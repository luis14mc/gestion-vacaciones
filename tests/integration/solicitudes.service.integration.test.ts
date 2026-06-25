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
  listarSolicitudes,
} from '@/services/solicitudes.service'
import { ejecutarAccion } from '@/services/workflow.service'
import {
  crearDatosBaseTest,
  crearUsuarioTest,
  crearBalanceTest,
} from '../helpers/test-data'
import './setup'

const FECHA_INICIO_LAB = '2026-03-02'
const FECHA_FIN_LAB = '2026-03-06'
const DIAS_LAB = 5

async function aprobarComoJefe(solicitudId: number, jefe: { id: number }, departamentoId: number, comentario?: string) {
  return ejecutarAccion({
    solicitudId,
    accion: 'aprobar_jefe',
    usuarioId: jefe.id,
    esDirector: false,
    esJefe: true,
    esRrhh: false,
    esAdmin: false,
    departamentoId,
    comentario,
  })
}

async function aprobarComoRRHH(solicitudId: number, rrhh: { id: number }, comentario?: string) {
  return ejecutarAccion({
    solicitudId,
    accion: 'aprobar_rrhh',
    usuarioId: rrhh.id,
    esDirector: false,
    esJefe: false,
    esRrhh: true,
    esAdmin: false,
    comentario,
  })
}

