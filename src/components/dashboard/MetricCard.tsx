'use client';

import React from 'react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
}

const COLOR_MAP = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent-foreground',
  info: 'bg-blue-500/10 text-blue-500',
  success: 'bg-green-500/10 text-green-500',
  warning: 'bg-orange-500/10 text-orange-500',
  error: 'bg-red-500/10 text-red-500',
};

export function MetricCard({ title, value, subtitle, icon: Icon, color }: MetricCardProps) {
  const colorStyles = COLOR_MAP[color] || COLOR_MAP.primary;

  return (
    <div className="group bg-card text-card-foreground border shadow-sm rounded-xl p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[13px] text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorStyles.split(' ')[0]}`}>
          <Icon className={`w-[18px] h-[18px] ${colorStyles.split(' ')[1]}`} />
        </div>
      </div>
    </div>
  );
}
