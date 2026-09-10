'use client';

import { useState, useTransition } from 'react';
import { applyPromoAction, removePromoAction } from '@/actions/cart';
import { ErrorBanner, SuccessBanner } from './error-banner';

export function PromoForm({ appliedCode }: { appliedCode: string | null }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (formData: FormData) => {
    startTransition(async () => {
      const response = await applyPromoAction(formData);
      setResult({ ok: response.ok, message: response.message ?? '' });
    });
  };

  const clear = () => {
    startTransition(async () => {
      await removePromoAction();
      setResult(null);
    });
  };

  if (appliedCode) {
    return (
      <div data-testid="promo-applied" className="flex flex-col gap-2">
        <p className="text-sm">
          Promo code <span className="font-semibold">{appliedCode}</span> is applied.
        </p>
        <button
          type="button"
          data-testid="promo-remove-btn"
          onClick={clear}
          disabled={pending}
          className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Remove code
        </button>
        {result && result.ok && <SuccessBanner message={result.message} testId="promo-success" />}
      </div>
    );
  }

  return (
    <form action={apply} className="flex flex-col gap-2">
      <label
        htmlFor="promo-input"
        className="text-muted text-xs font-semibold tracking-wide uppercase"
      >
        Promo code
      </label>
      <div className="flex gap-2">
        <input
          id="promo-input"
          name="code"
          data-testid="promo-input"
          type="text"
          autoComplete="off"
          placeholder="e.g. SAVE10"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase"
        />
        <button
          type="submit"
          data-testid="promo-apply-btn"
          disabled={pending}
          className="border-brand-600 text-brand-700 hover:bg-brand-50 rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? 'Applying…' : 'Apply'}
        </button>
      </div>
      {result &&
        (result.ok ? (
          <SuccessBanner message={result.message} testId="promo-success" />
        ) : (
          <ErrorBanner message={result.message} testId="promo-error" />
        ))}
    </form>
  );
}
