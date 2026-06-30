/**
 * Integration tests — workflow.service (camino crítico de aprobación)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { crearSolicitud } from '@/services/solicitudes.service';
import { ejecutarAccion } from '@/services/workflow.service';
import {
  crearDatosBaseTest,
  crearUsuarioTest,
  crearBalanceTest,
} from '../helpers/test-data';
import './setup';

const FECHA_INICIO_LAB = '2026-04-06';
const FECHA_FIN_LAB = '2026-04-10';
const DIAS_LAB = 5;

describe('Workflow Service - Integration Tests', () => {
  let datosBase: Awaited<ReturnType<typeof crearDatosBaseTest>>;
  let empleado: Awaited<ReturnType<typeof crearUsuarioTest>>;
  let jefe: Awaited<ReturnType<typeof crearUsuarioTest>>;
  let rrhh: Awaited<ReturnType<typeof crearUsuarioTest>>;
  let admin: Awaited<ReturnType<typeof crearUsuarioTest>>;

  beforeEach(async () => {
    datosBase = await crearDatosBaseTest();

    empleado = await crearUsuarioTest({
      nombre: 'Ana',
      apellido: 'López',
      email: 'ana.workflow@example.com',
      password: 'password123',
      departamentoId: datosBase.departamento.id,
      rolId: datosBase.roles.empleado.id,
    });

    jefe = await crearUsuarioTest({
      nombre: 'Pedro',
      apellido: 'Sánchez',
      email: 'pedro.workflow@example.com',
      password: 'password123',
      departamentoId: datosBase.departamento.id,
      rolId: datosBase.roles.jefe.id,
    });

    rrhh = await crearUsuarioTest({
      nombre: 'Laura',
      apellido: 'Méndez',
      email: 'laura.workflow@example.com',
      password: 'password123',
      departamentoId: datosBase.departamento.id,
      rolId: datosBase.roles.rrhh.id,
    });

    admin = await crearUsuarioTest({
      nombre: 'Admin',
      apellido: 'Sistema',
      email: 'admin.workflow@example.com',
      password: 'password123',
      departamentoId: datosBase.departamento.id,
      rolId: datosBase.roles.admin.id,
    });

    await crearBalanceTest({
      usuarioId: empleado.id,
      anoLaboralId: datosBase.anoLaboral.id,
      cantidadAsignada: 15,
      cantidadDisponible: 15,
      tipoAusencia: 'vacaciones',
    });

    const { db } = await import('@/lib/db');
    const { usuarios } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db
      .update(usuarios)
      .set({ jefeSuperiorId: jefe.id, esJefe: false })
      .where(eq(usuarios.id, empleado.id));

    await db.update(usuarios).set({ esJefe: true }).where(eq(usuarios.id, jefe.id));
    await db.update(usuarios).set({ esRrhh: true }).where(eq(usuarios.id, rrhh.id));
    await db.update(usuarios).set({ esAdmin: true }).where(eq(usuarios.id, admin.id));
  });

  it('camino feliz: crear → jefe → RRHH → finalizar (admin)', async () => {
    const solicitud = await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: FECHA_INICIO_LAB,
      fechaFin: FECHA_FIN_LAB,
      diasSolicitados: DIAS_LAB,
      motivo: 'Flujo completo',
    });

    expect(solicitud.estado).toBe('pendiente_jefe');

    const pasoJefe = await ejecutarAccion({
      solicitudId: solicitud.id,
      accion: 'aprobar_jefe',
      usuarioId: jefe.id,
      esDirector: false,
      esJefe: true,
      esRrhh: false,
      esAdmin: false,
      departamentoId: datosBase.departamento.id,
    });
    expect(pasoJefe.exito).toBe(true);
    expect(pasoJefe.solicitud?.estado).toBe('aprobada_jefe');

    const pasoRrhh = await ejecutarAccion({
      solicitudId: solicitud.id,
      accion: 'aprobar_rrhh',
      usuarioId: rrhh.id,
      esDirector: false,
      esJefe: false,
      esRrhh: true,
      esAdmin: false,
    });
    expect(pasoRrhh.exito).toBe(true);
    expect(pasoRrhh.solicitud?.estado).toBe('aprobada_rrhh');

    const pasoFinal = await ejecutarAccion({
      solicitudId: solicitud.id,
      accion: 'finalizar',
      usuarioId: admin.id,
      esDirector: false,
      esJefe: false,
      esRrhh: false,
      esAdmin: true,
    });
    expect(pasoFinal.exito).toBe(true);
    expect(pasoFinal.solicitud?.estado).toBe('finalizada');

    const { db } = await import('@/lib/db');
    const { balances } = await import('@/lib/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const balance = await db.query.balances.findFirst({
      where: and(
        eq(balances.usuarioId, empleado.id),
        eq(balances.anoLaboralId, datosBase.anoLaboral.id)
      ),
    });

    expect(parseFloat(balance!.cantidadPendiente)).toBe(0);
    expect(parseFloat(balance!.cantidadUsada)).toBe(DIAS_LAB);
    expect(parseFloat(balance!.cantidadDisponible)).toBe(10);
  });

  it('cancelación por empleado libera días pendientes', async () => {
    const solicitud = await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: FECHA_INICIO_LAB,
      fechaFin: FECHA_FIN_LAB,
      diasSolicitados: DIAS_LAB,
    });

    const cancelacion = await ejecutarAccion({
      solicitudId: solicitud.id,
      accion: 'cancelar',
      usuarioId: empleado.id,
      esDirector: false,
      esJefe: false,
      esRrhh: false,
      esAdmin: false,
      motivoCancelacion: 'Ya no viajo',
    });

    expect(cancelacion.exito).toBe(true);
    expect(cancelacion.solicitud?.estado).toBe('cancelada');

    const { db } = await import('@/lib/db');
    const { balances } = await import('@/lib/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const balance = await db.query.balances.findFirst({
      where: and(
        eq(balances.usuarioId, empleado.id),
        eq(balances.anoLaboralId, datosBase.anoLaboral.id)
      ),
    });

    expect(parseFloat(balance!.cantidadPendiente)).toBe(0);
    expect(parseFloat(balance!.cantidadDisponible)).toBe(15);
  });
});
