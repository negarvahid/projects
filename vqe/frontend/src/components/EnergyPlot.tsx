import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { VQEIteration } from "../types";

interface Props {
  iterations: VQEIteration[];
  currentIdx: number;
  groundTruth?: number;
  units: string;
}

export default function EnergyPlot({ iterations, currentIdx, groundTruth, units }: Props) {
  const visible = iterations.slice(0, currentIdx + 1);
  const minE = Math.min(...visible.map((i) => i.energy));
  const maxE = Math.max(...visible.map((i) => i.energy));
  const pad = (maxE - minE) * 0.15 || 0.1;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={iterations} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
        <XAxis
          dataKey="iteration"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#1e2d45" }}
          tickLine={false}
          label={{ value: "Iteration", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }}
        />
        <YAxis
          domain={[minE - pad, maxE + pad]}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toFixed(2)}
          width={52}
        />
        {/* Inline tooltip to avoid Recharts overload on typed content prop */}
        <Tooltip
          content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: "#0f1629", border: "1px solid #2a3f5f", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                <p style={{ color: "#94a3b8" }}>Iteration {label}</p>
                <p style={{ color: "#c4b5fd", fontFamily: "monospace", fontWeight: 600 }}>
                  E = {Number(payload[0].value).toFixed(5)} {units}
                </p>
              </div>
            );
          }}
        />
        {groundTruth !== undefined && (
          <ReferenceLine
            y={groundTruth}
            stroke="#10b981"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{ value: `FCI ${groundTruth.toFixed(3)}`, fill: "#10b981", fontSize: 10, position: "insideTopRight", offset: 6 }}
          />
        )}
        <Line
          type="monotone"
          dataKey="energy"
          stroke="#6366f1"
          strokeWidth={2}
          /* Use any to bypass strict Recharts dot prop overloads */
          dot={((props: any) => {
            const { cx, cy, index } = props;
            if (cx == null || cy == null) return null;
            if (index === currentIdx) return (
              <g key={index}>
                <circle cx={cx} cy={cy} r={7} fill="#7c3aed" stroke="#c4b5fd" strokeWidth={2} />
                <circle cx={cx} cy={cy} r={3} fill="#e9d5ff" />
              </g>
            );
            if (index < currentIdx) return <circle key={index} cx={cx} cy={cy} r={2.5} fill="#6366f1" opacity={0.6} />;
            return <g key={index} />;
          }) as any}
          activeDot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
