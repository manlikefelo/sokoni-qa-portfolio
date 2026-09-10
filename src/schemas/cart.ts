import { z } from 'zod';

export const MAX_LINE_QUANTITY = 99;

const quantity = z.coerce
  .number({ error: 'Quantity must be a number' })
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(MAX_LINE_QUANTITY, `Quantity may not exceed ${MAX_LINE_QUANTITY}`);

export const addToCartSchema = z.object({
  variantId: z.string().trim().min(1).max(64),
  quantity,
});

export const updateQuantitySchema = z.object({
  variantId: z.string().trim().min(1).max(64),
  quantity,
});

export const removeItemSchema = z.object({
  variantId: z.string().trim().min(1).max(64),
});

export const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter a promo code')
    .max(32, 'Promo code is too long')
    .transform((value) => value.toUpperCase()),
});
