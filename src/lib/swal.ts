/**
 * Wrapper centralizado de SweetAlert2 para el proyecto.
 * Uso:
 *   import { notify, confirmAction } from '@/lib/swal';
 *   notify.success('Guardado', 'El registro se guardó correctamente');
 *   const ok = await confirmAction('¿Eliminar?', 'Esta acción no se puede deshacer');
 */
import Swal from 'sweetalert2';
import { sileo } from 'sileo';

// ─── Tema base alineado con iOS 26 Glass ───────────────
const base = {
  customClass: {
    popup: '!rounded-2xl !shadow-[0_8px_32px_oklch(0%_0_0/0.12)] !border !border-white/50 !backdrop-blur-2xl',
    confirmButton: '!rounded-xl !font-semibold !px-5 !text-[13px]',
    cancelButton: '!rounded-xl !font-semibold !px-5 !text-[13px]',
  },
  buttonsStyling: true,
  showClass: { popup: 'animate__animated animate__fadeIn animate__faster' },
  hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' },
};

// ─── Notificaciones rápidas (toast) ────────────────────
export const notify = {
  success: (title: string, text?: string) =>
    sileo.success({ title, description: text }),

  error: (title: string, text?: string) =>
    sileo.error({ title, description: text, duration: 5000 }),

  warning: (title: string, text?: string) =>
    sileo.warning({ title, description: text, duration: 4000 }),

  info: (title: string, text?: string) =>
    sileo.info({ title, description: text }),
};

// ─── Alertas modales (pantalla completa) ───────────────
export const alert = {
  success: (title: string, text?: string) =>
    Swal.fire({ ...base, icon: 'success', title, text, confirmButtonColor: '#34c759' }),

  error: (title: string, text?: string) =>
    Swal.fire({ ...base, icon: 'error', title, text, confirmButtonColor: '#3478f6' }),

  warning: (title: string, text?: string) =>
    Swal.fire({ ...base, icon: 'warning', title, text, confirmButtonColor: '#3478f6' }),

  info: (title: string, text?: string) =>
    Swal.fire({ ...base, icon: 'info', title, text, confirmButtonColor: '#5856d6' }),
};

// ─── Confirmaciones ────────────────────────────────────
export async function confirmAction(
  title: string,
  text: string,
  opts?: {
    confirmText?: string;
    cancelText?: string;
    icon?: 'warning' | 'question' | 'info';
    confirmColor?: string;
    /** Si true, muestra textarea para motivo y retorna el texto */
    withInput?: boolean;
    inputLabel?: string;
    inputPlaceholder?: string;
  }
): Promise<{ confirmed: boolean; inputValue?: string }> {
  const result = await Swal.fire({
    ...base,
    icon: opts?.icon ?? 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: opts?.confirmText ?? 'Confirmar',
    cancelButtonText: opts?.cancelText ?? 'Cancelar',
    confirmButtonColor: opts?.confirmColor ?? '#3478f6',
    cancelButtonColor: '#8e8e93',
    reverseButtons: true,
    ...(opts?.withInput
      ? {
        input: 'textarea',
        inputLabel: opts.inputLabel ?? '',
        inputPlaceholder: opts.inputPlaceholder ?? '',
        inputValidator: (value: string) => (!value ? 'Este campo es requerido' : null),
      }
      : {}),
  });

  return {
    confirmed: result.isConfirmed,
    inputValue: result.value as string | undefined,
  };
}

// ─── Loading modal ─────────────────────────────────────
export function showLoading(title = 'Procesando...', text = 'Por favor espere') {
  Swal.fire({
    ...base,
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });
}

export function closeLoading() {
  Swal.close();
}

// Re-export Swal para casos avanzados
export { Swal };
