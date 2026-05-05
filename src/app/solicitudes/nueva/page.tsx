import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AppShell from '@/components/layout/AppShell';
import NuevaSolicitudClient from './NuevaSolicitudClient';

export default async function NuevaSolicitudPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <NuevaSolicitudClient session={session} />
    </AppShell>
  );
}
