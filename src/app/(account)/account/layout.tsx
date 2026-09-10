import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

const LINKS = [
  { href: '/account', label: 'Profile', testId: 'account-nav-profile' },
  { href: '/account/orders', label: 'Orders', testId: 'account-nav-orders' },
  { href: '/account/addresses', label: 'Addresses', testId: 'account-nav-addresses' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <nav aria-label="Account" data-testid="account-nav">
        <ul className="flex flex-col gap-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                data-testid={link.testId}
                className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
}
