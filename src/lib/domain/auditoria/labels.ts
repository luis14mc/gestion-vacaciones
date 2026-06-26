export const ACCION_LABELS: Record<string, string> = {
  crear: 'Crear',
  actualizar: 'Actualizar',
  eliminar: 'Eliminar',
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  login_fallido: 'Inicio de sesión fallido',
};

export const EVENTO_LABELS: Record<string, string> = {
  crear_usuario: 'Crear usuario',
  actualizar_usuario: 'Actualizar usuario',
  eliminar_usuario: 'Eliminar usuario',
  importar_usuarios: 'Importar usuarios',
  asignar_rol: 'Asignar rol',
  quitar_rol: 'Quitar rol',
  crear_solicitud: 'Crear solicitud',
  aprobar_jefe: 'Aprobar (jefe)',
  rechazar_jefe: 'Rechazar (jefe)',
  aprobar_rrhh: 'Aprobar (RRHH)',
  rechazar_rrhh: 'Rechazar (RRHH)',
  cancelar_solicitud: 'Cancelar solicitud',
  finalizar_solicitud: 'Finalizar solicitud',
  ajustar_balance: 'Ajustar balance',
  asignacion_masiva: 'Asignación masiva',
  asignar_dias_antiguedad: 'Asignar días por antigüedad',
  actualizar_configuracion: 'Actualizar configuración',
  exportar_reporte: 'Exportar reporte',
  exportar_auditoria: 'Exportar auditoría',
  login_exitoso: 'Login exitoso',
  login_fallido: 'Login fallido',
  logout: 'Logout',
  evento_manual_admin: 'Evento manual (admin)',
};

export const SEVERIDAD_LABELS: Record<string, string> = {
  info: 'Info',
  advertencia: 'Advertencia',
  critico: 'Crítico',
};

export const RESULTADO_LABELS: Record<string, string> = {
  exito: 'Éxito',
  fallo: 'Fallo',
  parcial: 'Parcial',
};

export function labelAccion(accion: string): string {
  return ACCION_LABELS[accion] ?? accion;
}

export function labelEvento(evento: string | null | undefined): string {
  if (!evento) return '—';
  return EVENTO_LABELS[evento] ?? evento.replace(/_/g, ' ');
}
