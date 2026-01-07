/**
 * Middleware de Next.js para protección de rutas y autorización RBAC
 * 
 * Este middleware se ejecuta antes de cada request y:
 * - Protege rutas que requieren autenticación
 * - Redirige a /login si no hay sesión activa
 * - Permite rutas públicas sin restricción
 * 
 * Nota: Las APIs manejan su propia autorización con permisos RBAC específicos.
 * Este middleware solo verifica autenticación básica.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Rutas públicas que no requieren autenticación
 */
const RUTAS_PUBLICAS = [
  '/login',
  '/api/auth/login',
];

/**
 * Rutas que deben ignorarse por el middleware
 * (archivos estáticos, imágenes, health checks)
 */
const RUTAS_IGNORADAS = [
  '/_next',
  '/favicon.ico',
  '/api/health',
];

/**
 * Middleware principal
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1️⃣ Ignorar rutas de archivos estáticos y health checks
  if (RUTAS_IGNORADAS.some(ruta => pathname.startsWith(ruta))) {
    return NextResponse.next();
  }
  
  // 2️⃣ Permitir rutas públicas (login y auth)
  if (RUTAS_PUBLICAS.some(ruta => pathname === ruta || pathname.startsWith(ruta))) {
    return NextResponse.next();
  }
  
  // 3️⃣ Verificar si hay sesión activa
  const sessionCookie = request.cookies.get('session');
  
  if (!sessionCookie?.value) {
    // No hay sesión - redirigir a login
    const loginUrl = new URL('/login', request.url);
    
    // Guardar URL original para redirección post-login (opcional)
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
  
  // 4️⃣ Validar que la sesión tenga estructura válida
  try {
    const sessionData = JSON.parse(sessionCookie.value);
    
    if (!sessionData.id || !sessionData.email) {
      // Sesión inválida - limpiar cookie
      const isApi = pathname.startsWith('/api');
      const response = isApi
        ? NextResponse.json(
            { success: false, error: 'Sesión inválida' },
            { status: 401 }
          )
        : NextResponse.redirect(new URL('/login', request.url));
      
      response.cookies.delete('session');
      return response;
    }
  } catch (error) {
    // Error al parsear sesión - limpiar y redirigir
    const isApi = pathname.startsWith('/api');
    const response = isApi
      ? NextResponse.json(
          { success: false, error: 'Sesión corrupta' },
          { status: 401 }
        )
      : NextResponse.redirect(new URL('/login', request.url));
    
    response.cookies.delete('session');
    return response;
  }
  
  // ✅ Sesión válida - permitir acceso
  // Nota: La autorización por permisos RBAC se maneja en cada API route
  return NextResponse.next();
}

/**
 * Configuración del matcher
 * Define qué rutas deben pasar por el middleware
 * 
 * Incluye:
 * - /dashboard/* (todas las rutas del dashboard)
 * - /solicitudes/* (gestión de solicitudes)
 * - /api/* (todas las APIs excepto /api/auth/login)
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
