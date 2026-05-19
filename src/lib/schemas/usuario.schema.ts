import { z } from "zod";

export const usuarioSchema = z.object({
    email: z.string().email("Correo electrónico inválido"),
    password: z.string().optional(),
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
    departamentoId: z.string().min(1, "Debe seleccionar un departamento"),
    cargo: z.string().optional(),
    fechaIngreso: z.string().optional(),
    esAdmin: z.boolean(),
    esRrhh: z.boolean(),
    esDirector: z.boolean(),
    esJefe: z.boolean(),
    jefeSuperiorId: z.string().optional(),
    activo: z.boolean(),
    numeroEmpleado: z.string().optional(),
    telefono: z.string().optional(),
    direccion: z.string().optional(),
});

export type UsuarioFormValues = z.infer<typeof usuarioSchema>;
