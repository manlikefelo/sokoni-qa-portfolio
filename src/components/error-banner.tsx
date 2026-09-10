export function ErrorBanner({
  message,
  testId = 'error-banner',
}: {
  message: string;
  testId?: string;
}) {
  return (
    <p
      role="alert"
      data-testid={testId}
      className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </p>
  );
}

export function SuccessBanner({
  message,
  testId = 'success-banner',
}: {
  message: string;
  testId?: string;
}) {
  return (
    <p
      role="status"
      data-testid={testId}
      className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
    >
      {message}
    </p>
  );
}
