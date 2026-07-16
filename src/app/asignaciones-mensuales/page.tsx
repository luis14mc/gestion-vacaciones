import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AppShell from '@/components/layout/AppShell';
import AsignacionesMensualesClient from './AsignacionesMensualesClient';

export default async function AsignacionesMensualesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.esAdmin && !session.user.esRrhh) {
    redirect('/mi-balance');
  }

  return (
    <AppShell session={session}>
      <AsignacionesMensualesClient session={session} />
    </AppShell>
  );
}
