'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' | 'success' | 'warning' | 'info';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  outline?: boolean;
  block?: boolean;
}

const variantMap: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  ghost: 'btn-ghost',
  error: 'btn-error',
  success: 'btn-success',
  warning: 'btn-warning',
  info: 'btn-info',
};

const sizeMap: Record<Size, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, outline, block, className = '', children, disabled, ...props }, ref) => {
    const classes = [
      'btn',
      variantMap[variant],
      sizeMap[size],
      outline ? 'btn-outline' : '',
      block ? 'btn-block' : '',
      loading ? 'loading' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {loading && <span className="loading loading-spinner loading-sm mr-2" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
