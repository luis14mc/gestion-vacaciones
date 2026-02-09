'use client';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 'loading-xs',
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <span className={`loading loading-spinner ${sizeMap[size]} ${className}`} />;
}
