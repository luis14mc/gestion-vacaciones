import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  notificacionesCumpleanosMensuales,
  usuarios,
} from '@/lib/db/schema';
import { nombreMes } from '@/lib/domain/cumpleanos';
import { notificarMesCumpleanos } from '@/services/email.service';
import { registrarAuditoria } from '@/services/auditoria.service';

export async function notificarCumpleanosDelMes(referencia: Date = new Date()) {
  const anio = referencia.getFullYear();
  const mes = referencia.getMonth() + 1;
  const candidatos = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
    })
    .from(usuarios)
    .where(and(
      eq(usuarios.activo, true),
      isNull(usuarios.deletedAt),
      sql`${usuarios.fechaNacimiento} IS NOT NULL`,
      sql`EXTRACT(MONTH FROM ${usuarios.fechaNacimiento}) = ${mes}`
    ));

  let enviadas = 0;
  let omitidas = 0;
  let errores = 0;

  for (const usuario of candidatos) {
    const claim = await db
      .insert(notificacionesCumpleanosMensuales)
      .values({ usuarioId: usuario.id, anio, mes })
      .onConflictDoNothing()
      .returning({ id: notificacionesCumpleanosMensuales.id });

    if (claim.length === 0) {
      omitidas++;
      continue;
    }

    const enviada = await notificarMesCumpleanos(
      usuario.email,
      `${usuario.nombre} ${usuario.apellido}`,
      nombreMes(mes)
    );

    if (!enviada) {
      errores++;
      await db
        .delete(notificacionesCumpleanosMensuales)
        .where(eq(notificacionesCumpleanosMensuales.id, claim[0]!.id));
      await registrarAuditoria({
        usuarioId: usuario.id,
        accion: 'notificacion_fallida',
        tablaAfectada: 'notificaciones_cumpleanos_mensuales',
        detalles: { evento: 'recordatorio_cumpleanos_mensual', anio, mes },
      });
      continue;
    }

    enviadas++;
    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: 'notificar',
      tablaAfectada: 'notificaciones_cumpleanos_mensuales',
      registroId: claim[0]!.id,
      detalles: { evento: 'recordatorio_cumpleanos_mensual', anio, mes },
    });
  }

  return { anio, mes, candidatos: candidatos.length, enviadas, omitidas, errores };
}

