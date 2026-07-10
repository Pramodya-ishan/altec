import React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            "w-full px-5 py-3 rounded-[var(--radius-lg)] bg-white border border-[var(--app-border)] text-sm transition-all text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] disabled:opacity-50 disabled:bg-slate-50 min-h-[80px]",
            error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[var(--danger)] px-2">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
