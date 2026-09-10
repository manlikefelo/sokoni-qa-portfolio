import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ChangePasswordForm } from '@/components/account-forms';

export const metadata: Metadata = { title: 'Your profile' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium">Name:</dt>
            <dd data-testid="profile-name">{user.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Email:</dt>
            <dd data-testid="profile-email">{user.email}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h2 className="text-lg font-bold">Change your password</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>
    </section>
  );
}
