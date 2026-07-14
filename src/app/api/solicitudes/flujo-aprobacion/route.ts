import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import {
  cargarDatosFlujoSolicitante,
  resolverFlujoSolicitante,
} from '@/lib/domain/solicitud-flujo-solicitante';
import { resolverRequisitosAdjuntosSolicitud } from '@/lib/domain/requisitos-adjuntos';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  const tipo = request.nextUrl.searchParams.get('tipo') ?? 'vacaciones';
  const duracionPermiso =
    request.nextUrl.searchParams.get('duracionPermiso') ?? undefined;

  const datosSolicitante = await cargarDatosFlujoSolicitante(session.id);
  if (!datosSolicitante) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
  }

  try {
    const flujo = await resolverFlujoSolicitante(datosSolicitante, tipo);

    if (flujo.errorFlujo) {
      return NextResponse.json(
        {
          success: false,
          error: flujo.mensajeFlujo,
          data: {
            ...flujo,
            requiereVoBo: false,
            tipoVoBoRequerido: null,
            etiquetaVoBo: null,
            requiereConstanciaMedica: false,
            adjuntosRequeridos: [],
          },
        },
        { status: 400 }
      );
    }

    const requisitos = resolverRequisitosAdjuntosSolicitud({
      usuarioSolicitante: {
        esDirector: datosSolicitante.esDirector,
        esJefe: datosSolicitante.esJefe,
      },
      tipoSolicitud: tipo,
      duracionPermiso,
      flujoAprobacion: {
        requiereVoBoMinistro: flujo.requiereVoBoMinistro,
        aprobadorSegundoNivelTipo: flujo.aprobadorSegundoNivelTipo ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...flujo,
        requiereVoBo: requisitos.requiereVoBo,
        tipoVoBoRequerido: requisitos.tipoVoBoRequerido,
        etiquetaVoBo: requisitos.etiquetaVoBo,
        requiereConstanciaMedica: requisitos.requiereConstanciaMedica,
        adjuntosRequeridos: requisitos.adjuntosRequeridos,
      },
    });
  } catch (err) {
    const mensajeError =
      err instanceof Error
        ? err.message
        : 'No se pudo resolver el flujo de aprobación.';
    return NextResponse.json(
      {
        success: false,
        error: mensajeError,
      },
      { status: 400 }
    );
  }
});
