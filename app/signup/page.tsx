import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import SignUpForm from './sign-up-form';

export default async function SignUpPage() {
  if (await getSession()) redirect('/approvals');
  return <SignUpForm />;
}
