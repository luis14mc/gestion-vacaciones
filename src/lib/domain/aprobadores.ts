/**
 * Resolución de aprobadores institucionales (Fase 2 — corrección).
 *
 * Reglas CNI:
 *   - Empleado normal (con jefe superior):
 *       pendiente_jefe → pendiente_rrhh → aprobada_rrhh.
 *       NO pasa por Director ni Secretaría General.
 *   - Jefe con Director superior (depto o jefeSuperiorId):
 *       pendiente_director → pendiente_rrhh.
 *   - Jefe sin Director:
 *       pendiente_secretario_general → pendiente_rrhh,
 *       aprobador = Director del departamento "Secretaría General".
 *   - Director: requiere VoBo Ministro; pasa directo a pendiente_rrhh.
 *
 * El aprobador sustituto NO es un rol/flag `esSecretarioGeneral`.
 * Se identifica como el Director (jefeId) del departamento
 * "Secretaría General" / "Secretaria General".
 */
import { db } from '@/lib/db';
import { usuarios, departamentos } from '@/lib/db/schema';
import { and, eq, ilike, isNull, or } from 'drizzle-orm';

export type TipoAprobadorSegundoNivel =
  | 'director'
  | 'director_secretaria_general';

export type MotivoAprobadorSegundoNivel =
  | 'director_asignado'
  | 'sin_director'
  | 'director_no_disponible';

export type AprobadorInicialTipo =
  | 'jefe'
  | 'director'
  | 'director_secretaria_general'
  | 'rrhh';

export interface AprobadorSegundoNivel {
  tipoAprobador: TipoAprobadorSegundoNivel;
  usuarioId: number;
  motivo: MotivoAprobadorSegundoNivel;
  /** Nombre humano (para mostrar en UI). Best-effort. */
  nombre?: string;
}

export interface UsuarioSolicitanteFlujo {
  id: number;
  esDirector: boolean;
  esJefe: boolean;
  departamentoId: number | null;
  jefeSuperiorId: number | null;
}

export interface FlujoAprobacionSolicitud {
  requiereAprobacionJefe: boolean;
  requiereAprobacionDirector: boolean;
  requiereAprobacionSecretariaGeneral: boolean;
  requiereVoBoMinistro: boolean;
  pasaDirectoRrhh: boolean;
  aprobadorInicialTipo: AprobadorInicialTipo;
  aprobadorInicialId: number | null;
  aprobadorInicialNombre: string | null;
  aprobadorSegundoNivelTipo: TipoAprobadorSegundoNivel | null;
  siguienteDespuesDeAprobacion: 'rrhh' | null;
  mensajeFlujo: string;
  pasosProceso: string[];
  /** Si true, no se puede crear la solicitud (falta aprobador). */
  errorFlujo: boolean;
}

export const ERROR_SIN_JEFE_SUPERIOR =
  'El empleado no tiene jefe superior asignado. Contacte a RRHH/Admin.';

export const ERROR_SIN_DIRECTOR_SECRETARIA_GENERAL =
  'No hay Director asignado al departamento Secretaría General para aprobación sustituta.';

const PASO_NOTIFICACION = 'Notificación al solicitante';

/**
 * Busca al Director de Área asociado al departamento del solicitante.
 * Usa la asignación `departamentos.jefeId` y el flag `esDirector`.
 * Devuelve null si no hay director activo disponible.
 */
export async function obtenerDirectorDeDepartamento(
  departamentoId: number | null | undefined
): Promise<{ id: number; nombre: string } | null> {
  if (!departamentoId) return null;

  // 1) Director del depto via departamentos.jefeId (preferente).
  const [depto] = await db
    .select({ jefeId: departamentos.jefeId })
    .from(departamentos)
    .where(and(eq(departamentos.id, departamentoId), isNull(departamentos.deletedAt)))
    .limit(1);

  if (depto?.jefeId) {
    const dir = await buscarUsuarioDirectorActivo(depto.jefeId);
    if (dir) return dir;
  }

  // 2) Fallback: cualquier usuario con esDirector=true en ese departamento.
  const [fallback] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, apellido: usuarios.apellido })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.departamentoId, departamentoId),
        eq(usuarios.esDirector, true),
        eq(usuarios.activo, true),
        isNull(usuarios.deletedAt)
      )
    )
    .limit(1);

  if (!fallback) return null;
  return { id: fallback.id, nombre: `${fallback.nombre} ${fallback.apellido}`.trim() };
}

