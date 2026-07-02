import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { obtenerRolesYPermisos } from "@/services/rbac.service";
import { checkDualRateLimit, resetDualRateLimit } from "@/lib/rate-limiter";
import { obtenerConfigs, asNumber } from "@/lib/config/service";
import { registrarEventoAuditoria, datosPeticion } from "@/services/auditoria.service";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const datos = request
          ? datosPeticion(request as unknown as Request)
          : { ipAddress: 'unknown', userAgent: 'unknown' };

        // 🛡️ Rate Limiting dual (email + IP)
        const rateLimitResult = await checkDualRateLimit(
          email.toLowerCase(),
          datos.ipAddress ?? 'unknown'
        );
        if (!rateLimitResult.allowed) {
          const waitMinutes = Math.ceil(rateLimitResult.remainingMs / 60000);
          throw new Error(`Demasiados intentos fallidos. Intente de nuevo en ${waitMinutes} minutos.`);
        }

        // Buscar usuario
        const usuario = await db.query.usuarios.findFirst({
          where: eq(usuarios.email, email.toLowerCase()),
        });

        if (!usuario?.activo) {
          return null;
        }

        // Verificar contraseña
        const passwordValida = await bcrypt.compare(password, usuario.passwordHash);

        if (!passwordValida) {
          await registrarEventoAuditoria({
            usuarioId: usuario.id,
            accion: 'login_fallido',
            modulo: 'seguridad',
            evento: 'login_fallido',
            severidad: 'advertencia',
            resultado: 'fallo',
            tablaAfectada: 'usuarios',
            registroId: usuario.id,
            detalles: { email: email.toLowerCase() },
            ...datos,
          });
          return null;
        }

        // ✅ Login exitoso: Resetear contadores de intentos fallidos
        await resetDualRateLimit(email.toLowerCase(), datos.ipAddress ?? 'unknown');

        await registrarEventoAuditoria({
          usuarioId: usuario.id,
          accion: 'login',
          modulo: 'seguridad',
          evento: 'login_exitoso',
          tablaAfectada: 'usuarios',
          registroId: usuario.id,
          ...datos,
        });

        // Actualizar último acceso
        await db
          .update(usuarios)
          .set({ ultimoAcceso: new Date().toISOString() })
          .where(eq(usuarios.id, usuario.id));

        // 🆕 Obtener roles y permisos RBAC
        const usuarioConRBAC = await obtenerRolesYPermisos(usuario.id);

        // Retornar usuario para sesión con RBAC
        return {
          id: usuario.id.toString(),
          email: usuario.email,
          name: `${usuario.nombre} ${usuario.apellido}`,
          image: null,
          // Datos adicionales
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          departamentoId: usuario.departamentoId,
          departamentoNombre: undefined, // Se resuelve por separado si se necesita
          cargo: usuario.cargo,
          // 🆕 RBAC
          roles: usuarioConRBAC?.roles || [],
          permisos: usuarioConRBAC?.permisos || [],
          // ⚠️ Legacy (calculado desde roles)
          esAdmin:
            usuarioConRBAC?.roles?.some((r: any) => r.codigo === 'ADMIN') ||
            usuario.esAdmin ||
            false,
          esRrhh:
            usuarioConRBAC?.roles?.some((r: any) => r.codigo === 'RRHH') ||
            usuario.esRrhh ||
            false,
          esDirector:
            usuarioConRBAC?.roles?.some((r: any) => r.codigo === 'DIRECTOR') ||
            usuario.esDirector ||
            false,
          esJefe:
            usuarioConRBAC?.roles?.some((r: any) => r.codigo === 'JEFE') ||
            usuario.esJefe ||
            false,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Expiración absoluta de sesión según Configuración → Seguridad.
        // Se fija solo al iniciar sesión (no en cada request).
        const horas = asNumber(
          (await obtenerConfigs(['seguridad.sesion_duracion_horas']))['seguridad.sesion_duracion_horas'],
          24
        );
        (token as any).absExp = Date.now() + horas * 60 * 60 * 1000;
        // Agregar datos personalizados al token incluyendo RBAC
        token.id = user.id;
        token.nombre = (user as any).nombre;
        token.apellido = (user as any).apellido;
        token.departamentoId = (user as any).departamentoId;
        token.departamentoNombre = (user as any).departamentoNombre;
        token.cargo = (user as any).cargo;
        // 🆕 RBAC
        token.roles = (user as any).roles;
        token.permisos = (user as any).permisos;
        token.esDirector = (user as any).esDirector;
        token.esJefe = (user as any).esJefe;
        token.esRrhh = (user as any).esRrhh;
        token.esAdmin = (user as any).esAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        // Exponer la expiración absoluta para que middleware y getSession
        // puedan invalidar la sesión cuando se supere la duración configurada.
        (session as any).absExp = (token as any).absExp ?? null;
        // Agregar datos del token a la sesión incluyendo RBAC
        session.user = {
          ...session.user,
          id: Number.parseInt(token.id as string),
          nombre: token.nombre as string,
          apellido: token.apellido as string,
          departamentoId: (token.departamentoId as number) ?? null,
          departamentoNombre: token.departamentoNombre as string,
          cargo: token.cargo as string | null,
          // 🆕 RBAC
          roles: token.roles as any[],
          permisos: token.permisos as string[],
          esDirector: token.esDirector as boolean,
          esJefe: token.esJefe as boolean,
          esRrhh: token.esRrhh as boolean,
          esAdmin: token.esAdmin as boolean
        } as any;
      }
      return session;
    }
  },
  events: {
    async signOut(message) {
      const token = (message as any)?.token;
      const id = token?.id ? Number(token.id) : null;
      if (id && !Number.isNaN(id)) {
        await registrarEventoAuditoria({
          usuarioId: id,
          accion: 'logout',
          modulo: 'seguridad',
          evento: 'logout',
          tablaAfectada: 'usuarios',
          registroId: id,
        });
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: {
    strategy: 'jwt',
    // Tope del cookie (30 días). La duración efectiva la gobierna absExp,
    // derivado de seguridad.sesion_duracion_horas en cada login.
    maxAge: 30 * 24 * 60 * 60
  }
});