async function rechazarComoJefe(
  solicitudId: number,
  jefe: { id: number },
  departamentoId: number,
  motivoRechazo: string
) {
  return ejecutarAccion({
    solicitudId,
    accion: 'rechazar_jefe',
    usuarioId: jefe.id,
    esDirector: false,
    esJefe: true,
    esRrhh: false,
    esAdmin: false,
    departamentoId,
    motivoRechazo,
  })
}

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

    const { db } = await import('@/lib/db')
    const { usuarios } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')

    await db
      .update(usuarios)
      .set({ jefeSuperiorId: usuarioJefe.id })
      .where(eq(usuarios.id, usuarioEmpleado.id))

    await db
      .update(usuarios)
      .set({ esJefe: true })
      .where(eq(usuarios.id, usuarioJefe.id))

    await db
      .update(usuarios)
      .set({ esRrhh: true })
      .where(eq(usuarios.id, usuarioRRHH.id))
  })

  // ===================================================
  // TESTS: crearSolicitud()
  // ===================================================

  describe('crearSolicitud()', () => {
    it('debe crear solicitud con código CNI-SOL-YYYY-XXXX', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
        motivo: 'Vacaciones familiares',
      })

      expect(solicitud).toBeDefined()
      expect(solicitud.codigo).toMatch(/^CNI-SOL-\d{4}-\d{4}$/)
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
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
        motivo: 'Vacaciones',
      })

      const balance = await db.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioEmpleado.id),
          eq(balances.anoLaboralId, datosBase.anoLaboral.id)
        ),
      })

      expect(balance).toBeDefined()
      expect(parseFloat(balance!.cantidadPendiente)).toBe(DIAS_LAB)
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
  // TESTS: ejecutarAccion() — aprobación jefe
  // ===================================================

  describe('ejecutarAccion() — aprobar_jefe', () => {
    it('debe cambiar estado a aprobada_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      const resultado = await aprobarComoJefe(
        solicitud.id,
        usuarioJefe,
        datosBase.departamento.id,
        'Aprobado por jefe'
      )

      expect(resultado.exito).toBe(true)
      expect(resultado.solicitud.estado).toBe('aprobada_jefe')
      expect(resultado.solicitud.aprobadaJefePor).toBe(usuarioJefe.id)
      expect(resultado.solicitud.comentarioJefe).toBe('Aprobado por jefe')
    })

    it('debe incrementar campo version (optimistic locking)', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      const versionInicial = solicitud.version

      const resultado = await aprobarComoJefe(
        solicitud.id,
        usuarioJefe,
        datosBase.departamento.id
      )

      expect(resultado.exito).toBe(true)
      expect(resultado.solicitud.version).toBe((versionInicial || 1) + 1)
    })

    it('debe rechazar si estado no es pendiente_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      await aprobarComoJefe(solicitud.id, usuarioJefe, datosBase.departamento.id)

      const segundoIntento = await aprobarComoJefe(
        solicitud.id,
        usuarioJefe,
        datosBase.departamento.id
      )

      expect(segundoIntento.exito).toBe(false)
    })

    it('debe detectar lost updates con optimistic locking', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      await aprobarComoJefe(solicitud.id, usuarioJefe, datosBase.departamento.id)

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
              eq(solicitudes.version, 1)
            )
          )
          .returning()
      ).resolves.toHaveLength(0)
    })
  })

  // ===================================================
  // TESTS: ejecutarAccion() — aprobación RRHH
  // ===================================================

  describe('ejecutarAccion() — aprobar_rrhh', () => {
    it('debe cambiar estado a aprobada_rrhh', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      await aprobarComoJefe(solicitud.id, usuarioJefe, datosBase.departamento.id)

      const resultado = await aprobarComoRRHH(
        solicitud.id,
        usuarioRRHH,
        'Aprobado por RRHH'
      )

      expect(resultado.exito).toBe(true)
      expect(resultado.solicitud.estado).toBe('aprobada_rrhh')
      expect(resultado.solicitud.aprobadaRrhhPor).toBe(usuarioRRHH.id)
    })

    it('debe mover días: pendiente → usada en balance', async () => {
      const { db } = await import('@/lib/db')
      const { balances } = await import('@/lib/db/schema')
      const { eq, and } = await import('drizzle-orm')

      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      await aprobarComoJefe(solicitud.id, usuarioJefe, datosBase.departamento.id)
      await aprobarComoRRHH(solicitud.id, usuarioRRHH)

      const balance = await db.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioEmpleado.id),
          eq(balances.anoLaboralId, datosBase.anoLaboral.id)
        ),
      })

      expect(balance).toBeDefined()
      expect(parseFloat(balance!.cantidadPendiente)).toBe(0)
      expect(parseFloat(balance!.cantidadUsada)).toBe(DIAS_LAB)
    })

    it('debe rechazar si estado no es aprobada_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      const resultado = await aprobarComoRRHH(solicitud.id, usuarioRRHH)

      expect(resultado.exito).toBe(false)
    })
  })

  // ===================================================
  // TESTS: ejecutarAccion() — rechazo jefe
  // ===================================================

  describe('ejecutarAccion() — rechazar_jefe', () => {
    it('debe cambiar estado a rechazada_jefe', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      const resultado = await rechazarComoJefe(
        solicitud.id,
        usuarioJefe,
        datosBase.departamento.id,
        'Fechas no disponibles'
      )

      expect(resultado.exito).toBe(true)
      expect(resultado.solicitud.estado).toBe('rechazada_jefe')
      expect(resultado.solicitud.motivoRechazo).toBe('Fechas no disponibles')
    })

    it('debe devolver días a balance disponible', async () => {
      const { db } = await import('@/lib/db')
      const { balances } = await import('@/lib/db/schema')
      const { eq, and } = await import('drizzle-orm')

      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      await rechazarComoJefe(
        solicitud.id,
        usuarioJefe,
        datosBase.departamento.id,
        'Rechazada'
      )

      const balance = await db.query.balances.findFirst({
        where: and(
          eq(balances.usuarioId, usuarioEmpleado.id),
          eq(balances.anoLaboralId, datosBase.anoLaboral.id)
        ),
      })

      expect(balance).toBeDefined()
      expect(parseFloat(balance!.cantidadPendiente)).toBe(0)
    })

    it('debe registrar motivo de rechazo', async () => {
      const solicitud = await crearSolicitud({
        usuarioId: usuarioEmpleado.id,
        tipo: 'vacaciones',
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      const motivoEsperado = 'Equipo con mucha carga de trabajo'
      const resultado = await rechazarComoJefe(
        solicitud.id,
        usuarioJefe,
        datosBase.departamento.id,
        motivoEsperado
      )

      expect(resultado.exito).toBe(true)
      expect(resultado.solicitud.motivoRechazo).toBe(motivoEsperado)
      expect(resultado.solicitud.rechazadaPor).toBe(usuarioJefe.id)
      expect(resultado.solicitud.rechazadaFecha).toBeDefined()
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
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
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
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      await aprobarComoJefe(solicitud.id, usuarioJefe, datosBase.departamento.id)

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
        fechaInicio: FECHA_INICIO_LAB,
        fechaFin: FECHA_FIN_LAB,
        diasSolicitados: DIAS_LAB,
      })

      const resultado = await listarSolicitudes({})

      expect(resultado[0].usuario).toBeDefined()
      expect(resultado[0].usuario?.nombre).toBe('Juan')
      expect(resultado[0].usuario?.email).toBe('juan@example.com')
    })
  })
})
