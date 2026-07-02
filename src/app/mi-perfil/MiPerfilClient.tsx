"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Calendar,
  Building,
  Briefcase,
  Shield,
  Edit2,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  UserCircle,
  MapPin,
  Hash,
  Loader2,
} from "lucide-react";
import { notify } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface UserProfile {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  fechaContratacion: string;
  diasVacacionesAnuales: number;
  diasAcumulados: number;
  departamento: { id: number; nombre: string };
  puesto: { id: number; nombre: string };
  roles: Array<{ id: number; nombre: string; codigo: string }>;
}

interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

function getRoleBadgeVariant(codigo: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    ADMIN: "destructive",
    RRHH: "secondary",
    JEFE: "outline",
    EMPLEADO: "default",
  };
  return map[codigo] ?? "outline";
}

export default function MiPerfilClient({ session }: { session?: any } = {}) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [editedData, setEditedData] = useState({
    telefono: "",
    direccion: "",
  });

  const [passwordData, setPasswordData] = useState<PasswordChange>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const cargarPerfil = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/usuarios/me");
      const data = await response.json();

      if (data.success) {
        setProfile(data.usuario);
        setEditedData({
          telefono: data.usuario.telefono || "",
          direccion: data.usuario.direccion || "",
        });
      } else {
        notify.error("Error", data.error || "No se pudo cargar el perfil");
      }
    } catch (error) {
      console.error("Error al cargar perfil:", error);
      notify.error("Error", "No se pudo cargar el perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarPerfil();
  }, [cargarPerfil]);

  const handleSaveProfile = async () => {
    try {
      const response = await fetch("/api/usuarios/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedData),
      });

      const data = await response.json();

      if (data.success) {
        notify.success("¡Éxito!", "Perfil actualizado correctamente");
        setProfile(data.usuario);
        setIsEditing(false);
      } else {
        notify.error("Error", data.error || "No se pudo actualizar el perfil");
      }
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      notify.error("Error", "No se pudo actualizar el perfil");
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      notify.error("Error", "Todos los campos son obligatorios");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      notify.error("Error", "Las contraseñas nuevas no coinciden");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      notify.error("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      const response = await fetch("/api/usuarios/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        notify.success("¡Éxito!", "Contraseña actualizada correctamente");
        setIsChangingPassword(false);
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        notify.error("Error", data.error || "No se pudo cambiar la contraseña");
      }
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      notify.error("Error", "No se pudo cambiar la contraseña");
    }
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const initials = profile
    ? profile.nombre
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        <div className="flex w-full max-w-md flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <UserCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">No se pudo cargar el perfil</p>
          <Button className="mt-4" onClick={() => router.push("/dashboard")}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="rounded-xl bg-muted p-2.5">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Mi Perfil</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Información personal y configuración de cuenta
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card className="gap-0 rounded-2xl py-0 shadow-sm">
              <CardContent className="flex flex-col items-center p-5 pt-6 text-center">
                <Avatar className="mb-4 h-24 w-24">
                  <AvatarFallback className="bg-primary/10 text-3xl font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-base font-semibold text-foreground">{profile.nombre}</h2>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="break-all">{profile.email}</span>
                </div>

                <Separator className="my-4" />

                <div className="w-full">
                  <div className="mb-2 text-xs font-semibold text-muted-foreground">
                    Roles asignados:
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {profile.roles.map((rol) => (
                      <Badge key={rol.id} variant={getRoleBadgeVariant(rol.codigo)}>
                        <Shield className="size-3" />
                        {rol.nombre}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-center">
                    <div className="mb-1 text-xs text-muted-foreground">Días Anuales</div>
                    <div className="text-xl font-semibold text-primary">
                      {profile.diasVacacionesAnuales || 0}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">asignados</div>
                  </div>
                  <div className="rounded-xl bg-muted p-3 text-center">
                    <div className="mb-1 text-xs text-muted-foreground">Disponibles</div>
                    <div className="text-xl font-semibold text-foreground">
                      {profile.diasAcumulados || 0}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">restantes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <Card className="gap-0 rounded-2xl py-0 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-semibold text-foreground">Información Laboral</h3>
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <Building className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Departamento</div>
                      <div className="truncate font-medium text-foreground">
                        {profile.departamento.nombre}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Briefcase className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Puesto</div>
                      <div className="truncate font-medium text-foreground">{profile.puesto.nombre}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Fecha de Contratación</div>
                      <div className="font-medium text-foreground">
                        {formatearFecha(profile.fechaContratacion)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Hash className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">ID de Empleado</div>
                      <div className="font-medium text-foreground">
                        #{profile.id.toString().padStart(4, "0")}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-2xl py-0 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <h3 className="text-[13px] font-semibold text-foreground">Información de Contacto</h3>
                  {!isEditing && (
                    <Button variant="ghost" size="sm" className="gap-2" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="perfil-telefono" className="text-foreground">
                      <Phone className="inline h-4 w-4 align-text-bottom" />
                      <span className="ml-1">Teléfono</span>
                    </Label>
                    <Input
                      id="perfil-telefono"
                      type="tel"
                      value={editedData.telefono}
                      onChange={(e) => setEditedData({ ...editedData, telefono: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Ej: +34 600 000 000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="perfil-direccion" className="text-foreground">
                      <MapPin className="inline h-4 w-4 align-text-bottom" />
                      <span className="ml-1">Dirección</span>
                    </Label>
                    <Textarea
                      id="perfil-direccion"
                      className="min-h-20"
                      value={editedData.direccion}
                      onChange={(e) => setEditedData({ ...editedData, direccion: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Dirección completa"
                    />
                  </div>

                  {isEditing && (
                    <div className="grid grid-cols-1 justify-end gap-2 min-[420px]:grid-cols-2 sm:flex">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedData({
                            telefono: profile.telefono || "",
                            direccion: profile.direccion || "",
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                      <Button size="sm" className="gap-2" onClick={handleSaveProfile}>
                        <Save className="h-4 w-4" />
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-2xl py-0 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-semibold text-foreground">Seguridad</h3>
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>

                {!isChangingPassword ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-amber-500/40 text-foreground hover:bg-muted"
                    onClick={() => setIsChangingPassword(true)}
                  >
                    <Lock className="h-4 w-4" />
                    Cambiar Contraseña
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pwd-current" className="text-foreground">
                        Contraseña Actual
                      </Label>
                      <div className="relative">
                        <Input
                          id="pwd-current"
                          type={showPasswords.current ? "text" : "password"}
                          className="pr-10"
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, currentPassword: e.target.value })
                          }
                          placeholder="••••••••"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-0 top-0"
                          onClick={() =>
                            setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                          }
                          aria-label={showPasswords.current ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPasswords.current ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pwd-new" className="text-foreground">
                        Nueva Contraseña
                      </Label>
                      <div className="relative">
                        <Input
                          id="pwd-new"
                          type={showPasswords.new ? "text" : "password"}
                          className="pr-10"
                          value={passwordData.newPassword}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, newPassword: e.target.value })
                          }
                          placeholder="••••••••"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-0 top-0"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          aria-label={showPasswords.new ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pwd-confirm" className="text-foreground">
                        Confirmar Nueva Contraseña
                      </Label>
                      <div className="relative">
                        <Input
                          id="pwd-confirm"
                          type={showPasswords.confirm ? "text" : "password"}
                          className="pr-10"
                          value={passwordData.confirmPassword}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                          }
                          placeholder="••••••••"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-0 top-0"
                          onClick={() =>
                            setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                          }
                          aria-label={showPasswords.confirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPasswords.confirm ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 justify-end gap-2 min-[420px]:grid-cols-2 sm:flex">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                      <Button size="sm" className="gap-2" onClick={handleChangePassword}>
                        <Save className="h-4 w-4" />
                        Cambiar Contraseña
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
