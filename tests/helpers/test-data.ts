import { db } from '@/lib/db'
import { 
  usuarios, 
  roles, 
  departamentos, 
  anosLaborales,
  balances,
  usuariosRoles,
  solicitudes
} from '@/lib/db/schema'
import bcrypt from 'bcryptjs'

export async function crearRolTest(nombre: string, descripcion: string, _permisos: string[] = []) {
  const [rol] = await db.insert(roles).values({
    nombre,
    codigo: nombre.toUpperCase(),
    descripcion,
    activo: true,
  }).returning()
  return rol
}

export async function crearDepartamentoTest(nombre: string, codigo: string) {
  const [depto] = await db.insert(departamentos).values({
    nombre,
    codigo,
    descripcion: `Departamento de ${nombre}`,
    activo: true,
  }).returning()
  return depto
}

export async function crearAnoLaboralTest(anio: number = 2026) {
  const [anoLaboral] = await db.insert(anosLaborales).values({
    ano: anio,
    nombre: `Año Laboral ${anio}`,
    fechaInicio: `${anio}-01-01`,
    fechaFin: `${anio}-12-31`,
    activo: true,
  }).returning()
  return anoLaboral
}

export async function crearUsuarioTest(data: {
  nombre: string
  apellido: string
  email: string
  password: string
  departamentoId: number
  rolId?: number
}) {
  const passwordHash = await bcrypt.hash(data.password, 10)
  
  const [usuario] = await db.insert(usuarios).values({
    nombre: data.nombre,
    apellido: data.apellido,
    email: data.email,
    passwordHash,
    departamentoId: data.departamentoId,
    activo: true,
  }).returning()

  if (data.rolId) {
    await db.insert(usuariosRoles).values({
      usuarioId: usuario.id,
      rolId: data.rolId,
      fechaAsignacion: new Date().toISOString(),
      activo: true,
    })
  }

  return usuario
}

export async function crearBalanceTest(data: {
  usuarioId: number
  anoLaboralId: number
  cantidadAsignada: number
  cantidadDisponible?: number
  cantidadUsada?: number
  cantidadPendiente?: number
  tipoAusencia?: string
}) {
  const [balance] = await db.insert(balances).values({
    usuarioId: data.usuarioId,
    anoLaboralId: data.anoLaboralId,
    tipoAusencia: (data.tipoAusencia || 'vacaciones') as any,
    cantidadInicial: data.cantidadAsignada.toString(),
    cantidadDisponible: (data.cantidadDisponible ?? data.cantidadAsignada).toString(),
    cantidadUsada: (data.cantidadUsada || 0).toString(),
    cantidadPendiente: (data.cantidadPendiente || 0).toString(),
  }).returning()
  return balance
}

export async function crearSolicitudTest(data: {
  usuarioId: number
  anoLaboralId: number
  tipo: string
  fechaInicio: string
  fechaFin: string
  diasSolicitados: number
  estado?: string
  codigo?: string
}) {
  const [solicitud] = await db.insert(solicitudes).values({
    codigo: data.codigo || `SOL-TEST-${Date.now()}`,
    usuarioId: data.usuarioId,
    anoLaboralId: data.anoLaboralId,
    tipo: data.tipo as any,
    fechaInicio: data.fechaInicio,
    fechaFin: data.fechaFin,
    diasSolicitados: data.diasSolicitados.toString(),
    estado: (data.estado || 'pendiente_jefe') as any,
    motivo: 'Test solicitud',
    comentarioEmpleado: 'Solicitud de prueba',
  }).returning()
  return solicitud
}

export async function crearDatosBaseTest() {
  const rolEmpleado = await crearRolTest('EMPLEADO', 'Rol de empleado', ['ver_perfil', 'crear_solicitud'])
  const rolJefe = await crearRolTest('JEFE', 'Rol de jefe de departamento', ['aprobar_solicitud_jefe', 'ver_equipo'])
  const rolRRHH = await crearRolTest('RRHH', 'Rol de recursos humanos', ['aprobar_solicitud_rrhh', 'ver_reportes', 'gestionar_usuarios'])

  const departamento = await crearDepartamentoTest('Tecnología', 'TEC')
  const anoLaboral = await crearAnoLaboralTest(2026)

  return {
    roles: {
      empleado: rolEmpleado,
      jefe: rolJefe,
      rrhh: rolRRHH,
    },
    departamento,
    anoLaboral,
  }
}
