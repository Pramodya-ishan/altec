import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = ({ className, children, hoverable = false, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[var(--radius-lg)] p-5 sm:p-6 transition-all duration-200",
        hoverable && "hover:border-slate-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
