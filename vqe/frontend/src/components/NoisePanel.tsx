import React, { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { Activity } from "lucide-react";
import { api } from "../api";
import type { NoiseSweepResult } from "../types";

interface Config {
  hamiltonian: string;
  ansatz: string;
  reps: number;
  optimizer: string;
  init_strategy: string;
  max_iter: number;
  seed: number;
  shots: number;
  custom_pauli_list?: [number, string][];
}

export default function NoisePanel({ config }: { config: Config }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NoiseSweepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    try {
      setData(await api.noiseSweep(config));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  // Build grouped histogram data over the union of clean/noisy bitstrings.
  const histData = data
    ? Array.from(new Set([...Object.keys(data.clean_counts), ...Object.keys(data.noisy_counts)]))
        .sort((a, b) => parseInt(a, 2) - parseInt(b, 2))
        .map((b) => ({
          bits: `|${b}⟩`,
          noiseless: data.clean_counts[b] ?? 0,
          noisy: data.noisy_counts[b] ?? 0,
        }))
    : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button className="btn-primary text-sm" onClick={run} disabled={loading}>
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Sweeping…</>
            : <><Activity size={14} /> Run noise sweep</>}
        </button>
        <span className="text-xs text-slate-500">
          Optimizes noiselessly, then degrades the optimal state with depolarizing + readout noise.
        </span>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in">
          {/* Energy + fidelity vs noise */}
          <div>
            <p className="label mb-2">Energy & fidelity vs noise strength</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                <XAxis dataKey="noise" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#1e2d45" }}
                  tickLine={false} tickFormatter={(v: number) => v.toFixed(3)}
                  label={{ value: "noise p", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
                <YAxis yAxisId="E" tick={{ fill: "#f0997b", fontSize: 11 }} axisLine={false} tickLine={false}
                  width={48} tickFormatter={(v: number) => v.toFixed(2)} />
                <YAxis yAxisId="F" orientation="right" domain={[0, 1]} tick={{ fill: "#5dcaa5", fontSize: 11 }}
                  axisLine={false} tickLine={false} width={36} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#0f1629", border: "1px solid #2a3f5f", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                      <p style={{ color: "#94a3b8" }}>p = {d.noise}</p>
                      <p style={{ color: "#f0997b", fontFamily: "monospace" }}>E = {d.energy.toFixed(4)}</p>
                      <p style={{ color: "#5dcaa5", fontFamily: "monospace" }}>F = {d.fidelity.toFixed(4)}</p>
                    </div>
                  );
                }} />
                <ReferenceLine yAxisId="E" y={data.exact_ground_energy} stroke="#64748b" strokeDasharray="5 3"
                  label={{ value: `exact ${data.exact_ground_energy.toFixed(2)}`, fill: "#64748b", fontSize: 9, position: "insideBottomRight" }} />
                <Line yAxisId="E" type="monotone" dataKey="energy" stroke="#d85a30" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} name="Energy" />
                <Line yAxisId="F" type="monotone" dataKey="fidelity" stroke="#1d9e75" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} name="Fidelity" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Clean vs noisy histogram */}
          <div>
            <p className="label mb-2">Histogram: noiseless vs noisy (p = {data.max_noise})</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={histData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                <XAxis dataKey="bits" tick={{ fill: "#64748b", fontSize: data.n_qubits > 3 ? 9 : 11 }}
                  axisLine={{ stroke: "#1e2d45" }} tickLine={false} interval={0}
                  angle={data.n_qubits > 3 ? -45 : 0} textAnchor={data.n_qubits > 3 ? "end" : "middle"}
                  height={data.n_qubits > 3 ? 48 : 24} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip cursor={{ fill: "#6366f120" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="noiseless" fill="#378add" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="noisy" fill="#d85a30" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
