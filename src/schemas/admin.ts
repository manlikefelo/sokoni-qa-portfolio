import { z } from 'zod';

const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug is required')
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase words separated by hyphens'),
  description: z.string().trim().min(10, 'Description is required').max(2000),
  categoryId: z.string().trim().min(1, 'Choose a category'),
  basePriceCents: z.coerce
    .number()
    .int()
    .min(1, 'Price must be greater than zero')
    .max(100_000_000),
  imageUrl: z.string().trim().min(1, 'Image path is required').max(300),
  isActive: z.coerce.boolean().optional().default(true),
});

export const stockAdjustmentSchema = z.object({
  variantId: z.string().trim().min(1).max(64),
  stockQty: z.coerce.number().int().min(0, 'Stock cannot be negative').max(100_000),
});

export const statusUpdateSchema = z.object({
  orderId: z.string().trim().min(1).max(64),
  status: orderStatusSchema,
});
