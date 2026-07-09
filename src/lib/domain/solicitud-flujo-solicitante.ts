import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios, departamentos } from '@/lib/db/schema';
import {
  resolverFlujoAprobacionNuevaSolicitud,
  type FlujoAprobacionNuevaSolicitud,
} from '@/lib/domain/solicitud-flujo-aprobacion';
import { resolverAprobadorSegundoNivel } from '@/lib/domain/aprobadores';

export interface DatosFlujoSolicitante {
  esDirector: boolean;
  esJefe: boolean;
  esSecretarioGeneral: boolean;
  departamentoId: number | null;
  departamentoNombre: string | null;
}

export async function cargarDatosFlujoSolicitante(
  usuarioId: number
): Promise<DatosFlujoSolicitante | null> {
  const [usuario] = await db
    .select({
      esDirector: usuarios.esDirector,
      esJefe: usuarios.esJefe,
      esSecretarioGeneral: usuarios.esSecretarioGeneral,
      departamentoId: usuarios.departamentoId,
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
    esDirector: usuario.esDirector,
    esJefe: usuario.esJefe,
    esSecretarioGeneral: usuario.esSecretarioGeneral,
    departamentoId: usuario.departamentoId,
    departamentoNombre,
  };
}

/**
 * Resuelve el flujo completo para una solicitud nueva del usuario.
 * Para Jefe/Empleado evalúa también quién sería el aprobador de segundo
 * nivel (Director vs Secretario General) llamando al helper institucional.
 *
 * Si el resultado indica falta de Director + falta de Secretario General
 * configurado, devuelve un flujo "error" con `requiereAprobacionSecretarioGeneral = false`
 * y `mensajeFlujo` describiendo el problema; el llamador (crear solicitud)
 * debe convertir esto en 422 con el mensaje.
 */
export async function resolverFlujoSolicitante(
  datos: DatosFlujoSolicitante,
  tipo: string
): Promise<FlujoAprobacionNuevaSolicitud> {
  let aprobadorSegundoNivelTipo: 'director' | 'secretario_general' | null = null;
  let aprobadorSegundoNivelNombre: string | null = null;

  // Solo Jefes y Empleados pasan por aprobador de segundo nivel.
  // Directores van directo a RRHH (VoBo Ministro).
  if (!datos.esDirector) {
    try {
      const aprobador = await resolverAprobadorSegundoNivel({
        departamentoId: datos.departamentoId,
      });
      aprobadorSegundoNivelTipo = aprobador.tipoAprobador;
      aprobadorSegundoNivelNombre = aprobador.nombre ?? null;
    } catch (err) {
      // Sin Director y sin SG configurado: el flujo se reporta "roto"
      // para que el caller rechace la creación de la solicitud con 422.
      const mensajeError =
        err instanceof Error
          ? err.message
          : 'No hay aprobador de segundo nivel configurado.';
      return {
        requiereVoBoMinistro: false,
        requiereAprobacionJefe: !datos.esJefe,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretarioGeneral: false,
        pasaDirectoRrhh: false,
        mensajeFlujo: mensajeError,
        pasosProceso: ['No se puede crear la solicitud'],
        aprobadorSegundoNivelTipo: null,
        aprobadorSegundoNivelNombre: null,
      };
    }
  }

  return resolverFlujoAprobacionNuevaSolicitud({
    esDirector: datos.esDirector,
    esJefe: datos.esJefe,
    aprobadorSegundoNivelTipo,
    aprobadorSegundoNivelNombre,
    tipo,
  });
}