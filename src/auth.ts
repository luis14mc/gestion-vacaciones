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
import type { SlimAuthJwt } from "@/types";

/**
 * Claims mínimos en el JWT/cookie de sesión.
 *
 * NO agregar roles[], permisos[], módulos, metadata ni objetos de usuario
 * completos al token: inflan la cookie y provocan 502 en Nginx con
 * "upstream sent too big header while reading response header from upstream"
 * (p. ej. POST /api/auth/callback/credentials).
 *
 * Roles y permisos se resuelven server-side vía getSession() → BD (usuarioId).
 */
const CODIGOS_ROL = {
  ADMIN: "ADMIN",
  RRHH: "RRHH",
  DIRECTOR: "DIRECTOR",
  JEFE: "JEFE",
  SECRETARIO_GENERAL: "SECRETARIO_GENERAL",
} as const;

function resolverFlagsDesdeRoles(
  codigosRol: string[],
  usuario: {
    esAdmin: boolean;
    esRrhh: boolean;
    esDirector: boolean;
    esJefe: boolean;
    esSecretarioGeneral: boolean;
  }
) {
  return {
    esAdmin: codigosRol.includes(CODIGOS_ROL.ADMIN) || usuario.esAdmin,
    esRrhh: codigosRol.includes(CODIGOS_ROL.RRHH) || usuario.esRrhh,
    esDirector: codigosRol.includes(CODIGOS_ROL.DIRECTOR) || usuario.esDirector,
    esJefe: codigosRol.includes(CODIGOS_ROL.JEFE) || usuario.esJefe,
    esSecretarioGeneral:
      codigosRol.includes(CODIGOS_ROL.SECRETARIO_GENERAL) || usuario.esSecretarioGeneral,
  };
}

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

        // RBAC solo para derivar flags booleanos; roles/permisos NO van al JWT.
        const rbac = await obtenerRolesYPermisos(usuario.id);
        const codigosRol = rbac?.roles.map((r) => r.codigo) ?? [];
        const flags = resolverFlagsDesdeRoles(codigosRol, usuario);

        return {
          id: usuario.id.toString(),
          email: usuario.email,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          departamentoId: usuario.departamentoId,
          ...flags,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      const slimToken = token as SlimAuthJwt & typeof token;
      if (user) {
        const horas = asNumber(
          (await obtenerConfigs(['seguridad.sesion_duracion_horas']))['seguridad.sesion_duracion_horas'],
          24
        );
        slimToken.absExp = Date.now() + horas * 60 * 60 * 1000;

        slimToken.id = user.id;
        slimToken.email = user.email;
        slimToken.nombre = user.nombre;
        slimToken.apellido = user.apellido;
        slimToken.departamentoId = user.departamentoId ?? null;
        slimToken.esDirector = user.esDirector;
        slimToken.esJefe = user.esJefe;
        slimToken.esRrhh = user.esRrhh;
        slimToken.esAdmin = user.esAdmin;
        slimToken.esSecretarioGeneral = user.esSecretarioGeneral;

        delete slimToken.name;
        delete slimToken.picture;
      }
      return slimToken;
    },
    async session({ session, token }) {
      const slimToken = token as SlimAuthJwt;
      if (slimToken.id) {
        session.absExp = slimToken.absExp ?? null;
        const userId = Number.parseInt(slimToken.id, 10);
        Object.assign(session.user, {
          id: userId,
          email: slimToken.email ?? session.user.email,
          name: `${slimToken.nombre ?? ""} ${slimToken.apellido ?? ""}`.trim(),
          nombre: slimToken.nombre ?? "",
          apellido: slimToken.apellido ?? "",
          departamentoId: slimToken.departamentoId ?? null,
          esDirector: slimToken.esDirector ?? false,
          esJefe: slimToken.esJefe ?? false,
          esRrhh: slimToken.esRrhh ?? false,
          esAdmin: slimToken.esAdmin ?? false,
          esSecretarioGeneral: slimToken.esSecretarioGeneral ?? false,
        });
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
