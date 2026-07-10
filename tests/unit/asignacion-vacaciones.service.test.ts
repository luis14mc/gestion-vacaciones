import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSession = { id: 99, esAdmin: false, esRrhh: true, esJefe: false, esDirector: false, esSecretarioGeneral: false };

const mockUsuarios = [
  { id: 1, nombre: 'Ana', apellido: 'Pérez', fechaIngreso: '2022-07-15T00:00:00.000Z', activo: true, deletedAt: null },
  { id: 2, nombre: 'Luis', apellido: 'Gómez', fechaIngreso: '2025-07-15T00:00:00.000Z', activo: true, deletedAt: null },
  { id: 3, nombre: 'María', apellido: 'Reyes', fechaIngreso: null, activo: true, deletedAt: null },
  { id: 4, nombre: 'Pedro', apellido: 'Loor', fechaIngreso: '2026-01-15T00:00:00.000Z', activo: true, deletedAt: null },
  { id: 5, nombre: 'Sofía', apellido: 'Mora', fechaIngreso: '2022-07-15T00:00:00.000Z', activo: false, deletedAt: null },
  { id: 6, nombre: 'Ximena', apellido: 'Bermúdez', fechaIngreso: '2022-07-15T00:00:00.000Z', activo: true, deletedAt: new Date() },
];

// Only active non-deleted users (what the batch query should return)
// NOTE: The service iterates ALL users and applies its own filters.
// We must return ALL users here so usuariosProcesados counts correctly.
const mockUsuariosActivos = [...mockUsuarios];

const mockBalances = [
  { id: 11, usuarioId: 1, anoLaboralId: 1, tipoAusencia: 'vacaciones', cantidadAcumulada: '5.0000', cantidadDisponible: '5.0000' },
  { id: 12, usuarioId: 2, anoLaboralId: 1, tipoAusencia: 'vacaciones', cantidadAcumulada: '0.0000', cantidadDisponible: '0.0000' },
  { id: 14, usuarioId: 4, anoLaboralId: 1, tipoAusencia: 'vacaciones', cantidadAcumulada: '0.0000', cantidadDisponible: '0.0000' },
  { id: 16, usuarioId: 6, anoLaboralId: 1, tipoAusencia: 'vacaciones', cantidadAcumulada: '0.0000', cantidadDisponible: '0.0000' },
];

// Tabla en memoria: usuarioId + anio + mes -> 'existe'
const historialTabla: Array<{ usuarioId: number; anio: number; mes: number; id: number }> = [];
let nextHistorialId = 1;
const historialInserts: Array<Record<string, unknown>> = [];

function makeChain(rows: any[]) {
  return {
    from: () => makeChain(rows),
    where: () => makeChain(rows),
    limit: () => Promise.resolve(rows),
    orderBy: () => makeChain(rows),
    innerJoin: () => makeChain(rows),
    leftJoin: () => makeChain(rows),
    then: (resolve: any) => Promise.resolve(rows).then(resolve),
  };
}

// Extract all primitive values (numbers, strings) from a Drizzle condition
// object by recursively walking queryChunks. Handles Param objects used
// in the vitest environment where values are wrapped.
function extractValues(obj: any): (number | string)[] {
  if (obj == null) return [];
  if (typeof obj === 'number' || typeof obj === 'string') return [obj];
  // Drizzle Param wrapper: { value: <actual> }
  if (typeof obj === 'object' && 'value' in obj && typeof obj.value !== 'object') return [obj.value];
  if (Array.isArray(obj)) return obj.flatMap(extractValues);
  if (typeof obj === 'object' && obj.queryChunks) return extractValues(obj.queryChunks);
  return [];
}

// Counter for no-args select() calls to distinguish año laboral (first call)
// from balance existence check (subsequent calls inside tx loop).
let noArgsSelectCallCount = 0;

