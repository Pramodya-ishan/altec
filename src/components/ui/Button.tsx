import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, variant = 'primary', size = 'md', isLoading, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-98 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          // Sizing
          size === 'sm' && "px-4 py-1.5 text-xs h-8",
          size === 'md' && "px-6 py-2.5 text-sm h-11",
          size === 'lg' && "px-8 py-3.5 text-base h-13",
          // Variants
          variant === 'primary' && "bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white shadow-sm border border-transparent",
          variant === 'secondary' && "bg-white hover:bg-slate-50 text-[var(--app-text)] border border-[var(--app-border)] shadow-sm",
          variant === 'ghost' && "bg-transparent hover:bg-slate-100 text-[var(--app-text)] border border-transparent",
          variant === 'danger' && "bg-[var(--danger)] hover:bg-red-700 text-white shadow-sm border border-transparent",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Uploading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
