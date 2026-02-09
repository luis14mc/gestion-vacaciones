'use client';

import { ESTADOS_CONFIG } from '@/lib/domain/state-machine';
import type { EstadoSolicitud } from '@/types';

interface StatusBadgeProps {
  estado: EstadoSolicitud;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

/**
 * Badge visual para estados de solicitud.
 * Colores y labels centralizados en la state machine.
 */
export function StatusBadge({ estado, size = 'sm', showIcon = true, className = '' }: StatusBadgeProps) {
  const config = ESTADOS_CONFIG[estado];

  if (!config) {
    return <span className="badge badge-ghost badge-sm">Desconocido</span>;
  }

  const sizeClass = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-sm px-4 py-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClass} ${className}`}
    >
      {showIcon && <span className="text-[0.85em]">{config.icon}</span>}
      {config.label}
    </span>
  );
}
