import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { obtenerRolesYPermisos } from "@/services/rbac.service";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

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
          return null;
        }

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
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60 // 24 horas
  }
});
