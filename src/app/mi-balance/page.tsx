import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import MiBalanceClient from './MiBalanceClient';

export default async function MiBalancePage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <MiBalanceClient />
    </AppShell>
  );
}
