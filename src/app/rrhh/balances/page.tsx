import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AppShell from '@/components/layout/AppShell';
import BalanceVacacionesClient from './BalanceVacacionesClient';

export default async function ControlVacacionesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect('/dashboard');
  }

  return (
    <AppShell session={session}>
      <BalanceVacacionesClient />
    </AppShell>
  );
}
