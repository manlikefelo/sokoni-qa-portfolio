'use client';

import { useState, useTransition } from 'react';
import {
  changePasswordAction,
  deleteAddressAction,
  saveAddressBookAction,
  setDefaultAddressAction,
} from '@/actions/account';
import { ErrorBanner, SuccessBanner } from './error-banner';

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

export function ChangePasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      setErrors(result.fieldErrors ?? {});
      setMessage({ ok: result.ok, text: result.message ?? '' });
    });
  };

  const fields = [
    { name: 'currentPassword', label: 'Current password', autoComplete: 'current-password' },
    { name: 'newPassword', label: 'New password', autoComplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm new password', autoComplete: 'new-password' },
  ];

  return (
    <form
      action={submit}
      data-testid="change-password-form"
      className="flex max-w-md flex-col gap-4"
    >
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="text-sm font-medium">
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            data-testid={`password-${field.name}`}
            type="password"
            autoComplete={field.autoComplete}
            required
            aria-invalid={errors[field.name] ? true : undefined}
            className={inputClass}
          />
          {errors[field.name] && (
            <p data-testid={`field-error-${field.name}`} className="mt-1 text-xs text-red-700">
              {errors[field.name]}
            </p>
          )}
        </div>
      ))}

      {message &&
        (message.ok ? (
          <SuccessBanner message={message.text} testId="password-success" />
        ) : (
          <ErrorBanner message={message.text} testId="password-error" />
        ))}

      <button
        type="submit"
        data-testid="password-submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 w-fit rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

export interface AddressRecord {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
  isDefault: boolean;
}

const ADDRESS_FIELDS = [
  { name: 'line1', label: 'Address line 1' },
  { name: 'line2', label: 'Address line 2 (optional)', optional: true },
  { name: 'city', label: 'Town or city' },
  { name: 'county', label: 'County' },
  { name: 'postalCode', label: 'Postal code' },
  { name: 'phone', label: 'Phone number' },
] as const;

export function AddressBook({ addresses }: { addresses: AddressRecord[] }) {
  const [editing, setEditing] = useState<AddressRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    action: (
      data: FormData,
    ) => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> }>,
    formData: FormData,
  ) => {
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const result = await action(formData);
      setErrors(result.fieldErrors ?? {});
      setMessage({ ok: result.ok, text: result.message ?? '' });
      if (result.ok) {
        setShowForm(false);
        setEditing(null);
      }
    });
  };

  const startEdit = (address: AddressRecord) => {
    setEditing(address);
    setShowForm(true);
    setErrors({});
    setMessage(null);
  };

  const startNew = () => {
    setEditing(null);
    setShowForm(true);
    setErrors({});
    setMessage(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {message &&
        (message.ok ? (
          <SuccessBanner message={message.text} testId="address-success" />
        ) : (
          <ErrorBanner message={message.text} testId="address-error" />
        ))}

      <ul data-testid="address-list" className="flex flex-col gap-3">
        {addresses.map((address) => (
          <li
            key={address.id}
            data-testid={`address-card-${address.id}`}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm"
          >
            <div>
              <p>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}
              </p>
              <p className="text-muted">
                {address.city}, {address.county} {address.postalCode}
              </p>
              <p className="text-muted">{address.phone}</p>
              {address.isDefault && (
                <p
                  data-testid={`address-default-badge-${address.id}`}
                  className="bg-brand-100 text-brand-700 mt-2 w-fit rounded px-2 py-0.5 text-xs font-semibold"
                >
                  Default
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid={`address-edit-${address.id}`}
                onClick={() => startEdit(address)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Edit
              </button>

              {!address.isDefault && (
                <button
                  type="button"
                  data-testid={`address-set-default-${address.id}`}
                  disabled={pending}
                  onClick={() => {
                    const formData = new FormData();
                    formData.set('addressId', address.id);
                    run(setDefaultAddressAction, formData);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Make default
                </button>
              )}

              <button
                type="button"
                data-testid={`address-delete-${address.id}`}
                disabled={pending}
                onClick={() => {
                  const formData = new FormData();
                  formData.set('addressId', address.id);
                  run(deleteAddressAction, formData);
                }}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}

        {addresses.length === 0 && (
          <li data-testid="address-empty" className="text-muted text-sm">
            No addresses saved yet.
          </li>
        )}
      </ul>

      {!showForm && (
        <button
          type="button"
          data-testid="address-add-btn"
          onClick={startNew}
          className="bg-brand-600 hover:bg-brand-700 w-fit rounded-md px-5 py-2.5 text-sm font-semibold text-white"
        >
          Add an address
        </button>
      )}

      {showForm && (
        <form
          key={editing?.id ?? 'new'}
          action={(formData) => run(saveAddressBookAction, formData)}
          data-testid="address-form"
          className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="text-lg font-bold">{editing ? 'Edit address' : 'New address'}</h2>
          {editing && <input type="hidden" name="addressId" value={editing.id} />}

          {ADDRESS_FIELDS.map((field) => (
            <div key={field.name}>
              <label htmlFor={`book-${field.name}`} className="text-sm font-medium">
                {field.label}
              </label>
              <input
                id={`book-${field.name}`}
                name={field.name}
                data-testid={`address-input-${field.name}`}
                defaultValue={editing ? (editing[field.name] ?? '') : ''}
                required={!('optional' in field && field.optional)}
                aria-invalid={errors[field.name] ? true : undefined}
                className={inputClass}
              />
              {errors[field.name] && (
                <p data-testid={`field-error-${field.name}`} className="mt-1 text-xs text-red-700">
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isDefault"
              value="true"
              data-testid="address-input-isDefault"
              defaultChecked={editing?.isDefault ?? addresses.length === 0}
            />
            Use as my default address
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              data-testid="address-save-btn"
              disabled={pending}
              className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save address'}
            </button>
            <button
              type="button"
              data-testid="address-cancel-btn"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
