'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { removeItemAction, updateQuantityAction } from '@/actions/cart';
import { formatMoney } from '@/lib/money';
import { ErrorBanner } from './error-banner';

export interface CartLineData {
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  imageUrl: string;
  unitPriceCents: number;
  quantity: number;
  stockQty: number;
}

export function CartLine({ line }: { line: CartLineData }) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const commit = (next: number) => {
    setQuantity(next);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('variantId', line.variantId);
      formData.set('quantity', String(next));
      const result = await updateQuantityAction(formData);
      if (!result.ok) {
        setError(result.message ?? 'Could not update that quantity.');
        setQuantity(line.quantity);
      }
    });
  };

  const remove = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('variantId', line.variantId);
      await removeItemAction(formData);
    });
  };

  return (
    <li
      data-testid={`cart-line-${line.variantId}`}
      className="flex flex-col gap-3 border-b border-slate-200 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-5"
    >
      <Image
        src={line.imageUrl}
        alt=""
        width={80}
        height={80}
        className="size-20 shrink-0 rounded-md border border-slate-200 object-cover"
      />

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">
          <Link href={`/products/${line.productSlug}`} className="hover:text-brand-600">
            {line.productName}
          </Link>
        </h3>
        <p data-testid={`cart-variant-${line.variantId}`} className="text-muted text-xs">
          {line.variantName}
        </p>
        <p data-testid={`cart-unit-price-${line.variantId}`} className="mt-1 text-sm">
          {formatMoney(line.unitPriceCents)} each
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`qty-input-${line.variantId}`}>
          Quantity for {line.productName}, {line.variantName}
        </label>
        <input
          id={`qty-input-${line.variantId}`}
          data-testid={`qty-input-${line.variantId}`}
          type="number"
          min={1}
          max={Math.max(1, line.stockQty)}
          value={quantity}
          disabled={pending}
          onChange={(event) => setQuantity(Number(event.target.value))}
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (next !== line.quantity) commit(next);
          }}
          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          data-testid={`cart-remove-${line.variantId}`}
          onClick={remove}
          disabled={pending}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      <p
        data-testid={`cart-line-total-${line.variantId}`}
        className="text-sm font-bold sm:w-32 sm:text-right"
      >
        {formatMoney(line.unitPriceCents * line.quantity)}
      </p>

      {error && (
        <div className="sm:col-span-full sm:basis-full">
          <ErrorBanner message={error} testId={`cart-error-${line.variantId}`} />
        </div>
      )}
    </li>
  );
}
