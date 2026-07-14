import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export interface PageShellProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '7xl' | 'full';
}

export const PageShell = ({
  title,
  subtitle,
  actions,
  className,
  children,
  maxWidth = '7xl'
}: PageShellProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "mx-auto w-full py-1",
        maxWidth === 'md' && "max-w-3xl",
        maxWidth === 'lg' && "max-w-4xl",
        maxWidth === 'xl' && "max-w-5xl",
        maxWidth === '7xl' && "max-w-7xl",
        maxWidth === 'full' && "max-w-none"
      )}
    >
      {(title || subtitle || actions) && (
        <div className="mb-6 flex flex-col gap-4 border-b border-[var(--app-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {title && (
              <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[var(--app-text)] sm:text-[28px]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1.5 text-sm sm:text-base text-[var(--app-muted)]">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={cn("w-full", className)}>
        {children}
      </div>
    </motion.div>
  );
};
