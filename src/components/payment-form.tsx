'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { placeOrderAction } from '@/actions/checkout';
import { formatMoney } from '@/lib/money';
import { ErrorBanner } from './error-banner';

/**
 * The idempotency key is generated once per mounted form and reused on retry, so a
 * double-click or a refreshed submission cannot produce two orders for one payment.
 */
export function PaymentForm({ totalCents }: { totalCents: number }) {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    formData.set('idempotencyKey', idempotencyKey.current);
    setFormError(null);
    setErrors({});

    startTransition(async () => {
      const result = await placeOrderAction(formData);
      if (result.ok && result.orderNumber) {
        router.push(`/checkout/confirmation/${result.orderNumber}`);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.message ?? 'That payment could not be completed.');
    });
  };

  const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

  return (
    <form action={submit} data-testid="payment-form" className="flex max-w-md flex-col gap-5">
      <div>
        <label htmlFor="cardNumber" className="text-sm font-medium">
          Card number
        </label>
        <input
          id="cardNumber"
          name="cardNumber"
          data-testid="card-number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          required
          aria-invalid={errors.cardNumber ? true : undefined}
          className={inputClass}
        />
        {errors.cardNumber && (
          <p data-testid="field-error-cardNumber" className="mt-1 text-xs text-red-700">
            {errors.cardNumber}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="expiry" className="text-sm font-medium">
            Expiry (MM/YY)
          </label>
          <input
            id="expiry"
            name="expiry"
            data-testid="card-expiry"
            autoComplete="cc-exp"
            placeholder="12/28"
            required
            aria-invalid={errors.expiry ? true : undefined}
            className={inputClass}
          />
          {errors.expiry && (
            <p data-testid="field-error-expiry" className="mt-1 text-xs text-red-700">
              {errors.expiry}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cvc" className="text-sm font-medium">
            CVC
          </label>
          <input
            id="cvc"
            name="cvc"
            data-testid="card-cvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            required
            aria-invalid={errors.cvc ? true : undefined}
            className={inputClass}
          />
          {errors.cvc && (
            <p data-testid="field-error-cvc" className="mt-1 text-xs text-red-700">
              {errors.cvc}
            </p>
          )}
        </div>
      </div>

      {formError && <ErrorBanner message={formError} testId="payment-error" />}

      <button
        type="submit"
        data-testid="pay-now-btn"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Processing payment…' : `Pay ${formatMoney(totalCents)}`}
      </button>

      <p className="text-muted text-xs">
        This is a demonstration gateway. No real card is charged and no card number is stored.
      </p>
    </form>
  );
}
