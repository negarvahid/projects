import React from "react";
import type { CircuitStats, BackendInfo } from "../api";

interface Props {
  simulatorEnergy: number | null;
  hardwareEnergy: number | null;
  hardwareStd?: number | null;
  groundTruth?: number | null;
  units: string;
  logicalStats?: CircuitStats;
  isaStats?: CircuitStats;
  physicalQubits?: number[] | null;
  backendInfo?: BackendInfo;
  backendNumQubitsFallback?: number;
  nHamiltonianTerms?: number;
  metrics?: Record<string, number | string>;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function formatSecs(x: unknown): string | null {
  const n = typeof x === "number" ? x : typeof x === "string" ? parseFloat(x) : NaN;
  if (!isFinite(n)) return null;
  if (n < 1) return `${(n * 1000).toFixed(0)} ms`;
  if (n < 60) return `${n.toFixed(1)} s`;
  const m = Math.floor(n / 60);
  const s = Math.round(n - m * 60);
  return `${m}m ${s}s`;
}

function diffSecs(a: unknown, b: unknown): number | null {
  const pa = typeof a === "string" ? Date.parse(a) : NaN;
  const pb = typeof b === "string" ? Date.parse(b) : NaN;
  if (!isFinite(pa) || !isFinite(pb)) return null;
  return Math.max(0, (pb - pa) / 1000);
}

// ──────────────────────────────────────────────────────────────────
// Energy bar chart with shot-noise whisker
// ──────────────────────────────────────────────────────────────────

function EnergyChart({
  simulatorEnergy, hardwareEnergy, hardwareStd, groundTruth, units,
}: {
  simulatorEnergy: number | null;
  hardwareEnergy: number | null;
  hardwareStd?: number | null;
  groundTruth?: number | null;
  units: string;
}) {
  const values: { label: string; val: number; color: string; std?: number }[] = [];
  if (groundTruth != null) values.push({ label: "Ground truth", val: groundTruth, color: "#06b6d4" });
  if (simulatorEnergy != null) values.push({ label: "Simulator", val: simulatorEnergy, color: "#a78bfa" });
  if (hardwareEnergy != null)
    values.push({ label: "Hardware", val: hardwareEnergy, color: "#818cf8", std: hardwareStd ?? undefined });

  if (values.length < 2) return null;

  const W = 380, H = 150, PAD_L = 70, PAD_R = 20, PAD_T = 10, PAD_B = 26;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const vmin = Math.min(...values.map((v) => v.val - (v.std ?? 0)));
  const vmax = Math.max(...values.map((v) => v.val + (v.std ?? 0)));
  const pad = Math.max(Math.abs(vmax - vmin) * 0.1, 0.001);
  const lo = vmin - pad;
  const hi = vmax + pad;
  const span = hi - lo || 1;

  const zeroX = PAD_L + ((0 - lo) / span) * plotW;
  const showZero = lo < 0 && hi > 0;

  const barH = Math.min(24, (plotH - (values.length - 1) * 10) / values.length);
  const gap = (plotH - values.length * barH) / Math.max(1, values.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* axis line */}
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#334155" strokeWidth={1} />
      {showZero && (
        <line x1={zeroX} y1={PAD_T} x2={zeroX} y2={H - PAD_B}
              stroke="#475569" strokeWidth={1} strokeDasharray="2 3" />
      )}
      {/* axis labels */}
      <text x={PAD_L} y={H - PAD_B + 14} fill="#64748b" fontSize={9} fontFamily="monospace">
        {lo.toFixed(3)}
      </text>
      <text x={W - PAD_R} y={H - PAD_B + 14} fill="#64748b" fontSize={9} textAnchor="end" fontFamily="monospace">
        {hi.toFixed(3)}
      </text>

      {values.map((v, i) => {
        const y = PAD_T + i * (barH + gap);
        const x0 = showZero ? zeroX : PAD_L;
        const xV = PAD_L + ((v.val - lo) / span) * plotW;
        const bx = Math.min(x0, xV);
        const bw = Math.abs(xV - x0);

        const stdLo = v.std != null ? PAD_L + ((v.val - v.std - lo) / span) * plotW : null;
        const stdHi = v.std != null ? PAD_L + ((v.val + v.std - lo) / span) * plotW : null;

        return (
          <g key={v.label}>
            <text x={PAD_L - 6} y={y + barH / 2 + 3} fill="#cbd5e1" fontSize={10} textAnchor="end">
              {v.label}
            </text>
            <rect x={bx} y={y} width={Math.max(1, bw)} height={barH} fill={v.color} opacity={0.85} rx={2} />
            {stdLo != null && stdHi != null && (
              <>
                <line x1={stdLo} y1={y + barH / 2} x2={stdHi} y2={y + barH / 2} stroke="#f1f5f9" strokeWidth={1.2} />
                <line x1={stdLo} y1={y + barH / 2 - 4} x2={stdLo} y2={y + barH / 2 + 4} stroke="#f1f5f9" strokeWidth={1.2} />
                <line x1={stdHi} y1={y + barH / 2 - 4} x2={stdHi} y2={y + barH / 2 + 4} stroke="#f1f5f9" strokeWidth={1.2} />
              </>
            )}
            <text x={xV + 4} y={y + barH / 2 + 3} fill="#e2e8f0" fontSize={9} fontFamily="monospace">
              {v.val.toFixed(4)}
              {v.std != null ? ` ± ${v.std.toFixed(4)}` : ""}
              <tspan fill="#64748b"> {units}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────
// Transpilation stats: logical (what you designed) vs ISA (what ran)
// ──────────────────────────────────────────────────────────────────

function TranspilationStats({ logical, isa }: { logical?: CircuitStats; isa?: CircuitStats }) {
  if (!logical || !isa) return null;
  const rows: { label: string; logi: number; isa: number; emphasize?: boolean }[] = [
    { label: "Depth", logi: logical.depth, isa: isa.depth },
    { label: "Total gates", logi: logical.total_gates, isa: isa.total_gates },
    { label: "2-qubit gates", logi: logical.two_qubit_gates, isa: isa.two_qubit_gates, emphasize: true },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
        <span></span>
        <span className="text-right">Logical</span>
        <span className="text-right">On hardware</span>
      </div>
      {rows.map((r) => {
        const blowup = r.logi > 0 ? r.isa / r.logi : 1;
        return (
          <div key={r.label} className="grid grid-cols-3 gap-2 items-center text-xs">
            <span className="text-slate-400">{r.label}</span>
            <span className="text-right font-mono text-slate-300">{r.logi}</span>
            <span className="text-right font-mono">
              <span className={r.emphasize ? "text-indigo-300 font-bold" : "text-slate-200"}>{r.isa}</span>
              {r.logi > 0 && blowup > 1 && (
                <span className="ml-1 text-[10px] text-amber-400">×{blowup.toFixed(1)}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Physical qubit map: show which qubits the circuit was placed on
// ──────────────────────────────────────────────────────────────────

function QubitMap({ used, total }: { used: number[]; total: number }) {
  if (!used.length || !total) return null;
  const cols = Math.min(total, 16);
  const rows = Math.ceil(total / cols);
  const usedSet = new Set(used);
  const size = 14;

  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
        Physical qubits used ({used.length} of {total})
      </p>
      <svg
        viewBox={`0 0 ${cols * (size + 2)} ${rows * (size + 2)}`}
        className="w-full max-w-[340px] h-auto"
      >
        {Array.from({ length: total }).map((_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const isUsed = usedSet.has(i);
          return (
            <g key={i}>
              <rect
                x={c * (size + 2)} y={r * (size + 2)}
                width={size} height={size} rx={2}
                fill={isUsed ? "#6366f1" : "#1e293b"}
                stroke={isUsed ? "#818cf8" : "#334155"}
                strokeWidth={0.5}
              />
              <text
                x={c * (size + 2) + size / 2}
                y={r * (size + 2) + size / 2 + 3}
                fontSize={7}
                textAnchor="middle"
                fill={isUsed ? "#ffffff" : "#475569"}
                fontFamily="monospace"
              >
                {i}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Gate mix bar (breakdown of ISA ops)
// ──────────────────────────────────────────────────────────────────

function GateMix({ ops }: { ops: Record<string, number> }) {
  const entries = Object.entries(ops)
    .filter(([name]) => name !== "barrier" && name !== "measure")
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const PALETTE = ["#a78bfa", "#818cf8", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];

  let offset = 0;
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Gate composition</p>
      <svg viewBox="0 0 200 14" className="w-full h-4" preserveAspectRatio="none">
        {entries.map(([name, n], i) => {
          const w = (n / total) * 200;
          const x = offset;
          offset += w;
          return <rect key={name} x={x} y={0} width={w} height={14} fill={PALETTE[i % PALETTE.length]} />;
        })}
      </svg>
      <div className="flex flex-wrap gap-2 mt-2">
        {entries.map(([name, n], i) => (
          <span key={name} className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
            <span className="w-2 h-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            {name} <span className="text-slate-500">×{n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Job timing pills
// ──────────────────────────────────────────────────────────────────

function TimingInfo({ metrics }: { metrics: Record<string, number | string> }) {
  if (!metrics) return null;
  const created = metrics["created"];
  const running = metrics["running"];
  const finished = metrics["finished"];

  const queueSecs = diffSecs(created, running);
  const execSecs = diffSecs(running, finished) ?? (typeof metrics["usage_seconds"] === "number" ? metrics["usage_seconds"] : null);
  const totalSecs = diffSecs(created, finished);

  const items: { label: string; value: string | null; color: string }[] = [
    { label: "Queue", value: queueSecs != null ? formatSecs(queueSecs) : null, color: "text-amber-300" },
    { label: "Execution", value: execSecs != null ? formatSecs(execSecs) : null, color: "text-emerald-300" },
    { label: "Total", value: totalSecs != null ? formatSecs(totalSecs) : null, color: "text-slate-200" },
  ].filter((it) => it.value);

  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">{it.label}</span>
          <span className={`font-mono text-xs ${it.color}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

export default function IBMResultsViz({
  simulatorEnergy, hardwareEnergy, hardwareStd, groundTruth, units,
  logicalStats, isaStats, physicalQubits, backendInfo, backendNumQubitsFallback,
  nHamiltonianTerms, metrics,
}: Props) {
  const backendQubits = backendInfo?.num_qubits ?? backendNumQubitsFallback ?? 0;

  const absErr =
    hardwareEnergy != null && simulatorEnergy != null
      ? hardwareEnergy - simulatorEnergy
      : null;
  const relErr =
    absErr != null && simulatorEnergy !== 0 && simulatorEnergy != null
      ? (absErr / Math.abs(simulatorEnergy)) * 100
      : null;

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-q-600">
      <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest">
        Hardware run analysis
      </p>

      {/* Energy bar chart */}
      <div className="card py-3">
        <p className="label mb-2">Energy comparison</p>
        <EnergyChart
          simulatorEnergy={simulatorEnergy}
          hardwareEnergy={hardwareEnergy}
          hardwareStd={hardwareStd}
          groundTruth={groundTruth}
          units={units}
        />
        {absErr != null && (
          <div className="flex flex-wrap gap-4 mt-2 text-[11px] font-mono">
            <span className="text-slate-400">
              abs error <span className={absErr >= 0 ? "text-amber-400" : "text-emerald-400"}>
                {absErr >= 0 ? "+" : ""}{absErr.toFixed(5)} {units}
              </span>
            </span>
            {relErr != null && (
              <span className="text-slate-400">
                rel error <span className="text-slate-200">{relErr.toFixed(2)}%</span>
              </span>
            )}
            {hardwareStd != null && (
              <span className="text-slate-400">
                shot noise <span className="text-indigo-300">±{hardwareStd.toFixed(5)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Transpilation + qubit map */}
      {(logicalStats || isaStats || (physicalQubits && physicalQubits.length)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {logicalStats && isaStats && (
            <div className="card py-3">
              <p className="label mb-3">Transpilation</p>
              <TranspilationStats logical={logicalStats} isa={isaStats} />
              {nHamiltonianTerms != null && (
                <p className="text-[10px] text-slate-500 mt-3">
                  Observable has <span className="text-slate-300 font-mono">{nHamiltonianTerms}</span> Pauli terms.
                </p>
              )}
            </div>
          )}
          {physicalQubits && physicalQubits.length > 0 && backendQubits > 0 && (
            <div className="card py-3">
              <QubitMap used={physicalQubits} total={backendQubits} />
            </div>
          )}
        </div>
      )}

      {/* Gate mix */}
      {isaStats?.ops && Object.keys(isaStats.ops).length > 0 && (
        <div className="card py-3">
          <GateMix ops={isaStats.ops} />
        </div>
      )}

      {/* Timings */}
      {metrics && (
        <div className="card py-3">
          <p className="label mb-2">Job timeline</p>
          <TimingInfo metrics={metrics} />
        </div>
      )}
    </div>
  );
}
