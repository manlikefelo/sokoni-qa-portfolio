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
    conditions.push({ variants: { some: { priceCents: { lt: query.maxPrice } } } });
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

/**
 * Narrows a set of products to those whose name or description contains the search
 * term. Applied in application code because the search term is matched against the
 * product copy rather than a dedicated index.
 */
function matchesSearch(product: ProductListItem, term: string): boolean {
  return product.name.includes(term) || product.description.includes(term);
}

export async function findProducts(query: CatalogueQuery): Promise<CatalogueResult> {
  const where = buildWhere(query);

  // With a search term the filtered set has to be assembled before it can be
  // counted and paged, since the match is not expressible in the query itself.
  if (query.q) {
    const term = query.q;
    const candidates = await db.product.findMany({
      where,
      include: listInclude,
      orderBy: buildOrderBy(query.sort),
    });

    const matched = candidates.filter((product) => matchesSearch(product, term));
    const totalCount = matched.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const page = Math.min(query.page, pageCount);

    return {
      products: matched.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
      totalCount,
      pageCount,
      page,
    };
  }

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