const mockTx = {
  select: (fields?: any) => {
    const keys = fields && typeof fields === 'object' ? Object.keys(fields) : [];

    // 1. db.select() — no args → año laboral (1st call) or balance existence (later calls)
    if (!fields) {
      noArgsSelectCallCount++;
      if (noArgsSelectCallCount === 1) {
        return makeChain([{ id: 1 }]);
      }
      // Subsequent no-args selects: balance existence check inside tx loop
      let userId: number | undefined;
      return {
        from: () => ({
          where: (cond: any) => {
            const vals = extractValues(cond);
            userId = vals.find((v): v is number => typeof v === 'number') as number | undefined;
            return {
              limit: () => {
                const balance = mockBalances.find(b => b.usuarioId === userId);
                return Promise.resolve(balance ? [balance] : []);
              },
            };
          },
        }),
      };
    }

    // 2. select({nombre: ...}) → individual user lookup (tx inside loop).
    if (keys.includes('nombre')) {
      let userId: number | undefined;
      return {
        from: () => ({
          where: (cond: any) => {
            const vals = extractValues(cond);
            userId = vals.find((v): v is number => typeof v === 'number') as number | undefined;
            return {
              limit: () => {
                const found = mockUsuarios.find(u => u.id === userId);
                return Promise.resolve([found ?? null]);
              },
            };
          },
        }),
      };
    }

    // 3. select({id: historial...id}) → duplicate check on historial table.
    if (
      keys.length === 1 &&
      keys[0] === 'id' &&
      fields.id?.table?.[Symbol.for('drizzle:Name')] === 'historial_asignaciones_mensuales'
    ) {
      let userId: number | undefined;
      let anio: number | undefined;
      let mes: number | undefined;
      return {
        from: () => ({
          where: (cond: any) => {
            const vals = extractValues(cond);
            const nums = vals.filter((v): v is number => typeof v === 'number');
            [userId, anio, mes] = [nums[0], nums[1], nums[2]];
            return {
              limit: () => {
                const match = historialTabla.find(
                  h => h.usuarioId === userId && h.anio === anio && h.mes === mes
                );
                return Promise.resolve(match ? [{ id: match.id }] : []);
              },
            };
          },
        }),
      };
    }

    // 4. select({cantidadDisponible: ...}) → single balance read-back
    if (keys.includes('cantidadDisponible') && !keys.includes('cantidadAcumulada')) {
      let userId: number | undefined;
      return {
        from: () => ({
          where: (cond: any) => {
            const vals = extractValues(cond);
            userId = vals.find((v): v is number => typeof v === 'number') as number | undefined;
            return {
              limit: () => {
                const balance = mockBalances.find(b => b.usuarioId === userId);
                return Promise.resolve(balance ? [{ cantidadDisponible: '15.0000' }] : []);
              },
            };
          },
        }),
      };
    }

    // 5. select({id: usuarios.id}).from(usuarios).where(...) → batch user list
    if (keys.includes('id') && fields.id?.table?.[Symbol.for('drizzle:Name')] === 'usuarios') {
      return makeChain(mockUsuariosActivos);
    }

    // Fallback
    return makeChain([]);
  },
  insert: (table: any) => ({
    values: (vals: any) => {
      historialInserts.push(vals);
      const tblName = table?.[Symbol.for('drizzle:Name')] ?? '';
      if (tblName === 'historial_asignaciones_mensuales') {
        const id = nextHistorialId++;
        historialTabla.push({ usuarioId: vals.usuarioId, anio: vals.anio, mes: vals.mes, id });
        return {
          returning: (fields: any) => {
            void fields;
            return Promise.resolve([{ id }]);
          },
        };
      }
      if (tblName === 'notificaciones') {
        const nid = historialInserts.length;
        return {
          returning: (fields: any) => {
            void fields;
            return Promise.resolve([{ id: nid }]);
          },
        };
      }
      return {
        returning: (fields: any) => {
          void fields;
          return Promise.resolve([]);
        },
      };
    },
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }),
  execute: (q: any) => {
    void q;
    return Promise.resolve();
  },
};

vi.mock('@/lib/db', () => ({
  db: {
    transaction: async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    select: mockTx.select,
    query: {
      usuarios: {
        findFirst: vi.fn(async () => mockUsuarios[0]),
      },
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(async () => mockSession),
}));

vi.mock('@/services/auditoria.service', () => ({
  registrarAuditoria: vi.fn(async () => undefined),
  registrarEventoAuditoria: vi.fn(async () => undefined),
  datosPeticion: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'test' })),
}));

