import { NextRequest, NextResponse } from "next/server";
import { getSession, tienePermiso } from "@/lib/auth";
import { db } from "@/lib/db";
import { solicitudes, usuarios } from "@/lib/db/schema";
import { eq, and, isNull, gte, lte, or, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // 2. Verificar permisos - calendario es público para usuarios autenticados
    // Pero filtraremos datos según permisos
    const puedeVerTodo = tienePermiso(session, 'vacaciones.solicitudes.ver_todas');
    const esJefe = session.roles?.some(r => r.codigo === 'JEFE');
    const esEmpleado = !puedeVerTodo && !esJefe;

    const searchParams = request.nextUrl.searchParams;
    const mes = searchParams.get("mes") || String(new Date().getMonth() + 1);
    const anio = searchParams.get("anio") || String(new Date().getFullYear());

    // Calcular primer y último día del mes
    const primerDia = new Date(Number(anio), Number(mes) - 1, 1);
    const ultimoDia = new Date(Number(anio), Number(mes), 0);
    
    // Convertir a strings para comparación con DATE columns
    const primerDiaStr = primerDia.toISOString().split('T')[0];
    const ultimoDiaStr = ultimoDia.toISOString().split('T')[0];

    // 3. Construir condiciones según permisos
    let whereConditions: any = and(
      isNull(solicitudes.deletedAt),
      or(
        eq(solicitudes.estado, "aprobada_rrhh"),
        eq(solicitudes.estado, "finalizada")
      ),
      or(
        // La solicitud comienza en el mes
        and(
          gte(solicitudes.fechaInicio, primerDiaStr),
          lte(solicitudes.fechaInicio, ultimoDiaStr)
        ),
        // La solicitud termina en el mes
        and(
          gte(solicitudes.fechaFin, primerDiaStr),
          lte(solicitudes.fechaFin, ultimoDiaStr)
        ),
        // La solicitud abarca todo el mes
        and(
          lte(solicitudes.fechaInicio, primerDiaStr),
          gte(solicitudes.fechaFin, ultimoDiaStr)
        )
      )
    );

    // Si es empleado sin permisos, solo ver sus propias solicitudes
    if (esEmpleado) {
      whereConditions = and(whereConditions, eq(solicitudes.usuarioId, session.id));
    }
    // Si es jefe, ver solo su departamento
    else if (esJefe && session.departamentoId && !puedeVerTodo) {
      const usuariosDept = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(and(
          eq(usuarios.departamentoId, session.departamentoId),
          isNull(usuarios.deletedAt)
        ));
      const usuariosIds = usuariosDept.map(u => u.id);
      if (usuariosIds.length > 0) {
        whereConditions = and(whereConditions, inArray(solicitudes.usuarioId, usuariosIds));
      }
    }

    // Obtener solicitudes del mes (aprobadas o en uso)
    const solicitudesMes = await db
      .select({
        id: solicitudes.id,
        usuarioId: solicitudes.usuarioId,
        fechaInicio: solicitudes.fechaInicio,
        fechaFin: solicitudes.fechaFin,
        estado: solicitudes.estado,
        usuario: {
          id: usuarios.id,
          nombre: usuarios.nombre,
          apellido: usuarios.apellido,
        },
      })
      .from(solicitudes)
      .innerJoin(usuarios, eq(solicitudes.usuarioId, usuarios.id))
      .where(whereConditions)
      .orderBy(solicitudes.fechaInicio);

    // Generar estructura del calendario
    const diasMes: any[] = [];
    const fecha = new Date(primerDia);
    
    while (fecha <= ultimoDia) {
      const dia = fecha.getDate();
      const fechaActual = new Date(fecha);
      
      // Buscar solicitudes para este día
      const solicitudesDelDia = solicitudesMes.filter(s => {
        const inicio = s.fechaInicio ? new Date(s.fechaInicio) : null;
        const fin = s.fechaFin ? new Date(s.fechaFin) : null;
        
        if (!inicio || !fin) return false;
        
        return fechaActual >= inicio && fechaActual <= fin;
      });

      diasMes.push({
        dia,
        fecha: fechaActual.toISOString().split('T')[0],
        diaSemana: fechaActual.getDay(), // 0 = Domingo, 6 = Sábado
        solicitudes: solicitudesDelDia.map(s => ({
          id: s.id,
          usuario: `${s.usuario.nombre} ${s.usuario.apellido}`,
          estado: s.estado,
        })),
        tieneVacaciones: solicitudesDelDia.length > 0,
        esFinde: fechaActual.getDay() === 0 || fechaActual.getDay() === 6,
      });
      
      fecha.setDate(fecha.getDate() + 1);
    }

    // Estadísticas del mes
    const totalDiasConVacaciones = diasMes.filter(d => d.tieneVacaciones && !d.esFinde).length;
    const usuariosUnicos = new Set(solicitudesMes.map(s => s.usuarioId)).size;

    return NextResponse.json({
      success: true,
      data: {
        mes: Number(mes),
        anio: Number(anio),
        nombreMes: new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString("es-ES", { month: "long" }),
        dias: diasMes,
        estadisticas: {
          totalDiasConVacaciones,
          usuariosEnVacaciones: usuariosUnicos,
          totalSolicitudes: solicitudesMes.length,
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo calendario:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener calendario" },
      { status: 500 }
    );
  }
}
