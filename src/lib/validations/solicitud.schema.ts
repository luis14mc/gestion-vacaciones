import { z } from 'zod';
import {
  esFinDeSemana,
  tipoPermiteFinDeSemana,
  validarHorasPermisoSalida,
  validarOrdenFechas,
  validarFechaNoPasada,
  validarAnticipacionMinima,
  validarRangoSinFinDeSemana,
  type TipoSolicitudValidacion,
} from '@/lib/domain/solicitud-validaciones';

export const solicitudSchema = z.object({
    tipoAusenciaId: z.string().min(1, 'Debe seleccionar un tipo de solicitud.'),
    unidad: z.enum(['dias', 'horas']),
    tipoPermiso: z.string().optional(),
    tipoSolicitud: z.string().optional(),

    // Vacaciones (días)
    fechaInicio: z.string().optional(),
    fechaFin: z.string().optional(),

    // Permisos (horas)
    horaSalida: z.string().optional(),
    horaRegreso: z.string().optional(),
    cantidad: z.string().optional(),

    motivo: z.string().optional(),
    observaciones: z.string().optional(),
    requiereMotivo: z.boolean().optional().default(false),
    diasAnticipacion: z.number().optional().default(0),
}).superRefine((data, ctx) => {
    const esCumpleanos = data.tipoAusenciaId === 'dia_cumpleanos';
    const tipoSolicitud = (data.tipoSolicitud ?? data.tipoAusenciaId) as TipoSolicitudValidacion;
    const anticipacion = data.diasAnticipacion ?? 0;

    if (data.unidad === 'horas') {
        if (!data.fechaInicio) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha del permiso es requerida.',
                path: ['fechaInicio'],
            });
        } else {
            const pasada = validarFechaNoPasada(data.fechaInicio);
            if (!pasada.valido) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: pasada.error!, path: ['fechaInicio'] });
            }
            const anticipacionVal = validarAnticipacionMinima(data.fechaInicio, anticipacion);
            if (!anticipacionVal.valido) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: anticipacionVal.error!, path: ['fechaInicio'] });
            }
            if (!tipoPermiteFinDeSemana('permiso_salida') && esFinDeSemana(data.fechaInicio)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'No se pueden solicitar permisos para sábado o domingo.',
                    path: ['fechaInicio'],
                });
            }
        }
        if (!data.tipoPermiso) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Debe seleccionar la duración del permiso.',
                path: ['tipoPermiso'],
            });
        }
        if (data.tipoPermiso === '1-2h' || data.tipoPermiso === '2-4h') {
            const horas = validarHorasPermisoSalida(
                data.tipoPermiso,
                data.horaSalida,
                data.horaRegreso
            );
            if (!horas.valido) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: horas.error!,
                    path: ['horaRegreso'],
                });
            }
        }
        if (!data.motivo || data.motivo.length < 5) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Debe proveer un motivo detallado (mínimo 5 caracteres).',
                path: ['motivo'],
            });
        }
    }

    // Validación condicional del motivo (para licencias o permisos que no sean vacaciones)
    if (data.requiereMotivo) {
        if (!data.motivo || data.motivo.length < 5) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Debe proveer un motivo detallado (mínimo 5 caracteres).',
                path: ['motivo'],
            });
        }
    }

    if (data.unidad === 'dias') {
        if (!data.fechaInicio) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha de inicio es requerida.',
                path: ['fechaInicio'],
            });
        }

        if (esCumpleanos) {
            if (data.fechaInicio) {
                const pasada = validarFechaNoPasada(data.fechaInicio);
                if (!pasada.valido) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: pasada.error!, path: ['fechaInicio'] });
                }
                const anticipacionVal = validarAnticipacionMinima(data.fechaInicio, anticipacion);
                if (!anticipacionVal.valido) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: anticipacionVal.error!, path: ['fechaInicio'] });
                }
                if (esFinDeSemana(data.fechaInicio)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'No se pueden solicitar permisos para sábado o domingo.',
                        path: ['fechaInicio'],
                    });
                }
            }
            return;
        }

        if (!data.fechaFin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha de fin es requerida.',
                path: ['fechaFin'],
            });
        }

        if (data.fechaInicio && data.fechaFin) {
            const orden = validarOrdenFechas(data.fechaInicio, data.fechaFin);
            if (!orden.valido) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: orden.error!,
                    path: ['fechaFin'],
                });
            }

            const pasada = validarFechaNoPasada(data.fechaInicio);
            if (!pasada.valido) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: pasada.error!, path: ['fechaInicio'] });
            }

            const anticipacionVal = validarAnticipacionMinima(data.fechaInicio, anticipacion);
            if (!anticipacionVal.valido) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: anticipacionVal.error!, path: ['fechaInicio'] });
            }

            const finDeSemana = validarRangoSinFinDeSemana(
                tipoSolicitud === 'licencia_medica' ? 'licencia_medica' : tipoSolicitud,
                data.fechaInicio,
                data.fechaFin
            );
            if (!finDeSemana.valido) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: finDeSemana.error!,
                    path: ['fechaInicio'],
                });
            }
        }
    }
});

export type SolicitudFormData = z.infer<typeof solicitudSchema>;
