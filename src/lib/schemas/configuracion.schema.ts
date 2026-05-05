import { z } from "zod";

export const configuracionSchema = z.object({
    clave: z.string().min(1, "La clave es requerida").regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guiones bajos (snake_case)"),
    valor: z.string().min(1, "El valor es requerido"),
    descripcion: z.string().optional(),
    categoria: z.string().min(1, "La categoría es requerida"),
    tipoDato: z.string().optional(),
    esPublico: z.boolean().optional(),
});

export type ConfiguracionFormValues = z.infer<typeof configuracionSchema>;
