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

export const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  actions,
  className,
  children,
  maxWidth = '7xl'
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mx-auto",
        maxWidth === 'md' && "max-w-3xl",
        maxWidth === 'lg' && "max-w-4xl",
        maxWidth === 'xl' && "max-w-5xl",
        maxWidth === '7xl' && "max-w-7xl",
        maxWidth === 'full' && "max-w-none"
      )}
    >
      {(title || subtitle || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-[var(--app-border)]">
          <div>
            {title && (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--app-text)] font-sans">
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
