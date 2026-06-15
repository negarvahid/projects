import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingDown } from "lucide-react";
import { api } from "../api";
import type { BarrenResult } from "../types";

export default function BarrenPanel() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BarrenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    try {
      setData(await api.barrenScan({ n_samples: 200, seed: 1 }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  // Least-squares fit of ln(variance) vs n to estimate the decay exponent.
  let slope: number | null = null;
  if (data && data.points.length > 1) {
    const xs = data.points.map((p) => p.n_qubits);
    const ys = data.points.map((p) => Math.log(p.variance));
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    slope = num / den;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button className="btn-primary text-sm" onClick={run} disabled={loading}>
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Scanning…</>
            : <><TrendingDown size={14} /> Run barren-plateau scan</>}
        </button>
        <span className="text-xs text-slate-500">
          Gradient variance of ⟨Z₀Z₁⟩ over random initializations vs qubit count (hardware-efficient ansatz).
        </span>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

      {data && (
        <div className="animate-fade-in">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.points} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
              <XAxis dataKey="n_qubits" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#1e2d45" }}
                tickLine={false} label={{ value: "number of qubits n", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
              <YAxis scale="log" domain={["auto", "auto"]} allowDataOverflow tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false} tickLine={false} width={64}
                tickFormatter={(v: number) => v.toExponential(0)} />
              <Tooltip content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#0f1629", border: "1px solid #2a3f5f", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                    <p style={{ color: "#94a3b8" }}>n = {d.n_qubits} ({d.n_params} params)</p>
                    <p style={{ color: "#c4b5fd", fontFamily: "monospace" }}>Var = {d.variance.toExponential(3)}</p>
                  </div>
                );
              }} />
              <Line type="monotone" dataKey="variance" stroke="#6366f1" strokeWidth={2}
                dot={{ r: 4, fill: "#7c3aed", stroke: "#c4b5fd", strokeWidth: 1.5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          {slope !== null && (
            <p className="text-[11px] text-slate-500 mt-2 font-mono">
              Exponential fit: Var ∝ e<sup>{slope.toFixed(2)}·n</sup> · ideal 2-design slope = −ln 2 ≈ −0.69 ·
              gradient vanishes exponentially with system size (log scale).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
