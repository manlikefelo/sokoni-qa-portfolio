'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Navigation for viewports below the md breakpoint. The panel is toggled with the
 * hidden attribute rather than conditional rendering so the links keep stable DOM
 * identity across opens.
 */
export function MobileNav({
  isAuthenticated,
  isAdmin,
}: {
  isAuthenticated: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        data-testid="mobile-nav-toggle"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
      >
        Menu
      </button>

      <div
        id="mobile-nav-panel"
        data-testid="mobile-nav-panel"
        hidden={!open}
        className="absolute right-0 left-0 z-20 border-b border-slate-200 bg-white px-4 py-4 shadow-lg"
      >
        <ul className="flex flex-col gap-3">
          <li>
            <Link href="/products" data-testid="mobile-nav-products" onClick={() => setOpen(false)}>
              Shop
            </Link>
          </li>
          <li>
            <Link href="/cart" data-testid="mobile-nav-cart" onClick={() => setOpen(false)}>
              Cart
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link href="/admin" data-testid="mobile-nav-admin" onClick={() => setOpen(false)}>
                Admin
              </Link>
            </li>
          )}
          {isAuthenticated ? (
            <li>
              <Link href="/account" data-testid="mobile-nav-account" onClick={() => setOpen(false)}>
                Account
              </Link>
            </li>
          ) : (
            <>
              <li>
                <Link href="/login" data-testid="mobile-nav-login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  data-testid="mobile-nav-register"
                  onClick={() => setOpen(false)}
                >
                  Register
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
