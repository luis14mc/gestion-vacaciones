// Servicio de Usuarios - Semana 2
export interface NuevoUsuario {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  cedula: string;
  departamentoId: number;
  fechaIngreso: Date;
  cargo?: string;
}

export interface ActualizarUsuario {
  nombre?: string;
  apellido?: string;
  departamentoId?: number;
  cargo?: string;
  activo?: boolean;
}

// Implementación pendiente
