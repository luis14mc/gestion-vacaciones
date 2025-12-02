"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setError("Credenciales inválidas");
        return;
      }

      // Login exitoso - redirigir al dashboard
      router.push("/dashboard");
      router.refresh();
      
    } catch (error) {
      console.error("Error en login:", error);
      setError("Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-base-200 to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Panel Izquierdo - Branding */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 p-8">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-transparent p-4 rounded-2xl backdrop-blur-sm border-none">
                  <Image
                    src="/assets/logo/logo.png"
                    alt="CNI Honduras Logo"
                    width={120}
                    height={68}
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-primary leading-tight">
                    Sistema de<br />Vacaciones
                  </h1>
                  <p className="text-base-content/60 text-sm mt-2">
                    Consejo Nacional de Inversiones
                  </p>
                </div>
              </div>
              
              <div className="space-y-4 pt-8">
                <div className="flex items-start gap-3">
                  <div className="bg-accent/10 p-2 rounded-lg">
                    <i className="lni lni-checkmark text-accent text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base-content">Gestión Simplificada</h3>
                    <p className="text-sm text-base-content/60">Solicita y aprueba vacaciones en segundos</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-info/10 p-2 rounded-lg">
                    <i className="lni lni-calendar text-info text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base-content">Control Total</h3>
                    <p className="text-sm text-base-content/60">Visualiza tus días disponibles en tiempo real</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-secondary/10 p-2 rounded-lg">
                    <i className="lni lni-lock text-secondary text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base-content">Seguro y Confiable</h3>
                    <p className="text-sm text-base-content/60">Tus datos protegidos con la mejor tecnología</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel Derecho - Formulario */}
          <div className="w-full">
            {/* Logo móvil */}
            <div className="lg:hidden text-center mb-6">
              <div className="inline-block bg-base-100 p-4 rounded-xl shadow-lg mb-4">
                <Image
                  src="/assets/logo/logo.png"
                  alt="CNI Logo"
                  width={100}
                  height={57}
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-primary">Sistema de Vacaciones</h1>
            </div>

            <div className="card bg-base-100 shadow-2xl border border-base-300">
              <div className="card-body p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-base-content mb-2">
                    Bienvenido de nuevo
                  </h2>
                  <p className="text-base-content/60 text-sm">
                    Ingresa tus credenciales para continuar
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="alert alert-error">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

                  {/* Email */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium flex items-center gap-2">
                        <i className="lni lni-envelope text-base-content/60"></i>
                        Correo electrónico
                      </span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu.email@cni.hn"
                      className="input input-bordered w-full focus:input-primary transition-all"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium flex items-center gap-2">
                        <i className="lni lni-lock text-base-content/60"></i>
                        Contraseña
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input input-bordered w-full focus:input-primary pr-12 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-base-content/50 hover:text-base-content transition-colors"
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember & Forgot */}
                  <div className="flex items-center justify-between text-sm">
                    <label className="label cursor-pointer gap-2 p-0">
                      <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" />
                      <span className="label-text">Recordarme</span>
                    </label>
                    <button type="button" className="link link-primary link-hover">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary w-full gap-2 text-base"
                  >
                    {isLoading ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        <i className="lni lni-enter"></i>
                        Iniciar Sesión
                      </>
                    )}
                  </button>
                </form>

                {/* Demo Section */}
                <div className="mt-6">
                  <div className="divider text-xs text-base-content/40">Acceso rápido de prueba</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDemoLogin("soporteit@cni.hn", "Admin123")}
                      className="btn btn-outline btn-sm border-primary/30 hover:border-primary hover:bg-primary/5 flex-col h-auto py-2 gap-1"
                    >
                      <i className="lni lni-shield text-lg text-primary"></i>
                      <span className="text-xs font-semibold">Admin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin("ygarcia@cni.hn", "RRHH123")}
                      className="btn btn-outline btn-sm border-secondary/30 hover:border-secondary hover:bg-secondary/5 flex-col h-auto py-2 gap-1"
                    >
                      <i className="lni lni-users text-lg text-secondary"></i>
                      <span className="text-xs font-semibold">RRHH</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin("ecarrasco@cni.hn", "Jefe123")}
                      className="btn btn-outline btn-sm border-info/30 hover:border-info hover:bg-info/5 flex-col h-auto py-2 gap-1"
                    >
                      <i className="lni lni-briefcase text-lg text-info"></i>
                      <span className="text-xs font-semibold">Jefe</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin("amartinez@cni.hn", "Empleado123")}
                      className="btn btn-outline btn-sm border-accent/30 hover:border-accent hover:bg-accent/5 flex-col h-auto py-2 gap-1"
                    >
                      <i className="lni lni-user text-lg text-accent"></i>
                      <span className="text-xs font-semibold">Empleado</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-6 space-y-1">
              <p className="text-xs text-base-content/50">CNI © 2025 - Todos los derechos reservados</p>
              <p className="text-xs text-base-content/30">Sistema de Vacaciones v1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}