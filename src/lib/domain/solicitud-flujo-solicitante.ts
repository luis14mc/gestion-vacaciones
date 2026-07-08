import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios, departamentos } from '@/lib/db/schema';
import {
  resolverFlujoAprobacionNuevaSolicitud,
  type FlujoAprobacionNuevaSolicitud,
} from '@/lib/domain/solicitud-flujo-aprobacion';

export interface DatosFlujoSolicitante {
  esDirector: boolean;
  esJefe: boolean;
  departamentoNombre: string | null;
}

export async function cargarDatosFlujoSolicitante(
  usuarioId: number
): Promise<DatosFlujoSolicitante | null> {
  const [usuario] = await db
    .select({
      esDirector: usuarios.esDirector,
      esJefe: usuarios.esJefe,
      departamentoId: usuarios.departamentoId,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!usuario) {
    return null;
  }

  let departamentoNombre: string | null = null;
  if (usuario.departamentoId) {
    const [departamento] = await db
      .select({ nombre: departamentos.nombre })
      .from(departamentos)
      .where(eq(departamentos.id, usuario.departamentoId))
      .limit(1);
    departamentoNombre = departamento?.nombre ?? null;
  }

  return {
    esDirector: usuario.esDirector,
    esJefe: usuario.esJefe,
    departamentoNombre,
  };
}

export function resolverFlujoSolicitante(
  datos: DatosFlujoSolicitante,
  tipo: string
): FlujoAprobacionNuevaSolicitud {
  return resolverFlujoAprobacionNuevaSolicitud({
    esDirector: datos.esDirector,
    esJefe: datos.esJefe,
    departamentoNombre: datos.departamentoNombre,
    tipo,
  });
}
