/**
 * Notificaciones y confirmaciones centralizadas (sin sweetalert2).
 */
import { sileo } from 'sileo';

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

export const alert = {
  success: (title: string, text?: string) => {
    window.alert(text ? `${title}\n\n${text}` : title);
  },
  error: (title: string, text?: string) => {
    window.alert(text ? `${title}\n\n${text}` : title);
  },
  warning: (title: string, text?: string) => {
    window.alert(text ? `${title}\n\n${text}` : title);
  },
  info: (title: string, text?: string) => {
    window.alert(text ? `${title}\n\n${text}` : title);
  },
};

export async function confirmAction(
  title: string,
  text: string,
  opts?: {
    confirmText?: string;
    cancelText?: string;
    icon?: 'warning' | 'question' | 'info';
    confirmColor?: string;
    withInput?: boolean;
    inputLabel?: string;
    inputPlaceholder?: string;
  }
): Promise<{ confirmed: boolean; inputValue?: string }> {
  void opts?.confirmText;
  void opts?.confirmColor;
  void opts?.icon;

  if (opts?.withInput) {
    const promptLabel = opts.inputLabel
      ? `${title}\n${opts.inputLabel}`
      : `${title}\n${text}`;
    const inputValue = window.prompt(promptLabel, opts.inputPlaceholder ?? '');
    if (inputValue === null || inputValue.trim() === '') {
      return { confirmed: false };
    }
    return { confirmed: true, inputValue: inputValue.trim() };
  }

  const message = text ? `${title}\n\n${text}` : title;
  const confirmed = window.confirm(message);
  return { confirmed };
}

/** Compatibilidad: ya no hay modal bloqueante; las operaciones usan estado local. */
export function showLoading(_title = 'Procesando...', _text = 'Por favor espere') {}

export function closeLoading() {}