async function buscarUsuarioDirectorActivo(
  usuarioId: number
): Promise<{ id: number; nombre: string } | null> {
  const [row] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      esDirector: usuarios.esDirector,
      activo: usuarios.activo,
      deletedAt: usuarios.deletedAt,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!row || !row.esDirector || !row.activo || row.deletedAt) return null;
  return { id: row.id, nombre: `${row.nombre} ${row.apellido}`.trim() };
}

async function buscarUsuarioActivo(
  usuarioId: number
): Promise<{ id: number; nombre: string } | null> {
  const [row] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      activo: usuarios.activo,
      deletedAt: usuarios.deletedAt,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!row || !row.activo || row.deletedAt) return null;
  return { id: row.id, nombre: `${row.nombre} ${row.apellido}`.trim() };
}

/**
 * Obtiene el Director del departamento "Secretaría General" / "Secretaria General".
 * Es el aprobador sustituto institucional cuando un depto no tiene Director.
 *
 * Lanza Error con mensaje controlado si el departamento no existe o no tiene
 * Director activo asignado.
 */
export async function obtenerDirectorSecretariaGeneral(): Promise<{
  id: number;
  nombre: string;
}> {
  const [depto] = await db
    .select({
      id: departamentos.id,
      jefeId: departamentos.jefeId,
      nombre: departamentos.nombre,
    })
    .from(departamentos)
    .where(
      and(
        isNull(departamentos.deletedAt),
        eq(departamentos.activo, true),
        or(
          ilike(departamentos.nombre, 'Secretaría General'),
          ilike(departamentos.nombre, 'Secretaria General')
        )
      )
    )
    .limit(1);

  if (!depto) {
    throw new Error(ERROR_SIN_DIRECTOR_SECRETARIA_GENERAL);
  }

  if (!depto.jefeId) {
    throw new Error(ERROR_SIN_DIRECTOR_SECRETARIA_GENERAL);
  }

  const director = await buscarUsuarioDirectorActivo(depto.jefeId);
  if (!director) {
    throw new Error(ERROR_SIN_DIRECTOR_SECRETARIA_GENERAL);
  }

  return director;
}

/**
 * Resuelve el jefe superior de un empleado normal.
 * Preferencia: `jefeSuperiorId` del usuario; fallback al `jefeId` del departamento.
 * No exige que el departamento tenga Director de Área.
 */
export async function obtenerJefeSuperiorEmpleado(params: {
  usuarioId: number;
  jefeSuperiorId: number | null | undefined;
  departamentoId: number | null | undefined;
}): Promise<{ id: number; nombre: string } | null> {
  if (params.jefeSuperiorId && params.jefeSuperiorId !== params.usuarioId) {
    const jefe = await buscarUsuarioActivo(params.jefeSuperiorId);
    if (jefe) return jefe;
  }

  if (!params.departamentoId) return null;

  const [depto] = await db
    .select({ jefeId: departamentos.jefeId })
    .from(departamentos)
    .where(
      and(eq(departamentos.id, params.departamentoId), isNull(departamentos.deletedAt))
    )
    .limit(1);

  if (!depto?.jefeId || depto.jefeId === params.usuarioId) return null;

  return buscarUsuarioActivo(depto.jefeId);
}

/**
 * Determina si un usuario está disponible para aprobar en una fecha dada.
 * Versión inicial: solo verifica activo/deletedAt.
 */
export async function estaUsuarioDisponible(
  usuarioId: number,
  _fechaInicio?: string | null,
  _fechaFin?: string | null
): Promise<boolean> {
  const [u] = await db
    .select({ activo: usuarios.activo, deletedAt: usuarios.deletedAt })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!u) return false;
  if (!u.activo) return false;
  if (u.deletedAt) return false;
  return true;
}

/**
 * Resuelve el Director superior de un Jefe:
 *   1. Si `jefeSuperiorId` apunta a un Director activo → ese.
 *   2. Si no, el Director del departamento del solicitante.
 */
export async function obtenerDirectorSuperiorJefe(params: {
  jefeSuperiorId: number | null | undefined;
  departamentoId: number | null | undefined;
}): Promise<{ id: number; nombre: string } | null> {
  if (params.jefeSuperiorId) {
    const superior = await buscarUsuarioDirectorActivo(params.jefeSuperiorId);
    if (superior) return superior;
  }
  return obtenerDirectorDeDepartamento(params.departamentoId);
}

