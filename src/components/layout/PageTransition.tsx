import { useRef, type ReactNode } from "react";
import { usePremiumMotion } from "../../hooks/usePremiumMotion";

export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePremiumMotion(rootRef, routeKey);
  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 w-full flex-1 flex-col" data-page-enter>
      {children}
    </div>
  );
}
