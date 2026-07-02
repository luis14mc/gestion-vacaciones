/**
 * ============================================================
 * AUDITORÍA DE CONFIGURACIÓN — alineación UI ↔ catálogo ↔ backend
 * ============================================================
 * Garantiza que toda clave visible en ConfiguracionClient:
 *   1. Existe en CONFIG_KEYS (catálogo).
 *   2. Tiene al menos un consumidor real en backend (o está marcada
 *      como UI-only explícitamente).
 *   3. No contiene claves retiradas (LEGACY_CONFIG_KEYS).
 *
 * Además verifica que la regla `vacaciones.dias_anticipacion` se
 * traduce a 400 (no 500) cuando se viola en el endpoint de creación
 * de solicitudes.
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import {
  CONFIG_KEYS,
  LEGACY_CONFIG_KEYS,
  CONFIG_DEFAULT_VALUES,
} from '@/lib/config/catalog';

const CONFIG_CLIENT_PATH = resolve(
  process.cwd(),
  'src/app/configuracion/ConfiguracionClient.tsx'
);
const CONFIG_CLIENT_SRC = readFileSync(CONFIG_CLIENT_PATH, 'utf8');

/** Extrae todas las claves que aparecen en arrays `claves: [...]` o en `LABELS`. */
function extractClavesVisibles(src: string): string[] {
  const claves = new Set<string>();

  // `claves: ["a.b", "c.d"]` o `claves: ['a.b', 'c.d']` dentro de GRUPOS
  const arrayMatches = src.matchAll(/claves:\s*\[([^\]]+)\]/g);
  for (const m of arrayMatches) {
    const inner = m[1] ?? '';
    const stringMatches = inner.matchAll(/['"]([^'"]+)['"]/g);
    for (const s of stringMatches) {
      if (s[1]) claves.add(s[1]);
    }
  }

  // `LABELS: Record<string, string> = { "a.b": "...", ... }`
  const labelsMatch = src.match(/const LABELS[^=]*=\s*\{([\s\S]*?)\n\}/);
  if (labelsMatch) {
    const body = labelsMatch[1] ?? '';
    const stringMatches = body.matchAll(/['"]([a-z][a-z0-9_.]+)['"]\s*:/g);
    for (const s of stringMatches) {
      if (s[1]) claves.add(s[1]);
    }
  }

  return Array.from(claves);
}

// ─── 1. Test de catálogo ──────────────────────────────
describe('configuración — catálogo alineado con UI', () => {
  it('ninguna clave visible en ConfiguracionClient está fuera de CONFIG_KEYS', () => {
    const visibles = extractClavesVisibles(CONFIG_CLIENT_SRC);
    expect(visibles.length).toBeGreaterThan(0);

    const fueraDeCatalogo = visibles.filter((k) => !CONFIG_KEYS.has(k));
    expect(fueraDeCatalogo).toEqual([]);
  });

  it('las claves extraídas cubren las categorías operativas (general, vacaciones, notificaciones, departamentos, seguridad)', () => {
    const visibles = extractClavesVisibles(CONFIG_CLIENT_SRC);
    const prefijos = new Set(visibles.map((k) => k.split('.')[0]));

    for (const esperado of ['app', 'vacaciones', 'notificaciones', 'departamentos', 'seguridad']) {
      expect(prefijos.has(esperado)).toBe(true);
    }
  });
});

// ─── 2. Test de impacto (backend) ──────────────────────
describe('configuración — impacto en backend', () => {
  /**
   * Mapa de claves de negocio → archivos donde se consumen.
   * Mantener alineado con el resto del código. Si una clave se retira
   * del backend, eliminar su entrada; si se agrega, agregar el archivo.
   */
  const CLAVES_CONSUMIDAS: Record<string, { archivos: string[]; minimo: number }> = {
    // Vacaciones
    'vacaciones.dias_minimos_solicitud': {
      archivos: ['src/services/solicitudes.service.ts'],
      minimo: 1,
    },
    'vacaciones.dias_maximos_consecutivos': {
      archivos: ['src/services/solicitudes.service.ts'],
      minimo: 1,
    },
    'vacaciones.dias_anticipacion': {
      archivos: ['src/services/solicitudes.service.ts'],
      minimo: 1,
    },
    // Notificaciones
    'notificaciones.email_habilitado': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.email_remitente': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.smtp_host': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.smtp_port': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.smtp_user': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.smtp_password': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.smtp_secure': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.smtp_require_tls': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.smtp_reject_unauthorized': {
      archivos: ['src/services/email.service.ts'],
      minimo: 1,
    },
    'notificaciones.notificar_jefe_nueva_solicitud': {
      archivos: ['src/app/api/solicitudes/route.ts'],
      minimo: 1,
    },
    'notificaciones.notificar_empleado_aprobacion': {
      archivos: ['src/services/workflow.service.ts'],
      minimo: 1,
    },
    'notificaciones.notificar_empleado_rechazo': {
      archivos: ['src/services/workflow.service.ts'],
      minimo: 1,
    },
    'notificaciones.notificar_rrhh_aprobacion_jefe': {
      archivos: ['src/services/workflow.service.ts'],
      minimo: 1,
    },
    // Departamentos
    'departamentos.max_ausencias_simultaneas': {
      archivos: ['src/lib/domain/departamento-conflictos.ts'],
      minimo: 1,
    },
    'departamentos.validar_conflictos': {
      archivos: ['src/lib/domain/departamento-conflictos.ts'],
      minimo: 1,
    },
    // Seguridad
    'seguridad.sesion_duracion_horas': {
      archivos: ['src/auth.ts', 'src/middleware.ts', 'src/lib/auth.ts'],
      minimo: 1,
    },
    'seguridad.password_min_length': {
      archivos: [
        'src/lib/config/password-policy.ts',
        'src/services/usuarios.service.ts',
        'src/app/api/usuarios/me/password/route.ts',
        'src/app/api/usuarios/importar/route.ts',
      ],
      minimo: 1,
    },
    'seguridad.password_requiere_mayuscula': {
      archivos: ['src/lib/config/password-policy.ts'],
      minimo: 1,
    },
    'seguridad.password_requiere_numero': {
      archivos: ['src/lib/config/password-policy.ts'],
      minimo: 1,
    },
    'seguridad.password_requiere_especial': {
      archivos: ['src/lib/config/password-policy.ts'],
      minimo: 1,
    },
    'seguridad.intentos_login_max': {
      archivos: ['src/lib/rate-limiter.ts'],
      minimo: 1,
    },
    'seguridad.bloqueo_duracion_minutos': {
      archivos: ['src/lib/rate-limiter.ts'],
      minimo: 1,
    },
    'seguridad.forzar_cambio_password_dias': {
      archivos: ['src/lib/auth.ts', 'src/lib/config/password-expiry.ts'],
      minimo: 1,
    },
    // General
    'app.mantenimiento': {
      archivos: ['src/components/MaintenanceGate.tsx'],
      minimo: 1,
    },
  };

  /** Claves UI-only (sin consumidor backend) que se permiten en la UI. */
  const UI_ONLY_ACEPTADAS: ReadonlySet<string> = new Set([
    'app.nombre',
    'app.version',
    'app.empresa',
    'app.siglas',
    'app.pais',
    'app.timezone',
    'app.idioma',
  ]);

  /** Claves conservadas en UI solo en la sección legacy/decorativa. */
  const CLAVES_LEGACY_EN_UI: ReadonlySet<string> = new Set([
    // Mostrada en la card "Configuración legacy (no en uso)"; el campo está
    // deshabilitado y el alert explica que no afecta la asignación automática.
    'vacaciones.dias_anuales_default',
  ]);

  /** Claves marcadas explícitamente como "Próximamente" en la UI. */
  const CLAVES_NO_IMPLEMENTADAS_ACEPTADAS: ReadonlySet<string> = new Set([
    'notificaciones.recordatorio_dias_antes',
  ]);

  it('toda clave visible está en CONFIG_KEYS o marcada como UI-only / no implementada', () => {
    const visibles = extractClavesVisibles(CONFIG_CLIENT_SRC);
    const permitidas = new Set([
      ...Object.keys(CLAVES_CONSUMIDAS),
      ...UI_ONLY_ACEPTADAS,
      ...CLAVES_NO_IMPLEMENTADAS_ACEPTADAS,
      ...CLAVES_LEGACY_EN_UI,
    ]);
    const noClasificadas = visibles.filter((k) => !permitidas.has(k));
    expect(noClasificadas).toEqual([]);
  });

  it('cada clave de negocio declarada se consume en al menos uno de sus archivos objetivo', () => {
    for (const [clave, spec] of Object.entries(CLAVES_CONSUMIDAS)) {
      expect(
        CONFIG_KEYS.has(clave),
        `La clave ${clave} debe existir en CONFIG_KEYS`
      ).toBe(true);

      let totalCoincidencias = 0;
      for (const archivo of spec.archivos) {
        const ruta = resolve(process.cwd(), archivo);
        const src = readFileSync(ruta, 'utf8');
        const regex = new RegExp(clave.replace(/\./g, '\\.'), 'g');
        const matches = src.match(regex);
        totalCoincidencias += matches ? matches.length : 0;
      }
      expect(
        totalCoincidencias,
        `La clave ${clave} debe aparecer al menos ${spec.minimo} vez en: ${spec.archivos.join(', ')}`
      ).toBeGreaterThanOrEqual(spec.minimo);
    }
  });

  it('las claves consumidas por backend tienen default en CONFIG_DEFAULT_VALUES', () => {
    // Las claves SMTP y de identidad no tienen default (se asumen vacías/seed)
    const sinDefaultEsperado = new Set([
      'notificaciones.email_habilitado',
      'notificaciones.email_remitente',
      'notificaciones.smtp_host',
      'notificaciones.smtp_port',
      'notificaciones.smtp_user',
      'notificaciones.smtp_password',
      'notificaciones.smtp_secure',
      'notificaciones.smtp_require_tls',
      'notificaciones.smtp_reject_unauthorized',
    ]);

    for (const clave of Object.keys(CLAVES_CONSUMIDAS)) {
      if (sinDefaultEsperado.has(clave)) continue;
      expect(
        Object.prototype.hasOwnProperty.call(CONFIG_DEFAULT_VALUES, clave),
        `La clave ${clave} debería tener default en CONFIG_DEFAULT_VALUES`
      ).toBe(true);
    }
  });
});

// ─── 3. Test de vacaciones — dias_anticipacion → 400 (no 500) ─────────
const mockGetSession = vi.fn();
const mockCrearSolicitud = vi.fn();
const mockRegistrarAuditoria = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  tienePermiso: vi.fn(() => false),
}));

