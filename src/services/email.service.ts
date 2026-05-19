import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { configuracion } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface ConfiguracionEmail {
  habilitado: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  from: string;
}

export async function getConfiguracionEmail(): Promise<ConfiguracionEmail> {
  const configs = await db
    .select()
    .from(configuracion)
    .where(inArray(configuracion.clave, [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMTP_SECURE',
      'NOTIFICACIONES_EMAIL_HABILITADAS',
      'EMAIL_FROM'
    ]));

  const configMap = configs.reduce((acc, curr) => {
    acc[curr.clave] = curr.valor;
    return acc;
  }, {} as Record<string, string>);

  return {
    habilitado: configMap['NOTIFICACIONES_EMAIL_HABILITADAS'] === 'true',
    host: configMap['SMTP_HOST'] || 'smtp.office365.com',
    port: parseInt(configMap['SMTP_PORT'] || '587'),
    user: configMap['SMTP_USER'] || '',
    password: configMap['SMTP_PASSWORD'] || '',
    secure: configMap['SMTP_SECURE'] === 'true', // false for TLS (587)
    from: configMap['EMAIL_FROM'] || '"Servicios Online" <notificaciones@cni.hn>',
  };
}

function crearTransporteConConfig(config: ConfiguracionEmail) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });
}

export async function enviarEmail(options: EmailOptions) {
  try {
    const config = await getConfiguracionEmail();
    if (!config.habilitado) {
      console.log('Notificaciones por email están deshabilitadas en la configuración.');
      return false;
    }

    const transporter = crearTransporteConConfig(config);

    const info = await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log('Email enviado: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}

// ============================================================
// PLANTILLAS DE CORREO
// ============================================================

export async function notificarNuevaSolicitudAJefe(jefeEmail: string, jefeNombre: string, solicitanteNombre: string, tipo: string, dias: number) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 8px;">
      <h2 style="color: #182243;">Nueva Solicitud Pendiente de Aprobación</h2>
      <p>Hola <strong>${jefeNombre}</strong>,</p>
      <p>El colaborador <strong>${solicitanteNombre}</strong> ha enviado una nueva solicitud de <strong>${tipo}</strong> por <strong>${dias} días</strong>.</p>
      <p>Por favor, ingresa al Sistema de Gestión de Vacaciones CNI para revisar y aprobar/rechazar esta solicitud.</p>
      <br>
      <a href="https://vacaciones.cni.hn/aprobar-solicitudes" style="background-color: #00B5E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Solicitudes Pendientes</a>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eaeaeb;">
      <p style="font-size: 12px; color: #666;">Este es un mensaje automático. Por favor, no respondas a este correo.</p>
    </div>
  `;
  
  return enviarEmail({
    to: jefeEmail,
    subject: `[CNI Vacaciones] Nueva solicitud de ${solicitanteNombre}`,
    html
  });
}

export async function notificarAprobacionJefeARRHH(rrhhEmail: string, solicitanteNombre: string, tipo: string, dias: number) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 8px;">
      <h2 style="color: #182243;">Aprobación Pendiente de RRHH</h2>
      <p>El jefe inmediato ha aprobado la solicitud de <strong>${tipo}</strong> de <strong>${solicitanteNombre}</strong> por <strong>${dias} días</strong>.</p>
      <p>La solicitud se encuentra ahora en la bandeja de Recursos Humanos para su validación final y descuento de saldo.</p>
      <br>
      <a href="https://vacaciones.cni.hn/aprobar-solicitudes" style="background-color: #00B5E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir a la Bandeja de RRHH</a>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eaeaeb;">
      <p style="font-size: 12px; color: #666;">Este es un mensaje automático. Por favor, no respondas a este correo.</p>
    </div>
  `;
  
  return enviarEmail({
    to: rrhhEmail,
    subject: `[CNI Vacaciones] Solicitud de ${solicitanteNombre} lista para RRHH`,
    html
  });
}

export async function notificarResolucionAEmpleado(empleadoEmail: string, empleadoNombre: string, estado: string, tipo: string, dias: number, motivoRechazo?: string) {
  const esAprobada = estado === 'aprobada_rrhh';
  const color = esAprobada ? '#16a34a' : '#dc2626';
  const titulo = esAprobada ? 'Solicitud Aprobada Exitosamente' : 'Solicitud Rechazada';
  const mensaje = esAprobada 
    ? `Nos complace informarte que tu solicitud de <strong>${tipo}</strong> por <strong>${dias} días</strong> ha sido validada y <strong>aprobada por Recursos Humanos</strong>. ¡Disfruta tu tiempo!`
    : `Tu solicitud de <strong>${tipo}</strong> por <strong>${dias} días</strong> ha sido <strong>rechazada</strong>.`;

  const motivoHtml = motivoRechazo ? `<p style="background-color: #fef2f2; padding: 10px; border-left: 4px solid #dc2626;"><strong>Motivo del rechazo:</strong> ${motivoRechazo}</p>` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 8px;">
      <h2 style="color: ${color};">${titulo}</h2>
      <p>Hola <strong>${empleadoNombre}</strong>,</p>
      <p>${mensaje}</p>
      ${motivoHtml}
      <br>
      <a href="https://vacaciones.cni.hn/mi-perfil" style="background-color: #182243; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver mi balance actual</a>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eaeaeb;">
      <p style="font-size: 12px; color: #666;">Este es un mensaje automático. Por favor, no respondas a este correo.</p>
    </div>
  `;
  
  return enviarEmail({
    to: empleadoEmail,
    subject: `[CNI Vacaciones] Actualización de tu solicitud: ${esAprobada ? 'Aprobada' : 'Rechazada'}`,
    html
  });
}
