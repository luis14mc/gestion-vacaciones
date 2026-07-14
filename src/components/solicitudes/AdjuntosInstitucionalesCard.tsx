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
import { normalizarAdjuntosHistoricos } from '@/lib/domain/requisitos-adjuntos';
import { registrarVisualizacionAdjunto } from '@/lib/solicitudes/registrar-visualizacion-adjunto';

interface AdjuntosInstitucionalesCardProps {
  solicitudId: number;
  documentosAdjuntos: unknown;
  autorizado: boolean;
  className?: string;
}

export function AdjuntosInstitucionalesCard({
  solicitudId,
  documentosAdjuntos,
  autorizado,
  className,
}: AdjuntosInstitucionalesCardProps) {
  const adjuntos = normalizarAdjuntosHistoricos(documentosAdjuntos) as AdjuntoVisor[];

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
          adjuntos={adjuntos}
          onAdjuntoVisualizado={(_adj, idx) => {
            void registrarVisualizacionAdjunto(solicitudId, idx);
          }}
        />
      </CardContent>
    </Card>
  );
}
