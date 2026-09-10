import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth';
import { RegisterForm } from '@/components/auth-forms';

export const metadata: Metadata = { title: 'Create an account' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  if (await getSessionUser()) redirect('/account');

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-2xl font-bold">Create an account</h1>
      <RegisterForm />
    </section>
  );
}