vi.mock('@/services/solicitudes.service', () => ({
  crearSolicitud: (...args: unknown[]) => mockCrearSolicitud(...args),
}));

vi.mock('@/services/auditoria.service', () => ({
  registrarAuditoria: (...args: unknown[]) => mockRegistrarAuditoria(...args),
  datosPeticion: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' })),
}));

vi.mock('@/services/email.service', () => ({
  notificarNuevaSolicitudAJefe: vi.fn(),
}));

vi.mock('@/lib/config/service', () => ({
  obtenerConfigs: vi.fn(async () => ({
    'notificaciones.notificar_jefe_nueva_solicitud': 'false',
    'vacaciones.dias_anticipacion': '5',
  })),
  asBool: vi.fn(() => false),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      solicitudes: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

import { POST } from '@/app/api/solicitudes/route';

const sessionEmpleado = {
  id: 10,
  esAdmin: false,
  esRrhh: false,
  esDirector: false,
  esJefe: false,
  departamentoId: 1,
};

function crearRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/solicitudes — vacaciones.dias_anticipacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(sessionEmpleado);
    mockRegistrarAuditoria.mockResolvedValue(undefined);
  });

  it('devuelve 400 (no 500) cuando el servicio rechaza por falta de anticipación', async () => {
    // Reproduce el mensaje exacto que emite src/services/solicitudes.service.ts
    // cuando se viola vacaciones.dias_anticipacion.
    mockCrearSolicitud.mockRejectedValue(
      new Error(
        'Las vacaciones deben solicitarse con al menos 5 día(s) de anticipación.'
      )
    );

    const response = await POST(
      crearRequest({
        usuarioId: 10,
        tipo: 'vacaciones',
        fechaInicio: '2026-07-08',
        fechaFin: '2026-07-12',
        diasSolicitados: 5,
        motivo: 'Vacaciones',
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/anticipación/);
    // La clave debe estar presente en el servicio (defensa contra refactor).
    const solicitudesSrc = readFileSync(
      resolve(process.cwd(), 'src/services/solicitudes.service.ts'),
      'utf8'
    );
    expect(solicitudesSrc).toMatch(/vacaciones\.dias_anticipacion/);
  });

  it('la clave existe en CONFIG_KEYS y tiene default en CONFIG_DEFAULT_VALUES', () => {
    expect(CONFIG_KEYS.has('vacaciones.dias_anticipacion')).toBe(true);
    expect(CONFIG_DEFAULT_VALUES['vacaciones.dias_anticipacion']).toBeDefined();
  });
});

// ─── 4. Test de configuración legacy ──────────────────
describe('configuración — claves retiradas', () => {
  it('ninguna clave de LEGACY_CONFIG_KEYS aparece como clave visible en ConfiguracionClient', () => {
    const visibles = new Set(extractClavesVisibles(CONFIG_CLIENT_SRC));
    for (const legacy of LEGACY_CONFIG_KEYS) {
      expect(visibles.has(legacy)).toBe(false);
    }
  });

  it('las claves legacy de acumulación y auto-aprobación NO están en CONFIG_KEYS', () => {
    const legacyEsperadas = [
      'vacaciones.acumulacion_habilitada',
      'vacaciones.max_acumulacion',
      'departamentos.jefe_auto_aprobar',
      'departamentos.jefe_puede_auto_aprobar',
      'jefe_auto_aprobar',
      'jefe_puede_auto_aprobar',
    ];
    for (const clave of legacyEsperadas) {
      expect(CONFIG_KEYS.has(clave)).toBe(false);
    }
  });

  it('el seed no siembra las claves legacy retiradas', () => {
    const seedSrc = readFileSync(
      resolve(process.cwd(), 'scripts/seed-database.ts'),
      'utf8'
    );
    for (const legacy of [
      'vacaciones.acumulacion_habilitada',
      'vacaciones.max_acumulacion',
    ]) {
      expect(seedSrc.includes(`clave: '${legacy}'`)).toBe(false);
    }
  });

  it('el script SQL de limpieza incluye las claves legacy retiradas', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'database/limpiar-config-legacy.sql'),
      'utf8'
    );
    for (const legacy of [
      'vacaciones.acumulacion_habilitada',
      'vacaciones.max_acumulacion',
    ]) {
      expect(sql).toContain(legacy);
    }
  });
});
