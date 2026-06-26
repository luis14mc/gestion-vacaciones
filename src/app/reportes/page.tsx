import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import ReportesClient from './ReportesClient';
import { getSession } from '@/lib/auth';
import { puedeVerReportes } from '@/lib/domain/reportes/access';

export default async function ReportesPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const sessionUser = await getSession();
  if (!sessionUser || !puedeVerReportes(sessionUser)) {
    redirect('/dashboard');
  }

  return (
    <AppShell session={session}>
      <ReportesClient session={session} />
    </AppShell>
  );
}
