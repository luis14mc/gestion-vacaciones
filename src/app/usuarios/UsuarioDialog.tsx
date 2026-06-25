"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usuarioSchema, type UsuarioFormValues } from "@/lib/schemas/usuario.schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, EyeOff, Info } from "lucide-react";
import { notify } from "@/lib/swal";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UsuarioDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    usuario: any | null;
    departamentos: any[];
    onSuccess: () => void;
}

export function UsuarioDialog({ open, onOpenChange, usuario, departamentos, onSuccess }: UsuarioDialogProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const isEditing = !!usuario;

    const [posiblesJefes, setPosiblesJefes] = useState<any[]>([]);

    const form = useForm<UsuarioFormValues>({
        resolver: zodResolver(usuarioSchema),
        defaultValues: {
            email: "",
            password: "",
            nombre: "",
            apellido: "",
            departamentoId: "",
            cargo: "",
            fechaIngreso: "",
            fechaNacimiento: "",
            esAdmin: false,
            esRrhh: false,
            esDirector: false,
            esJefe: false,
            jefeSuperiorId: "",
            activo: true,
            numeroEmpleado: "",
            telefono: "",
            direccion: "",
        },
    });

    useEffect(() => {
        if (open) {
            setServerError(null);
            if (usuario) {
                const fechaRaw = usuario.fechaIngreso || "";
                const fechaFormato = fechaRaw ? fechaRaw.substring(0, 10) : "";
                const nacimientoRaw = usuario.fechaNacimiento || "";
                const nacimientoFormato = nacimientoRaw ? nacimientoRaw.substring(0, 10) : "";
                form.reset({
                    email: usuario.email,
                    password: "",
                    nombre: usuario.nombre,
                    apellido: usuario.apellido,
                    departamentoId: usuario.departamentoId?.toString() || "",
                    cargo: usuario.cargo || "",
                    fechaIngreso: fechaFormato,
                    fechaNacimiento: nacimientoFormato,
                    esAdmin: usuario.esAdmin,
                    esRrhh: usuario.esRrhh,
                    esDirector: usuario.esDirector || false,
                    esJefe: usuario.esJefe,
                    jefeSuperiorId: usuario.jefeSuperiorId?.toString() || "",
                    activo: usuario.activo,
                    numeroEmpleado: usuario.numeroEmpleado || "",
                    telefono: usuario.telefono || "",
                    direccion: usuario.direccion || "",
                });
            } else {
                form.reset({
                    email: "",
                    password: "",
                    nombre: "",
                    apellido: "",
                    departamentoId: "",
                    cargo: "",
                    fechaIngreso: "",
                    fechaNacimiento: "",
                    esAdmin: false,
                    esRrhh: false,
                    esDirector: false,
                    esJefe: false,
                    jefeSuperiorId: "",
                    activo: true,
                    numeroEmpleado: "",
                    telefono: "",
                    direccion: "",
                });
            }
            setShowPassword(false);
        }
    }, [open, usuario, form]);

    const watchDeptId = form.watch("departamentoId");
    const esDirectorChecked = form.watch("esDirector");

    const prevDeptRef = useRef<string>("");
    useEffect(() => {
        if (!watchDeptId) {
            setPosiblesJefes([]);
            return;
        }
        if (prevDeptRef.current && prevDeptRef.current !== watchDeptId) {
            form.setValue("jefeSuperiorId", "");
        }
        prevDeptRef.current = watchDeptId;

        fetch(`/api/usuarios?activo=true&departamentoId=${watchDeptId}`)
            .then(r => r.json())
            .then(data => {
                if (data.success && data.usuarios) {
                    const jefes = data.usuarios.filter(
                        (u: any) =>
                            (u.esDirector || u.esJefe) &&
                            u.id !== usuario?.id
                    );
                    setPosiblesJefes(jefes);
                }
            })
            .catch(() => setPosiblesJefes([]));
    }, [watchDeptId, usuario?.id, form]);

    const onSubmit = async (values: UsuarioFormValues) => {
        setServerError(null);

        if (!isEditing && !values.password) {
            form.setError("password", { type: "manual", message: "La contraseña es requerida para nuevos usuarios" });
            return;
        }

        try {
            const url = "/api/usuarios";
            const method = isEditing ? "PATCH" : "POST";

            const body: any = {
                email: values.email,
                nombre: values.nombre,
                apellido: values.apellido,
                departamentoId: values.departamentoId,
                esAdmin: values.esAdmin,
                esRrhh: values.esRrhh,
                esDirector: values.esDirector,
                esJefe: values.esJefe,
                jefeSuperiorId: values.jefeSuperiorId && values.jefeSuperiorId !== "none" ? values.jefeSuperiorId : null,
                activo: values.activo,
                numeroEmpleado: values.numeroEmpleado || undefined,
                telefono: values.telefono || undefined,
                direccion: values.direccion || undefined,
            };

            if (values.cargo) body.cargo = values.cargo;
            if (values.fechaIngreso) body.fechaIngreso = new Date(values.fechaIngreso).toISOString();
            if (values.fechaNacimiento) body.fechaNacimiento = values.fechaNacimiento.slice(0, 10);
            if (values.password) body.password = values.password;
            if (isEditing) body.id = usuario.id;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const responseText = await res.text();
            let responseData: any = {};
            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch {
                responseData = {};
            }

            if (res.ok) {
                onSuccess();
                onOpenChange(false);
                notify.success(isEditing ? "Usuario actualizado" : "Usuario creado exitosamente");
            } else {
                const detalles = Array.isArray(responseData.detalles) ? responseData.detalles : [];
                for (const detalle of detalles) {
                    if (detalle?.campo) {
                        form.setError(detalle.campo as keyof UsuarioFormValues, {
                            type: "server",
                            message: detalle.mensaje || "Revise este campo",
                        });
                    }
                }

                const mensaje = detalles.length > 0
                    ? "Revise los campos marcados antes de guardar."
                    : responseData.error || "Error al guardar el usuario";

                setServerError(mensaje);
                notify.error(mensaje);
            }
        } catch (error) {
            console.error(error);
            setServerError("Error procesando solicitud");
            notify.error("Error procesando solicitud");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? "Actualiza los datos del usuario aquí." : "Completa la información para registrar al nuevo usuario."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {serverError && (
                            <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
                                <Info className="h-4 w-4" />
                                <AlertDescription className="text-sm">
                                    {serverError}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="nombre"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre *</FormLabel>
                                        <FormControl><Input placeholder="John" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="apellido"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Apellido *</FormLabel>
                                        <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email *</FormLabel>
                                        <FormControl><Input type="email" placeholder="correo@ejemplo.com" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contraseña {!isEditing && "*"}</FormLabel>
                                        <div className="relative">
                                            <FormControl><Input type={showPassword ? "text" : "password"} {...field} /></FormControl>
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="departamentoId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Departamento *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {departamentos.map((dept) => (
                                                    <SelectItem key={dept.id.toString()} value={dept.id.toString()}>
                                                        {dept.nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="cargo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cargo</FormLabel>
                                        <FormControl><Input placeholder="Opcional" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="numeroEmpleado"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número de Empleado</FormLabel>
                                        <FormControl><Input placeholder="Ej: 000123" {...field} value={field.value || ""} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="telefono"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teléfono</FormLabel>
                                        <FormControl><Input placeholder="Ej: +504 9999-9999" {...field} value={field.value || ""} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="direccion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Dirección</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Dirección completa"
                                            className="min-h-20"
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="fechaIngreso"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha de Ingreso</FormLabel>
                                        <FormControl><Input type="date" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="fechaNacimiento"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha de Nacimiento</FormLabel>
                                        <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="jefeSuperiorId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Jefe Superior</FormLabel>
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                                            value={field.value || "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar jefe superior..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">— Sin jefe superior —</SelectItem>
                                                {posiblesJefes.map((jefe: any) => (
                                                    <SelectItem key={jefe.id.toString()} value={jefe.id.toString()}>
                                                        {jefe.nombre} {jefe.apellido}
                                                        {jefe.esDirector ? ' (Director)' : ' (Jefe)'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {!esDirectorChecked && !form.watch("jefeSuperiorId") && watchDeptId && (
                            <Alert className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                                <Info className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                    Sin jefe superior, las solicitudes de este usuario no podrán ser aprobadas.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-3 pt-2">
                            <h4 className="text-sm font-semibold">Roles y Permisos</h4>
                            <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-lg border bg-muted/30 p-4">
                                {([
                                    { name: "esAdmin" as const, label: "Administrador" },
                                    { name: "esRrhh" as const, label: "RRHH" },
                                    { name: "esDirector" as const, label: "Director" },
                                    { name: "esJefe" as const, label: "Jefe" },
                                    { name: "activo" as const, label: "Activo" },
                                ]).map((role) => (
                                    <FormField
                                        key={role.name}
                                        control={form.control}
                                        name={role.name}
                                        render={({ field }) => (
                                            <FormItem className="flex min-w-[9rem] flex-row items-center space-x-2 space-y-0">
                                                <FormControl>
                                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                                <FormLabel className="text-sm font-medium cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                    {role.label}
                                                </FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                {isEditing ? "Guardar Cambios" : "Crear Usuario"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
