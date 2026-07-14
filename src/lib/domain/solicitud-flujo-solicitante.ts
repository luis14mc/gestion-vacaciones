import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios, departamentos } from '@/lib/db/schema';
import type { FlujoAprobacionNuevaSolicitud } from '@/lib/domain/solicitud-flujo-aprobacion';
import {
  resolverFlujoAprobacionSolicitud,
  type FlujoAprobacionSolicitud,
} from '@/lib/domain/aprobadores';

export interface DatosFlujoSolicitante {
  id: number;
  esDirector: boolean;
  esJefe: boolean;
  departamentoId: number | null;
  departamentoNombre: string | null;
  jefeSuperiorId: number | null;
}

export async function cargarDatosFlujoSolicitante(
  usuarioId: number
): Promise<DatosFlujoSolicitante | null> {
  const [usuario] = await db
    .select({
      id: usuarios.id,
      esDirector: usuarios.esDirector,
      esJefe: usuarios.esJefe,
      departamentoId: usuarios.departamentoId,
      jefeSuperiorId: usuarios.jefeSuperiorId,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!usuario) {
    return null;
  }

  let departamentoNombre: string | null = null;
  if (usuario.departamentoId) {
    const [departamento] = await db
      .select({ nombre: departamentos.nombre })
      .from(departamentos)
      .where(eq(departamentos.id, usuario.departamentoId))
      .limit(1);
    departamentoNombre = departamento?.nombre ?? null;
  }

  return {
    id: usuario.id,
    esDirector: usuario.esDirector,
    esJefe: usuario.esJefe,
    departamentoId: usuario.departamentoId,
    departamentoNombre,
    jefeSuperiorId: usuario.jefeSuperiorId,
  };
}

function aFlujoUi(flujo: FlujoAprobacionSolicitud): FlujoAprobacionNuevaSolicitud {
  return {
    requiereVoBoMinistro: flujo.requiereVoBoMinistro,
    requiereAprobacionJefe: flujo.requiereAprobacionJefe,
    requiereAprobacionDirector: flujo.requiereAprobacionDirector,
    requiereAprobacionSecretariaGeneral: flujo.requiereAprobacionSecretariaGeneral,
    // Alias legacy para consumidores que aún lean el nombre anterior.
    requiereAprobacionSecretarioGeneral: flujo.requiereAprobacionSecretariaGeneral,
    pasaDirectoRrhh: flujo.pasaDirectoRrhh,
    mensajeFlujo: flujo.mensajeFlujo,
    pasosProceso: flujo.pasosProceso,
    aprobadorInicialTipo: flujo.aprobadorInicialTipo,
    siguienteDespuesDeAprobacion: flujo.siguienteDespuesDeAprobacion,
    aprobadorSegundoNivelTipo: flujo.aprobadorSegundoNivelTipo,
    aprobadorSegundoNivelNombre: flujo.aprobadorInicialNombre,
    aprobadorInicialId: flujo.aprobadorInicialId,
    errorFlujo: flujo.errorFlujo,
  };
}

/**
 * Resuelve el flujo completo para una solicitud nueva del usuario.
 * Delega en `resolverFlujoAprobacionSolicitud` (fuente canónica).
 *
 * Si falta jefe (empleado) o Director de Secretaría General (jefe sin
 * Director), `errorFlujo=true` y `mensajeFlujo` describe el problema;
 * el llamador debe responder 400.
 */
export async function resolverFlujoSolicitante(
  datos: DatosFlujoSolicitante,
  tipo: string
): Promise<FlujoAprobacionNuevaSolicitud> {
  const flujo = await resolverFlujoAprobacionSolicitud(
    {
      id: datos.id,
      esDirector: datos.esDirector,
      esJefe: datos.esJefe,
      departamentoId: datos.departamentoId,
      jefeSuperiorId: datos.jefeSuperiorId,
    },
    tipo
  );
  return aFlujoUi(flujo);
}
