import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { AddressBook } from '@/components/account-forms';

export const metadata: Metadata = { title: 'Your addresses' };
export const dynamic = 'force-dynamic';

export default async function AddressesPage() {
  const session = await requireUser();
  const addresses = await db.address.findMany({
    where: { userId: session.id },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Your addresses</h1>
      <AddressBook
        addresses={addresses.map((address) => ({
          id: address.id,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          county: address.county,
          postalCode: address.postalCode,
          phone: address.phone,
          isDefault: address.isDefault,
        }))}
      />
    </section>
  );
}