describe('asignacion-vacaciones.service — Fase 5 (lógica de orquestación)', () => {
  beforeEach(() => {
    historialTabla.length = 0;
    historialInserts.length = 0;
    nextHistorialId = 1;
    noArgsSelectCallCount = 0;
  });

  it('ejecuta asignación y devuelve resumen con conteos correctos', async () => {
    const mod = await import('@/services/asignacion-vacaciones.service');
    // Use mes: 8 (August) so reference = Aug 1, 2026 which is after both
    // Ana's birthday (Jul 15) and Luis's birthday (Jul 15).
    const resumen = await mod.asignarVacacionesMensuales({
      anio: 2026,
      mes: 8,
      origen: 'manual',
      ejecutadoPor: 99,
    });

    // Esperado:
    //   1 (Ana, 4 años, 1.6667) → asignado
    //   2 (Luis, 1 año, 0.8333) → asignado
    //   3 (María, sin fecha)     → omitido_sin_ingreso
    //   4 (Pedro, < 1 año)       → omitido_sin_antiguedad
    //   5 (Sofía, inactivo)     → omitido_inactivo
    //   6 (Ximena, eliminado)    → omitido_eliminado

    expect(resumen.usuariosProcesados).toBe(6);
    expect(resumen.asignacionesCreadas).toBe(2);
    expect(resumen.usuariosOmitidos).toBe(4);
    expect(resumen.totalDiasAsignados).toBeCloseTo(0.8333 + 1.6667, 4);

    const estados = resumen.detalles.map((d: { estado: string }) => d.estado);
    expect(estados.filter((e: string) => e === 'asignado')).toHaveLength(2);
    expect(estados.filter((e: string) => e === 'omitido_sin_ingreso')).toHaveLength(1);
    expect(estados.filter((e: string) => e === 'omitido_sin_antiguedad')).toHaveLength(1);
    expect(estados.filter((e: string) => e === 'omitido_inactivo')).toHaveLength(1);
    expect(estados.filter((e: string) => e === 'omitido_eliminado')).toHaveLength(1);
  });

  it('no duplica asignaciones del mismo (usuario, anio, mes)', async () => {
    const mod = await import('@/services/asignacion-vacaciones.service');

    // Pre-poblar historialTabla como si la asignación de Ana ya existiera.
    historialTabla.push({ usuarioId: 1, anio: 2026, mes: 8, id: 99 });

    const resumen = await mod.asignarVacacionesMensuales({
      anio: 2026,
      mes: 8,
      origen: 'manual',
      ejecutadoPor: 99,
    });

    const ana = resumen.detalles.find((d: { usuarioId: number }) => d.usuarioId === 1);
    // Ana (id=1) está en historialTabla → omitido_duplicado. Luis (id=2) es
    // el otro activo con fecha de ingreso que asignaría normalmente.
    expect(ana?.estado).toBe('omitido_duplicado');
    // Contamos: Ana (duplicado), Luis (asignado), María (sin ingreso),
    // Pedro (< 1 año), Sofía (inactivo), Ximena (eliminada).
    expect(resumen.asignacionesCreadas).toBe(1); // solo Luis
    expect(resumen.usuariosOmitidos).toBe(5);
  });

  it('persiste días_asignados con 4 decimales (precisión BD)', async () => {
    const mod = await import('@/services/asignacion-vacaciones.service');
    await mod.asignarVacacionesMensuales({
      anio: 2026,
      mes: 8,
      origen: 'manual',
      ejecutadoPor: 99,
    });

    // Ana (4 años → 1.6667 mensual). Luis (1 año → 0.8333 mensual).
    const anaInsert = historialInserts.find(
      (h: Record<string, unknown>) => h.usuarioId === 1
    );
    const luisInsert = historialInserts.find(
      (h: Record<string, unknown>) => h.usuarioId === 2
    );
    expect(anaInsert?.diasAsignados).toBe('1.6667');
    expect(luisInsert?.diasAsignados).toBe('0.8333');
    // Balance guardado con 4 decimales también.
    expect(anaInsert?.balanceAnterior).toMatch(/^\d+\.\d{4}$/);
    expect(anaInsert?.balanceNuevo).toMatch(/^\d+\.\d{4}$/);
  });

  it('crea notificación interna por asignación con datos clave (mes, días, total)', async () => {
    const mod = await import('@/services/asignacion-vacaciones.service');
    historialInserts.length = 0;
    await mod.asignarVacacionesMensuales({
      anio: 2026,
      mes: 8,
      origen: 'manual',
      ejecutadoPor: 99,
    });

    const notificacionesInsertadas = historialInserts.filter(
      (h: Record<string, unknown>) => h.tipo === 'asignacion_vacaciones'
    );
    // Ana (id=1) y Luis (id=2) reciben notificación.
    expect(notificacionesInsertadas.length).toBeGreaterThanOrEqual(2);

    const anaNotif = notificacionesInsertadas.find(
      (n: Record<string, unknown>) => n.usuarioId === 1
    );
    expect(anaNotif).toMatchObject({
      titulo: 'Asignación mensual de vacaciones',
      leida: false,
    });
    expect(String(anaNotif?.mensaje ?? '')).toContain('mes 8');
    expect(String(anaNotif?.mensaje ?? '')).toMatch(/d[ií]as/);
    // Total nuevo disponible (precisión 2 decimales en display).
    expect(String(anaNotif?.mensaje ?? '')).toMatch(/\d+\.\d{1,2} d[ií]as/);
    expect(String(anaNotif?.referencia ?? '')).toMatch(/^asignacion:/);
  });

  it('no crea notificación cuando el usuario fue omitido', async () => {
    const mod = await import('@/services/asignacion-vacaciones.service');
    historialInserts.length = 0;
    await mod.asignarVacacionesMensuales({
      anio: 2026,
      mes: 8,
      origen: 'manual',
      ejecutadoPor: 99,
    });

    // Usuarios omitidos (sin ingreso, sin antigüedad, inactivo, eliminado)
    // no deben tener notificación de tipo asignacion_vacaciones.
    const usuariosOmitidosIds = [3, 4, 5, 6];
    for (const id of usuariosOmitidosIds) {
      const notifs = historialInserts.filter(
        (n: Record<string, unknown>) =>
          n.usuarioId === id && n.tipo === 'asignacion_vacaciones'
      );
      expect(notifs).toHaveLength(0);
    }
  });
});