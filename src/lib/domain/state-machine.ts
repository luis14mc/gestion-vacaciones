export type EstadoSolicitud =
  | 'borrador'
  | 'pendiente_jefe'
  | 'aprobada_jefe'
  | 'rechazada_jefe'
  | 'aprobada_rrhh'
  | 'rechazada_rrhh'
  | 'cancelada'
  | 'finalizada';

export type AccionSolicitud =
  | 'enviar'
  | 'aprobar_jefe'
  | 'rechazar_jefe'
  | 'aprobar_rrhh'
  | 'rechazar_rrhh'
  | 'cancelar'
  | 'finalizar';

export interface TransicionContexto {
  usuarioId: number;
  solicitanteId: number;
  esDirector: boolean;
  esJefe: boolean;
  esRrhh: boolean;
  esAdmin: boolean;
  tipo?: string;
  // Departamentos para validar alcance de aprobación (regla CNI: mismo depto)
  departamentoAprobador?: number | null;
  departamentoSolicitante?: number | null;
  esSubordinadoDirecto?: boolean;
  directorSinSubordinadosDirectos?: boolean;
  // Jerarquía: si el solicitante es Jefe, solo el Director puede aprobarlo
  solicitanteEsJefe?: boolean;
  // Acción ejecutada por el sistema (cron/jobs), no por un usuario
  esSistema?: boolean;
}

interface Efecto {
  tipo: 'RESERVAR_BALANCE' | 'CONFIRMAR_BALANCE' | 'LIBERAR_BALANCE' | 'NOTIFICAR';
  dias?: number;
  destinatario?: string;
}

interface ResultadoTransicion {
  exito: boolean;
  estadoNuevo?: EstadoSolicitud;
  efectos: Efecto[];
  error?: string;
}

interface EstadoConfig {
  label: string;
  bgColor: string;
  textColor: string;
  esFinal: boolean;
}

