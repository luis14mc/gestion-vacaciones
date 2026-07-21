/**
 * ============================================================
 * SOLICITUDES SERVICE - CNI Clean Architecture
 * ============================================================
 * @description Servicio de gestión de solicitudes de vacaciones
 * @version 5.0 - Compatible con Schema CNI
 * ============================================================
 */

import { db } from '@/lib/db';
import { solicitudes, balances, anosLaborales, usuarios } from '@/lib/db/schema';
import { eq, and, sql, desc, inArray, isNull } from 'drizzle-orm';
import { obtenerConfigs, asNumber } from '@/lib/config/service';
import { contarDiasHabiles } from '@/lib/domain/labor-days';
import { reservarBalanceVacaciones } from '@/lib/domain/balance-effects';
import {
  ESTADOS_DIA_CUMPLEANOS_ACTIVOS,
  validarEstructuraSolicitudCumpleanos,
  validarFechaSolicitudCumpleanos,
} from '@/lib/domain/cumpleanos';
import { validarVoBoDirectorService } from '@/lib/domain/solicitud-adjuntos';
import { validarConflictosDepartamento } from '@/lib/domain/departamento-conflictos';
import { resolverFlujoInicialSolicitud } from '@/lib/domain/solicitud-flujo-inicial';
import { resolverAprobadorSegundoNivel, obtenerJefeSuperiorEmpleado } from '@/lib/domain/aprobadores';
import {
  tipoDescuentaSaldo,
  validarReglasFechasSolicitud,
} from '@/lib/domain/solicitud-validaciones';

// =====================================================
// TIPOS
// =====================================================

export interface CrearSolicitudParams {
  usuarioId: number;
  tipo: 'vacaciones' | 'permiso_salida' | 'licencia_medica' | 'permiso_personal' | 'dia_cumpleanos';
  fechaInicio?: string;
  fechaFin?: string;
  diasSolicitados?: number;
  duracionPermiso?: '1-2h' | '2-4h' | 'dia_completo';
  horaSalida?: string;
  horaRegreso?: string;
  motivo?: string;
  comentarioEmpleado?: string;
  esDirector?: boolean;
  documentosAdjuntos?: any[];
}

export interface AprobarSolicitudParams {
  solicitudId: number;
  aprobadorId: number;
  comentario?: string;
  tipo: 'jefe' | 'rrhh';
}

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Crear nueva solicitud de vacaciones/permiso
 */
