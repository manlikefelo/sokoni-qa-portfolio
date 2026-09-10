import Link from 'next/link';

const STEPS = [
  { key: 'address', label: 'Address', href: '/checkout/address' },
  { key: 'review', label: 'Review', href: '/checkout/review' },
  { key: 'payment', label: 'Payment', href: '/checkout/payment' },
] as const;

export type CheckoutStep = (typeof STEPS)[number]['key'];

export function CheckoutSteps({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="Checkout progress" data-testid="checkout-steps">
      <ol className="flex flex-wrap gap-3 text-sm">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li key={step.key} className="flex items-center gap-3">
              {isDone ? (
                <Link
                  href={step.href}
                  data-testid={`checkout-step-${step.key}`}
                  className="text-brand-600 font-medium hover:underline"
                >
                  {index + 1}. {step.label}
                </Link>
              ) : (
                <span
                  data-testid={`checkout-step-${step.key}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={isCurrent ? 'font-bold' : 'text-muted'}
                >
                  {index + 1}. {step.label}
                </span>
              )}
              {index < STEPS.length - 1 && <span aria-hidden="true">→</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
