'use client';

import type { ReactNode } from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'info' | 'success' | 'warning' | 'error';
type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  children: ReactNode;
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  primary: 'badge-primary',
  secondary: 'badge-secondary',
  accent: 'badge-accent',
  ghost: 'badge-ghost',
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
};

const sizeMap: Record<BadgeSize, string> = {
  xs: 'badge-xs',
  sm: 'badge-sm',
  md: '',
  lg: 'badge-lg',
};

export function Badge({ variant = 'ghost', size = 'md', outline, children, className = '' }: BadgeProps) {
  const classes = [
    'badge',
    variantMap[variant],
    sizeMap[size],
    outline ? 'badge-outline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}
