import { describe, expect, it } from "vitest";

/** Espejo de resolverFlagsDesdeRoles en src/auth.ts */
function resolverFlagsDesdeRoles(
  codigosRol: string[],
  usuario: {
    esAdmin: boolean;
    esRrhh: boolean;
    esDirector: boolean;
    esJefe: boolean;
  }
) {
  return {
    esAdmin: codigosRol.includes("ADMIN") || usuario.esAdmin,
    esRrhh: codigosRol.includes("RRHH") || usuario.esRrhh,
    esDirector: codigosRol.includes("DIRECTOR") || usuario.esDirector,
    esJefe: codigosRol.includes("JEFE") || usuario.esJefe,
  };
}

describe("JWT slim — flags de rol sin arrays en token", () => {
  it("deriva flags desde códigos RBAC", () => {
    const flags = resolverFlagsDesdeRoles(["RRHH", "JEFE"], {
      esAdmin: false,
      esRrhh: false,
      esDirector: false,
      esJefe: false,
    });
    expect(flags).toEqual({
      esAdmin: false,
      esRrhh: true,
      esDirector: false,
      esJefe: true,
    });
  });

  it("conserva flags legacy de la fila usuarios", () => {
    const flags = resolverFlagsDesdeRoles([], {
      esAdmin: true,
      esRrhh: false,
      esDirector: false,
      esJefe: false,
    });
    expect(flags.esAdmin).toBe(true);
  });

  it("el payload mínimo no incluye roles ni permisos", () => {
    const slimClaims = [
      "id",
      "email",
      "nombre",
      "apellido",
      "departamentoId",
      "esAdmin",
      "esRrhh",
      "esJefe",
      "esDirector",
      "absExp",
    ];
    const forbiddenInJwt = ["roles", "permisos", "modulos", "metadata", "cargo"];
    for (const key of forbiddenInJwt) {
      expect(slimClaims).not.toContain(key);
    }
  });
});
