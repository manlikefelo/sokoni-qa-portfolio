import { logoutAction } from '@/actions/auth';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        data-testid="logout-btn"
        className="hover:text-brand-600 text-sm font-medium text-slate-700"
      >
        Sign out
      </button>
    </form>
  );
}