/**
 * Resuelve quién es el aprobador de segundo nivel (Director o Director de
 * Secretaría General) para un Jefe. NO debe llamarse para empleados normales.
 *
 * Reglas:
 *   1. Si hay Director superior activo → tipo='director'.
 *   2. Si no → Director de Secretaría General →
 *      tipo='director_secretaria_general'.
 *      Si tampoco hay → lanza error controlado.
 */
export async function resolverAprobadorSegundoNivel(input: {
  departamentoId: number | null | undefined;
  jefeSuperiorId?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}): Promise<AprobadorSegundoNivel> {
  const director = await obtenerDirectorSuperiorJefe({
    jefeSuperiorId: input.jefeSuperiorId,
    departamentoId: input.departamentoId,
  });

  if (director) {
    const disponible = await estaUsuarioDisponible(
      director.id,
      input.fechaInicio,
      input.fechaFin
    );
    if (disponible) {
      return {
        tipoAprobador: 'director',
        usuarioId: director.id,
        motivo: 'director_asignado',
        nombre: director.nombre,
      };
    }
  }

  // Sin Director (o no disponible): cae a Director de Secretaría General.
  const dirSg = await obtenerDirectorSecretariaGeneral();
  return {
    tipoAprobador: 'director_secretaria_general',
    usuarioId: dirSg.id,
    motivo: director ? 'director_no_disponible' : 'sin_director',
    nombre: dirSg.nombre,
  };
}

/**
 * Función central: resuelve el flujo de aprobación completo para un
 * usuario solicitante según las reglas institucionales Fase 2.
 */
export async function resolverFlujoAprobacionSolicitud(
  usuarioSolicitante: UsuarioSolicitanteFlujo,
  tipo: string = 'vacaciones'
): Promise<FlujoAprobacionSolicitud> {
  const esCumpleanos = tipo === 'dia_cumpleanos';

  // D. Director → VoBo Ministro → RRHH (excepto tipos que no exigen VoBo).
  if (usuarioSolicitante.esDirector && !esCumpleanos && tipo !== 'licencia_medica') {
    return {
      requiereAprobacionJefe: false,
      requiereAprobacionDirector: false,
      requiereAprobacionSecretariaGeneral: false,
      requiereVoBoMinistro: true,
      pasaDirectoRrhh: true,
      aprobadorInicialTipo: 'rrhh',
      aprobadorInicialId: null,
      aprobadorInicialNombre: null,
      aprobadorSegundoNivelTipo: null,
      siguienteDespuesDeAprobacion: null,
      mensajeFlujo:
        'Como Director, debe adjuntar el VoBo del Ministro. La solicitud será revisada por Recursos Humanos.',
      pasosProceso: [
        'VoBo Ministro (mediante documento adjunto)',
        'Revisión y validación de Recursos Humanos',
        PASO_NOTIFICACION,
      ],
      errorFlujo: false,
    };
  }

  // Cumpleaños / licencia médica de Director: flujo de empleado (jefe → RRHH).
  if (usuarioSolicitante.esDirector && (esCumpleanos || tipo === 'licencia_medica')) {
    const jefe = await obtenerJefeSuperiorEmpleado({
      usuarioId: usuarioSolicitante.id,
      jefeSuperiorId: usuarioSolicitante.jefeSuperiorId,
      departamentoId: usuarioSolicitante.departamentoId,
    });
    if (!jefe) {
      return flujoError(ERROR_SIN_JEFE_SUPERIOR, {
        requiereAprobacionJefe: true,
      });
    }
    return flujoEmpleadoConJefe(jefe, esCumpleanos);
  }

  // B / C. Jefe (no Director).
  if (usuarioSolicitante.esJefe) {
    try {
      const aprobador = await resolverAprobadorSegundoNivel({
        departamentoId: usuarioSolicitante.departamentoId,
        jefeSuperiorId: usuarioSolicitante.jefeSuperiorId,
      });

      if (aprobador.tipoAprobador === 'director') {
        return {
          requiereAprobacionJefe: false,
          requiereAprobacionDirector: true,
          requiereAprobacionSecretariaGeneral: false,
          requiereVoBoMinistro: false,
          pasaDirectoRrhh: false,
          aprobadorInicialTipo: 'director',
          aprobadorInicialId: aprobador.usuarioId,
          aprobadorInicialNombre: aprobador.nombre ?? null,
          aprobadorSegundoNivelTipo: 'director',
          siguienteDespuesDeAprobacion: 'rrhh',
          mensajeFlujo:
            'Su solicitud será revisada por su Director y luego pasará a Recursos Humanos.',
          pasosProceso: [
            'Aprobación de Director de Área',
            'Revisión y aprobación de Recursos Humanos',
            PASO_NOTIFICACION,
          ],
          errorFlujo: false,
        };
      }

      return {
        requiereAprobacionJefe: false,
        requiereAprobacionDirector: false,
        requiereAprobacionSecretariaGeneral: true,
        requiereVoBoMinistro: false,
        pasaDirectoRrhh: false,
        aprobadorInicialTipo: 'director_secretaria_general',
        aprobadorInicialId: aprobador.usuarioId,
        aprobadorInicialNombre: aprobador.nombre ?? null,
        aprobadorSegundoNivelTipo: 'director_secretaria_general',
        siguienteDespuesDeAprobacion: 'rrhh',
        mensajeFlujo:
          'Su departamento no tiene Director asignado. Su solicitud será revisada por el Director de Secretaría General y luego pasará a Recursos Humanos.',
        pasosProceso: [
          'Aprobación del Director de Secretaría General (aprobador sustituto)',
          'Revisión y aprobación de Recursos Humanos',
          PASO_NOTIFICACION,
        ],
        errorFlujo: false,
      };
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : ERROR_SIN_DIRECTOR_SECRETARIA_GENERAL;
      return flujoError(mensaje, {
        requiereAprobacionDirector: false,
        requiereAprobacionSecretariaGeneral: true,
      });
    }
  }

  // A. Empleado normal: requiere jefe superior; NO busca Director/SG.
  const jefe = await obtenerJefeSuperiorEmpleado({
    usuarioId: usuarioSolicitante.id,
    jefeSuperiorId: usuarioSolicitante.jefeSuperiorId,
    departamentoId: usuarioSolicitante.departamentoId,
  });
  if (!jefe) {
    return flujoError(ERROR_SIN_JEFE_SUPERIOR, {
      requiereAprobacionJefe: true,
    });
  }

  return flujoEmpleadoConJefe(jefe, esCumpleanos);
}

