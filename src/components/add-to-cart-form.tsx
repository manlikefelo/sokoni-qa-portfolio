'use client';

import { useState, useTransition } from 'react';
import { addToCartAction } from '@/actions/cart';
import { formatMoney } from '@/lib/money';
import { ErrorBanner, SuccessBanner } from './error-banner';

export interface VariantOption {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  stockQty: number;
}

/**
 * Variant selection, quantity and add-to-cart. The quantity ceiling follows the
 * selected variant's stock, but the server action re-checks it: the input bound is
 * a convenience, not the control.
 */
export function AddToCartForm({ variants }: { variants: VariantOption[] }) {
  const [selectedId, setSelectedId] = useState(
    variants.find((variant) => variant.stockQty > 0)?.id ?? variants[0]?.id ?? '',
  );
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];
  if (!selected) return null;

  const soldOut = selected.stockQty === 0;

  const onSelect = (id: string) => {
    setSelectedId(id);
    setQuantity(1);
    setResult(null);
  };

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const response = await addToCartAction(formData);
      setResult({ ok: response.ok, message: response.message ?? 'Added to your cart.' });
    });
  };

  return (
    <form action={submit} className="flex flex-col gap-4" data-testid="add-to-cart-form">
      <input type="hidden" name="variantId" value={selected.id} />

      {variants.length > 1 && (
        <fieldset>
          <legend className="text-muted text-xs font-semibold tracking-wide uppercase">
            Choose an option
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((variant) => (
              <label
                key={variant.id}
                data-testid={`variant-option-${variant.sku}`}
                className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                  variant.id === selected.id
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                    : 'border-slate-300 hover:border-slate-400'
                } ${variant.stockQty === 0 ? 'text-slate-400 line-through' : ''}`}
              >
                <input
                  type="radio"
                  name="variantChoice"
                  className="sr-only"
                  value={variant.id}
                  checked={variant.id === selected.id}
                  onChange={() => onSelect(variant.id)}
                />
                {variant.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-2xl font-bold" data-testid="product-price">
        {formatMoney(selected.priceCents)}
      </p>

      <p data-testid="stock-indicator" className="text-sm">
        {soldOut ? (
          <span className="font-semibold text-red-700">Out of stock</span>
        ) : selected.stockQty <= 3 ? (
          <span className="font-semibold text-amber-700">
            Only {selected.stockQty} left in stock
          </span>
        ) : (
          <span className="text-green-700">In stock ({selected.stockQty} available)</span>
        )}
      </p>

      <div className="flex items-end gap-3">
        <div>
          <label
            htmlFor="quantity"
            className="text-muted block text-xs font-semibold tracking-wide uppercase"
          >
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            data-testid="quantity-input"
            type="number"
            min={1}
            max={Math.max(1, selected.stockQty)}
            value={quantity}
            disabled={soldOut}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          data-testid="add-to-cart-btn"
          disabled={soldOut || pending}
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Adding…' : soldOut ? 'Out of stock' : 'Add to cart'}
        </button>
      </div>

      {result &&
        (result.ok ? (
          <SuccessBanner message={result.message} testId="add-to-cart-success" />
        ) : (
          <ErrorBanner message={result.message} />
        ))}
    </form>
  );
}
