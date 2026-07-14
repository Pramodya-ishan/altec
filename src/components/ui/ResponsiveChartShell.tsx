import React, { useState, useEffect, useRef } from 'react';

interface ResponsiveChartShellProps {
  children: React.ReactNode;
  minHeight?: number;
}

export const ResponsiveChartShell: React.FC<ResponsiveChartShellProps> = ({ 
  children, 
  minHeight = 260 
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        if (!Array.isArray(entries) || !entries.length) return;
        const rect = entries[0].contentRect;
        if (rect.width > 0 && rect.height > 0) {
          setSize({ width: rect.width, height: rect.height });
        }
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isReady = size.width > 0 && size.height > 0;

  return (
    <div
      ref={containerRef}
      className="min-w-0 w-full relative"
      style={{ height: minHeight }}
      aria-busy={!isReady}
    >
      {isReady ? children : (
        <div className="absolute inset-0 overflow-hidden rounded-xl bg-slate-50">
          <div className="absolute inset-x-5 bottom-7 top-8 rounded-lg bg-[linear-gradient(to_bottom,transparent_24%,#e2e8f0_25%,transparent_26%,transparent_49%,#e2e8f0_50%,transparent_51%,transparent_74%,#e2e8f0_75%,transparent_76%)] opacity-60" />
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        </div>
      )}
    </div>
  );
};
