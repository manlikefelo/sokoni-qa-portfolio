import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { getCart, cartItemCount } from '@/lib/cart';
import { MobileNav } from './mobile-nav';
import { LogoutButton } from './logout-button';

export async function SiteHeader() {
  const [user, cart] = await Promise.all([getSessionUser(), getCart()]);
  const count = cartItemCount(cart);

  const links = [
    { href: '/', label: 'Home', testId: 'nav-home' },
    { href: '/products', label: 'Shop', testId: 'nav-products' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
        <Link
          href="/"
          data-testid="nav-logo"
          className="text-brand-700 text-xl font-bold tracking-tight"
        >
          Sokoni
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-5">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  data-testid={link.testId}
                  className="hover:text-brand-600 text-sm font-medium text-slate-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {user?.role === 'ADMIN' && (
              <li>
                <Link
                  href="/admin"
                  data-testid="nav-admin"
                  className="hover:text-brand-600 text-sm font-medium text-slate-700"
                >
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/cart"
            data-testid="nav-cart"
            className="hover:text-brand-600 relative text-sm font-medium text-slate-700"
          >
            Cart
            <span
              data-testid="cart-count"
              className="bg-brand-600 ml-1 inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold text-white"
            >
              {count}
            </span>
          </Link>

          {user ? (
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/account"
                data-testid="nav-account"
                className="hover:text-brand-600 text-sm font-medium text-slate-700"
              >
                Account
              </Link>
              <LogoutButton />
            </div>
          ) : (
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/login"
                data-testid="nav-login"
                className="hover:text-brand-600 text-sm font-medium text-slate-700"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                data-testid="nav-register"
                className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-semibold text-white"
              >
                Register
              </Link>
            </div>
          )}

          <MobileNav isAuthenticated={Boolean(user)} isAdmin={user?.role === 'ADMIN'} />
        </div>
      </div>
    </header>
  );
}
