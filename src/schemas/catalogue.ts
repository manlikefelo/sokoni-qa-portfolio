import { z } from 'zod';

export const SORT_OPTIONS = ['newest', 'price-asc', 'price-desc', 'name-asc'] as const;
export const PAGE_SIZE = 12;

/**
 * Catalogue state lives entirely in the query string so a filtered view is
 * shareable and survives a reload. Unparseable values fall back to defaults
 * rather than erroring: a hand-edited URL should not produce a 500.
 */
export const catalogueQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(SORT_OPTIONS).catch('newest'),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;
