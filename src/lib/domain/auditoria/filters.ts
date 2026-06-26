export interface FiltrosAuditoria {
  pagina: number;
  limite: number;
  accion: string | null;
  tabla: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  usuarioId: number | null;
  email: string | null;
  ipAddress: string | null;
  registroId: number | null;
  evento: string | null;
  modulo: string | null;
  severidad: string | null;
  resultado: string | null;
  q: string | null;
}

export function parseFiltrosAuditoria(searchParams: URLSearchParams): FiltrosAuditoria {
  const parseOptionalInt = (key: string): number | null => {
    const raw = searchParams.get(key);
    if (!raw || raw === 'all' || raw === '') return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  const parseOptionalString = (key: string): string | null => {
    const raw = searchParams.get(key);
    if (!raw || raw === 'all' || raw === '') return null;
    return raw.trim();
  };

  const pagina = Math.max(1, parseOptionalInt('pagina') ?? 1);
  const limite = Math.min(200, Math.max(1, parseOptionalInt('limite') ?? 50));

  return {
    pagina,
    limite,
    accion: parseOptionalString('accion'),
    tabla: parseOptionalString('tabla'),
    fechaInicio: parseOptionalString('fechaInicio'),
    fechaFin: parseOptionalString('fechaFin'),
    usuarioId: parseOptionalInt('usuarioId'),
    email: parseOptionalString('email'),
    ipAddress: parseOptionalString('ipAddress'),
    registroId: parseOptionalInt('registroId'),
    evento: parseOptionalString('evento'),
    modulo: parseOptionalString('modulo'),
    severidad: parseOptionalString('severidad'),
    resultado: parseOptionalString('resultado'),
    q: parseOptionalString('q'),
  };
}

export function filtrosAuditoriaToRecord(filtros: FiltrosAuditoria): Record<string, unknown> {
  return { ...filtros };
}
