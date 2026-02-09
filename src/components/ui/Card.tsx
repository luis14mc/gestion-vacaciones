'use client';

import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  compact?: boolean;
}

export function Card({ title, subtitle, children, className = '', actions, compact }: CardProps) {
  return (
    <div className={`card bg-base-100 shadow-md ${className}`}>
      <div className={`card-body ${compact ? 'p-4' : ''}`}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-2">
            <div>
              {title && <h2 className="card-title text-base">{title}</h2>}
              {subtitle && <p className="text-sm text-base-content/60">{subtitle}</p>}
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