export const ESTADOS_CONFIG: Record<EstadoSolicitud, EstadoConfig> = {
  borrador:              { label: 'Borrador',              bgColor: 'bg-gray-100',   textColor: 'text-gray-700',   esFinal: false },
  pendiente_jefe:        { label: 'Pendiente Jefe',        bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', esFinal: false },
  aprobada_jefe:         { label: 'Aprobada Jefe',         bgColor: 'bg-blue-100',   textColor: 'text-blue-800',   esFinal: false },
  rechazada_jefe:        { label: 'Rechazada Jefe',        bgColor: 'bg-red-100',    textColor: 'text-red-800',    esFinal: true  },
  aprobada_rrhh:         { label: 'Aprobada',              bgColor: 'bg-green-100',  textColor: 'text-green-800',  esFinal: false },
  rechazada_rrhh:        { label: 'Rechazada RRHH',        bgColor: 'bg-red-100',    textColor: 'text-red-800',    esFinal: true  },
  cancelada:             { label: 'Cancelada',             bgColor: 'bg-gray-100',   textColor: 'text-gray-600',   esFinal: true  },
  finalizada:            { label: 'Finalizada',            bgColor: 'bg-emerald-100',textColor: 'text-emerald-800',esFinal: true  },
};

type Guard = (ctx: TransicionContexto) => string | null;

interface TransicionDef {
  destino: EstadoSolicitud | ((ctx: TransicionContexto) => EstadoSolicitud);
  guard: Guard;
  efectos: (dias: number) => Efecto[];
}

const guardPropietarioOAdmin: Guard = (ctx) => {
  if (ctx.esAdmin || ctx.usuarioId === ctx.solicitanteId) return null;
  return 'No tiene permisos para realizar esta acción';
};

const guardJefe: Guard = (ctx) => {
  if (!ctx.esAdmin && !ctx.esJefe && !ctx.esDirector) return 'Solo un Jefe o Director puede realizar esta acción';
  if (ctx.usuarioId === ctx.solicitanteId) return 'No puede aprobar/rechazar su propia solicitud';
  if (ctx.esAdmin) return null;
  // Regla CNI: el jefe/director solo aprueba a empleados de su MISMO departamento.
  // Cierra la escalada horizontal (un jefe del depto A aprobando al depto B).
  // Default seguro: si falta el dato de departamento, se deniega.
  if (
    ctx.departamentoAprobador == null ||
    ctx.departamentoSolicitante == null ||
    ctx.departamentoAprobador !== ctx.departamentoSolicitante
  ) {
    return 'Solo puede aprobar solicitudes de empleados de su mismo departamento';
  }
  const usaFallbackDirector = ctx.esDirector && ctx.directorSinSubordinadosDirectos === true;
  if (ctx.esSubordinadoDirecto !== true && !usaFallbackDirector) {
    return 'Solo puede aprobar solicitudes de su equipo directo';
  }
  // Jerarquía CNI (2 niveles): el Director está por encima de los Jefes.
  // La solicitud de un Jefe SOLO puede aprobarla el Director del depto;
  // un Jefe no puede aprobar a otro Jefe de su mismo nivel.
  if (ctx.solicitanteEsJefe && !ctx.esDirector) {
    return 'La solicitud de un Jefe solo puede ser aprobada por el Director del departamento';
  }
  return null;
};

const guardRrhh: Guard = (ctx) => {
  if (!ctx.esAdmin && !ctx.esRrhh) return 'Solo RRHH puede realizar esta acción';
  if (ctx.usuarioId === ctx.solicitanteId) return 'No puede aprobar/rechazar su propia solicitud';
  return null;
};

const guardCancelar: Guard = (ctx) => {
  if (ctx.esAdmin || ctx.esRrhh || ctx.usuarioId === ctx.solicitanteId) return null;
  return 'No tiene permisos para cancelar esta solicitud';
};

// Finalizar es una acción del sistema (al vencer la fecha de fin) o de un admin.
const guardSistema: Guard = (ctx) => {
  if (ctx.esSistema || ctx.esAdmin) return null;
  return 'Solo el sistema o un administrador puede finalizar una solicitud';
};

const sinEfectos = () => [] as Efecto[];

const TRANSICIONES: Record<string, Record<string, TransicionDef>> = {
  borrador: {
    enviar: {
      destino: (ctx) => (ctx.esDirector ? 'aprobada_jefe' : 'pendiente_jefe'),
      guard: guardPropietarioOAdmin,
      efectos: (dias) => [{ tipo: 'RESERVAR_BALANCE', dias }],
    },
    cancelar: {
      destino: 'cancelada',
      guard: guardPropietarioOAdmin,
      efectos: sinEfectos,
    },
  },
  pendiente_jefe: {
    aprobar_jefe: {
      destino: 'aprobada_jefe',
      guard: guardJefe,
      efectos: sinEfectos,
    },
    rechazar_jefe: {
      destino: 'rechazada_jefe',
      guard: guardJefe,
      efectos: (dias) => [{ tipo: 'LIBERAR_BALANCE', dias }],
    },
    cancelar: {
      destino: 'cancelada',
      guard: guardCancelar,
      efectos: (dias) => [{ tipo: 'LIBERAR_BALANCE', dias }],
    },
  },
  aprobada_jefe: {
    aprobar_rrhh: {
      destino: 'aprobada_rrhh',
      guard: guardRrhh,
      efectos: (dias) => [{ tipo: 'CONFIRMAR_BALANCE', dias }],
    },
    rechazar_rrhh: {
      destino: 'rechazada_rrhh',
      guard: guardRrhh,
      efectos: (dias) => [{ tipo: 'LIBERAR_BALANCE', dias }],
    },
    cancelar: {
      destino: 'cancelada',
      guard: guardCancelar,
      efectos: (dias) => [{ tipo: 'LIBERAR_BALANCE', dias }],
    },
  },
  aprobada_rrhh: {
    finalizar: {
      destino: 'finalizada',
      guard: guardSistema,
      efectos: sinEfectos,
    },
  },
};

export function transicionar(
  estadoActual: EstadoSolicitud,
  accion: AccionSolicitud,
  contexto: TransicionContexto,
  dias: number
): ResultadoTransicion {
  const config = ESTADOS_CONFIG[estadoActual];
  if (config?.esFinal) {
    return { exito: false, efectos: [], error: `El estado "${estadoActual}" es final y no permite transiciones` };
  }

  const estadoTransiciones = TRANSICIONES[estadoActual];
  if (!estadoTransiciones) {
    return { exito: false, efectos: [], error: `Transición inválida: "${accion}" no permitida desde "${estadoActual}"` };
  }

  const transicion = estadoTransiciones[accion];
  if (!transicion) {
    return { exito: false, efectos: [], error: `Transición inválida: "${accion}" no permitida desde "${estadoActual}"` };
  }

  const guardError = transicion.guard(contexto);
  if (guardError) {
    return { exito: false, efectos: [], error: guardError };
  }

  const destinoFinal = typeof transicion.destino === 'function' ? transicion.destino(contexto) : transicion.destino;

  return {
    exito: true,
    estadoNuevo: destinoFinal,
    efectos: transicion.efectos(dias),
  };
}

export function obtenerAccionesDisponibles(estado: EstadoSolicitud): AccionSolicitud[] {
  const transiciones = TRANSICIONES[estado];
  if (!transiciones) return [];
  return Object.keys(transiciones) as AccionSolicitud[];
}

export function puedeTransicionar(
  estadoActual: EstadoSolicitud,
  accion: AccionSolicitud,
  contexto: TransicionContexto
): { valido: boolean; error?: string } {
  const estadoTransiciones = TRANSICIONES[estadoActual];
  if (!estadoTransiciones?.[accion]) {
    return { valido: false, error: `Transición inválida: "${accion}" no permitida desde "${estadoActual}"` };
  }

  const guardError = estadoTransiciones[accion].guard(contexto);
  if (guardError) {
    return { valido: false, error: guardError };
  }

  return { valido: true };
}

export function obtenerMapaTransiciones(contextoMock?: TransicionContexto): { desde: EstadoSolicitud; hacia: EstadoSolicitud; accion: AccionSolicitud }[] {
  const mapa: { desde: EstadoSolicitud; hacia: EstadoSolicitud; accion: AccionSolicitud }[] = [];

  for (const [desde, acciones] of Object.entries(TRANSICIONES)) {
    for (const [accion, def] of Object.entries(acciones)) {
      const destinoFinal = typeof def.destino === 'function' 
        ? (contextoMock ? def.destino(contextoMock) : 'aprobada_jefe') // Fallback para diagramas
        : def.destino;
        
      mapa.push({
        desde: desde as EstadoSolicitud,
        hacia: destinoFinal as EstadoSolicitud,
        accion: accion as AccionSolicitud,
      });
    }
  }

  return mapa;
}

export function esEstadoFinal(estado: EstadoSolicitud): boolean {
  return ESTADOS_CONFIG[estado]?.esFinal ?? false;
}
