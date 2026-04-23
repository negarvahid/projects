import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Cpu, Zap, Settings2, Download, Eye, EyeOff, ChevronDown, ChevronUp,
  Shuffle, RefreshCw,
} from "lucide-react";
import { api } from "../api";
import type { HamiltonianMeta } from "../api";
import type { VQEResult, AnsatzInfo } from "../types";
import CircuitDiagram from "./CircuitDiagram";
import EnergyPlot from "./EnergyPlot";
import BlochSphere from "./BlochSphere";
import StateVector from "./StateVector";
import ParameterHeatmap from "./ParameterHeatmap";

const SPEED_OPTIONS = [0.5, 1, 2, 4];
const OPTIMIZERS = ["COBYLA", "Powell", "Nelder-Mead"];
const ENCODINGS = [
  { key: "",       label: "Default (2q reduced)" },
  { key: "jw",     label: "Jordan-Wigner (4q)" },
  { key: "bk",     label: "Bravyi-Kitaev (4q)" },
  { key: "parity", label: "Parity (4q)" },
];
const INIT_STRATEGIES = [
  { key: "random", label: "Random (−π … +π)" },
  { key: "near_zero", label: "Near-zero (±0.1)" },
  { key: "zeros", label: "All zeros" },
  { key: "pi_fractions", label: "π-fractions" },
];

type PanelKey = "circuit" | "bloch" | "energy" | "states" | "heatmap";
const ALL_PANELS: { key: PanelKey; label: string }[] = [
  { key: "circuit",  label: "Circuit" },
  { key: "bloch",    label: "Bloch Spheres" },
  { key: "energy",   label: "Energy Plot" },
  { key: "states",   label: "State Distribution" },
  { key: "heatmap",  label: "Param Heatmap" },
];

function parseCustomHamiltonian(text: string): [number, string][] | null {
  try {
    const lines = text.trim().split("\n").filter(Boolean);
    const result: [number, string][] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) return null;
      const coeff = parseFloat(parts[0]);
      const pauli = parts[1].toUpperCase();
      if (isNaN(coeff) || !/^[XYZI]+$/.test(pauli)) return null;
      result.push([coeff, pauli]);
    }
    if (!result.length) return null;
    const n = result[0][1].length;
    if (result.some(([, p]) => p.length !== n)) return null;
    return result;
  } catch { return null; }
}

