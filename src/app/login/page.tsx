'use client';

import { Suspense, useState, type ElementType, type FormEvent } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle,
  CalendarDays,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';


export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2
            className="size-8 animate-spin text-primary"
            aria-hidden
          />
          <span className="sr-only">Cargando…</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.');
        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-linear-to-br from-background via-muted/15 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* ── Left Panel — Branding ── */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 pl-4">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3">
                  <Image
                    src="/assets/logo/logo.png"
                    alt="CNI Honduras Logo"
                    width={100}
                    height={57}
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
                    Sistema de
                    <br />
                    Vacaciones
                  </h1>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Consejo Nacional de Inversiones
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-6">
                <FeatureItem
                  icon={CheckCircle}
                  title="Gestión Simplificada"
                  desc="Solicita y aprueba vacaciones en segundos"
                />
                <FeatureItem
                  icon={CalendarDays}
                  title="Control Total"
                  desc="Visualiza tus días disponibles en tiempo real"
                />
                <FeatureItem
                  icon={ShieldCheck}
                  title="Seguro y Confiable"
                  desc="Tus datos protegidos con la mejor tecnología"
                />
              </div>
            </div>
          </div>

          {/* ── Right Panel — Form ── */}
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="lg:hidden text-center mb-8">
              <div className="inline-block p-3 mb-3">
                <Image
                  src="/assets/logo/logo.png"
                  alt="CNI Logo"
                  width={80}
                  height={46}
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                Sistema de Vacaciones
              </h1>
            </div>

            <Card className="border-border/80 shadow-md">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-lg tracking-tight">
                  Bienvenido de nuevo
                </CardTitle>
                <CardDescription className="text-[13px]">
                  Ingresa tus credenciales para continuar
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3"
                    >
                      <AlertCircle className="size-4 shrink-0 text-destructive" />
                      <span className="text-[13px] text-destructive">{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="login-email"
                      className="text-[13px] text-muted-foreground"
                    >
                      <Mail className="size-3.5" />
                      Correo electrónico
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu.email@cni.hn"
                      className="h-10 rounded-lg text-[13px]"
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="login-password"
                      className="text-[13px] text-muted-foreground"
                    >
                      <Lock className="size-3.5" />
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-10 rounded-lg pr-10 text-[13px]"
                        required
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        aria-label={
                          showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full rounded-lg text-[13px] font-semibold active:scale-[0.98] transition-transform"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        <LogIn className="size-4" />
                        Iniciar Sesión
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>


            </Card>

            <div className="text-center mt-6">
              <p className="text-[11px] text-muted-foreground">
                CNI &copy; {new Date().getFullYear()} &mdash; Sistema de Vacaciones
                v1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-sm">
        <Icon className="size-4 text-primary" />
      </div>
      <div>
        <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
        <p className="text-[12px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
