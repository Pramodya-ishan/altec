import React, { useEffect, useRef, useState } from "react";

type ChartSize = { width: number; height: number };

interface ResponsiveChartShellProps {
  children: React.ReactNode | ((size: ChartSize) => React.ReactNode);
  minHeight?: number;
}

const EMPTY_SIZE: ChartSize = { width: 0, height: 0 };

export const ResponsiveChartShell: React.FC<ResponsiveChartShellProps> = ({
  children,
  minHeight = 260,
}) => {
  const [size, setSize] = useState<ChartSize>(EMPTY_SIZE);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let frame = 0;
    const commitMeasurement = (width: number, height: number) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const valid = Number.isFinite(width)
          && Number.isFinite(height)
          && width >= 32
          && height >= 120
          && element.offsetParent !== null;
        setSize(valid ? { width: Math.floor(width), height: Math.floor(height) } : EMPTY_SIZE);
      });
    };

    const measure = () => {
      const rect = element.getBoundingClientRect();
      commitMeasurement(rect.width, rect.height);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      commitMeasurement(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(element);

    const intersectionObserver = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting !== false;
      setIsVisible(visible);
      if (visible) measure();
      else setSize(EMPTY_SIZE);
    }, { threshold: 0.001 });
    intersectionObserver.observe(element);

    measure();
    window.addEventListener("orientationchange", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const isReady = isVisible && size.width >= 32 && size.height >= 120;

  return (
    <div
      ref={containerRef}
      className="chart-boundary relative w-full min-w-0 overflow-hidden"
      style={{ height: minHeight, minHeight, minWidth: 0 }}
      aria-busy={!isReady}
    >
      {isReady
        ? (typeof children === "function" ? children(size) : children)
        : (
          <div className="absolute inset-0 overflow-hidden rounded-xl bg-slate-50" aria-hidden="true">
            <div className="absolute inset-x-5 bottom-7 top-8 rounded-lg bg-[linear-gradient(to_bottom,transparent_24%,#e2e8f0_25%,transparent_26%,transparent_49%,#e2e8f0_50%,transparent_51%,transparent_74%,#e2e8f0_75%,transparent_76%)] opacity-60" />
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          </div>
        )}
    </div>
  );
};
