import React from "react";

const R = 52;
const CX = 68;
const CY = 68;
const W = 136;
const H = 136;

// Projection: isometric-ish: x to bottom-right, y into screen, z up
function proj(x: number, y: number, z: number): [number, number] {
  const a = Math.PI / 5.5; // ~32.7°
  const sx = CX + R * (x * Math.cos(a) - y * Math.sin(a));
  const sy = CY - R * z + R * (x * Math.sin(a) + y * Math.cos(a)) * 0.28;
  return [sx, sy];
}

function ellipsePoints(fn: (t: number) => [number, number, number], steps = 64): string {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const [sx, sy] = proj(...fn((i / steps) * 2 * Math.PI));
    return `${sx.toFixed(2)},${sy.toFixed(2)}`;
  }).join(" ");
}

interface Props {
  bloch: [number, number, number];
  qubitIndex: number;
  label?: string;
}

export default function BlochSphere({ bloch, qubitIndex, label }: Props) {
  const [bx, by, bz] = bloch;
  const [px, py] = proj(bx, by, bz);
  const [ox, oy] = proj(0, 0, 0);

  // Axis endpoints
  const [zp_x, zp_y] = proj(0, 0, 1);
  const [zm_x, zm_y] = proj(0, 0, -1);
  const [xp_x, xp_y] = proj(1, 0, 0);
  const [yp_x, yp_y] = proj(0, 1, 0);

  // Equator ellipse (z = 0 plane)
  const equator = ellipsePoints((t) => [Math.cos(t), Math.sin(t), 0]);
  // Meridian (y = 0 plane, vertical circle)
  const meridianFront = ellipsePoints((t) => [Math.sin(t), 0, Math.cos(t)], 32);

  // Purity (length of Bloch vector)
  const purity = Math.min(1, Math.sqrt(bx * bx + by * by + bz * bz));

  // Color by z value: purple (|0⟩) to cyan (|1⟩)
  const hue = bz > 0 ? "#7c3aed" : "#0ea5e9";
  const glow = bz > 0 ? "rgba(124,58,237,0.6)" : "rgba(14,165,233,0.6)";
  const colors = ["#7c3aed", "#6366f1", "#0ea5e9", "#10b981"];
  const dotColor = colors[qubitIndex % colors.length];

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={`sphere-grad-${qubitIndex}`} cx="40%" cy="35%">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0a0f1e" stopOpacity="1" />
          </radialGradient>
          <filter id={`glow-${qubitIndex}`}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Sphere body */}
        <circle cx={CX} cy={CY} r={R} fill={`url(#sphere-grad-${qubitIndex})`} stroke="#2d1d6e" strokeWidth={1} />

        {/* Back hemisphere hint */}
        <polyline points={meridianFront} fill="none" stroke="#1e1b4b" strokeWidth={0.6} />

        {/* Equator */}
        <polyline points={equator} fill="none" stroke="#2d3a5a" strokeWidth={0.8} strokeDasharray="3 2" />

        {/* Axes */}
        <line x1={CX} y1={zp_y} x2={CX} y2={zm_y} stroke="#374151" strokeWidth={0.8} />
        <line x1={CX} y1={CY} x2={xp_x} y2={xp_y} stroke="#374151" strokeWidth={0.8} strokeDasharray="2 2" />
        <line x1={CX} y1={CY} x2={yp_x} y2={yp_y} stroke="#374151" strokeWidth={0.8} strokeDasharray="2 2" />

        {/* Bloch vector line with glow */}
        <line
          x1={ox} y1={oy} x2={px} y2={py}
          stroke={dotColor} strokeWidth={2}
          filter={`url(#glow-${qubitIndex})`}
          opacity={0.9}
        />

        {/* State dot */}
        <circle cx={px} cy={py} r={5.5} fill={dotColor} filter={`url(#glow-${qubitIndex})`} />
        <circle cx={px} cy={py} r={3} fill="white" opacity={0.9} />

        {/* Axis labels */}
        <text x={zp_x} y={zp_y - 8} textAnchor="middle" fill="#c4b5fd" fontSize={9} fontFamily="JetBrains Mono">|0⟩</text>
        <text x={zm_x} y={zm_y + 12} textAnchor="middle" fill="#7dd3fc" fontSize={9} fontFamily="JetBrains Mono">|1⟩</text>
      </svg>

      {/* Qubit label + Bloch coords */}
      <div className="text-center">
        <p className="text-xs font-semibold font-mono" style={{ color: dotColor }}>
          {label ?? `q${qubitIndex}`}
        </p>
        <p className="text-[10px] text-slate-500 font-mono leading-tight">
          ({bx.toFixed(2)}, {by.toFixed(2)}, {bz.toFixed(2)})
        </p>
        <div className="flex justify-center mt-1">
          <div className="h-1 rounded-full bg-q-600 w-16 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${purity * 100}%`, background: dotColor }}
            />
          </div>
        </div>
        <p className="text-[9px] text-slate-600 mt-0.5">purity {(purity * 100).toFixed(0)}%</p>
      </div>
    </div>
  );
}
