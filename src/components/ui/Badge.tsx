import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'slate';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'primary', children, ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold select-none",
        variant === 'primary' && "bg-[var(--brand-50)] text-[var(--brand-700)]",
        variant === 'secondary' && "bg-slate-100 text-slate-800",
        variant === 'success' && "bg-emerald-50 text-emerald-700",
        variant === 'warning' && "bg-amber-50 text-amber-700",
        variant === 'danger' && "bg-red-50 text-red-700",
        variant === 'slate' && "bg-slate-200 text-slate-700",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
