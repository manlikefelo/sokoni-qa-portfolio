'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary. The message shown is always generic: a stack trace
 * or a database error string must never reach the browser.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error', error.digest ?? error.message);
  }, [error]);

  return (
    <div
      role="alert"
      data-testid="route-error"
      className="rounded-lg border border-red-300 bg-red-50 p-6"
    >
      <h1 className="text-xl font-bold text-red-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-red-900">
        We could not load this page. Try again, and if it keeps happening come back shortly.
      </p>
      <button
        type="button"
        onClick={reset}
        data-testid="route-error-retry"
        className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
      >
        Try again
      </button>
    </div>
  );
}
