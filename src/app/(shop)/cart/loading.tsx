export default function Loading() {
  return (
    <div data-testid="route-loading" role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading your cart</span>
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}
