import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Props {
  counts: Record<string, number>;
  shots: number;
  nQubits: number;
}

export default function MeasurementHistogram({ counts, shots, nQubits }: Props) {
  // Sort bitstrings by their integer value for a stable, readable x-axis.
  const data = Object.entries(counts)
    .sort(([a], [b]) => parseInt(a, 2) - parseInt(b, 2))
    .map(([bits, c]) => ({
      bits: `|${bits}⟩`,
      count: c,
      prob: c / shots,
    }));

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
          <XAxis
            dataKey="bits"
            tick={{ fill: "#64748b", fontSize: nQubits > 3 ? 9 : 11 }}
            axisLine={{ stroke: "#1e2d45" }}
            tickLine={false}
            angle={nQubits > 3 ? -45 : 0}
            textAnchor={nQubits > 3 ? "end" : "middle"}
            height={nQubits > 3 ? 48 : 24}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "#6366f120" }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ background: "#0f1629", border: "1px solid #2a3f5f", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                  <p style={{ color: "#c4b5fd", fontFamily: "monospace", fontWeight: 600 }}>{d.bits}</p>
                  <p style={{ color: "#94a3b8", fontFamily: "monospace" }}>
                    {d.count} shots · {(d.prob * 100).toFixed(1)}%
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={`rgba(124,58,237,${0.35 + 0.65 * (d.count / maxCount)})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-slate-500 mt-2 font-mono">
        {shots.toLocaleString()} shots · {data.length} distinct outcome{data.length !== 1 ? "s" : ""} · sampled from optimal state
      </p>
    </div>
  );
}
