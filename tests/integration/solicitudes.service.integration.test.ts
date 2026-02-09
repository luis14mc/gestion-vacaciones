/**
 * =====================================================
 * INTEGRATION TESTS - Solicitudes Service
 * =====================================================
 * @description Tests de integración con BD real
 * @version 5.0 - CNI Schema
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  getSeedUser,
  getCurrentAnoLaboral,
  createTestBalance,
} from './setup';
import {
  crearSolicitud,
  aprobarSolicitudJefe,
  aprobarSolicitudRRHH,
  rechazarSolicitud,
  obtenerSolicitudPorId,
} from '../../src/services/solicitudes.service';
import { solicitudes, balances } from '../../src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// =====================================================
// SUITE: crearSolicitud()
// =====================================================
describe('solicitudes.service - crearSolicitud()', () => {
  let empleado: Awaited<ReturnType<typeof getSeedUser>>;
  let anoLaboral: Awaited<ReturnType<typeof getCurrentAnoLaboral>>;
  let balanceId: number;

  beforeEach(async () => {
    // Obtener datos de seed
    empleado = await getSeedUser('ana.dev@cni.cl');
    anoLaboral = await getCurrentAnoLaboral();

    // Crear balance de prueba para el empleado
    const balance = await createTestBalance({
      usuarioId: empleado.id,
      anoLaboralId: anoLaboral.id,
      cantidadAsignada: 15,
    });
    
    balanceId = balance.id;
  });

  it('✅ Crea solicitud con código SOL-2026-XXXXX auto-generado', async () => {
    const solicitud = await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: '2026-03-10',
      fechaFin: '2026-03-14',
      diasSolicitados: 5,
      motivo: 'Vacaciones familiares',
    });

    expect(solicitud).toBeDefined();
    expect(solicitud.codigo).toMatch(/^SOL-2026-\d+$/);
    expect(solicitud.usuarioId).toBe(empleado.id);
    expect(solicitud.diasSolicitados).toBe('5.00');
    expect(solicitud.estado).toBe('pendiente_jefe');
  });

  it('✅ Actualiza balance.cantidadPendiente al crear solicitud', async () => {
    // Verificar balance antes
    const balanceAntes = await db.query.balances.findFirst({
      where: eq(balances.id, balanceId),
    });
    expect(balanceAntes?.cantidadPendiente).toBe('0.00');
    expect(balanceAntes?.cantidadDisponible).toBe('15.00');

    // Crear solicitud
    await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: '2026-03-10',
      fechaFin: '2026-03-14',
      diasSolicitados: 5,
      motivo: 'Test',
    });

    // Verificar balance después
    const balanceDespues = await db.query.balances.findFirst({
      where: eq(balances.id, balanceId),
    });
    expect(balanceDespues?.cantidadPendiente).toBe('5.00');
    expect(balanceDespues?.cantidadDisponible).toBe('10.00'); // 15 - 5
  });

  it('❌ Rechaza si balance insuficiente', async () => {
    await expect(
      crearSolicitud({
        usuarioId: empleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-10',
        fechaFin: '2026-03-30',
        diasSolicitados: 20,
        motivo: 'Test',
      })
    ).rejects.toThrow(/balance insuficiente|días disponibles/i);
  });

  it('❌ Valida que fecha_inicio < fecha_fin', async () => {
    await expect(
      crearSolicitud({
        usuarioId: empleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-20',
        fechaFin: '2026-03-10',
        diasSolicitados: 5,
        motivo: 'Test',
      })
    ).rejects.toThrow(/fecha/i);
  });

  it('❌ Valida que cantidad > 0', async () => {
    await expect(
      crearSolicitud({
        usuarioId: empleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-10',
        fechaFin: '2026-03-10',
        diasSolicitados: 0,
        motivo: 'Test',
      })
    ).rejects.toThrow(/cantidad|días/i);
  });

  it('✅ Rollback en error (transacción)', async () => {
    // Simular error forzando usuario inválido
    const solicitudesAntes = await db.select().from(solicitudes).where(
      sql`metadata->>'test' = 'true'`
    );
    const countAntes = solicitudesAntes.length;

    try {
      await crearSolicitud({
        usuarioId: 999999,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-10',
        fechaFin: '2026-03-14',
        diasSolicitados: 5,
        motivo: 'Test',
      });
    } catch (error) {
      // Esperamos el error
    }

    // Verificar que no se creó ninguna solicitud
    const solicitudesDespues = await db.select().from(solicitudes).where(
      sql`metadata->>'test' = 'true'`
    );
    expect(solicitudesDespues.length).toBe(countAntes);
  });
});

// =====================================================
// SUITE: aprobarSolicitudJefe()
// =====================================================
describe('solicitudes.service - aprobarSolicitudJefe()', () => {
  let empleado: Awaited<ReturnType<typeof getSeedUser>>;
  let jefe: Awaited<ReturnType<typeof getSeedUser>>;
  let anoLaboral: Awaited<ReturnType<typeof getCurrentAnoLaboral>>;
  let solicitudId: number;

  beforeEach(async () => {
    // Obtener datos
    empleado = await getSeedUser('ana.dev@cni.cl');
    jefe = await getSeedUser('jefe.ti@cni.cl');
    anoLaboral = await getCurrentAnoLaboral();

    // Crear balance
    await createTestBalance({
      usuarioId: empleado.id,
      anoLaboralId: anoLaboral.id,
      cantidadAsignada: 15,
    });

    // Crear solicitud pendiente
    const solicitud = await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: '2026-03-10',
      fechaFin: '2026-03-14',
      diasSolicitados: 5,
      motivo: 'Test',
    });
    solicitudId = solicitud.id;
  });

  it('✅ Cambia estado a "aprobada_jefe"', async () => {
    const resultado = await aprobarSolicitudJefe(
      solicitudId,
      jefe.id,
      'Aprobado por jefe'
    );

    expect(resultado.estado).toBe('aprobada_jefe');
    expect(resultado.aprobadaJefePor).toBe(jefe.id);
    expect(resultado.aprobadaJefeFecha).toBeDefined();
  });

  it('✅ Incrementa campo "version" (optimistic locking)', async () => {
    const solicitudAntes = await obtenerSolicitudPorId(solicitudId);
    const versionAntes = solicitudAntes?.version || 1;

    const resultado = await aprobarSolicitudJefe(
      solicitudId,
      jefe.id,
      'Test'
    );

    expect(resultado.version).toBe(versionAntes + 1);
  });

  it('❌ Rechaza si estado no es "pendiente_jefe"', async () => {
    // Aprobar una vez
    await aprobarSolicitudJefe(solicitudId, jefe.id, 'Primera aprobación');

    // Intentar aprobar de nuevo
    await expect(
      aprobarSolicitudJefe(solicitudId, jefe.id, 'Segunda aprobación')
    ).rejects.toThrow(/estado|pendiente/i);
  });

  it('✅ Detecta lost updates (optimistic locking)', async () => {
    // Simular dos aprobaciones concurrentes
    const promesa1 = aprobarSolicitudJefe(solicitudId, jefe.id, 'Aprobación 1');
    const promesa2 = aprobarSolicitudJefe(solicitudId, jefe.id, 'Aprobación 2');

    const resultados = await Promise.allSettled([promesa1, promesa2]);
    
    // Una debe tener éxito, la otra debe fallar
    const exitos = resultados.filter(r => r.status === 'fulfilled');
    const fallos = resultados.filter(r => r.status === 'rejected');
    
    expect(exitos.length).toBe(1);
    expect(fallos.length).toBe(1);
  });
});

// =====================================================
// SUITE: aprobarSolicitudRRHH()
// =====================================================
describe('solicitudes.service - aprobarSolicitudRRHH()', () => {
  let empleado: Awaited<ReturnType<typeof getSeedUser>>;
  let jefe: Awaited<ReturnType<typeof getSeedUser>>;
  let rrhh: Awaited<ReturnType<typeof getSeedUser>>;
  let anoLaboral: Awaited<ReturnType<typeof getCurrentAnoLaboral>>;
  let solicitudId: number;
  let balanceId: number;

  beforeEach(async () => {
    // Obtener datos
    empleado = await getSeedUser('ana.dev@cni.cl');
    jefe = await getSeedUser('jefe.ti@cni.cl');
    rrhh = await getSeedUser('rrhh@cni.cl');
    anoLaboral = await getCurrentAnoLaboral();

    // Crear balance
    const balance = await createTestBalance({
      usuarioId: empleado.id,
      anoLaboralId: anoLaboral.id,
      cantidadAsignada: 15,
    });
    balanceId = balance.id;

    // Crear y aprobar por jefe
    const solicitud = await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: '2026-03-10',
      fechaFin: '2026-03-14',
      diasSolicitados: 5,
      motivo: 'Test',
    });
    solicitudId = solicitud.id;

    await aprobarSolicitudJefe(solicitudId, jefe.id, 'Aprobado por jefe');
  });

  it('✅ Cambia estado a "aprobada" (aprobación final)', async () => {
    const resultado = await aprobarSolicitudRRHH(
      solicitudId,
      rrhh.id,
      'Aprobado por RRHH'
    );

    expect(resultado.estado).toBe('aprobada_rrhh');
    expect(resultado.aprobadaRrhhPor).toBe(rrhh.id);
    expect(resultado.aprobadaRrhhFecha).toBeDefined();
  });

  it('✅ Mueve días: pendiente → utilizada en balance', async () => {
    // Verificar balance antes
    const balanceAntes = await db.query.balances.findFirst({
      where: eq(balances.id, balanceId),
    });
    expect(balanceAntes?.cantidadPendiente).toBe('5.00');

    // Aprobar por RRHH
    await aprobarSolicitudRRHH(solicitudId, rrhh.id, 'Aprobado');

    // Verificar balance después
    const balanceDespues = await db.query.balances.findFirst({
      where: eq(balances.id, balanceId),
    });
    expect(balanceDespues?.cantidadPendiente).toBe('0.00');
    expect(balanceDespues?.cantidadUsada).toBe('5.00');
    expect(balanceDespues?.cantidadDisponible).toBe('10.00');
  });

  it('❌ Rechaza si estado no es "aprobada_jefe"', async () => {
    // Crear nueva solicitud sin aprobar por jefe
    const balance2 = await createTestBalance({
      usuarioId: empleado.id,
      anoLaboralId: anoLaboral.id + 1,
      cantidadAsignada: 15,
    });

    const nuevaSolicitud = await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: '2026-04-10',
      fechaFin: '2026-04-14',
      diasSolicitados: 5,
      motivo: 'Test',
    });

    // Intentar aprobar por RRHH directamente
    await expect(
      aprobarSolicitudRRHH(nuevaSolicitud.id, rrhh.id, 'Test')
    ).rejects.toThrow(/aprobada_jefe|estado/i);
  });
});

// =====================================================
// SUITE: rechazarSolicitud()
// =====================================================
describe('solicitudes.service - rechazarSolicitud()', () => {
  let empleado: Awaited<ReturnType<typeof getSeedUser>>;
  let jefe: Awaited<ReturnType<typeof getSeedUser>>;
  let anoLaboral: Awaited<ReturnType<typeof getCurrentAnoLaboral>>;
  let solicitudId: number;
  let balanceId: number;

  beforeEach(async () => {
    // Obtener datos
    empleado = await getSeedUser('ana.dev@cni.cl');
    jefe = await getSeedUser('jefe.ti@cni.cl');
    anoLaboral = await getCurrentAnoLaboral();

    // Crear balance
    const balance = await createTestBalance({
      usuarioId: empleado.id,
      anoLaboralId: anoLaboral.id,
      cantidadAsignada: 15,
    });
    balanceId = balance.id;

    // Crear solicitud
    const solicitud = await crearSolicitud({
      usuarioId: empleado.id,
      tipo: 'vacaciones',
      fechaInicio: '2026-03-10',
      fechaFin: '2026-03-14',
      diasSolicitados: 5,
      motivo: 'Test',
    });
    solicitudId = solicitud.id;
  });

  it('✅ Cambia estado a "rechazada"', async () => {
    const resultado = await rechazarSolicitud(
      solicitudId,
      jefe.id,
      'No hay cobertura en el departamento'
    );

    expect(resultado.estado).toBe('rechazada_jefe');
    expect(resultado.rechazadaPor).toBe(jefe.id);
    expect(resultado.motivoRechazo).toContain('cobertura');
  });

  it('✅ Devuelve días a balance.cantidadDisponible', async () => {
    // Verificar balance antes (debe tener 5 días pendientes)
    const balanceAntes = await db.query.balances.findFirst({
      where: eq(balances.id, balanceId),
    });
    expect(balanceAntes?.cantidadPendiente).toBe('5.00');
    expect(balanceAntes?.cantidadDisponible).toBe('10.00'); // 15 - 5

    // Rechazar solicitud
    await rechazarSolicitud(solicitudId, jefe.id, 'Rechazado');

    // Verificar balance después
    const balanceDespues = await db.query.balances.findFirst({
      where: eq(balances.id, balanceId),
    });
    expect(balanceDespues?.cantidadPendiente).toBe('0.00');
    expect(balanceDespues?.cantidadDisponible).toBe('15.00'); // devuelve los 5
  });

  it('✅ Registra motivo de rechazo', async () => {
    const motivo = 'No hay suficiente personal en esas fechas';
    
    const resultado = await rechazarSolicitud(solicitudId, jefe.id, motivo);

    expect(resultado.motivoRechazo).toBe(motivo);
    expect(resultado.rechazadaFecha).toBeDefined();
  });

  it('❌ Rechaza si solicitud ya está aprobada', async () => {
    // Aprobar la solicitud primero
    await aprobarSolicitudJefe(solicitudId, jefe.id, 'Aprobado');

    // Intentar rechazar
    await expect(
      rechazarSolicitud(solicitudId, jefe.id, 'Cambio de opinión')
    ).rejects.toThrow(/estado|aprobada/i);
  });
});
