'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { loginAction, registerAction } from '@/actions/account';
import { ErrorBanner, SuccessBanner } from './error-banner';

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

export function LoginForm({ redirectTo = '/account' }: { redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result.ok) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      setError(result.message ?? 'Those credentials are not valid.');
    });
  };

  return (
    <form action={submit} data-testid="login-form" className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          data-testid="login-email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          data-testid="login-password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      {error && <ErrorBanner message={error} testId="login-error" />}

      <button
        type="submit"
        data-testid="login-submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-muted text-sm">
        No account yet?{' '}
        <Link
          href="/register"
          data-testid="login-register-link"
          className="text-brand-600 hover:underline"
        >
          Register
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const result = await registerAction(formData);
      setErrors(result.fieldErrors ?? {});
      setMessage({ ok: result.ok, text: result.message ?? '' });
    });
  };

  const fields = [
    { name: 'name', label: 'Full name', type: 'text', autoComplete: 'name' },
    { name: 'email', label: 'Email address', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  ];

  return (
    <form action={submit} data-testid="register-form" className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="text-sm font-medium">
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            data-testid={`register-${field.name}`}
            type={field.type}
            autoComplete={field.autoComplete}
            required
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

      <p className="text-muted text-xs">At least 10 characters, including a letter and a digit.</p>

      {message &&
        (message.ok ? (
          <SuccessBanner message={message.text} testId="register-success" />
        ) : (
          <ErrorBanner message={message.text} testId="register-error" />
        ))}

      <button
        type="submit"
        data-testid="register-submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-muted text-sm">
        Already registered?{' '}
        <Link
          href="/login"
          data-testid="register-login-link"
          className="text-brand-600 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
