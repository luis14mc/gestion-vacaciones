import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/types';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 1,
    email: 'u@cni.hn',
    nombre: 'Test',
    apellido: 'User',
    roles: [],
    permisos: [],
    esAdmin: false,
    esRrhh: false,
    esDirector: false,
    esJefe: false,
    esSecretarioGeneral: false,
    ...overrides,
  };
}

describe('aprobadores.ts — Fase 2 Secretario General', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('esSecretarioGeneral / usuarioEsSecretarioGeneralActivo', () => {
    it('devuelve true solo si el flag esSecretarioGeneral está activo', async () => {
      const { esSecretarioGeneral, usuarioEsSecretarioGeneralActivo } = await import(
        '@/lib/domain/aprobadores'
      );
      expect(esSecretarioGeneral(null)).toBe(false);
      expect(esSecretarioGeneral(session({ esSecretarioGeneral: false }))).toBe(false);
      expect(esSecretarioGeneral(session({ esSecretarioGeneral: true }))).toBe(true);
      expect(usuarioEsSecretarioGeneralActivo(session({ esSecretarioGeneral: true }))).toBe(true);
    });
  });

  describe('obtenerSecretarioGeneral (con BD mockeada)', () => {
    it('devuelve null si no hay Secretario General activo', async () => {
      vi.doMock('@/lib/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve([])),
            })),
          })),
        },
      }));
      const { obtenerSecretarioGeneral } = await import('@/lib/domain/aprobadores');
      const sg = await obtenerSecretarioGeneral();
      expect(sg).toBeNull();
    });

    it('lanza error si hay más de un Secretario General activo', async () => {
      vi.doMock('@/lib/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() =>
                Promise.resolve([
                  { id: 1, nombre: 'SG 1', apellido: 'Apellido 1' },
                  { id: 2, nombre: 'SG 2', apellido: 'Apellido 2' },
                ])
              ),
            })),
          })),
        },
      }));
      const { obtenerSecretarioGeneral } = await import('@/lib/domain/aprobadores');
      await expect(obtenerSecretarioGeneral()).rejects.toThrow(
        /Secretarios Generales activos/
      );
    });

    it('devuelve el único Secretario General activo', async () => {
      vi.doMock('@/lib/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() =>
                Promise.resolve([
                  { id: 99, nombre: 'Sec.', apellido: 'General' },
                ])
              ),
            })),
          })),
        },
      }));
      const { obtenerSecretarioGeneral } = await import('@/lib/domain/aprobadores');
      const sg = await obtenerSecretarioGeneral();
      expect(sg).toEqual({ id: 99, nombre: 'Sec. General' });
    });
  });
});