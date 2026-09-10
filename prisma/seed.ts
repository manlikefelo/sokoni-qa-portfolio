/**
 * Deterministic seed. Running it twice from scratch produces byte-identical data
 * apart from cuids and timestamps, which no test asserts on.
 *
 * Product createdAt values are spaced one hour apart in catalogue order so the
 * "newest" sort has a stable, unambiguous answer rather than depending on how fast
 * the inserts happen to run.
 */
import { PrismaClient, type DiscountType } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { CATEGORIES, PRODUCTS } from './seed-data';

const prisma = new PrismaClient();

const ARGON_OPTIONS = { memoryCost: 19_456, timeCost: 2, outputLen: 32, parallelism: 1 } as const;

/** Fixed epoch so "newest" ordering is reproducible across machines. */
const BASE_TIME = new Date('2026-01-05T08:00:00.000Z').getTime();
const HOUR_MS = 60 * 60 * 1000;

function endOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 0),
  );
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * HOUR_MS);
}

interface SeedPromo {
  code: string;
  type: DiscountType;
  value: number;
  minSpendCents: number;
  expiresAt: Date;
  maxUses: number | null;
  isActive: boolean;
}

const PROMO_CODES: SeedPromo[] = [
  {
    code: 'SAVE10',
    type: 'PERCENTAGE',
    value: 10,
    minSpendCents: 0,
    expiresAt: daysFromNow(30),
    maxUses: null,
    isActive: true,
  },
  {
    code: 'SAVE25',
    type: 'PERCENTAGE',
    value: 25,
    minSpendCents: 300_000,
    expiresAt: daysFromNow(30),
    maxUses: null,
    isActive: true,
  },
  {
    code: 'FLAT500',
    type: 'FIXED',
    value: 50_000,
    minSpendCents: 200_000,
    expiresAt: daysFromNow(30),
    maxUses: null,
    isActive: true,
  },
  {
    code: 'EXPIRED20',
    type: 'PERCENTAGE',
    value: 20,
    minSpendCents: 0,
    expiresAt: daysFromNow(-1),
    maxUses: null,
    isActive: true,
  },
  {
    code: 'ENDSTODAY',
    type: 'PERCENTAGE',
    value: 15,
    minSpendCents: 0,
    expiresAt: endOfTodayUtc(),
    maxUses: null,
    isActive: true,
  },
  {
    code: 'ONESHOT',
    type: 'FIXED',
    value: 100_000,
    minSpendCents: 0,
    expiresAt: daysFromNow(30),
    maxUses: 1,
    isActive: true,
  },
  {
    code: 'DEAD5',
    type: 'PERCENTAGE',
    value: 5,
    minSpendCents: 0,
    expiresAt: daysFromNow(30),
    maxUses: null,
    isActive: false,
  },
];

const USERS = [
  { email: 'admin@sokoni.co.ke', name: 'Admin User', password: 'AdminPass2026', role: 'ADMIN' },
  { email: 'asha@example.com', name: 'Asha Mwangi', password: 'Customer2026', role: 'CUSTOMER' },
  { email: 'brian@example.com', name: 'Brian Otieno', password: 'Customer2026', role: 'CUSTOMER' },
] as const;

async function main() {
  // Child rows first so foreign keys never dangle mid-wipe.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.address.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.user.deleteMany();

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({ data: category });
    categoryIds.set(category.slug, created.id);
  }

  for (const [index, product] of PRODUCTS.entries()) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Unknown category slug: ${product.category}`);

    await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        searchText: `${product.name} ${product.description}`.toLowerCase(),
        categoryId,
        basePriceCents: product.basePriceCents,
        imageUrl: `/products/${product.slug}.svg`,
        isActive: true,
        createdAt: new Date(BASE_TIME + index * HOUR_MS),
        variants: { create: product.variants },
      },
    });
  }

  await prisma.promoCode.createMany({ data: PROMO_CODES });

  for (const user of USERS) {
    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: await hash(user.password, ARGON_OPTIONS),
      },
    });
  }

  // A default address on the first customer so checkout has something to select
  // without the test having to create one first.
  const asha = await prisma.user.findUniqueOrThrow({ where: { email: 'asha@example.com' } });
  await prisma.address.create({
    data: {
      userId: asha.id,
      line1: 'Jacaranda Apartments, Block C',
      line2: 'Apartment 4B',
      city: 'Nairobi',
      county: 'Nairobi',
      postalCode: '00100',
      phone: '0712345678',
      isDefault: true,
    },
  });

  const variantCount = await prisma.variant.count();
  const outOfStock = await prisma.variant.count({ where: { stockQty: 0 } });
  const lastUnit = await prisma.variant.count({ where: { stockQty: 1 } });

  console.log('Seed complete.');
  console.log(`  categories:  ${CATEGORIES.length}`);
  console.log(`  products:    ${PRODUCTS.length}`);
  console.log(`  variants:    ${variantCount} (${outOfStock} at zero stock, ${lastUnit} at one)`);
  console.log(`  promo codes: ${PROMO_CODES.length}`);
  console.log(`  users:       ${USERS.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
