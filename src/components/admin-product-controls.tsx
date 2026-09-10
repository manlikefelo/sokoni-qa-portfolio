'use client';

import { useState, useTransition } from 'react';
import {
  adjustStockAction,
  createProductAction,
  setProductActiveAction,
  updateProductAction,
} from '@/actions/admin';
import { ErrorBanner, SuccessBanner } from './error-banner';

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ProductFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  basePriceCents: number;
  imageUrl: string;
  isActive: boolean;
}

export function ProductForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: ProductFormValues;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial?.id);

  const submit = (formData: FormData) => {
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateProductAction(formData)
        : await createProductAction(formData);
      setErrors(result.fieldErrors ?? {});
      setMessage({ ok: result.ok, text: result.message ?? '' });
    });
  };

  return (
    <form action={submit} data-testid="admin-product-form" className="flex max-w-xl flex-col gap-4">
      {initial?.id && <input type="hidden" name="productId" value={initial.id} />}

      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Product name
        </label>
        <input
          id="name"
          name="name"
          data-testid="admin-product-name"
          defaultValue={initial?.name ?? ''}
          required
          className={inputClass}
        />
        {errors.name && (
          <p data-testid="field-error-name" className="mt-1 text-xs text-red-700">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="slug" className="text-sm font-medium">
          URL slug
        </label>
        <input
          id="slug"
          name="slug"
          data-testid="admin-product-slug"
          defaultValue={initial?.slug ?? ''}
          required
          className={inputClass}
        />
        {errors.slug && (
          <p data-testid="field-error-slug" className="mt-1 text-xs text-red-700">
            {errors.slug}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          data-testid="admin-product-description"
          defaultValue={initial?.description ?? ''}
          required
          rows={4}
          className={inputClass}
        />
        {errors.description && (
          <p data-testid="field-error-description" className="mt-1 text-xs text-red-700">
            {errors.description}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="categoryId" className="text-sm font-medium">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          data-testid="admin-product-category"
          defaultValue={initial?.categoryId ?? ''}
          required
          className={inputClass}
        >
          <option value="">Choose a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p data-testid="field-error-categoryId" className="mt-1 text-xs text-red-700">
            {errors.categoryId}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="basePriceCents" className="text-sm font-medium">
          Base price (cents)
        </label>
        <input
          id="basePriceCents"
          name="basePriceCents"
          data-testid="admin-product-price"
          type="number"
          min={1}
          defaultValue={initial?.basePriceCents ?? ''}
          required
          className={inputClass}
        />
        {errors.basePriceCents && (
          <p data-testid="field-error-basePriceCents" className="mt-1 text-xs text-red-700">
            {errors.basePriceCents}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="imageUrl" className="text-sm font-medium">
          Image path
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          data-testid="admin-product-image"
          defaultValue={initial?.imageUrl ?? '/products/placeholder.svg'}
          required
          className={inputClass}
        />
        {errors.imageUrl && (
          <p data-testid="field-error-imageUrl" className="mt-1 text-xs text-red-700">
            {errors.imageUrl}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          data-testid="admin-product-active"
          defaultChecked={initial?.isActive ?? true}
        />
        Visible in the storefront
      </label>

      {message &&
        (message.ok ? (
          <SuccessBanner message={message.text} testId="admin-product-success" />
        ) : (
          <ErrorBanner message={message.text} testId="admin-product-error" />
        ))}

      <button
        type="submit"
        data-testid="admin-product-save"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 w-fit rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
      </button>
    </form>
  );
}

export function StockAdjuster({
  variantId,
  sku,
  stockQty,
}: {
  variantId: string;
  sku: string;
  stockQty: number;
}) {
  const [value, setValue] = useState(stockQty);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await adjustStockAction(formData);
      setMessage({ ok: result.ok, text: result.message ?? '' });
    });
  };

  return (
    <form action={submit} className="flex items-center gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      <label className="sr-only" htmlFor={`stock-${sku}`}>
        Stock for {sku}
      </label>
      <input
        id={`stock-${sku}`}
        name="stockQty"
        data-testid={`admin-stock-input-${sku}`}
        type="number"
        min={0}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        data-testid={`admin-stock-save-${sku}`}
        disabled={pending}
        className="border-brand-600 text-brand-700 hover:bg-brand-50 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {message && (
        <span
          data-testid={`admin-stock-message-${sku}`}
          className={`text-xs ${message.ok ? 'text-green-700' : 'text-red-700'}`}
        >
          {message.text}
        </span>
      )}
    </form>
  );
}

export function ActiveToggle({
  productId,
  slug,
  isActive,
}: {
  productId: string;
  slug: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await setProductActiveAction(formData);
        });
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <button
        type="submit"
        data-testid={`admin-toggle-active-${slug}`}
        disabled={pending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
      >
        {isActive ? 'Deactivate' : 'Reactivate'}
      </button>
    </form>
  );
}
