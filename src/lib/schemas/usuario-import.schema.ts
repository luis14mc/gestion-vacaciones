import { z } from 'zod';

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

/** Validación de campos de fila alineada con `usuarioApiSchema` (sin IDs numéricos). */
export const usuarioImportRowSchema = z.object({
  email: z.string().email('Correo electronico invalido'),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  telefono: optionalTrimmed,
  direccion: optionalTrimmed,
  cargo: optionalTrimmed,
  numeroEmpleado: optionalTrimmed,
});

export function validarCamposImportacionUsuario(data: {
  email: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  direccion?: string;
  cargo?: string;
  numeroEmpleado?: string;
}): string[] {
  const result = usuarioImportRowSchema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}

export interface JefeSuperiorReferencia {
  email: string;
  departamentoId: number | null;
  esJefe: boolean;
  esDirector: boolean;
}

/** Misma regla que el formulario: jefe superior debe ser Jefe o Director del mismo departamento. */
export function validarJefeSuperiorImportacion(
  jefe: JefeSuperiorReferencia | undefined,
  departamentoId: number | null
): string | null {
  if (!jefe) {
    return 'Email Jefe Superior no existe en el sistema ni en este archivo';
  }
  if (!jefe.esJefe && !jefe.esDirector) {
    return 'El jefe superior debe tener rol Jefe o Director';
  }
  if (departamentoId && jefe.departamentoId && jefe.departamentoId !== departamentoId) {
    return 'El jefe superior debe pertenecer al mismo departamento';
  }
  return null;
}
