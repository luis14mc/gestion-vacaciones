'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AdjuntosViewer,
  type AdjuntoVisor,
} from '@/components/solicitudes/AdjuntosViewer';
import { prepararAdjuntosVisor } from '@/lib/domain/requisitos-adjuntos';
import {
  puedeVerAdjuntosSolicitud,
  type SolicitudAdjuntosAcceso,
} from '@/lib/domain/solicitud-adjuntos-acceso';
import { registrarVisualizacionAdjunto } from '@/lib/solicitudes/registrar-visualizacion-adjunto';
import type { SessionUser } from '@/types';

interface AdjuntosInstitucionalesCardProps {
  solicitudId: number;
  documentosAdjuntos: unknown;
  /** Si se omite, usar session + accesoSolicitud. */
  autorizado?: boolean;
  session?: Pick<
    SessionUser,
    'id' | 'esAdmin' | 'esRrhh' | 'esJefe' | 'esDirector' | 'esSecretarioGeneral'
  > | null;
  accesoSolicitud?: SolicitudAdjuntosAcceso;
  className?: string;
}

export function AdjuntosInstitucionalesCard({
  solicitudId,
  documentosAdjuntos,
  autorizado: autorizadoProp,
  session,
  accesoSolicitud,
  className,
}: AdjuntosInstitucionalesCardProps) {
  const adjuntos = prepararAdjuntosVisor(documentosAdjuntos) as AdjuntoVisor[];

  const autorizado =
    autorizadoProp ??
    (session && accesoSolicitud
      ? puedeVerAdjuntosSolicitud(session, accesoSolicitud, documentosAdjuntos)
      : false);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Adjuntos institucionales</CardTitle>
        <CardDescription>
          Documentos de respaldo del VoBo y constancias asociadas a esta solicitud.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AdjuntosViewer
          autorizado={autorizado}
          solicitudId={solicitudId}
          adjuntos={adjuntos}
          onAdjuntoVisualizado={(_adj, idx) => {
            void registrarVisualizacionAdjunto(solicitudId, idx);
          }}
        />
      </CardContent>
    </Card>
  );
}
