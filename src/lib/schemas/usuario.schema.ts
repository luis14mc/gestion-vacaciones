import { z } from "zod";
import { normalizarFechaNacimiento } from "@/lib/domain/fecha-nacimiento";

const emptyToUndefined = (value: unknown) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
};

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const optionalFechaNacimiento = z.preprocess(
    emptyToUndefined,
    z.string()
        .superRefine((value, ctx) => {
            const result = normalizarFechaNacimiento(value);
            if (result.error) ctx.addIssue({ code: "custom", message: result.error });
        })
        .transform((value) => normalizarFechaNacimiento(value).fecha!)
        .optional()
);

const optionalFechaNacimientoFormulario = z.string()
    .optional()
    .superRefine((value, ctx) => {
        if (!value) return;
        const result = normalizarFechaNacimiento(value);
        if (result.error) ctx.addIssue({ code: "custom", message: result.error });
    });

const isPositiveIntegerString = (value: string) => {
    const numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue > 0;
};

const requiredIdString = z.preprocess(
    (value) => value === null || value === undefined ? "" : String(value),
    z.string()
        .min(1, "Debe seleccionar un departamento")
        .refine(isPositiveIntegerString, "Debe seleccionar un departamento valido")
);

const optionalIdString = z.preprocess((value) => {
    if (value === null || value === undefined || value === "" || value === "none") {
        return undefined;
    }
    return String(value);
}, z.string().refine(isPositiveIntegerString, "Debe seleccionar un jefe superior valido").optional());

export const usuarioSchema = z.object({
    email: z.string().email("Correo electronico invalido"),
    password: z.string().optional(),
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
    departamentoId: z.string().min(1, "Debe seleccionar un departamento"),
    cargo: z.string().optional(),
    fechaIngreso: z.string().optional(),
    fechaNacimiento: optionalFechaNacimientoFormulario,
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

export const usuarioApiSchema = z.object({
    email: z.string().email("Correo electronico invalido"),
    password: optionalString,
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
    departamentoId: requiredIdString,
    cargo: optionalString,
    fechaIngreso: optionalString,
    fechaNacimiento: optionalFechaNacimiento,
    esAdmin: z.boolean(),
    esRrhh: z.boolean(),
    esDirector: z.boolean(),
    esJefe: z.boolean(),
    jefeSuperiorId: optionalIdString,
    activo: z.boolean(),
    numeroEmpleado: optionalString,
    telefono: optionalString,
    direccion: optionalString,
});

export type UsuarioFormValues = z.infer<typeof usuarioSchema>;
export type UsuarioApiValues = z.infer<typeof usuarioApiSchema>;
