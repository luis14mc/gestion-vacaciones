"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
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
  ArrowLeft,
  UserCircle,
  MapPin,
  Hash,
} from "lucide-react";
import Swal from "sweetalert2";

interface UserProfile {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  fechaContratacion: string;
  diasVacacionesAnuales: number;
  diasAcumulados: number;
  departamento: {
    id: number;
    nombre: string;
  };
  puesto: {
    id: number;
    nombre: string;
  };
  roles: Array<{
    id: number;
    nombre: string;
    codigo: string;
  }>;
}

interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function MiPerfilClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Datos editables
  const [editedData, setEditedData] = useState({
    telefono: "",
    direccion: "",
  });

  // Cambio de contraseña
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

  useEffect(() => {
    cargarPerfil();
  }, []);

  const cargarPerfil = async () => {
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
        Swal.fire("Error", data.error || "No se pudo cargar el perfil", "error");
      }
    } catch (error) {
      console.error("Error al cargar perfil:", error);
      Swal.fire("Error", "No se pudo cargar el perfil", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await fetch("/api/usuarios/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedData),
      });

      const data = await response.json();

      if (data.success) {
        await Swal.fire("¡Éxito!", "Perfil actualizado correctamente", "success");
        setProfile(data.usuario);
        setIsEditing(false);
      } else {
        Swal.fire("Error", data.error || "No se pudo actualizar el perfil", "error");
      }
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      Swal.fire("Error", "No se pudo actualizar el perfil", "error");
    }
  };

  const handleChangePassword = async () => {
    // Validaciones
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Swal.fire("Error", "Todos los campos son obligatorios", "error");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Swal.fire("Error", "Las contraseñas nuevas no coinciden", "error");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Swal.fire("Error", "La contraseña debe tener al menos 6 caracteres", "error");
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
        await Swal.fire("¡Éxito!", "Contraseña actualizada correctamente", "success");
        setIsChangingPassword(false);
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        Swal.fire("Error", data.error || "No se pudo cambiar la contraseña", "error");
      }
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      Swal.fire("Error", "No se pudo cambiar la contraseña", "error");
    }
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const getRoleBadgeClass = (codigo: string) => {
    const classes: Record<string, string> = {
      ADMIN: "badge-error",
      RRHH: "badge-warning",
      JEFE: "badge-info",
      EMPLEADO: "badge-primary",
    };
    return classes[codigo] || "badge-ghost";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
        <div className="text-center">
          <UserCircle className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
          <p className="text-base-content/60">No se pudo cargar el perfil</p>
          <button onClick={() => router.push("/dashboard")} className="btn btn-primary mt-4">
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-2 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-primary to-secondary p-3 sm:p-4 rounded-2xl shadow-lg">
            <UserCircle className="w-6 h-6 sm:w-8 sm:h-8 text-primary-content" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-base-content">Mi Perfil</h1>
            <p className="text-sm sm:text-base text-base-content/70">
              Información personal y configuración de cuenta
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-sm sm:btn-md btn-ghost gap-2 self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        </div>

        {/* Información Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Avatar y Datos Básicos */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center p-4 sm:p-6">
                <div className="avatar placeholder mb-4">
                  <div className="bg-gradient-to-br from-primary to-secondary text-primary-content rounded-full w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shadow-lg">
                    <span className="text-4xl sm:text-5xl font-bold">
                      {profile.nombre.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                    </span>
                  </div>
                </div>
                <h2 className="card-title text-xl sm:text-2xl">{profile.nombre}</h2>
                <div className="text-sm text-base-content/70 flex items-center gap-1 flex-wrap justify-center">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="break-all">{profile.email}</span>
                </div>
                
                {/* Roles */}
                <div className="divider my-2"></div>
                <div className="w-full">
                  <div className="text-xs text-base-content/60 mb-2 font-semibold">Roles asignados:</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.roles.map((rol) => (
                      <div key={rol.id} className={`badge ${getRoleBadgeClass(rol.codigo)} gap-1`}>
                        <Shield className="w-3 h-3" />
                        {rol.nombre}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balance de Vacaciones */}
                <div className="divider my-2"></div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <div className="text-xs text-base-content/60 mb-1">Días Anuales</div>
                    <div className="text-3xl font-bold text-primary">{profile.diasVacacionesAnuales || 0}</div>
                    <div className="text-xs text-base-content/50 mt-1">asignados</div>
                  </div>
                  <div className="bg-secondary/10 rounded-lg p-3 text-center">
                    <div className="text-xs text-base-content/60 mb-1">Disponibles</div>
                    <div className="text-3xl font-bold text-secondary">{profile.diasAcumulados || 0}</div>
                    <div className="text-xs text-base-content/50 mt-1">restantes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Información Detallada */}
          <div className="lg:col-span-2 space-y-4">
            {/* Información Laboral */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="card-title text-lg">Información Laboral</h3>
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Building className="w-5 h-5 text-base-content/50 mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-base-content/60">Departamento</div>
                      <div className="font-medium truncate">{profile.departamento.nombre}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-base-content/50 mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-base-content/60">Puesto</div>
                      <div className="font-medium truncate">{profile.puesto.nombre}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-base-content/50 mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-base-content/60">Fecha de Contratación</div>
                      <div className="font-medium">{formatearFecha(profile.fechaContratacion)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Hash className="w-5 h-5 text-base-content/50 mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-base-content/60">ID de Empleado</div>
                      <div className="font-medium">#{profile.id.toString().padStart(4, '0')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Información Personal Editable */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="card-title text-lg">Información de Contacto</h3>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn btn-sm btn-ghost gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Teléfono
                      </span>
                    </label>
                    <input
                      type="tel"
                      className="input input-bordered"
                      value={editedData.telefono}
                      onChange={(e) => setEditedData({ ...editedData, telefono: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Ej: +34 600 000 000"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Dirección
                      </span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-20"
                      value={editedData.direccion}
                      onChange={(e) => setEditedData({ ...editedData, direccion: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Dirección completa"
                    />
                  </div>

                  {isEditing && (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditedData({
                            telefono: profile.telefono || "",
                            direccion: profile.direccion || "",
                          });
                        }}
                        className="btn btn-ghost btn-sm gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="btn btn-primary btn-sm gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Guardar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cambiar Contraseña */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="card-title text-lg">Seguridad</h3>
                  <Lock className="w-5 h-5 text-warning" />
                </div>

                {!isChangingPassword ? (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="btn btn-outline btn-warning btn-sm gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Cambiar Contraseña
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Contraseña Actual</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          className="input input-bordered w-full pr-10"
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, currentPassword: e.target.value })
                          }
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm absolute right-0 top-0"
                          onClick={() =>
                            setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                          }
                        >
                          {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Nueva Contraseña</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          className="input input-bordered w-full pr-10"
                          value={passwordData.newPassword}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, newPassword: e.target.value })
                          }
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm absolute right-0 top-0"
                          onClick={() =>
                            setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                          }
                        >
                          {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <label className="label">
                        <span className="label-text-alt">Mínimo 6 caracteres</span>
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Confirmar Nueva Contraseña</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          className="input input-bordered w-full pr-10"
                          value={passwordData.confirmPassword}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                          }
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm absolute right-0 top-0"
                          onClick={() =>
                            setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                          }
                        >
                          {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        }}
                        className="btn btn-ghost btn-sm gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleChangePassword}
                        className="btn btn-warning btn-sm gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Cambiar Contraseña
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
