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
  requireTLS: boolean;
  rejectUnauthorized: boolean;
  from: string;
}

export async function getConfiguracionEmail(): Promise<ConfiguracionEmail> {
  const configs = await db
    .select()
    .from(configuracion)
    .where(inArray(configuracion.clave, [
      'notificaciones.email_habilitado',
      'notificaciones.email_remitente',
      'notificaciones.smtp_host',
      'notificaciones.smtp_port',
      'notificaciones.smtp_user',
      'notificaciones.smtp_password',
      'notificaciones.smtp_secure',
      'notificaciones.smtp_require_tls',
      'notificaciones.smtp_reject_unauthorized',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMTP_SECURE',
      'SMTP_REQUIRE_TLS',
      'SMTP_REJECT_UNAUTHORIZED',
      'NOTIFICACIONES_EMAIL_HABILITADAS',
      'EMAIL_FROM',
    ]));

  const configMap = configs.reduce((acc, curr) => {
    acc[curr.clave] = curr.valor;
    return acc;
  }, {} as Record<string, string>);

  const getConfig = (primary: string, legacy: string, fallback = '') => {
    const primaryValue = configMap[primary];
    if (primaryValue !== undefined && primaryValue !== '') return primaryValue;
    const legacyValue = configMap[legacy];
    if (legacyValue !== undefined && legacyValue !== '') return legacyValue;
    return fallback;
  };

  const port = Number.parseInt(getConfig('notificaciones.smtp_port', 'SMTP_PORT', '587'), 10);

  return {
    habilitado: getConfig('notificaciones.email_habilitado', 'NOTIFICACIONES_EMAIL_HABILITADAS') === 'true',
    host: getConfig('notificaciones.smtp_host', 'SMTP_HOST', 'smtp.office365.com'),
    port: Number.isNaN(port) ? 587 : port,
    user: getConfig('notificaciones.smtp_user', 'SMTP_USER'),
    password: getConfig('notificaciones.smtp_password', 'SMTP_PASSWORD'),
    secure: getConfig('notificaciones.smtp_secure', 'SMTP_SECURE') === 'true',
    requireTLS: getConfig('notificaciones.smtp_require_tls', 'SMTP_REQUIRE_TLS', 'true') === 'true',
    rejectUnauthorized: getConfig('notificaciones.smtp_reject_unauthorized', 'SMTP_REJECT_UNAUTHORIZED', 'true') === 'true',
    from: getConfig('notificaciones.email_remitente', 'EMAIL_FROM', '"Servicios Online" <notificaciones@cni.hn>'),
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
    requireTLS: config.requireTLS,
    tls: {
      rejectUnauthorized: config.rejectUnauthorized,
    },
  });
}

export async function verificarConexionSMTP(): Promise<{
  exito: boolean;
  mensaje: string;
  detalle?: string;
}> {
  try {
    const config = await getConfiguracionEmail();

    if (!config.habilitado) {
      return {
        exito: false,
        mensaje: 'Las notificaciones por email están deshabilitadas en la configuración.',
      };
    }

    if (!config.host || !config.user || !config.password) {
      return {
        exito: false,
        mensaje: 'Configuración SMTP incompleta (host, usuario o contraseña).',
      };
    }

    const transporter = crearTransporteConConfig(config);
    await transporter.verify();

    return { exito: true, mensaje: 'Conexión SMTP verificada correctamente.' };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    return {
      exito: false,
      mensaje: 'No se pudo verificar la conexión SMTP.',
      detalle,
    };
  }
}

