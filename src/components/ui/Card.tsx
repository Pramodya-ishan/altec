import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, children, hoverable = false, ...props }) => {
  return (
    <div
      className={cn(
        "bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[var(--radius-lg)] p-5 sm:p-6 transition-all duration-200",
        hoverable && "hover:shadow-lg hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
