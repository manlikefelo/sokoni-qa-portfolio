import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

const LINKS = [
  { href: '/admin', label: 'Overview', testId: 'admin-nav-overview' },
  { href: '/admin/products', label: 'Products', testId: 'admin-nav-products' },
  { href: '/admin/orders', label: 'Orders', testId: 'admin-nav-orders' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // A non-admin gets notFound() from here, so every page below inherits the gate.
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Admin" data-testid="admin-nav">
        <ul className="flex flex-wrap gap-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                data-testid={link.testId}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
