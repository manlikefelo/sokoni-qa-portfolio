'use client';

import { useState, useTransition } from 'react';
import type { OrderStatus } from '@prisma/client';
import { updateOrderStatusAction } from '@/actions/admin';
import { ErrorBanner, SuccessBanner } from './error-banner';

/**
 * Only the transitions legal from the current status are offered. The server
 * re-checks the state machine regardless, so this list is a convenience rather
 * than the enforcement point.
 */
export function StatusControl({
  orderId,
  currentStatus,
  allowedTargets,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  allowedTargets: readonly OrderStatus[];
}) {
  const [target, setTarget] = useState<string>(allowedTargets[0] ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (allowedTargets.length === 0) {
    return (
      <p data-testid="status-terminal" className="text-muted text-sm">
        {currentStatus} is a final status. No further changes are possible.
      </p>
    );
  }

  const submit = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction(formData);
      setMessage({ ok: result.ok, text: result.message ?? '' });
    });
  };

  return (
    <form action={submit} data-testid="status-form" className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex items-end gap-2">
        <div>
          <label
            htmlFor="status"
            className="text-muted block text-xs font-semibold tracking-wide uppercase"
          >
            Move to
          </label>
          <select
            id="status"
            name="status"
            data-testid="status-select"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {allowedTargets.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          data-testid="status-submit"
          disabled={pending}
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Updating…' : 'Update status'}
        </button>
      </div>

      {message &&
        (message.ok ? (
          <SuccessBanner message={message.text} testId="status-success" />
        ) : (
          <ErrorBanner message={message.text} testId="status-error" />
        ))}
    </form>
  );
}
