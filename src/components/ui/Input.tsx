import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 rounded-full bg-white border border-[var(--app-border)] text-sm transition-all text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] disabled:opacity-50 disabled:bg-slate-50",
            error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-[var(--danger)] px-2">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
