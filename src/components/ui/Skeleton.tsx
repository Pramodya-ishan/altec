import React from 'react';
import { cn } from '../../lib/utils';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = ({ className, ...props }: SkeletonProps) => {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-200/70 rounded-[var(--radius-sm)]",
        className
      )}
      {...props}
    />
  );
};
