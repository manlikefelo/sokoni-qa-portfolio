'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getAdminOrNull } from '@/lib/admin';
import { productFormSchema, stockAdjustmentSchema, statusUpdateSchema } from '@/schemas/admin';

export interface AdminResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Every admin action re-checks the role from the session. The navigation hides
 * these controls from ordinary users, but hiding a control is not a security
 * boundary: a non-admin invoking the action directly gets the same answer as one
 * hitting a route they may not see.
 */
const NOT_FOUND: AdminResult = { ok: false, message: 'Not found.' };

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export async function createProductAction(formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return NOT_FOUND;

  const parsed = productFormSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const clash = await db.product.findUnique({ where: { slug: parsed.data.slug } });
  if (clash) {
    return {
      ok: false,
      message: 'That slug is already taken.',
      fieldErrors: { slug: 'That slug is already taken.' },
    };
  }

  const category = await db.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) {
    return {
      ok: false,
      message: 'Choose a valid category.',
      fieldErrors: { categoryId: 'Choose a valid category.' },
    };
  }

  await db.product.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      searchText: `${parsed.data.name} ${parsed.data.description}`.toLowerCase(),
      categoryId: parsed.data.categoryId,
      basePriceCents: parsed.data.basePriceCents,
      imageUrl: parsed.data.imageUrl,
      isActive: parsed.data.isActive,
      // A product needs at least one purchasable variant to be any use.
      variants: {
        create: {
          name: 'Standard',
          sku: `ADM-${parsed.data.slug.toUpperCase().slice(0, 20)}`,
          priceCents: parsed.data.basePriceCents,
          stockQty: 0,
        },
      },
    },
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  return { ok: true, message: 'Product created.' };
}

export async function updateProductAction(formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return NOT_FOUND;

  const productId = formData.get('productId');
  if (typeof productId !== 'string' || productId.length === 0) return NOT_FOUND;

  const parsed = productFormSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const existing = await db.product.findUnique({ where: { id: productId } });
  if (!existing) return NOT_FOUND;

  const clash = await db.product.findFirst({
    where: { slug: parsed.data.slug, id: { not: productId } },
  });
  if (clash) {
    return {
      ok: false,
      message: 'That slug is already taken.',
      fieldErrors: { slug: 'That slug is already taken.' },
    };
  }

  await db.product.update({
    where: { id: productId },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      searchText: `${parsed.data.name} ${parsed.data.description}`.toLowerCase(),
      categoryId: parsed.data.categoryId,
      basePriceCents: parsed.data.basePriceCents,
      imageUrl: parsed.data.imageUrl,
      isActive: parsed.data.isActive,
    },
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${parsed.data.slug}`);
  return { ok: true, message: 'Product updated.' };
}

export async function setProductActiveAction(formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return NOT_FOUND;

  const productId = formData.get('productId');
  const isActive = formData.get('isActive') === 'true';
  if (typeof productId !== 'string' || productId.length === 0) return NOT_FOUND;

  const existing = await db.product.findUnique({ where: { id: productId } });
  if (!existing) return NOT_FOUND;

  await db.product.update({ where: { id: productId }, data: { isActive } });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  return { ok: true, message: isActive ? 'Product reactivated.' : 'Product deactivated.' };
}

export async function adjustStockAction(formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return NOT_FOUND;

  const parsed = stockAdjustmentSchema.safeParse({
    variantId: formData.get('variantId'),
    stockQty: formData.get('stockQty'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid stock value.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const variant = await db.variant.findUnique({
    where: { id: parsed.data.variantId },
    include: { product: true },
  });
  if (!variant) return NOT_FOUND;

  await db.variant.update({
    where: { id: variant.id },
    data: { stockQty: parsed.data.stockQty },
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${variant.product.slug}`);
  return { ok: true, message: 'Stock updated.' };
}

export async function updateOrderStatusAction(formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return NOT_FOUND;

  const parsed = statusUpdateSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'That status is not recognised.' };
  }

  const order = await db.order.findUnique({ where: { id: parsed.data.orderId } });
  if (!order) return NOT_FOUND;

  await db.order.update({
    where: { id: order.id },
    data: { status: parsed.data.status },
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${order.id}`);
  return { ok: true, message: `Order is now ${parsed.data.status}.` };
}
