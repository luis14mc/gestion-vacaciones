import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { configuracionSistema } from '../src/lib/db/schema';

// Cargar variables de entorno
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está configurada en las variables de entorno');
}

const sql = neon(connectionString);
const db = drizzle(sql);

const configuracionesIniciales = [
  // GENERAL
  {
    clave: 'nombre_empresa',
    valor: 'CNI Honduras',
    tipoDato: 'string',
    descripcion: 'Nombre oficial de la empresa',
    categoria: 'general',
    esPublico: true
  },
  {
    clave: 'permitir_editar_solicitudes',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Permitir a los usuarios editar solicitudes en estado pendiente',
    categoria: 'general',
    esPublico: false
  },
  {
    clave: 'horario_laboral_inicio',
    valor: '08:00',
    tipoDato: 'time',
    descripcion: 'Hora de inicio de la jornada laboral',
    categoria: 'general',
    esPublico: true
  },
  {
    clave: 'horario_laboral_fin',
    valor: '17:00',
    tipoDato: 'time',
    descripcion: 'Hora de fin de la jornada laboral',
    categoria: 'general',
    esPublico: true
  },

  // VACACIONES
  {
    clave: 'dias_vacaciones_default',
    valor: '15',
    tipoDato: 'number',
    descripcion: 'Días de vacaciones por defecto para nuevos empleados',
    categoria: 'vacaciones',
    esPublico: false
  },
  {
    clave: 'dias_anticipacion_solicitud',
    valor: '7',
    tipoDato: 'number',
    descripcion: 'Días de anticipación mínimos para solicitar vacaciones',
    categoria: 'vacaciones',
    esPublico: true
  },
  {
    clave: 'max_dias_consecutivos',
    valor: '15',
    tipoDato: 'number',
    descripcion: 'Máximo de días consecutivos que se pueden solicitar',
    categoria: 'vacaciones',
    esPublico: true
  },
  {
    clave: 'min_dias_consecutivos',
    valor: '1',
    tipoDato: 'number',
    descripcion: 'Mínimo de días que se pueden solicitar',
    categoria: 'vacaciones',
    esPublico: true
  },
  {
    clave: 'permitir_fraccionar_vacaciones',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Permitir dividir las vacaciones en varios períodos',
    categoria: 'vacaciones',
    esPublico: true
  },
  {
    clave: 'anio_vencimiento_vacaciones',
    valor: '2',
    tipoDato: 'number',
    descripcion: 'Años después de los cuales vencen los días de vacaciones no utilizados',
    categoria: 'vacaciones',
    esPublico: false
  },

  // NOTIFICACIONES
  {
    clave: 'email_notificaciones',
    valor: 'rrhh@cni.hn',
    tipoDato: 'string',
    descripcion: 'Email principal para notificaciones del sistema',
    categoria: 'notificaciones',
    esPublico: false
  },
  {
    clave: 'notificar_aprobaciones',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Enviar email cuando se aprueba una solicitud',
    categoria: 'notificaciones',
    esPublico: false
  },
  {
    clave: 'notificar_rechazos',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Enviar email cuando se rechaza una solicitud',
    categoria: 'notificaciones',
    esPublico: false
  },
  {
    clave: 'notificar_nueva_solicitud',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Notificar a jefes cuando hay nuevas solicitudes',
    categoria: 'notificaciones',
    esPublico: false
  },
  {
    clave: 'notificar_recordatorio_vacaciones',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Enviar recordatorios de días de vacaciones próximos a vencer',
    categoria: 'notificaciones',
    esPublico: false
  },

  // DEPARTAMENTOS
  {
    clave: 'requiere_aprobacion_departamento',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Las solicitudes requieren aprobación del jefe de departamento',
    categoria: 'departamentos',
    esPublico: false
  },
  {
    clave: 'max_empleados_simultaneos_vacaciones',
    valor: '2',
    tipoDato: 'number',
    descripcion: 'Máximo de empleados que pueden estar de vacaciones al mismo tiempo por departamento',
    categoria: 'departamentos',
    esPublico: false
  },

  // SEGURIDAD
  {
    clave: 'tiempo_sesion_minutos',
    valor: '1440',
    tipoDato: 'number',
    descripcion: 'Tiempo de expiración de sesión en minutos (24 horas por defecto)',
    categoria: 'seguridad',
    esPublico: false
  },
  {
    clave: 'intentos_login_maximos',
    valor: '5',
    tipoDato: 'number',
    descripcion: 'Número máximo de intentos de login fallidos antes de bloquear',
    categoria: 'seguridad',
    esPublico: false
  },
  {
    clave: 'tiempo_bloqueo_minutos',
    valor: '30',
    tipoDato: 'number',
    descripcion: 'Tiempo en minutos que dura el bloqueo después de intentos fallidos',
    categoria: 'seguridad',
    esPublico: false
  },
  {
    clave: 'requiere_cambio_password_inicial',
    valor: 'true',
    tipoDato: 'boolean',
    descripcion: 'Forzar cambio de contraseña en el primer inicio de sesión',
    categoria: 'seguridad',
    esPublico: false
  },
  {
    clave: 'dias_expiracion_password',
    valor: '90',
    tipoDato: 'number',
    descripcion: 'Días después de los cuales expira la contraseña y debe cambiarse',
    categoria: 'seguridad',
    esPublico: false
  }
];

async function seed() {
  try {
    console.log('🌱 Iniciando seed de configuraciones del sistema...');

    // Verificar configuraciones existentes
    const existentes = await db.select().from(configuracionSistema);
    console.log(`✅ Configuraciones existentes: ${existentes.length}`);

    // Insertar solo las que no existen
    let insertadas = 0;
    let omitidas = 0;

    for (const config of configuracionesIniciales) {
      const existe = existentes.find(e => e.clave === config.clave);
      
      if (!existe) {
        await db.insert(configuracionSistema).values(config);
        console.log(`  ✓ Creada: ${config.clave}`);
        insertadas++;
      } else {
        console.log(`  ⊝ Ya existe: ${config.clave}`);
        omitidas++;
      }
    }

    console.log('');
    console.log('📊 Resumen:');
    console.log(`  • Configuraciones insertadas: ${insertadas}`);
    console.log(`  • Configuraciones omitidas: ${omitidas}`);
    console.log(`  • Total en base de datos: ${existentes.length + insertadas}`);
    console.log('');
    console.log('✅ Seed completado exitosamente!');

  } catch (error) {
    console.error('❌ Error ejecutando seed:', error);
    process.exit(1);
  }
}

seed();
