/**
 * MaintenanceGate (Server Component)
 * ---------------------------------
 * Aplica el modo mantenimiento (Configuración → General → app.mantenimiento).
 * Cuando está activo, bloquea la UI para todos salvo administradores,
 * mostrando un aviso. El login sigue accesible para que un admin pueda
 * entrar y desactivarlo.
 *
 * Se ejecuta en runtime Node (puede leer BD), a diferencia del middleware
 * que corre en Edge. El pathname llega vía la cabecera x-pathname que
 * inyecta el middleware.
 */
import { headers } from 'next/headers';
import { obtenerConfig, asBool } from '@/lib/config/service';
import { getSession } from '@/lib/auth';

export default async function MaintenanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get('x-pathname') ?? '';

  // El login y las rutas de auth nunca se bloquean (vía de escape del admin).
  const esRutaLibre =
    pathname.startsWith('/login') || pathname.startsWith('/api/auth');

  if (!esRutaLibre) {
    const mantenimiento = asBool(await obtenerConfig('app.mantenimiento'));
    if (mantenimiento) {
      const session = await getSession();
      if (!session?.esAdmin) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
            <div className="rounded-full bg-yellow-100 p-4">
              <span className="text-4xl" role="img" aria-label="mantenimiento">
                🛠️
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              Sistema en mantenimiento
            </h1>
            <p className="max-w-md text-gray-600">
              Estamos realizando tareas de mantenimiento. Por favor, vuelva a
              intentarlo en unos minutos. Disculpe las molestias.
            </p>
          </div>
        );
      }
    }
  }

  return <>{children}</>;
}
