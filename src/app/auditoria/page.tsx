import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AppShell from '@/components/layout/AppShell';
import AuditoriaClient from './AuditoriaClient';
import { getSession } from '@/lib/auth';
import { puedeVerAuditoria } from '@/lib/domain/auditoria/access';

/** Auditoría global: solo ADMIN (RRHH no tiene acceso institucional por política CNI). */
export default async function AuditoriaPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const sessionUser = await getSession();
  if (!sessionUser || !puedeVerAuditoria(sessionUser)) {
    redirect('/dashboard');
  }

  return (
    <AppShell session={session}>
      <AuditoriaClient session={session} />
    </AppShell>
  );
}
