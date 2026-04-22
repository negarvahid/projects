import React from "react";

interface Props {
  allParams: number[][];   // [iteration][param_index]
  currentIdx: number;
  paramNames: string[];
}

function paramColor(v: number): string {
  // Map -π..+π to a color: negative = cyan, zero = dark, positive = purple
  const t = (v + Math.PI) / (2 * Math.PI); // 0..1
  if (t < 0.5) {
    // cyan → dark
    const s = t / 0.5;
    const r = Math.round(6 + s * (30 - 6));
    const g = Math.round(120 + s * (27 - 120));
    const b = Math.round(200 + s * (120 - 200));
    return `rgb(${r},${g},${b})`;
  } else {
    // dark → purple
    const s = (t - 0.5) / 0.5;
    const r = Math.round(30 + s * (139 - 30));
    const g = Math.round(27 + s * (92 - 27));
    const b = Math.round(120 + s * (246 - 120));
    return `rgb(${r},${g},${b})`;
  }
}

export default function ParameterHeatmap({ allParams, currentIdx, paramNames }: Props) {
  if (!allParams.length) return null;
  const nParams = allParams[0].length;
  const nIter = allParams.length;

  // Sample columns: show at most ~120 columns
  const stride = Math.max(1, Math.floor(nIter / 120));
  const sampled = allParams.filter((_, i) => i % stride === 0);
  const sampledIdx = allParams.reduce<number[]>((acc, _, i) => {
    if (i % stride === 0) acc.push(i);
    return acc;
  }, []);

  const currentCol = sampledIdx.findIndex((i) => i >= currentIdx);
  const highlightCol = currentCol === -1 ? sampled.length - 1 : currentCol;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 mb-2 items-center">
        <span className="text-[10px] text-slate-500 font-mono">−π</span>
        <div className="h-2 flex-1 rounded" style={{
          background: "linear-gradient(to right, rgb(6,120,200), #0f172a, rgb(139,92,246))"
        }} />
        <span className="text-[10px] text-slate-500 font-mono">+π</span>
      </div>

      <div
        className="relative rounded overflow-hidden border border-q-600"
        style={{ display: "grid", gridTemplateRows: `repeat(${nParams}, 20px)`, gap: "1px" }}
      >
        {Array.from({ length: nParams }, (_, paramIdx) => (
          <div key={paramIdx} className="flex items-center gap-0.5">
            <span className="text-[9px] font-mono text-slate-600 w-8 shrink-0 text-right pr-1">
              θ[{paramIdx}]
            </span>
            <div className="flex gap-px flex-1">
              {sampled.map((iterParams, colIdx) => (
                <div
                  key={colIdx}
                  className="flex-1 h-5 transition-opacity duration-150"
                  style={{
                    background: paramColor(iterParams[paramIdx]),
                    minWidth: "2px",
                    opacity: colIdx <= highlightCol ? 1 : 0.25,
                    outline: colIdx === highlightCol ? "1px solid rgba(255,255,255,0.4)" : "none",
                  }}
                  title={`iter ${sampledIdx[colIdx]}: ${iterParams[paramIdx].toFixed(3)}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-600 mt-1 text-right font-mono">
        iteration {currentIdx} / {nIter - 1}
      </p>
    </div>
  );
}
