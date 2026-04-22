import React from "react";

interface Props {
  probabilities: number[];
  nQubits: number;
}

function basisLabel(index: number, n: number): string {
  return "|" + index.toString(2).padStart(n, "0") + "⟩";
}

// HSL color: map probability to a color intensity
function probColor(p: number): string {
  if (p < 0.001) return "#0f172a";
  const intensity = Math.sqrt(p); // sqrt for perceptual scaling
  // Interpolate from dark-violet to bright-violet→cyan
  const r = Math.round(30 + intensity * (139 - 30));
  const g = Math.round(10 + intensity * (92 - 10));
  const b = Math.round(80 + intensity * (246 - 80));
  return `rgb(${r},${g},${b})`;
}

export default function StateVector({ probabilities, nQubits }: Props) {
  const maxProb = Math.max(...probabilities, 0.001);

  return (
    <div className="space-y-1.5">
      {probabilities.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400 w-10 shrink-0 text-right">
            {basisLabel(i, nQubits)}
          </span>
          <div className="flex-1 h-4 bg-q-700 rounded overflow-hidden relative">
            <div
              className="h-full rounded transition-all duration-300"
              style={{
                width: `${(p / maxProb) * 100}%`,
                background: probColor(p),
                boxShadow: p > 0.05 ? `0 0 6px ${probColor(p)}` : "none",
              }}
            />
          </div>
          <span className="font-mono text-[11px] w-10 shrink-0" style={{ color: p > 0.05 ? "#c4b5fd" : "#475569" }}>
            {(p * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}
