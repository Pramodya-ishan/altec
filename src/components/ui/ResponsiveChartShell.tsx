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

  if (size.width <= 0 || size.height <= 0) {
    return (
      <div 
        ref={containerRef} 
        className="min-w-0 w-full relative bg-slate-50/50 rounded-xl" 
        style={{ height: minHeight }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-semibold font-mono animate-pulse">
          Initializing chart...
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-w-0 w-full relative" style={{ height: minHeight }}>
      {children}
    </div>
  );
};
