import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import SignInForm from './sign-in-form';

export default async function LoginPage() {
  if (await getSession()) redirect('/approvals');
  return <SignInForm />;
}
