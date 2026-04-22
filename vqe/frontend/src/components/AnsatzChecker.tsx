import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Sparkles, FlaskConical } from "lucide-react";
import { api } from "../api";
import type { AnsatzCheckResult, AnsatzInfo } from "../types";

interface ProblemInfo { name: string; description: string; type: string; }

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-300">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 bg-q-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function AnsatzChecker() {
  const [problems, setProblems] = useState<Record<string, ProblemInfo>>({});
  const [ansatze, setAnsatze] = useState<Record<string, AnsatzInfo>>({});
  const [selectedProblem, setSelectedProblem] = useState("h2");
  const [selectedAnsatz, setSelectedAnsatz] = useState("hea");
  const [nQubits, setNQubits] = useState(2);
  const [reps, setReps] = useState(2);
  const [customDesc, setCustomDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnsatzCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.problems().then((p) => {
      setProblems(p);
    }).catch(() => {});
    api.ansatze().then(setAnsatze).catch(() => {});
  }, []);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.checkAnsatz(selectedProblem, selectedAnsatz, nQubits, reps, customDesc);
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Input panel */}
      <div className="card glow-cyan">
        <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-widest mb-4 flex items-center gap-2">
          <FlaskConical size={14} /> Ansatz Checker
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Problem</label>
            <select className="select-field" value={selectedProblem} onChange={(e) => setSelectedProblem(e.target.value)}>
              {Object.entries(problems).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </div>
          <div>
            <label className="label">Ansatz</label>
            <select className="select-field" value={selectedAnsatz} onChange={(e) => setSelectedAnsatz(e.target.value)}>
              {Object.entries(ansatze).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Qubits</label>
            <select className="select-field" value={nQubits} onChange={(e) => setNQubits(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reps</label>
            <select className="select-field" value={reps} onChange={(e) => setReps(Number(e.target.value))}>
              {[1, 2, 3, 4].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {selectedProblem === "custom" && (
          <div className="mt-3">
            <label className="label">Problem description</label>
            <textarea
              className="select-field h-20 resize-none"
              placeholder="Describe your Hamiltonian or problem type…"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
            />
          </div>
        )}
        <div className="mt-4">
          <button className="btn-primary" onClick={handleCheck} disabled={loading}>
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing with Claude…
              </>
            ) : (
              <><Sparkles size={15} /> Check Ansatz</>
            )}
          </button>
        </div>
        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Verdict banner */}
          <div className={`card flex items-start gap-4 ${result.suitable ? "glow-green border-emerald-800" : "border-red-900"}`}>
            <div className="mt-0.5">
              {result.suitable
                ? <CheckCircle size={28} className="text-emerald-400" />
                : <XCircle size={28} className="text-red-400" />
              }
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className={`font-bold text-lg ${result.suitable ? "text-emerald-300" : "text-red-300"}`}>
                  {result.suitable ? "Suitable" : "Not Suitable"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  result.suitable ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"
                }`}>
                  {Math.round(result.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-slate-300 text-sm">{result.verdict}</p>
              <p className="text-xs text-slate-400 mt-2">
                {result.ansatz_name} → {result.problem_name}
              </p>
            </div>
          </div>

          {/* Metrics + Explanation grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Metrics */}
            <div className="card">
              <h3 className="label mb-4">Computed Metrics</h3>
              <div className="space-y-4">
                <MetricBar label="Expressibility" value={result.metrics.expressibility} color="linear-gradient(90deg, #6366f1, #8b5cf6)" />
                <MetricBar label="Entanglement Capability" value={result.metrics.entanglement_capability} color="linear-gradient(90deg, #0ea5e9, #6366f1)" />
                <MetricBar label="Parameter Efficiency" value={result.metrics.parameter_efficiency} color="linear-gradient(90deg, #10b981, #0ea5e9)" />
                <MetricBar label="Problem Alignment" value={result.metrics.problem_alignment} color="linear-gradient(90deg, #f59e0b, #ef4444)" />
              </div>
            </div>

            {/* Technical explanation */}
            <div className="card">
              <h3 className="label mb-3 flex items-center gap-2">
                <Sparkles size={11} /> Claude's Analysis
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">{result.technical_explanation}</p>
            </div>
          </div>

          {/* Strengths / Weaknesses / Suggestions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <h3 className="label mb-3 text-emerald-400">Strengths</h3>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="label mb-3 text-red-400">Weaknesses</h3>
              <ul className="space-y-2">
                {result.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="label mb-3 text-amber-400">Suggestions</h3>
              <ul className="space-y-2">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
