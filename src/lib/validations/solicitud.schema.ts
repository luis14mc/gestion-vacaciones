import { z } from 'zod';

export const solicitudSchema = z.object({
    tipoAusenciaId: z.string().min(1, 'Debe seleccionar un tipo de solicitud.'),
    unidad: z.enum(['dias', 'horas']),
    tipoPermiso: z.string().optional(),

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
}).superRefine((data, ctx) => {
    if (data.unidad === 'horas') {
        if (!data.fechaInicio) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha del permiso es requerida.',
                path: ['fechaInicio'],
            });
        }
        if (!data.tipoPermiso) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Debe seleccionar la duración del permiso.',
                path: ['tipoPermiso'],
            });
        }
        if (data.tipoPermiso === '1-2h') {
            if (!data.horaSalida) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'La hora de salida es requerida.',
                    path: ['horaSalida'],
                });
            }
            if (!data.horaRegreso) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'La hora de regreso es requerida.',
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
        if (!data.fechaFin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha de fin es requerida.',
                path: ['fechaFin'],
            });
        }

        if (data.fechaInicio && data.fechaFin) {
            const inicio = new Date(data.fechaInicio);
            const fin = new Date(data.fechaFin);
            if (fin < inicio) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'La fecha de fin no puede ser anterior a la de inicio.',
                    path: ['fechaFin'],
                });
            }
        }
    }
});

export type SolicitudFormData = z.infer<typeof solicitudSchema>;
