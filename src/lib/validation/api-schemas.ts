import { z } from 'zod';

export const ROL_CODIGOS = ['ADMIN', 'RRHH', 'JEFE', 'DIRECTOR', 'EMPLEADO'] as const;

export const asignacionMasivaSchema = z.object({
  departamentoId: z.coerce.number().int().positive(),
  tipoAusencia: z.string().min(1).max(50),
  cantidadAsignada: z.coerce.number().finite().nonnegative(),
  operacion: z.enum(['reemplazar', 'sumar', 'restar']).default('reemplazar'),
  anoLaboralId: z.coerce.number().int().positive().optional(),
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const asignarRolSchema = z.object({
  usuarioId: z.coerce.number().int().positive(),
  rolCodigo: z.enum(ROL_CODIGOS),
  departamentoId: z.coerce.number().int().positive().optional(),
});

export const cambiarPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: z.string().min(1, 'La nueva contraseña es obligatoria'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'La nueva contraseña debe ser diferente a la actual',
    path: ['newPassword'],
  });

export const cronAuthHeaderSchema = z
  .string()
  .min(16, 'CRON_SECRET debe tener al menos 16 caracteres');
