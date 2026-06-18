import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import CambiarPasswordForm from './CambiarPasswordForm';

export const dynamic = 'force-dynamic';

export default async function CambiarPasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <CambiarPasswordForm forzado={!!session.debeCambiarPassword} />;
}
