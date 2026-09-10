import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ProductForm } from '@/components/admin-product-controls';

export const metadata: Metadata = { title: 'Edit product' };
export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ]);
  if (!product) notFound();

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Edit {product.name}</h1>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          categoryId: product.categoryId,
          basePriceCents: product.basePriceCents,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
        }}
      />
    </section>
  );
}
