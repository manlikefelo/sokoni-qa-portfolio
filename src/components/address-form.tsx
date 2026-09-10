'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveAddressAction } from '@/actions/checkout';
import { ErrorBanner } from './error-banner';

export interface SavedAddress {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
  isDefault: boolean;
}

interface FieldSpec {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  optional?: boolean;
}

const FIELDS: FieldSpec[] = [
  { name: 'line1', label: 'Address line 1', autoComplete: 'address-line1' },
  {
    name: 'line2',
    label: 'Address line 2 (optional)',
    autoComplete: 'address-line2',
    optional: true,
  },
  { name: 'city', label: 'Town or city', autoComplete: 'address-level2' },
  { name: 'county', label: 'County', autoComplete: 'address-level1' },
  { name: 'postalCode', label: 'Postal code', autoComplete: 'postal-code' },
  { name: 'phone', label: 'Phone number', type: 'tel', autoComplete: 'tel' },
];

export function AddressForm({
  isGuest,
  savedAddresses,
}: {
  isGuest: boolean;
  savedAddresses: SavedAddress[];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [useNew, setUseNew] = useState(savedAddresses.length === 0);
  const [selectedId, setSelectedId] = useState(
    savedAddresses.find((address) => address.isDefault)?.id ?? savedAddresses[0]?.id ?? '',
  );
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    if (!useNew && selectedId) {
      formData.set('addressId', selectedId);
    } else {
      formData.delete('addressId');
    }

    startTransition(async () => {
      const result = await saveAddressAction(formData);
      if (result.ok) {
        router.push('/checkout/review');
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.message ?? 'Could not save that address.');
    });
  };

  const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

  return (
    <form action={submit} data-testid="address-form" className="flex max-w-xl flex-col gap-5">
      {savedAddresses.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold">Deliver to</legend>
          {savedAddresses.map((address) => (
            <label
              key={address.id}
              className="flex items-start gap-3 rounded-md border border-slate-300 p-3 text-sm"
            >
              <input
                type="radio"
                name="savedAddress"
                data-testid={`saved-address-${address.id}`}
                checked={!useNew && selectedId === address.id}
                onChange={() => {
                  setUseNew(false);
                  setSelectedId(address.id);
                }}
                className="mt-1"
              />
              <span>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.county}{' '}
                {address.postalCode}
                <br />
                {address.phone}
              </span>
            </label>
          ))}

          <label className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              name="savedAddress"
              data-testid="use-new-address"
              checked={useNew}
              onChange={() => setUseNew(true)}
            />
            Use a different address
          </label>
        </fieldset>
      )}

      {(useNew || savedAddresses.length === 0) && (
        <div className="flex flex-col gap-4">
          {isGuest && (
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                name="email"
                data-testid="address-email"
                type="email"
                autoComplete="email"
                required
                aria-describedby={errors.email ? 'error-email' : undefined}
                aria-invalid={errors.email ? true : undefined}
                className={inputClass}
              />
              {errors.email && (
                <p
                  id="error-email"
                  data-testid="field-error-email"
                  className="mt-1 text-xs text-red-700"
                >
                  {errors.email}
                </p>
              )}
            </div>
          )}

          {FIELDS.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="text-sm font-medium">
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                data-testid={`address-${field.name}`}
                type={field.type ?? 'text'}
                autoComplete={field.autoComplete}
                required={!field.optional}
                aria-describedby={errors[field.name] ? `error-${field.name}` : undefined}
                aria-invalid={errors[field.name] ? true : undefined}
                className={inputClass}
              />
              {errors[field.name] && (
                <p
                  id={`error-${field.name}`}
                  data-testid={`field-error-${field.name}`}
                  className="mt-1 text-xs text-red-700"
                >
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {formError && <ErrorBanner message={formError} />}

      <button
        type="submit"
        data-testid="address-continue-btn"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 w-fit rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Continue to review'}
      </button>
    </form>
  );
}
