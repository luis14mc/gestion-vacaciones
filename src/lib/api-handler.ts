import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * ============================================================
 * API HANDLER (Security & Error Management)
 * ============================================================
 * @description Wrapper centralizado para rutas API. 
 * Implementa OWASP A04/A05:2026 previniendo fuga de información (Information Leakage).
 * Atrapa errores internos y retorna mensajes estandarizados.
 * Maneja validaciones Zod automáticamente.
 * ============================================================
 */

export function withErrorHandler(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      // 1. Manejo de Errores de Validación (Zod)
      if (error instanceof z.ZodError) {
        const issues = error.issues ?? [];
        return NextResponse.json(
          {
            success: false,
            error: "Error de validación de datos",
            detalles: issues.map((e: any) => ({
              campo: e.path.join("."),
              mensaje: e.message,
            })),
          },
          { status: 400 }
        );
      }

      // 2. Loggeo del error interno (solo visible en el servidor, no en el cliente)
      console.error(
        `[API Error] ${req.method} ${req.nextUrl.pathname}:`,
        error instanceof Error ? error.stack : error
      );

      // 3. Respuesta estandarizada genérica (Information Leakage Prevention)
      // OWASP: Nunca retornar error.message directo si proviene de la DB o sistema interno.
      return NextResponse.json(
        {
          success: false,
          error: "Ocurrió un error inesperado al procesar la solicitud. Contacte a soporte si el problema persiste.",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  };
}