function flujoEmpleadoConJefe(
  jefe: { id: number; nombre: string },
  esCumpleanos: boolean
): FlujoAprobacionSolicitud {
  return {
    requiereAprobacionJefe: true,
    requiereAprobacionDirector: false,
    requiereAprobacionSecretariaGeneral: false,
    requiereVoBoMinistro: false,
    pasaDirectoRrhh: false,
    aprobadorInicialTipo: 'jefe',
    aprobadorInicialId: jefe.id,
    aprobadorInicialNombre: jefe.nombre,
    aprobadorSegundoNivelTipo: null,
    siguienteDespuesDeAprobacion: 'rrhh',
    mensajeFlujo: esCumpleanos
      ? 'Su día libre por cumpleaños será revisado por su jefe y luego por Recursos Humanos.'
      : 'Su solicitud será revisada por su jefe superior y luego pasará a Recursos Humanos.',
    pasosProceso: [
      esCumpleanos
        ? 'Aprobación de Jefe Inmediato / Director de Área'
        : 'Aprobación de Jefe Inmediato',
      'Revisión y aprobación de Recursos Humanos',
      PASO_NOTIFICACION,
    ],
    errorFlujo: false,
  };
}

function flujoError(
  mensaje: string,
  flags: Partial<
    Pick<
      FlujoAprobacionSolicitud,
      | 'requiereAprobacionJefe'
      | 'requiereAprobacionDirector'
      | 'requiereAprobacionSecretariaGeneral'
    >
  >
): FlujoAprobacionSolicitud {
  return {
    requiereAprobacionJefe: flags.requiereAprobacionJefe ?? false,
    requiereAprobacionDirector: flags.requiereAprobacionDirector ?? false,
    requiereAprobacionSecretariaGeneral:
      flags.requiereAprobacionSecretariaGeneral ?? false,
    requiereVoBoMinistro: false,
    pasaDirectoRrhh: false,
    aprobadorInicialTipo: 'rrhh',
    aprobadorInicialId: null,
    aprobadorInicialNombre: null,
    aprobadorSegundoNivelTipo: null,
    siguienteDespuesDeAprobacion: null,
    mensajeFlujo: mensaje,
    pasosProceso: ['No se puede crear la solicitud'],
    errorFlujo: true,
  };
}
