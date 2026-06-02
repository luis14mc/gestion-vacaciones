import 'dotenv/config';
import { db } from '../src/lib/db';
import { configuracion } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function seedSmtp() {
  console.log('Seeding SMTP config...');

  const configs = [
    {
      clave: 'notificaciones.smtp_host',
      valor: process.env.SMTP_HOST || 'smtp.office365.com',
      descripcion: 'Servidor SMTP para envio de correos',
      categoria: 'notificaciones',
      tipoDato: 'string',
      esPublico: false,
    },
    {
      clave: 'notificaciones.smtp_port',
      valor: process.env.SMTP_PORT || '587',
      descripcion: 'Puerto del servidor SMTP',
      categoria: 'notificaciones',
      tipoDato: 'number',
      esPublico: false,
    },
    {
      clave: 'notificaciones.smtp_user',
      valor: process.env.SMTP_USER || '',
      descripcion: 'Usuario de autenticacion SMTP',
      categoria: 'notificaciones',
      tipoDato: 'string',
      esPublico: false,
    },
    {
      clave: 'notificaciones.smtp_password',
      valor: process.env.SMTP_PASSWORD || '',
      descripcion: 'Contrasena de autenticacion SMTP',
      categoria: 'notificaciones',
      tipoDato: 'password',
      esPublico: false,
    },
    {
      clave: 'notificaciones.smtp_secure',
      valor: process.env.SMTP_SECURE || 'false',
      descripcion: 'Usar SSL/TLS directo. Normalmente false para STARTTLS en puerto 587',
      categoria: 'notificaciones',
      tipoDato: 'boolean',
      esPublico: false,
    },
    {
      clave: 'notificaciones.smtp_require_tls',
      valor: process.env.SMTP_REQUIRE_TLS || 'true',
      descripcion: 'Requerir STARTTLS para el envio de correos',
      categoria: 'notificaciones',
      tipoDato: 'boolean',
      esPublico: false,
    },
    {
      clave: 'notificaciones.smtp_reject_unauthorized',
      valor: process.env.SMTP_REJECT_UNAUTHORIZED || 'true',
      descripcion: 'Validar certificado TLS del servidor SMTP',
      categoria: 'notificaciones',
      tipoDato: 'boolean',
      esPublico: false,
    },
    {
      clave: 'notificaciones.email_remitente',
      valor: process.env.SMTP_FROM || '"Servicios Online" <notificaciones@cni.hn>',
      descripcion: 'Remitente por defecto para los correos',
      categoria: 'notificaciones',
      tipoDato: 'string',
      esPublico: false,
    },
    {
      clave: 'notificaciones.email_habilitado',
      valor: process.env.NOTIFICACIONES_EMAIL_HABILITADAS || 'true',
      descripcion: 'Habilitar o deshabilitar envio de correos',
      categoria: 'notificaciones',
      tipoDato: 'boolean',
      esPublico: false,
    },
  ];

  for (const conf of configs) {
    try {
      await db.insert(configuracion).values(conf).onConflictDoUpdate({
        target: configuracion.clave,
        set: {
          descripcion: conf.descripcion,
          categoria: conf.categoria,
          tipoDato: conf.tipoDato,
          esPublico: conf.esPublico,
          updatedAt: new Date().toISOString(),
        },
      });
      console.log(`Upserted ${conf.clave}`);
    } catch (e: any) {
      console.error(`Error upserting ${conf.clave}:`, e.message);
      process.exitCode = 1;
    }
  }

  console.log('Done seeding SMTP config.');
  process.exit(process.exitCode || 0);
}

seedSmtp();
