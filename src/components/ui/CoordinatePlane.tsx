import React from "react";

interface Point {
  label: string;
  x: number;
  y: number;
}

interface Line {
  from: string;
  to: string;
  label?: string;
}

interface CoordinatePlaneProps {
  points: Point[];
  lines?: Line[];
  width?: number;
  height?: number;
  showGrid?: boolean;
}

export function CoordinatePlane({
  points = [],
  lines = [],
  width = 400,
  height = 400,
  showGrid = true,
}: CoordinatePlaneProps) {
  const padding = 40;

  // Compute mathematical bounds
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  let minX = xs.length ? Math.min(...xs) : -5;
  let maxX = xs.length ? Math.max(...xs) : 5;
  let minY = ys.length ? Math.min(...ys) : -5;
  let maxY = ys.length ? Math.max(...ys) : 5;

  let rangeX = maxX - minX;
  let rangeY = maxY - minY;

  if (rangeX === 0) rangeX = 2;
  if (rangeY === 0) rangeY = 2;

  // Add 30% padding to bounds
  minX -= rangeX * 0.3;
  maxX += rangeX * 0.3;
  minY -= rangeY * 0.3;
  maxY += rangeY * 0.3;

  // Ensure origin is within a reasonable frame or we see at least some range
  if (minX > -2) minX = -2;
  if (maxX < 2) maxX = 2;
  if (minY > -2) minY = -2;
  if (maxY < 2) maxY = 2;

  // Map math coordinates (x, y) to SVG pixels
  const mapX = (x: number) => padding + ((x - minX) / (maxX - minX)) * (width - 2 * padding);
  const mapY = (y: number) => height - (padding + ((y - minY) / (maxY - minY)) * (height - 2 * padding));

  // Determine grid step size
  const maxDiff = Math.max(maxX - minX, maxY - minY);
  let step = 1;
  if (maxDiff > 100) step = 20;
  else if (maxDiff > 50) step = 10;
  else if (maxDiff > 20) step = 5;
  else if (maxDiff > 10) step = 2;

  const gridLines: any[] = [];
  if (showGrid) {
    const startX = Math.ceil(minX / step) * step;
    for (let x = startX; x <= maxX; x += step) {
      if (Math.abs(x) < 0.0001) continue; // skip axis
      gridLines.push({
        x1: mapX(x),
        y1: mapY(minY),
        x2: mapX(x),
        y2: mapY(maxY),
        label: x.toString(),
        type: "v",
        value: x,
      });
    }

    const startY = Math.ceil(minY / step) * step;
    for (let y = startY; y <= maxY; y += step) {
      if (Math.abs(y) < 0.0001) continue; // skip axis
      gridLines.push({
        x1: mapX(minX),
        y1: mapY(y),
        x2: mapX(maxX),
        y2: mapY(y),
        label: y.toString(),
        type: "h",
        value: y,
      });
    }
  }

  const xAxisY = mapY(0);
  const yAxisX = mapX(0);

  // Calculate coordinates for triangle projection helpers (if 2 points)
  let projTriangle: any = null;
  if (points.length === 2) {
    const p1 = points[0];
    const p2 = points[1];
    const cx = p2.x;
    const cy = p1.y;

    projTriangle = {
      p1,
      p2,
      corner: { x: cx, y: cy },
      p1Svg: { x: mapX(p1.x), y: mapY(p1.y) },
      p2Svg: { x: mapX(p2.x), y: mapY(p2.y) },
      cornerSvg: { x: mapX(cx), y: mapY(cy) },
      dx: Math.abs(p2.x - p1.x),
      dy: Math.abs(p2.y - p1.y),
    };
  }

  return (
    <div className="w-full flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-200/60 shadow-xs">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[340px] aspect-square text-slate-400 select-none"
        id="svg-coordinate-plane"
      >
        {/* Definitions for markers (arrows) */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Grid lines */}
        {gridLines.map((gl, i) => (
          <g key={i}>
            <line
              x1={gl.x1}
              y1={gl.y1}
              x2={gl.x2}
              y2={gl.y2}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            {gl.type === "v" && gl.y1 && (
              <text
                x={gl.x1}
                y={mapY(0) + 14}
                textAnchor="middle"
                className="text-[9px] fill-slate-400 font-medium"
              >
                {gl.label}
              </text>
            )}
            {gl.type === "h" && gl.x1 && (
              <text
                x={mapX(0) - 10}
                y={gl.y1 + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-medium"
              >
                {gl.label}
              </text>
            )}
          </g>
        ))}

        {/* X Axis */}
        <line
          x1={mapX(minX)}
          y1={xAxisY}
          x2={mapX(maxX)}
          y2={xAxisY}
          stroke="#64748b"
          strokeWidth="1.5"
          markerEnd="url(#arrow)"
          markerStart="url(#arrow)"
        />
        <text
          x={mapX(maxX) - 12}
          y={xAxisY - 8}
          className="text-[11px] font-bold fill-slate-500"
          textAnchor="end"
        >
          x
        </text>

        {/* Y Axis */}
        <line
          x1={yAxisX}
          y1={mapY(minY)}
          x2={yAxisX}
          y2={mapY(maxY)}
          stroke="#64748b"
          strokeWidth="1.5"
          markerEnd="url(#arrow)"
          markerStart="url(#arrow)"
        />
        <text
          x={yAxisX + 8}
          y={mapY(maxY) + 12}
          className="text-[11px] font-bold fill-slate-500"
          textAnchor="start"
        >
          y
        </text>

        {/* Origin Label */}
        <text
          x={yAxisX - 10}
          y={xAxisY + 12}
          className="text-[9px] font-bold fill-slate-400"
        >
          0
        </text>

        {/* Right triangle projection helper */}
        {projTriangle && (
          <g>
            {/* Horizontal side */}
            <line
              x1={projTriangle.p1Svg.x}
              y1={projTriangle.p1Svg.y}
              x2={projTriangle.cornerSvg.x}
              y2={projTriangle.cornerSvg.y}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            {/* Vertical side */}
            <line
              x1={projTriangle.cornerSvg.x}
              y1={projTriangle.cornerSvg.y}
              x2={projTriangle.p2Svg.x}
              y2={projTriangle.p2Svg.y}
              stroke="#ec4899"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            {/* Right angle symbol */}
            <path
              d={`M ${projTriangle.cornerSvg.x - (projTriangle.p2.x > projTriangle.p1.x ? 8 : -8)} ${projTriangle.cornerSvg.y} 
                  L ${projTriangle.cornerSvg.x - (projTriangle.p2.x > projTriangle.p1.x ? 8 : -8)} ${projTriangle.cornerSvg.y - (projTriangle.p2.y > projTriangle.p1.y ? 8 : -8)} 
                  L ${projTriangle.cornerSvg.x} ${projTriangle.cornerSvg.y - (projTriangle.p2.y > projTriangle.p1.y ? 8 : -8)}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1"
            />
            {/* Labels for delta x and delta y */}
            <text
              x={(projTriangle.p1Svg.x + projTriangle.cornerSvg.x) / 2}
              y={projTriangle.p1Svg.y + (projTriangle.p2.y > projTriangle.p1.y ? 15 : -8)}
              textAnchor="middle"
              className="text-[10px] font-bold fill-indigo-600"
            >
              Δx = {projTriangle.dx}
            </text>
            <text
              x={projTriangle.cornerSvg.x + (projTriangle.p2.x > projTriangle.p1.x ? 10 : -10)}
              y={(projTriangle.p2Svg.y + projTriangle.cornerSvg.y) / 2}
              textAnchor={projTriangle.p2.x > projTriangle.p1.x ? "start" : "end"}
              className="text-[10px] font-bold fill-pink-600"
            >
              Δy = {projTriangle.dy}
            </text>
          </g>
        )}

        {/* Lines between points */}
        {lines.map((line, i) => {
          const fromPt = points.find((p) => p.label === line.from);
          const toPt = points.find((p) => p.label === line.to);
          if (!fromPt || !toPt) return null;
          const x1 = mapX(fromPt.x);
          const y1 = mapY(fromPt.y);
          const x2 = mapX(toPt.x);
          const y2 = mapY(toPt.y);
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#4f46e5"
                strokeWidth="2.5"
              />
              {line.label && (
                <text
                  x={(x1 + x2) / 2 - 8}
                  y={(y1 + y2) / 2 - 8}
                  className="text-[10px] font-black fill-indigo-800 italic"
                >
                  {line.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Points */}
        {points.map((p, i) => {
          const cx = mapX(p.x);
          const cy = mapY(p.y);
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r="5"
                className="fill-indigo-600 stroke-white stroke-[2px] filter drop-shadow-sm"
              />
              <text
                x={cx + 8}
                y={cy - 8}
                className="text-[11px] font-extrabold fill-slate-800"
                id={`point-label-${p.label}`}
              >
                {p.label}({p.x},{p.y})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
