import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ProductForm } from '@/components/admin-product-controls';

export const metadata: Metadata = { title: 'New product' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const categories = await db.category.findMany({ orderBy: { name: 'asc' } });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New product</h1>
      <ProductForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </section>
  );
}
