'use client';

import { useRouter } from 'next/navigation';
import FormularioSolicitud from '@/components/FormularioSolicitud';
import type { Session } from 'next-auth';

interface Props {
  session: Session;
}

export default function NuevaSolicitudClient({ session }: Props) {
  const router = useRouter();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Nueva Solicitud</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Completa el formulario para crear una nueva solicitud de ausencia
        </p>
      </div>

      <FormularioSolicitud
        usuarioId={Number(session.user.id)}
        esDirector={(session.user as any)?.esDirector}
        esJefe={(session.user as any)?.esJefe}
        onSuccess={() => {
          router.push('/solicitudes');
        }}
        onCancel={() => {
          router.back();
        }}
      />
    </div>
  );
}
