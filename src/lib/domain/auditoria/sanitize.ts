const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'password_hash',
  'smtp_password',
  'smtp_password_encrypted',
  'token',
  'secret',
  'auth_secret',
  'authorization',
  'adjunto',
  'adjuntos',
  'base64',
  'documentos_adjuntos',
];

const MASK = '***';

function esClaveSensible(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

export function sanitizarDetallesAuditoria(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncado]';

  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > 4000) return `${value.slice(0, 4000)}…[truncado]`;
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizarDetallesAuditoria(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (esClaveSensible(key)) {
        out[key] = MASK;
      } else {
        out[key] = sanitizarDetallesAuditoria(val, depth + 1);
      }
    }
    return out;
  }

  return value;
}

export function parseDetallesAuditoria(raw: string | null | undefined): {
  parsed: Record<string, unknown> | null;
  textoPlano: string | null;
} {
  if (!raw) return { parsed: null, textoPlano: null };
  const trimmed = raw.trim();
  if (!trimmed) return { parsed: null, textoPlano: null };

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { parsed: parsed as Record<string, unknown>, textoPlano: null };
      }
      return { parsed: null, textoPlano: trimmed };
    } catch {
      return { parsed: null, textoPlano: trimmed };
    }
  }

  return { parsed: null, textoPlano: trimmed };
}

export function extraerCampoDetalle(raw: string | null | undefined, campo: string): string | null {
  const { parsed } = parseDetallesAuditoria(raw);
  if (!parsed) return null;
  const value = parsed[campo];
  return value == null ? null : String(value);
}
