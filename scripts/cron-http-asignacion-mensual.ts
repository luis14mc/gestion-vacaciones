/**
 * Disparador HTTP para cron externo (Railway worker sin acceso directo a BD).
 *
 * Requiere:
 *   APP_URL — URL pública de la app (p. ej. https://vacaciones.cni.hn)
 *   CRON_SECRET — mismo valor que en el servicio web
 *
 * Uso:
 *   pnpm tsx scripts/cron-http-asignacion-mensual.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const appUrl = (process.env.APP_URL ?? process.env.RAILWAY_PUBLIC_DOMAIN ?? '').replace(
    /\/$/,
    ''
  );
  const secret = process.env.CRON_SECRET;

  if (!appUrl) {
    console.error('[cron-http] APP_URL o RAILWAY_PUBLIC_DOMAIN no definido.');
    process.exit(1);
  }
  if (!secret || secret.length < 16) {
    console.error('[cron-http] CRON_SECRET inválido (mínimo 16 caracteres).');
    process.exit(1);
  }

  const url = `${appUrl.startsWith('http') ? appUrl : `https://${appUrl}`}/api/cron/asignacion-mensual`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modo: 'automatico', soloAniversario: true }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`[cron-http] HTTP ${res.status}: ${body}`);
    process.exit(1);
  }

  console.log(`[cron-http] OK ${res.status}: ${body}`);
}

main().catch((err) => {
  console.error('[cron-http] Error:', err);
  process.exit(1);
});
