import type { Prisma } from '@prisma/client';
import { db } from './db';
import { PAGE_SIZE, type CatalogueQuery } from '@/schemas/catalogue';

const listInclude = {
  category: true,
  variants: { orderBy: { priceCents: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductListItem = Prisma.ProductGetPayload<{ include: typeof listInclude }>;

export interface CatalogueResult {
  products: ProductListItem[];
  totalCount: number;
  pageCount: number;
  page: number;
}

/** Normalises the category param, which arrives as a string or a repeated key. */
export function toCategoryList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function buildWhere(query: CatalogueQuery): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [{ isActive: true }];

  if (query.q) {
    // searchText holds a lowercased copy of the name and description, so a
    // lowercased needle gives case-insensitive partial matching on SQLite.
    conditions.push({ searchText: { contains: query.q.toLowerCase() } });
  }

  const categories = toCategoryList(query.category);
  if (categories.length > 0) {
    conditions.push({ category: { slug: { in: categories } } });
  }

  // Price bounds are inclusive on both ends and are applied against variant
  // prices, since that is the figure the catalogue card displays.
  if (query.minPrice !== undefined) {
    conditions.push({ variants: { some: { priceCents: { gte: query.minPrice } } } });
  }
  if (query.maxPrice !== undefined) {
    conditions.push({ variants: { some: { priceCents: { lte: query.maxPrice } } } });
  }

  if (query.inStock === 'true') {
    conditions.push({ variants: { some: { stockQty: { gt: 0 } } } });
  }

  return { AND: conditions };
}

function buildOrderBy(sort: CatalogueQuery['sort']): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price-asc':
      return [{ basePriceCents: 'asc' }, { id: 'asc' }];
    case 'price-desc':
      return [{ basePriceCents: 'desc' }, { id: 'asc' }];
    case 'name-asc':
      return [{ name: 'asc' }, { id: 'asc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}

export async function findProducts(query: CatalogueQuery): Promise<CatalogueResult> {
  const where = buildWhere(query);
  const totalCount = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);

  const products = await db.product.findMany({
    where,
    include: listInclude,
    orderBy: buildOrderBy(query.sort),
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { products, totalCount, pageCount, page };
}

export async function findCategories() {
  return db.category.findMany({ orderBy: { name: 'asc' } });
}

export function lowestVariantPrice(product: ProductListItem): number {
  return product.variants.reduce(
    (lowest, variant) => Math.min(lowest, variant.priceCents),
    product.basePriceCents,
  );
}

export function isOutOfStock(product: ProductListItem): boolean {
  return product.variants.every((variant) => variant.stockQty === 0);
}

export async function findProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, isActive: true },
    include: { category: true, variants: { orderBy: { priceCents: 'asc' } } },
  });
}