export async function crearSolicitud(params: CrearSolicitudParams) {
  const {
    usuarioId,
    tipo,
    fechaInicio,
    fechaFin,
    diasSolicitados,
    duracionPermiso,
    horaSalida,
    horaRegreso,
    motivo,
    comentarioEmpleado,
    esDirector = false,
    documentosAdjuntos = [],
  } = params;

  return await db.transaction(async (tx) => {
    const descuentaBalance = tipoDescuentaSaldo(tipo, duracionPermiso);

    const reglasVacaciones = await obtenerConfigs([
      'vacaciones.dias_minimos_solicitud',
      'vacaciones.dias_maximos_consecutivos',
      'vacaciones.dias_anticipacion',
    ]);
    const diasAnticipacion = asNumber(reglasVacaciones['vacaciones.dias_anticipacion'], 0);

    // Días AUTORITATIVOS (no se confía en el valor del cliente):
    let diasParaSolicitud: number;
    let fechaInicioFinal = fechaInicio?.slice(0, 10);
    let fechaFinFinal = fechaFin?.slice(0, 10);

    if (tipo === 'dia_cumpleanos') {
      const estructura = validarEstructuraSolicitudCumpleanos({
        fechaInicio,
        fechaFin,
        diasSolicitados,
      });
      if (!estructura.valido) {
        throw new Error(estructura.error);
      }
      fechaInicioFinal = fechaInicio!.slice(0, 10);
      fechaFinFinal = fechaFin!.slice(0, 10);
      diasParaSolicitud = 1;
    } else if (tipo === 'vacaciones') {
      if (!fechaInicioFinal || !fechaFinFinal) {
        throw new Error('Las vacaciones requieren fecha de inicio y fin');
      }
      diasParaSolicitud = contarDiasHabiles(fechaInicioFinal, fechaFinFinal);
    } else if (tipo === 'permiso_salida') {
      diasParaSolicitud = duracionPermiso === 'dia_completo' ? 1 : 0;
      if (!fechaFinFinal && fechaInicioFinal) {
        fechaFinFinal = fechaInicioFinal;
      }
    } else {
      diasParaSolicitud = Number(diasSolicitados || 0);
    }

    const diasParaBalance = descuentaBalance ? diasParaSolicitud : 0;

    // 1. Fechas, anticipación, fines de semana y horas (antes de saldo)
    const validacionFechas = validarReglasFechasSolicitud({
      tipo,
      fechaInicio: fechaInicioFinal,
      fechaFin: fechaFinFinal,
      duracionPermiso,
      horaSalida,
      horaRegreso,
      diasAnticipacion,
    });
    if (!validacionFechas.valido) {
      throw new Error(validacionFechas.error);
    }

    if (tipo === 'permiso_salida' && (!motivo?.trim() || motivo.trim().length < 5)) {
      throw new Error('Para permisos de salida es obligatorio indicar un motivo de al menos 5 caracteres.');
    }

    // 2. Reglas de vacaciones (días hábiles mín/máx) — después de fechas válidas
    if (tipo === 'vacaciones') {
      const minDias = asNumber(reglasVacaciones['vacaciones.dias_minimos_solicitud'], 1);
      const maxDias = asNumber(reglasVacaciones['vacaciones.dias_maximos_consecutivos'], 365);

      if (diasParaSolicitud <= 0) {
        throw new Error('El rango de fechas no contiene días hábiles para descontar');
      }
      if (diasParaSolicitud < minDias) {
        throw new Error(`La solicitud debe ser de al menos ${minDias} día(s) hábil(es).`);
      }
      if (diasParaSolicitud > maxDias) {
        throw new Error(`No puede solicitar más de ${maxDias} días consecutivos.`);
      }
    }

    // 3. Validar VoBo de Ministro para Directores (no aplica a día de cumpleaños)
    const errorVoBoDirector = validarVoBoDirectorService({
      esDirector,
      tipo,
      duracionPermiso,
      documentosAdjuntos,
    });
    if (errorVoBoDirector) {
      throw new Error(errorVoBoDirector);
    }

    // 3. Validar usuario activo
    const usuario = await tx.query.usuarios.findFirst({
      where: eq(usuarios.id, usuarioId),
    });

    if (!usuario || !usuario.activo) {
      throw new Error('Usuario no encontrado o inactivo');
    }

    if (tipo === 'dia_cumpleanos') {
      if (!usuario.fechaNacimiento) {
        throw new Error('No tiene registrada su fecha de nacimiento. Contacte a Recursos Humanos.');
      }

      const validacionFecha = validarFechaSolicitudCumpleanos(
        usuario.fechaNacimiento,
        fechaInicioFinal!
      );
      if (!validacionFecha.valido) {
        throw new Error(validacionFecha.error ?? 'Fecha no válida para día de cumpleaños');
      }

      const anioActual = new Date().getFullYear();
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${usuarioId}, ${anioActual})`);
      const [solicitudExistente] = await tx
        .select({ id: solicitudes.id })
        .from(solicitudes)
        .where(
          and(
            eq(solicitudes.usuarioId, usuarioId),
            eq(solicitudes.tipo, 'dia_cumpleanos'),
            inArray(solicitudes.estado, [...ESTADOS_DIA_CUMPLEANOS_ACTIVOS]),
            isNull(solicitudes.deletedAt),
            sql`EXTRACT(YEAR FROM ${solicitudes.fechaInicio}) = ${anioActual}`
          )
        )
        .limit(1);

      if (solicitudExistente) {
        throw new Error('Ya utilizó su día libre por cumpleaños este año.');
      }
    }

    if (fechaInicioFinal && fechaFinFinal) {
      await validarConflictosDepartamento(
        {
          usuarioId,
          departamentoId: usuario.departamentoId,
          fechaInicio: fechaInicioFinal,
          fechaFin: fechaFinFinal,
        },
        tx
      );
    }

    // 2. Obtener año laboral activo
    const anoLaboral = await tx.query.anosLaborales.findFirst({
      where: eq(anosLaborales.activo, true),
    });

    if (!anoLaboral) {
      throw new Error('No hay año laboral activo');
    }

    // Validar saldo solo cuando el tipo/duración descuenta días
    if (descuentaBalance && diasParaBalance > 0) {
      const balance = await tx.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioId),
          eq(balances.anoLaboralId, anoLaboral.id),
          eq(balances.tipoAusencia, 'vacaciones')
        ),
      });

      if (!balance) {
        throw new Error('No se encontró balance de vacaciones para el usuario');
      }

      const disponible = parseFloat(balance.cantidadDisponible);
      if (disponible < diasParaBalance) {
        throw new Error('No tiene días disponibles suficientes.');
      }
    }

    // 4. Generar código único (formato CNI: CNI-SOL-YYYY-XXXX)
    const year = new Date().getFullYear();
    const lastSolicitud = await tx.query.solicitudes.findFirst({
      where: sql`(${solicitudes.codigo} LIKE ${`CNI-SOL-${year}-%`} OR ${solicitudes.codigo} LIKE ${`SOL-${year}-%`})`,
      orderBy: [desc(solicitudes.id)],
    });

    let nextNumber = 1;
    if (lastSolicitud?.codigo) {
      const match = lastSolicitud.codigo.match(/(?:CNI-SOL|SOL)-\d{4}-(\d+)/);
      if (match?.[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const codigo = `CNI-SOL-${year}-${String(nextNumber).padStart(4, '0')}`;

    // Fase 2 (corrección):
    //   - Empleado normal: solo requiere jefeSuperiorId; NO busca Director/SG.
    //   - Jefe: resuelve Director o Director de Secretaría General.
    //   - Director: pasa directo a RRHH (sin aprobador de segundo nivel).
    let aprobadorSegundoNivelTipo: 'director' | 'director_secretaria_general' | null = null;
    let aprobadorDirectorId: number | null = null;
    let aprobadorSecretarioId: number | null = null;

    if (!esDirector && !usuario.esJefe) {
      const jefe = await obtenerJefeSuperiorEmpleado({
        usuarioId,
        jefeSuperiorId: usuario.jefeSuperiorId,
        departamentoId: usuario.departamentoId,
      });
      if (!jefe) {
        throw new Error(
          'El empleado no tiene jefe superior asignado. Contacte a RRHH/Admin.'
        );
      }
    }

    if (!esDirector && usuario.esJefe) {
      try {
        const aprobador = await resolverAprobadorSegundoNivel({
          departamentoId: usuario.departamentoId,
          jefeSuperiorId: usuario.jefeSuperiorId,
          fechaInicio: fechaInicioFinal,
          fechaFin: fechaFinFinal,
        });
        aprobadorSegundoNivelTipo = aprobador.tipoAprobador;
        if (aprobador.tipoAprobador === 'director') {
          aprobadorDirectorId = aprobador.usuarioId;
        } else {
          aprobadorSecretarioId = aprobador.usuarioId;
        }
      } catch (err) {
        const mensajeError =
          err instanceof Error
            ? err.message
            : 'No hay Director asignado al departamento Secretaría General para aprobación sustituta.';
        throw new Error(mensajeError);
      }
    }

    // Fase 3: resolver requisitos de adjuntos según rol/flujo del
    // solicitante. La regla canónica vive en `requisitos-adjuntos.ts`.
    // Persistimos el `tipoVoBoRequerido` en metadata (no como columna)
    // para que el visor histórico siga funcionando sin migración.
    const { resolverRequisitosAdjuntosSolicitud } = await import(
      '@/lib/domain/requisitos-adjuntos'
    );
    const requisitosAdjuntos = resolverRequisitosAdjuntosSolicitud({
      usuarioSolicitante: {
        esDirector: usuario.esDirector,
        esJefe: usuario.esJefe,
      },
      tipoSolicitud: tipo,
      duracionPermiso,
      flujoAprobacion: {
        requiereVoBoMinistro: false, // No usado en este camino; el helper
        // decide por rol. Director pasa por su propio flujo.
        aprobadorSegundoNivelTipo,
      },
    });
    const tipoVoBoRequerido = requisitosAdjuntos.tipoVoBoRequerido;
    const adjuntosRequeridos = requisitosAdjuntos.adjuntosRequeridos;

    const flujoInicial = resolverFlujoInicialSolicitud({
      esDirector,
      esJefe: usuario.esJefe,
      aprobadorSegundoNivelTipo,
    });

    // Combinar metadata con info de aprobador (para auditoría y UI).
    const metadataInicial = {
      ...flujoInicial.metadataInicial,
      ...(aprobadorSegundoNivelTipo
        ? { aprobadorSegundoNivelTipo }
        : {}),
      ...(aprobadorDirectorId ? { aprobadorDirectorIdSnapshot: aprobadorDirectorId } : {}),
      ...(aprobadorSecretarioId
        ? { aprobadorSecretarioIdSnapshot: aprobadorSecretarioId }
        : {}),
      // Fase 3: snapshot del tipo de VoBo requerido (sin guardarlo
      // en columna propia, vive en metadata para evitar migración).
      ...(tipoVoBoRequerido ? { tipoVoBoRequerido } : {}),
      ...(adjuntosRequeridos && adjuntosRequeridos.length > 0
        ? { adjuntosRequeridos: adjuntosRequeridos.map((r) => r.tipo) }
        : {}),
    };

    // Resolver horas para permisos de salida
    // El CHECK constraint de la BD exige hora_salida y hora_regreso NOT NULL para permiso_salida
    let horaSalidaFinal = horaSalida || null;
    let horaRegresoFinal = horaRegreso || null;

    if (tipo === 'permiso_salida') {
      if (duracionPermiso === 'dia_completo') {
        // Para día completo, auto-asignar jornada laboral
        horaSalidaFinal = horaSalidaFinal || '08:00';
        horaRegresoFinal = horaRegresoFinal || '17:00';
      } else {
        // Para 1-2h y 2-4h, asegurar que las horas estén presentes
        if (!horaSalidaFinal) horaSalidaFinal = '08:00';
        if (!horaRegresoFinal) {
          if (duracionPermiso === '1-2h') horaRegresoFinal = '10:00';
          else if (duracionPermiso === '2-4h') horaRegresoFinal = '12:00';
          else horaRegresoFinal = '17:00';
        }
      }
    }

    const ahoraIso = new Date().toISOString();

    const [nuevaSolicitud] = await tx
      .insert(solicitudes)
      .values({
        codigo,
        usuarioId,
        anoLaboralId: anoLaboral.id,
        tipo,
        fechaInicio: fechaInicioFinal,
        fechaFin: fechaFinFinal,
        diasSolicitados: diasParaSolicitud.toString(),
        duracionPermiso,
        horaSalida: horaSalidaFinal,
        horaRegreso: horaRegresoFinal,
        motivo,
        comentarioEmpleado,
        // Fase 3: persistir cada adjunto con su `tipo` poblado. Si el
        // cliente solo mandó `nombre` (compatibilidad histórica), se
        // propaga como `tipo` para que el visor pueda identificarlo.
        documentosAdjuntos: Array.isArray(documentosAdjuntos)
          ? documentosAdjuntos.map((a: any) => ({
              ...a,
              tipo: typeof a?.tipo === 'string' ? a.tipo : a?.nombre ?? 'adjunto',
              uploadedAt: typeof a?.uploadedAt === 'string' ? a.uploadedAt : ahoraIso,
              uploadedBy: typeof a?.uploadedBy === 'number' ? a.uploadedBy : usuarioId,
            }))
          : [],
        estado: flujoInicial.estadoInicial,
        metadata: metadataInicial,
        // Fase 2: persistir aprobador de segundo nivel esperado para
        // que las bandejas puedan filtrar por id sin recálculo en cada
        // request.
        aprobadaDirectorPor: aprobadorDirectorId,
        aprobadaSecretarioPor: aprobadorSecretarioId,
        ...(flujoInicial.autoAprobacionJefe
          ? {
              aprobadaJefePor: usuarioId,
              aprobadaJefeFecha: ahoraIso,
              comentarioJefe: flujoInicial.autoAprobacionJefe.comentarioJefe,
            }
          : {}),
      })
      .returning();

    // 6. Si es vacación, actualizar balance (cantidad_pendiente)
    if (descuentaBalance && diasParaBalance > 0) {
      await reservarBalanceVacaciones(tx, {
        usuarioId,
        anoLaboralId: anoLaboral.id,
        dias: diasParaBalance,
      });
    }

    return nuevaSolicitud;
  });
}

/**
 * Obtener solicitud por ID
 */
export async function obtenerSolicitudPorId(id: number) {
  return await db.query.solicitudes.findFirst({
    where: eq(solicitudes.id, id),
    with: {
      usuario: true,
      anoLaboral: true,
    },
  });
}

/**
 * Listar solicitudes con filtros
 */
export async function listarSolicitudes(filtros: {
  usuarioId?: number;
  estado?: string;
  tipo?: string;
  limit?: number;
  offset?: number;
}) {
  const { usuarioId, estado, tipo, limit = 50, offset = 0 } = filtros;

  const conditions = [isNull(solicitudes.deletedAt)];

  if (usuarioId) {
    conditions.push(eq(solicitudes.usuarioId, usuarioId));
  }

  if (estado) {
    conditions.push(eq(solicitudes.estado, estado as any));
  }

  if (tipo) {
    conditions.push(eq(solicitudes.tipo, tipo as any));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return await db.query.solicitudes.findMany({
    where,
    orderBy: [desc(solicitudes.createdAt)],
    limit,
    offset,
    with: {
      usuario: {
        columns: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
        },
      },
    },
  });
}
