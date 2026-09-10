import { redirect } from 'next/navigation';

/** /checkout is an alias for the first step rather than a page of its own. */
export default function CheckoutIndexPage() {
  redirect('/checkout/address');
}
