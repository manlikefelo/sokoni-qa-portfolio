/**
 * The accounts the seed creates, and where their storageState is written by global
 * setup. Keeping these in one place means a spec never hard-codes a credential.
 */
export const USERS = {
  admin: {
    email: 'admin@sokoni.co.ke',
    password: 'AdminPass2026',
    name: 'Admin User',
    storageState: 'playwright/.auth/admin.json',
  },
  customer: {
    email: 'asha@example.com',
    password: 'Customer2026',
    name: 'Asha Mwangi',
    storageState: 'playwright/.auth/customer.json',
  },
  secondCustomer: {
    email: 'brian@example.com',
    password: 'Customer2026',
    name: 'Brian Otieno',
    storageState: 'playwright/.auth/second-customer.json',
  },
} as const;

export type UserRole = keyof typeof USERS;
