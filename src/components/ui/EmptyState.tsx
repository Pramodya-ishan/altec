import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className
}) => {
  return (
    <Card className={cn("flex flex-col items-center justify-center text-center p-8 sm:p-12 border-dashed border-2 bg-slate-50/50", className)}>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-[var(--app-muted)] mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--app-text)] font-sans">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-[var(--app-muted)] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction} className="h-10 px-5">
          {actionText}
        </Button>
      )}
    </Card>
  );
};
