/**
 * Middleware de Next.js para protección de rutas y autorización RBAC
 * 
 * Este middleware se ejecuta antes de cada request y:
 * - Protege rutas que requieren autenticación
 * - Redirige a /login si no hay sesión activa
 * - Permite rutas públicas sin restricción
 * 
 * Nota: Las APIs manejan su propia autorización con permisos RBAC específicos.
 * Este middleware solo verifica autenticación básica usando NextAuth.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  
  // 1️⃣ Ignorar rutas de archivos estáticos y health checks
  const RUTAS_IGNORADAS = ['/_next', '/favicon.ico', '/api/health'];
  if (RUTAS_IGNORADAS.some(ruta => pathname.startsWith(ruta))) {
    return NextResponse.next();
  }
  
  // 2️⃣ Permitir rutas públicas (login y auth)
  const RUTAS_PUBLICAS = ['/login', '/api/auth'];
  if (RUTAS_PUBLICAS.some(ruta => pathname === ruta || pathname.startsWith(ruta))) {
    return NextResponse.next();
  }
  
  // 3️⃣ Verificar si hay sesión activa
  const isLoggedIn = !!req.auth;
  
  if (!isLoggedIn) {
    // No hay sesión - redirigir a login
    const loginUrl = new URL('/login', req.url);
    
    // Guardar URL original para redirección post-login
    if (pathname !== '/' && !pathname.startsWith('/api')) {
      loginUrl.searchParams.set('redirect', pathname);
    }
    
    // Si es API, retornar 401 en lugar de redirect
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    return NextResponse.redirect(loginUrl);
  }
  
  // ✅ Sesión válida - permitir acceso
  return NextResponse.next();
});

/**
 * Configuración del matcher
 * Define qué rutas deben pasar por el middleware
 * 
 * Incluye:
 * - /dashboard/* (todas las rutas del dashboard)
 * - /solicitudes/* (gestión de solicitudes)
 * - /usuarios/* (gestión de usuarios)
 * - /reportes/* (reportes)
 * - /api/* (todas las APIs excepto /api/auth/*)
 * 
 * Excluye automáticamente:
 * - /_next/static (archivos estáticos de Next.js)
 * - /_next/image (optimización de imágenes)
 * - /favicon.ico
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/solicitudes/:path*',
    '/usuarios/:path*',
    '/reportes/:path*',
    '/api/:path*',
  ],
};
