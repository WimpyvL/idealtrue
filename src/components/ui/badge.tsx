import React from 'react';
import { cn } from '@/lib/utils';

export const Badge = ({ children, variant = 'neutral', className }: { children: React.ReactNode, variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'secondary', className?: string }) => {
  const variants = {
    neutral: 'bg-surface-container-low text-on-surface-variant',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    secondary: 'bg-surface-container-low text-on-surface',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider', variants[variant], className)}>
      {children}
    </span>
  );
};
