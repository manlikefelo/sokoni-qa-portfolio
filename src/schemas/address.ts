import { z } from 'zod';

const line = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const addressSchema = z.object({
  line1: line('Address line 1'),
  line2: z.string().trim().max(120, 'Address line 2 is too long').optional().or(z.literal('')),
  city: line('City', 80),
  county: line('County', 80),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Postal code is required')
    .max(12, 'Postal code is too long')
    .regex(/^[A-Za-z0-9 -]+$/, 'Postal code contains invalid characters'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^(?:\+254|0)[17]\d{8}$/, 'Enter a Kenyan phone number, e.g. 0712345678'),
  isDefault: z.coerce.boolean().optional().default(false),
});

export const guestCheckoutSchema = addressSchema.extend({
  email: z.string().trim().email('Enter a valid email address').max(254),
});

export type AddressInput = z.infer<typeof addressSchema>;