export async function enviarEmail(options: EmailOptions) {
  try {
    const config = await getConfiguracionEmail();
    if (!config.habilitado) {
      console.log('Notificaciones por email estan deshabilitadas en la configuracion.');
      return false;
    }

    if (!config.host || !config.user || !config.password || !config.from) {
      console.error('Configuracion SMTP incompleta. Revise host, usuario, contrasena y remitente.');
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

function nombreTipoSolicitud(tipo: string) {
  const nombres: Record<string, string> = {
    vacaciones: 'vacaciones',
    permiso_salida: 'permiso de salida',
    licencia_medica: 'licencia medica',
    permiso_personal: 'permiso personal',
    dia_cumpleanos: 'dia libre por cumpleanos',
    licencia_paternidad: 'licencia de paternidad',
    licencia_maternidad: 'licencia de maternidad',
    compensacion: 'compensacion',
  };

  return nombres[tipo] || tipo.replace(/_/g, ' ');
}

function detalleSolicitud(tipo: string, dias: number) {
  if (tipo === 'permiso_salida') {
    return dias > 0 ? 'por dia completo' : 'por horas';
  }

  return dias > 0 ? `por ${dias} ${dias === 1 ? 'dia' : 'dias'}` : '';
}

function descripcionSolicitud(tipo: string, dias: number) {
  const detalle = detalleSolicitud(tipo, dias);
  return `<strong>${nombreTipoSolicitud(tipo)}</strong>${detalle ? ` ${detalle}` : ''}`;
}

function consumeBalance(tipo: string, dias: number) {
  return tipo === 'vacaciones' || (tipo === 'permiso_salida' && dias > 0);
}

export async function notificarNuevaSolicitudAJefe(
  jefeEmail: string,
  jefeNombre: string,
  solicitanteNombre: string,
  tipo: string,
  dias: number
) {
  const solicitud = descripcionSolicitud(tipo, dias);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 8px;">
      <h2 style="color: #182243;">Nueva Solicitud Pendiente de Aprobacion</h2>
      <p>Hola <strong>${escapeHtml(jefeNombre)}</strong>,</p>
      <p>El colaborador <strong>${escapeHtml(solicitanteNombre)}</strong> ha enviado una nueva solicitud de ${solicitud}.</p>
      <p>Por favor, ingresa al Sistema de Gestion de Vacaciones CNI para revisar y aprobar o rechazar esta solicitud.</p>
      <br>
      <a href="https://vacaciones.cni.hn/aprobar-solicitudes" style="background-color: #00B5E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Solicitudes Pendientes</a>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eaeaeb;">
      <p style="font-size: 12px; color: #666;">Este es un mensaje automatico. Por favor, no respondas a este correo.</p>
    </div>
  `;

  return enviarEmail({
    to: jefeEmail,
    subject: `[CNI Vacaciones] Nueva solicitud de ${escapeHtml(solicitanteNombre)}`,
    html,
  });
}

export async function notificarAprobacionJefeARRHH(
  rrhhEmail: string,
  solicitanteNombre: string,
  tipo: string,
  dias: number
) {
  const solicitud = descripcionSolicitud(tipo, dias);
  const requiereSaldo = consumeBalance(tipo, dias);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 8px;">
      <h2 style="color: #182243;">Aprobacion Pendiente de RRHH</h2>
      <p>El jefe inmediato ha aprobado la solicitud de ${solicitud} de <strong>${escapeHtml(solicitanteNombre)}</strong>.</p>
      <p>La solicitud se encuentra ahora en la bandeja de Recursos Humanos para su validacion final${requiereSaldo ? ' y actualizacion de saldo' : ''}.</p>
      <br>
      <a href="https://vacaciones.cni.hn/aprobar-solicitudes" style="background-color: #00B5E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir a la Bandeja de RRHH</a>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eaeaeb;">
      <p style="font-size: 12px; color: #666;">Este es un mensaje automatico. Por favor, no respondas a este correo.</p>
    </div>
  `;

  return enviarEmail({
    to: rrhhEmail,
    subject: `[CNI Vacaciones] Solicitud de ${escapeHtml(solicitanteNombre)} lista para RRHH`,
    html,
  });
}

export async function notificarResolucionAEmpleado(
  empleadoEmail: string,
  empleadoNombre: string,
  estado: string,
  tipo: string,
  dias: number,
  motivoRechazo?: string
) {
  const esAprobada = estado === 'aprobada_rrhh';
  const color = esAprobada ? '#16a34a' : '#dc2626';
  const titulo = esAprobada ? 'Solicitud Aprobada Exitosamente' : 'Solicitud Rechazada';
  const solicitud = descripcionSolicitud(tipo, dias);
  const requiereBalance = consumeBalance(tipo, dias);
  const mensaje = esAprobada
    ? `Nos complace informarte que tu solicitud de ${solicitud} ha sido validada y <strong>aprobada por Recursos Humanos</strong>.`
    : `Tu solicitud de ${solicitud} ha sido <strong>rechazada</strong>.`;
  const motivoHtml = !esAprobada && motivoRechazo
    ? `<p style="background-color: #fef2f2; padding: 10px; border-left: 4px solid #dc2626;"><strong>Motivo del rechazo:</strong> ${escapeHtml(motivoRechazo)}</p>`
    : '';
  const ctaHref = requiereBalance ? 'https://vacaciones.cni.hn/mi-perfil' : 'https://vacaciones.cni.hn/solicitudes';
  const ctaTexto = requiereBalance ? 'Ver mi balance actual' : 'Ver mis solicitudes';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 8px;">
      <h2 style="color: ${color};">${titulo}</h2>
      <p>Hola <strong>${escapeHtml(empleadoNombre)}</strong>,</p>
      <p>${mensaje}</p>
      ${motivoHtml}
      <br>
      <a href="${ctaHref}" style="background-color: #182243; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">${ctaTexto}</a>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eaeaeb;">
      <p style="font-size: 12px; color: #666;">Este es un mensaje automatico. Por favor, no respondas a este correo.</p>
    </div>
  `;

  return enviarEmail({
    to: empleadoEmail,
    subject: `[CNI Vacaciones] Actualizacion de tu solicitud: ${esAprobada ? 'Aprobada' : 'Rechazada'}`,
    html,
  });
}