export default function VQEVisualizer() {
  const [hamiltonians, setHamiltonians] = useState<Record<string, HamiltonianMeta>>({});
  const [ansatze, setAnsatze] = useState<Record<string, AnsatzInfo>>({});

  // Config
  const [selectedHam, setSelectedHam]     = useState("h2");
  const [selectedAnsatz, setSelectedAnsatz] = useState("real_amplitudes");
  const [reps, setReps]                   = useState(2);
  const [maxIter, setMaxIter]             = useState(80);
  const [optimizer, setOptimizer]         = useState("COBYLA");
  const [initStrategy, setInitStrategy]   = useState("random");
  const [seed, setSeed]                   = useState(42);
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [encoding, setEncoding]           = useState("");

  // Custom Hamiltonian
  const [customHamText, setCustomHamText] = useState(
    "-1.0523 II\n0.3979 ZI\n-0.3979 IZ\n-0.0112 ZZ\n0.1809 XX\n0.1809 YY"
  );
  const [customHamError, setCustomHamError] = useState<string | null>(null);

  // Panels visibility
  const [visiblePanels, setVisiblePanels] = useState<Record<PanelKey, boolean>>({
    circuit: true, bloch: true, energy: true, states: true, heatmap: true,
  });

  // Run state
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<VQEResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [speed, setSpeed]       = useState(1);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.hamiltonians().then(setHamiltonians).catch(() => {});
    api.ansatze().then(setAnsatze).catch(() => {});
  }, []);

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (!result) return;
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIdx((idx) => {
        if (idx >= result.iterations.length - 1) { stopPlayback(); return idx; }
        return idx + 1;
      });
    }, 550 / speed);
  }, [result, speed, stopPlayback]);

  useEffect(() => { if (playing) { stopPlayback(); startPlayback(); } }, [speed]);
  useEffect(() => () => stopPlayback(), [stopPlayback]);

  async function handleRun() {
    if (selectedHam === "custom") {
      const parsed = parseCustomHamiltonian(customHamText);
      if (!parsed) { setCustomHamError("Invalid format. Each line: <coeff> <PAULI>  e.g.  -1.05 ZZ"); return; }
      setCustomHamError(null);
    }
    setLoading(true); setError(null); setResult(null); stopPlayback();
    try {
      const customPauliList = selectedHam === "custom"
        ? parseCustomHamiltonian(customHamText) ?? undefined
        : undefined;

      const r = await api.runVQE({
        hamiltonian: selectedHam,
        ansatz: selectedAnsatz,
        reps,
        max_iter: maxIter,
        optimizer,
        init_strategy: initStrategy,
        seed,
        custom_pauli_list: customPauliList,
        encoding: encoding || undefined,
      });
      setResult(r); setCurrentIdx(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally { setLoading(false); }
  }

  function handleExport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vqe_${result.hamiltonian_name}_${result.ansatz_name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function togglePanel(key: PanelKey) {
    setVisiblePanels((p) => ({ ...p, [key]: !p[key] }));
  }

  const iter = result?.iterations[currentIdx];
  const total = result?.iterations.length ?? 0;
  const allParams = result?.iterations.map((it) => it.params) ?? [];
  const prevEnergy = currentIdx > 0 ? result?.iterations[currentIdx - 1].energy : null;
  const deltaE = iter && prevEnergy !== null ? iter.energy - prevEnergy! : null;

  // Group hamiltonians by category (exclude "custom", rendered separately)
  const hamByCategory = Object.entries(hamiltonians).reduce<Record<string, [string, HamiltonianMeta][]>>(
    (acc, [k, v]) => {
      if (k === "custom") return acc;
      (acc[v.category] ??= []).push([k, v]);
      return acc;
    }, {}
  );

  return (
    <div className="space-y-4">
      {/* ── Config Card ── */}
      <div className="card glow-violet">
        <h2 className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Cpu size={13} /> Configuration
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Hamiltonian, grouped by category */}
          <div>
            <label className="label">Hamiltonian</label>
            <select className="select-field" value={selectedHam} onChange={(e) => { setSelectedHam(e.target.value); setEncoding(""); }}>
              {Object.entries(hamByCategory).map(([cat, entries]) => (
                <optgroup key={cat} label={cat}>
                  {entries.map(([k, v]) => (
                    <option key={k} value={k}>{v.name} ({v.n_qubits}q)</option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Custom">
                <option value="custom">Custom Hamiltonian…</option>
              </optgroup>
            </select>
          </div>

          {/* Encoding: only for molecular Hamiltonians */}
          {hamiltonians[selectedHam]?.supports_encoding && (
            <div>
              <label className="label">Encoding</label>
              <select className="select-field" value={encoding} onChange={(e) => setEncoding(e.target.value)}>
                {ENCODINGS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Ansatz</label>
            <select className="select-field" value={selectedAnsatz} onChange={(e) => setSelectedAnsatz(e.target.value)}>
              {Object.entries(ansatze).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Reps (depth)</label>
            <select className="select-field" value={reps} onChange={(e) => setReps(Number(e.target.value))}>
              {[1, 2, 3, 4].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Max iterations</label>
            <select className="select-field" value={maxIter} onChange={(e) => setMaxIter(Number(e.target.value))}>
              {[30, 50, 80, 120, 150].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Custom Hamiltonian input */}
        {selectedHam === "custom" && (
          <div className="mt-4 animate-fade-in">
            <label className="label">Pauli Operators, one per line: &lt;coeff&gt; &lt;PAULI&gt;</label>
            <textarea
              className="select-field h-32 resize-y font-mono text-xs"
              value={customHamText}
              onChange={(e) => { setCustomHamText(e.target.value); setCustomHamError(null); }}
              placeholder="-1.05 ZZ&#10;0.50 XI&#10;0.50 IX"
              spellCheck={false}
            />
            {customHamError && <p className="text-red-400 text-xs mt-1">{customHamError}</p>}
            <p className="text-slate-600 text-xs mt-1">
              All Pauli strings must be the same length. Valid chars: I X Y Z.
            </p>
          </div>
        )}

        {/* Advanced toggle */}
        <button
          className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <Settings2 size={12} />
          Advanced options
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-4 pt-3 border-t border-q-600 animate-fade-in">
            <div>
              <label className="label">Optimizer</label>
              <select className="select-field" value={optimizer} onChange={(e) => setOptimizer(e.target.value)}>
                {OPTIMIZERS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Initial parameters</label>
              <select className="select-field" value={initStrategy} onChange={(e) => setInitStrategy(e.target.value)}>
                {INIT_STRATEGIES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Random seed</label>
              <div className="flex gap-2">
                <input
                  type="number" min={0} max={9999}
                  className="select-field font-mono"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                />
                <button
                  className="btn-secondary px-2.5 shrink-0"
                  onClick={() => setSeed(Math.floor(Math.random() * 10000))}
                  title="Random seed"
                >
                  <Shuffle size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Run button row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={handleRun} disabled={loading}>
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Running…</>
              : <><Zap size={14} /> Run VQE</>}
          </button>
          {result && (
            <>
              <span className="text-xs text-slate-500 font-mono">
                {total} iters · {result.n_params} params · {result.n_qubits}q · {result.n_gates} gates · {result.optimizer}
              </span>
              <button className="btn-secondary ml-auto text-xs px-3 py-1.5" onClick={handleExport}>
                <Download size={12} /> Export JSON
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
      </div>

      {/* ── Results ── */}
      {result && iter && (
        <div className="space-y-4 animate-fade-in">

          {/* Panel visibility toggles */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 mr-1">Panels:</span>
            {ALL_PANELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => togglePanel(key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all ${
                  visiblePanels[key]
                    ? "bg-violet-900/40 border-violet-700 text-violet-300"
                    : "bg-q-700 border-q-500 text-slate-500"
                }`}
              >
                {visiblePanels[key] ? <Eye size={11} /> : <EyeOff size={11} />}
                {label}
              </button>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Energy", value: iter.energy.toFixed(5), unit: result.units,
                color: "text-violet-300",
                sub: deltaE !== null ? `Δ ${deltaE >= 0 ? "+" : ""}${deltaE.toFixed(5)}` : null,
                subColor: deltaE !== null && deltaE < 0 ? "text-emerald-400" : "text-red-400",
              },
              { label: "Best Found", value: result.final_energy.toFixed(5), unit: result.units, color: "text-emerald-300", sub: null },
              {
                label: "Ground Truth",
                value: result.ground_truth != null ? result.ground_truth.toFixed(4) : "N/A",
                unit: result.ground_truth != null ? result.units : "",
                color: "text-cyan-300", sub: null,
              },
              {
                label: "Iteration", value: `${currentIdx + 1}`, unit: `/ ${total}`, color: "text-amber-300",
                sub: result.converged ? "converged ✓" : "max iter reached",
                subColor: result.converged ? "text-emerald-400" : "text-slate-500",
              },
            ].map(({ label, value, unit, color, sub, subColor }) => (
              <div key={label} className="card py-3">
                <p className="label">{label}</p>
                <p className={`font-mono font-bold text-sm ${color}`}>
                  {value} <span className="font-normal text-xs text-slate-500">{unit}</span>
                </p>
                {sub && <p className={`text-[11px] font-mono mt-0.5 ${subColor}`}>{sub}</p>}
              </div>
            ))}
          </div>

          {/* Circuit + Bloch */}
          {(visiblePanels.circuit || visiblePanels.bloch) && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              {visiblePanels.circuit && (
                <div className={`card ${visiblePanels.bloch ? "xl:col-span-3" : "xl:col-span-5"}`}>
                  <p className="label mb-3">Quantum Circuit, iteration {currentIdx}</p>
                  <CircuitDiagram gates={iter.gates} nQubits={result.n_qubits} nCols={iter.n_cols} />
                </div>
              )}
              {visiblePanels.bloch && (
                <div className={`card ${visiblePanels.circuit ? "xl:col-span-2" : "xl:col-span-5"}`}>
                  <p className="label mb-3">Qubit States (Bloch Spheres)</p>
                  <div className={`flex flex-wrap justify-around gap-3 ${result.n_qubits > 4 ? "gap-y-6" : ""}`}>
                    {iter.bloch_vectors.map((bv, qi) => (
                      <BlochSphere key={qi} bloch={bv} qubitIndex={qi} label={`q${qi}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Energy + States */}
          {(visiblePanels.energy || visiblePanels.states) && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {visiblePanels.energy && (
                <div className={`card ${visiblePanels.states ? "xl:col-span-2" : "xl:col-span-3"}`}>
                  <p className="label mb-3">Energy Convergence</p>
                  <EnergyPlot
                    iterations={result.iterations}
                    currentIdx={currentIdx}
                    groundTruth={result.ground_truth ?? undefined}
                    units={result.units}
                  />
                </div>
              )}
              {visiblePanels.states && (
                <div className={`card ${visiblePanels.energy ? "" : "xl:col-span-3"}`}>
                  <p className="label mb-3">State Distribution</p>
                  <StateVector probabilities={iter.probabilities} nQubits={result.n_qubits} />
                </div>
              )}
            </div>
          )}

          {/* Heatmap */}
          {visiblePanels.heatmap && (
            <div className="card">
              <p className="label mb-3">Parameter Evolution Heatmap</p>
              <ParameterHeatmap allParams={allParams} currentIdx={currentIdx} paramNames={result.param_names} />
            </div>
          )}

          {/* Playback */}
          <div className="card py-3">
            <input
              type="range" min={0} max={total - 1} value={currentIdx}
              onChange={(e) => { stopPlayback(); setCurrentIdx(Number(e.target.value)); }}
              className="w-full accent-violet-500 cursor-pointer mb-3"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <button className="btn-secondary px-2 py-1.5" title="Reset" onClick={() => { stopPlayback(); setCurrentIdx(0); }}>
                  <SkipBack size={13} />
                </button>
                <button className="btn-secondary px-2 py-1.5" onClick={() => { stopPlayback(); setCurrentIdx((i) => Math.max(0, i - 1)); }}>
                  <ChevronLeft size={13} />
                </button>
                <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => playing ? stopPlayback() : startPlayback()}>
                  {playing ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Play</>}
                </button>
                <button className="btn-secondary px-2 py-1.5" onClick={() => { stopPlayback(); setCurrentIdx((i) => Math.min(total - 1, i + 1)); }}>
                  <ChevronRight size={13} />
                </button>
                <button className="btn-secondary px-2 py-1.5" title="End" onClick={() => { stopPlayback(); setCurrentIdx(total - 1); }}>
                  <SkipForward size={13} />
                </button>
                <button className="btn-secondary px-2 py-1.5" title="Rerun same config" onClick={handleRun} disabled={loading}>
                  <RefreshCw size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">Speed</span>
                {SPEED_OPTIONS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
                      speed === s ? "bg-violet-600 text-white" : "bg-q-600 text-slate-400 hover:bg-q-500"
                    }`}
                  >{s}×</button>
                ))}
                <span className="text-xs text-slate-600 font-mono ml-2">{currentIdx + 1} / {total}</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
