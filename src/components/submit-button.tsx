'use client';

import { useFormStatus } from 'react-dom';

/**
 * Submit control that disables itself while its form action is in flight. Gives
 * every mutation a loading state and prevents double submission.
 */
export function SubmitButton({
  children,
  testId,
  pendingLabel = 'Working…',
  className = 'rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60',
  disabled = false,
}: {
  children: React.ReactNode;
  testId: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" data-testid={testId} disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
