/**
 * PasswordChangeGate (Server Component)
 * -------------------------------------
 * Si el usuario autenticado tiene la marca debeCambiarPassword (p.ej. fue
 * creado por carga masiva con contraseña temporal), lo obliga a cambiarla
 * antes de usar el sistema, redirigiendo a /cambiar-password.
 *
 * Lee la sesión FRESCA desde BD (getSession), por lo que al cambiar la
 * contraseña y limpiar la marca, el siguiente request pasa sin problema
 * (no depende del JWT que quedaria obsoleto).
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function PasswordChangeGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get('x-pathname') ?? '';

  const rutaLibre =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/cambiar-password');

  if (!rutaLibre) {
    const session = await getSession();
    if (session?.debeCambiarPassword) {
      redirect('/cambiar-password');
    }
  }

  return <>{children}</>;
}
