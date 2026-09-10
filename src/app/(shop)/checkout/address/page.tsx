import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getCart } from '@/lib/cart';
import { AddressForm } from '@/components/address-form';
import { CheckoutSteps } from '@/components/checkout-steps';

export const metadata: Metadata = { title: 'Delivery address' };
export const dynamic = 'force-dynamic';

export default async function CheckoutAddressPage() {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect('/cart');

  const user = await getSessionUser();
  const savedAddresses = user
    ? await db.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
      })
    : [];

  return (
    <section className="flex flex-col gap-6">
      <CheckoutSteps current="address" />
      <h1 className="text-2xl font-bold">Where should we deliver?</h1>
      <AddressForm
        isGuest={!user}
        savedAddresses={savedAddresses.map((address) => ({
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
