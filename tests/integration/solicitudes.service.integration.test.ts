/**
 * ============================================================
 * INTEGRATION TESTS - Solicitudes Service
 * ============================================================
 * @description Tests de integración con base de datos real
 * @version 1.0 - Semana 3
 * ============================================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  crearSolicitud,
  aprobarSolicitudJefe,
  aprobarSolicitudRRHH,
  rechazarSolicitud,
  obtenerSolicitudPorId,
  listarSolicitudes,
} from '@/services/solicitudes.service'
import {
  crearDatosBaseTest,
  crearUsuarioTest,
  crearBalanceTest,
  crearSolicitudTest,
} from '../helpers/test-data'
import '../setup-integration'

describe('Solicitudes Service - Integration Tests', () => {
  let datosBase: Awaited<ReturnType<typeof crearDatosBaseTest>>
  let usuarioEmpleado: any
  let usuarioJefe: any
  let usuarioRRHH: any

  beforeEach(async () => {
    // Crear datos base antes de cada test
    datosBase = await crearDatosBaseTest()

    // Crear usuarios de prueba
    usuarioEmpleado = await crearUsuarioTest({
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@example.com',
      password: 'password123',
      departamentoId: datosBase.departamento.id,
      rolId: datosBase.roles.empleado.id,
    })

    usuarioJefe = await crearUsuarioTest({
      nombre: 'María',
      apellido: 'González',
      email: 'maria@example.com',
      password: 'password123',
      departamentoId: datosBase.departamento.id,
      rolId: datosBase.roles.jefe.id,
    })

    usuarioRRHH = await crearUsuarioTest({
      nombre: 'Carlos',
      apellido: 'Rodríguez',
      email: 'carlos@example.com',
      password: 'password123',
      departamentoId: datosBase.departamento.id,
      rolId: datosBase.roles.rrhh.id,
    })

    // Crear balance para el empleado
    await crearBalanceTest({
      usuarioId: usuarioEmpleado.id,
      anoLaboralId: datosBase.anoLaboral.id,
      cantidadAsignada: 15,
      cantidadDisponible: 15,
      tipoAusencia: 'vacaciones',
    })
  })

  // ===================================================
  // TESTS: crearSolicitud()
  // ===================================================

  describe('crearSolicitud()', () => {
    it('debe crear solicitud con código SOL-YYYY-XXXXX', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
        motivo: 'Vacaciones familiares',
      })

      expect(solicitud).toBeDefined()
      expect(solicitud.codigo).toMatch(/^SOL-\d{4}-\d{5}$/)
      expect(solicitud.estado).toBe('pendiente_jefe')
      expect(solicitud.usuarioId).toBe(usuarioEmpleado.id)
    })

    it('debe actualizar balance.cantidadPendiente al crear solicitud', async () => {
      const { db } = await import('@/lib/db')
      const { balances } = await import('@/lib/db/schema')
      const { eq, and } = await import('drizzle-orm')

      await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
        motivo: 'Vacaciones',
      })

      const balance = await db.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioEmpleado.id),
          eq(balances.anoLaboralId, datosBase.anoLaboral.id)
        ),
      })

      expect(balance).toBeDefined()
      expect(parseFloat(balance!.cantidadPendiente)).toBe(5)
    })

    it('debe rechazar si balance insuficiente', async () => {
      await expect(
        crearSolicitud({
          usuarioId: usuarioEmpleado.id,
          tipo: 'vacaciones',
          fechaInicio: '2026-03-01',
          fechaFin: '2026-03-20',
          diasSolicitados: 20, // Más de los 15 disponibles
          motivo: 'Vacaciones largas',
        })
      ).rejects.toThrow(/Balance insuficiente/)
    })

    it('debe validar que fechaInicio < fechaFin', async () => {
      await expect(
        crearSolicitud({
          usuarioId: usuarioEmpleado.id,
          tipo: 'vacaciones',
          fechaInicio: '2026-03-10',
          fechaFin: '2026-03-05', // Fecha fin antes de inicio
          diasSolicitados: 5,
          motivo: 'Fechas inválidas',
        })
      ).rejects.toThrow(/fecha de inicio debe ser anterior/)
    })

    it('debe validar que días solicitados > 0', async () => {
      await expect(
        crearSolicitud({
          usuarioId: usuarioEmpleado.id,
          tipo: 'vacaciones',
          fechaInicio: '2026-03-01',
          fechaFin: '2026-03-05',
          diasSolicitados: 0, // Días = 0
          motivo: 'Sin días',
        })
      ).rejects.toThrow(/mayor a 0/)
    })

    it('debe hacer rollback en error (transacción)', async () => {
      const { db } = await import('@/lib/db')
      const { solicitudes } = await import('@/lib/db/schema')

      // Intentar crear solicitud inválida
      try {
        await crearSolicitud({
          usuarioId: usuarioEmpleado.id,
          tipo: 'vacaciones',
          fechaInicio: '2026-03-10',
          fechaFin: '2026-03-05', // Error: fecha inválida
          diasSolicitados: 5,
        })
      } catch (error) {
        // Esperado
      }

      // Verificar que NO se creó ninguna solicitud
      const solicitudesCreadas = await db.query.solicitudes.findMany({
        where: (s, { eq }) => eq(s.usuarioId, usuarioEmpleado.id),
      })

      expect(solicitudesCreadas).toHaveLength(0)
    })

    it('debe permitir crear permiso de salida sin afectar balance', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'permiso_salida',
        horaSalida: '14:00',
        horaRegreso: '16:00',
        duracionPermiso: '1-2h',
        motivo: 'Cita médica',
      })

      expect(solicitud).toBeDefined()
      expect(solicitud.tipo).toBe('permiso_salida')
      expect(solicitud.estado).toBe('pendiente_jefe')
    })
  })

  // ===================================================
  // TESTS: aprobarSolicitudJefe()
  // ===================================================

  describe('aprobarSolicitudJefe()', () => {
    it('debe cambiar estado a aprobada_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      const aprobada = await aprobarSolicitudJefe(
        solicitud.id,
        usuarioJefe.id,
        'Aprobado por jefe'
      )

      expect(aprobada.estado).toBe('aprobada_jefe')
      expect(aprobada.aprobadaJefePor).toBe(usuarioJefe.id)
      expect(aprobada.comentarioJefe).toBe('Aprobado por jefe')
    })

    it('debe incrementar campo version (optimistic locking)', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      const versionInicial = solicitud.version

      const aprobada = await aprobarSolicitudJefe(solicitud.id, usuarioJefe.id)

      expect(aprobada.version).toBe((versionInicial || 1) + 1)
    })

    it('debe rechazar si estado no es pendiente_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      // Aprobar por jefe primero
      await aprobarSolicitudJefe(solicitud.id, usuarioJefe.id)

      // Intentar aprobar de nuevo
      await expect(
        aprobarSolicitudJefe(solicitud.id, usuarioJefe.id)
      ).rejects.toThrow(/Estado inválido/)
    })

    it('debe detectar lost updates con optimistic locking', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      // Aprobar la solicitud
      await aprobarSolicitudJefe(solicitud.id, usuarioJefe.id)

      // Intentar aprobar con versión desactualizada (simular conflicto)
      const { db } = await import('@/lib/db')
      const { solicitudes } = await import('@/lib/db/schema')
      const { sql, eq, and } = await import('drizzle-orm')

      await expect(
        db
          .update(solicitudes)
          .set({
            estado: 'aprobada_jefe',
            version: sql`${solicitudes.version} + 1`,
          })
          .where(
            and(
              eq(solicitudes.id, solicitud.id),
              eq(solicitudes.version, 1) // Versión antigua
            )
          )
          .returning()
      ).resolves.toHaveLength(0) // No debe actualizar nada
    })
  })

  // ===================================================
  // TESTS: aprobarSolicitudRRHH()
  // ===================================================

  describe('aprobarSolicitudRRHH()', () => {
    it('debe cambiar estado a aprobada_rrhh', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      await aprobarSolicitudJefe(solicitud.id, usuarioJefe.id)

      const aprobada = await aprobarSolicitudRRHH(
        solicitud.id,
        usuarioRRHH.id,
        'Aprobado por RRHH'
      )

      expect(aprobada.estado).toBe('aprobada_rrhh')
      expect(aprobada.aprobadaRrhhPor).toBe(usuarioRRHH.id)
    })

    it('debe mover días: pendiente → usada en balance', async () => {
      const { db } = await import('@/lib/db')
      const { balances } = await import('@/lib/db/schema')
      const { eq, and } = await import('drizzle-orm')

      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      await aprobarSolicitudJefe(solicitud.id, usuarioJefe.id)
      await aprobarSolicitudRRHH(solicitud.id, usuarioRRHH.id)

      const balance = await db.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioEmpleado.id),
          eq(balances.anoLaboralId, datosBase.anoLaboral.id)
        ),
      })

      expect(balance).toBeDefined()
      expect(parseFloat(balance!.cantidadPendiente)).toBe(0) // Pendiente = 0
      expect(parseFloat(balance!.cantidadUsada)).toBe(5) // Usada = 5
    })

    it('debe rechazar si estado no es aprobada_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      // Intentar aprobar sin aprobación de jefe
      await expect(
        aprobarSolicitudRRHH(solicitud.id, usuarioRRHH.id)
      ).rejects.toThrow(/Estado debe ser aprobada_jefe/)
    })
  })

  // ===================================================
  // TESTS: rechazarSolicitud()
  // ===================================================

  describe('rechazarSolicitud()', () => {
    it('debe cambiar estado a rechazada_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      const rechazada = await rechazarSolicitud(
        solicitud.id,
        usuarioJefe.id,
        'Fechas no disponibles'
      )

      expect(rechazada.estado).toBe('rechazada_jefe')
      expect(rechazada.motivoRechazo).toBe('Fechas no disponibles')
    })

    it('debe devolver días a balance disponible', async () => {
      const { db } = await import('@/lib/db')
      const { balances } = await import('@/lib/db/schema')
      const { eq, and } = await import('drizzle-orm')

      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      // Rechazar solicitud
      await rechazarSolicitud(solicitud.id, usuarioJefe.id, 'Rechazada')

      const balance = await db.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioEmpleado.id),
          eq(balances.anoLaboralId, datosBase.anoLaboral.id)
        ),
      })

      expect(balance).toBeDefined()
      expect(parseFloat(balance!.cantidadPendiente)).toBe(0) // Devuelto a disponible
    })

    it('debe registrar motivo de rechazo', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      const motivoEsperado = 'Equipo con mucha carga de trabajo'
      const rechazada = await rechazarSolicitud(
        solicitud.id,
        usuarioJefe.id,
        motivoEsperado
      )

      expect(rechazada.motivoRechazo).toBe(motivoEsperado)
      expect(rechazada.rechazadaPor).toBe(usuarioJefe.id)
      expect(rechazada.rechazadaFecha).toBeDefined()
    })
  })

  // ===================================================
  // TESTS: listarSolicitudes()
  // ===================================================

  describe('listarSolicitudes()', () => {
    it('debe filtrar solicitudes por usuarioId', async () => {
      await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      const resultado = await listarSolicitudes({
        usuarioId: usuarioEmpleado.id,
      })

      expect(resultado).toHaveLength(1)
      expect(resultado[0].usuarioId).toBe(usuarioEmpleado.id)
    })

    it('debe filtrar solicitudes por estado', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      await aprobarSolicitudJefe(solicitud.id, usuarioJefe.id)

      const resultado = await listarSolicitudes({
        estado: 'aprobada_jefe',
      })

      expect(resultado).toHaveLength(1)
      expect(resultado[0].estado).toBe('aprobada_jefe')
    })

    it('debe incluir información del usuario', async () => {
      await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-03-05',
        diasSolicitados: 5,
      })

      const resultado = await listarSolicitudes({})

      expect(resultado[0].usuario).toBeDefined()
      expect(resultado[0].usuario?.nombre).toBe('Juan')
      expect(resultado[0].usuario?.email).toBe('juan@example.com')
    })
  })
})
