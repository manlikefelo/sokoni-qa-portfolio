import { z } from 'zod';

/**
 * The card number is validated for shape only. It is never logged, never
 * persisted, and never echoed back in a response.
 */
export const mockPaymentSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{12,19}$/, 'Enter a valid card number')),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be in MM/YY format'),
  cvc: z
    .string()
    .trim()
    .regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits'),
  amountCents: z.number().int().min(1).max(1_000_000_000),
  idempotencyKey: z.string().trim().min(8).max(64),
});

export type MockPaymentInput = z.infer<typeof mockPaymentSchema>;
