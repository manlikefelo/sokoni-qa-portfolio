import { PrismaClient, type Prisma } from '@prisma/client';

/**
 * Direct database access for test setup and for asserting on state the UI does not
 * show — stock levels, promo usage counters, order rows.
 *
 * One client is shared across a worker. Playwright runs workers as separate
 * processes, so each gets its own connection.
 */
export const testDb = new PrismaClient();

export interface SeedCounts {
  products: number;
  variants: number;
  zeroStockVariants: number;
  singleStockVariants: number;
}

/** The figures the seed is expected to produce. Asserted by the smoke spec. */
export const EXPECTED_SEED: SeedCounts = {
  products: 25,
  variants: 47,
  zeroStockVariants: 7,
  singleStockVariants: 7,
};

export async function countSeed(): Promise<SeedCounts> {
  const [products, variants, zeroStockVariants, singleStockVariants] = await Promise.all([
    testDb.product.count(),
    testDb.variant.count(),
    testDb.variant.count({ where: { stockQty: 0 } }),
    testDb.variant.count({ where: { stockQty: 1 } }),
  ]);
  return { products, variants, zeroStockVariants, singleStockVariants };
}

export function variantBySku(sku: string) {
  return testDb.variant.findUniqueOrThrow({
    where: { sku },
    include: { product: true },
  });
}

export function stockOf(sku: string): Promise<number> {
  return variantBySku(sku).then((variant) => variant.stockQty);
}

/**
 * Puts a variant's stock back to a known figure. Specs that consume stock call this
 * in a finally block so they leave the shared catalogue as they found it.
 */
export async function setStock(sku: string, stockQty: number): Promise<void> {
  await testDb.variant.update({ where: { sku }, data: { stockQty } });
}

export async function promoByCode(code: string) {
  return testDb.promoCode.findUniqueOrThrow({ where: { code } });
}

export async function resetPromoUsage(code: string, usedCount = 0): Promise<void> {
  await testDb.promoCode.update({ where: { code }, data: { usedCount } });
}

/**
 * Creates a product owned by one spec file, tagged with a unique prefix.
 *
 * Specs that need to assert on a whole result set — sorting, filter boundaries,
 * pagination arithmetic — read the shared seed, because those assertions are about
 * the 25-product dataset the PRD specifies. Specs that mutate data create their own
 * instead, so they cannot disturb the shared set or each other. The trade-off is
 * discussed in docs/TEST_STRATEGY.md.
 */
export async function createScopedProduct(options: {
  prefix: string;
  name: string;
  priceCents: number;
  stockQty: number;
  description?: string;
  categorySlug?: string;
}) {
  const category = await testDb.category.findFirstOrThrow({
    where: options.categorySlug ? { slug: options.categorySlug } : {},
  });

  const slug = `${options.prefix}-${options.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const description = options.description ?? `Fixture product for ${options.prefix}.`;

  return testDb.product.create({
    data: {
      name: options.name,
      slug,
      description,
      searchText: `${options.name} ${description}`.toLowerCase(),
      categoryId: category.id,
      basePriceCents: options.priceCents,
      imageUrl: '/products/leather-bifold-wallet.svg',
      isActive: true,
      variants: {
        create: {
          name: 'Standard',
          sku: `${options.prefix.toUpperCase()}-STD`,
          priceCents: options.priceCents,
          stockQty: options.stockQty,
        },
      },
    },
    include: { variants: true },
  });
}

/** Removes everything a spec created under its prefix. */
export async function cleanupScopedData(prefix: string): Promise<void> {
  const products = await testDb.product.findMany({
    where: { slug: { startsWith: prefix } },
    include: { variants: true },
  });
  const variantIds = products.flatMap((product) => product.variants.map((v) => v.id));

  if (variantIds.length > 0) {
    await testDb.orderItem.deleteMany({ where: { variantId: { in: variantIds } } });
    await testDb.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
  }
  await testDb.product.deleteMany({ where: { slug: { startsWith: prefix } } });
}

/** Removes orders a spec created, identified by their idempotency key prefix. */
export async function cleanupScopedOrders(keyPrefix: string): Promise<void> {
  const orders = await testDb.order.findMany({
    where: { idempotencyKey: { startsWith: keyPrefix } },
    select: { id: true },
  });
  if (orders.length === 0) return;

  const orderIds = orders.map((order) => order.id);
  await testDb.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await testDb.order.deleteMany({ where: { id: { in: orderIds } } });
}

/** Empties a user's cart so a cart spec starts from a known state. */
export async function clearUserCart(email: string): Promise<void> {
  const user = await testDb.user.findUnique({ where: { email }, include: { cart: true } });
  if (user?.cart) {
    await testDb.cartItem.deleteMany({ where: { cartId: user.cart.id } });
  }
}

export async function seedUserCart(
  email: string,
  items: Array<{ sku: string; quantity: number }>,
): Promise<void> {
  const user = await testDb.user.findUniqueOrThrow({ where: { email } });
  const cart =
    (await testDb.cart.findUnique({ where: { userId: user.id } })) ??
    (await testDb.cart.create({ data: { userId: user.id } }));

  for (const item of items) {
    const variant = await testDb.variant.findUniqueOrThrow({ where: { sku: item.sku } });
    await testDb.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      create: { cartId: cart.id, variantId: variant.id, quantity: item.quantity },
      update: { quantity: item.quantity },
    });
  }
}

export async function createOrderFor(options: {
  email: string;
  idempotencyKey: string;
  orderNumber: string;
  status?: Prisma.OrderCreateInput['status'];
  sku?: string;
}) {
  const user = await testDb.user.findUniqueOrThrow({ where: { email: options.email } });
  const variant = await testDb.variant.findUniqueOrThrow({
    where: { sku: options.sku ?? 'FASH-WALL-BRN' },
    include: { product: true },
  });

  const lineTotal = variant.priceCents;
  return testDb.order.create({
    data: {
      orderNumber: options.orderNumber,
      userId: user.id,
      status: options.status ?? 'PAID',
      subtotalCents: lineTotal,
      discountCents: 0,
      shippingCents: 35_000,
      totalCents: lineTotal + 35_000,
      shippingAddress: JSON.stringify({
        line1: 'Fixture House',
        city: 'Nairobi',
        county: 'Nairobi',
        postalCode: '00100',
        phone: '0712345678',
      }),
      idempotencyKey: options.idempotencyKey,
      items: {
        create: {
          variantId: variant.id,
          productName: variant.product.name,
          variantName: variant.name,
          unitPriceCents: variant.priceCents,
          quantity: 1,
          lineTotalCents: lineTotal,
        },
      },
    },
  });
}
