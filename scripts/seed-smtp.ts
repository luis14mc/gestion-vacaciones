import 'dotenv/config';
import { db } from '../src/lib/db';
import { configuracion } from '../src/lib/db/schema';

async function seedSmtp() {
  console.log('Seeding SMTP config...');

  const configs = [
    {
      clave: 'SMTP_HOST',
      valor: 'smtp.office365.com',
      descripcion: 'Servidor SMTP para envío de correos',
      categoria: 'notificaciones',
      tipoDato: 'string',
      esPublico: false
    },
    {
      clave: 'SMTP_PORT',
      valor: '587',
      descripcion: 'Puerto del servidor SMTP',
      categoria: 'notificaciones',
      tipoDato: 'number',
      esPublico: false
    },
    {
      clave: 'SMTP_USER',
      valor: 'info@cni.hn',
      descripcion: 'Usuario de autenticación SMTP',
      categoria: 'notificaciones',
      tipoDato: 'string',
      esPublico: false
    },
    {
      clave: 'SMTP_PASSWORD',
      valor: 'Cnihonduras2026$',
      descripcion: 'Contraseña de autenticación SMTP',
      categoria: 'notificaciones',
      tipoDato: 'password',
      esPublico: false
    },
    {
      clave: 'SMTP_SECURE',
      valor: 'false',
      descripcion: 'Usar conexión segura (false para TLS en puerto 587)',
      categoria: 'notificaciones',
      tipoDato: 'boolean',
      esPublico: false
    },
    {
      clave: 'EMAIL_FROM',
      valor: '"Servicios Online" <notificaciones@cni.hn>',
      descripcion: 'Remitente por defecto para los correos',
      categoria: 'notificaciones',
      tipoDato: 'string',
      esPublico: false
    },
    {
      clave: 'NOTIFICACIONES_EMAIL_HABILITADAS',
      valor: 'true',
      descripcion: 'Habilitar o deshabilitar envío de correos',
      categoria: 'notificaciones',
      tipoDato: 'boolean',
      esPublico: true
    }
  ];

  for (const conf of configs) {
    try {
      await db.insert(configuracion).values(conf);
      console.log(`Inserted ${conf.clave}`);
    } catch (e: any) {
      if (e.code === '23505' || e.code === '23505') { // Unique violation
        console.log(`Config ${conf.clave} already exists, updating...`);
        await db.update(configuracion).set(conf).where((table) => table.clave === conf.clave);
      } else {
        console.error(`Error inserting ${conf.clave}:`, e.message);
      }
    }
  }

  console.log('Done seeding SMTP config.');
  process.exit(0);
}

seedSmtp();
