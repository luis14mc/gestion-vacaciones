/** Formatea tiempo relativo usando una referencia fija (evita Date.now() impuro en render). */
export function calcularTiempoRelativo(fecha: string, referenciaMs: number): string {
  const diff = referenciaMs - new Date(fecha).getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Hace 1 día';
  if (dias < 30) return `Hace ${dias} días`;

  const meses = Math.floor(dias / 30);
  if (meses === 1) return 'Hace 1 mes';
  return `Hace ${meses} meses`;
}
