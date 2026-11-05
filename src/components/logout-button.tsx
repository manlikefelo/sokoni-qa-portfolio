import { logoutAction } from '@/actions/auth';

export function LogoutButton({ testId = 'logout-btn' }: { testId?: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        data-testid={testId}
        className="hover:text-brand-600 text-sm font-medium text-slate-700"
      >
        Sign out
      </button>
    </form>
  );
}
