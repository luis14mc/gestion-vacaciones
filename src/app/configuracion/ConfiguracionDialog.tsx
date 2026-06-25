import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { configuracionSchema, type ConfiguracionFormValues } from "@/lib/schemas/configuracion.schema";

interface ConfigItem {
    id: number;
    clave: string;
    valor: string;
    descripcion?: string;
    categoria: string;
    tipoDato?: string;
    esPublico?: boolean;
}

interface Categoria {
    id: string;
    nombre: string;
}

interface ConfiguracionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    configuracion: ConfigItem | null;
    categorias: Categoria[];
    categoriaActiva: string;
    onSubmit: (data: ConfiguracionFormValues) => Promise<void>;
}

export function ConfiguracionDialog({
    open,
    onOpenChange,
    configuracion,
    categorias,
    categoriaActiva,
    onSubmit,
}: ConfiguracionDialogProps) {
    const form = useForm<ConfiguracionFormValues>({
        resolver: zodResolver(configuracionSchema),
        defaultValues: {
            clave: "",
            valor: "",
            descripcion: "",
            categoria: categoriaActiva,
            tipoDato: "string",
            esPublico: false,
        },
    });

    useEffect(() => {
        if (configuracion) {
            form.reset({
                clave: configuracion.clave,
                valor: configuracion.valor,
                descripcion: configuracion.descripcion || "",
                categoria: configuracion.categoria,
                tipoDato: configuracion.tipoDato || "string",
                esPublico: configuracion.esPublico || false,
            });
        } else {
            form.reset({
                clave: "",
                valor: "",
                descripcion: "",
                categoria: categoriaActiva,
                tipoDato: "string",
                esPublico: false,
            });
        }
    }, [configuracion, categoriaActiva, form]);

    const handleSubmit = async (values: ConfiguracionFormValues) => {
        await onSubmit(values);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {configuracion ? "Editar Configuración" : "Nueva Configuración"}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="categoria"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione una categoría" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categorias.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.nombre}
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
                            name="clave"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Clave *</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="nombre_configuracion"
                                            {...field}
                                            disabled={!!configuracion}
                                        />
                                    </FormControl>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Formato: snake_case (ej: dias_vacaciones_default)
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="valor"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="15" {...field} />
                                    </FormControl>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Para booleanos usa: true o false
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="descripcion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Descripción de la configuración..."
                                            className="resize-none h-20"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                <Save className="w-4 h-4 mr-2" />
                                {form.formState.isSubmitting ? "Guardando..." : "Guardar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
