import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Dot,
} from "recharts";
import type { VQEIteration } from "../types";

interface Props {
  iterations: VQEIteration[];
  currentIdx: number;
  groundTruth?: number;
  units: string;
}

const CustomDot = (currentIdx: number) =>
  // eslint-disable-next-line react/display-name
  (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    if (index === currentIdx) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={7} fill="#7c3aed" stroke="#c4b5fd" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={3} fill="#e9d5ff" />
        </g>
      );
    }
    if (index! < currentIdx) {
      return <circle cx={cx} cy={cy} r={2.5} fill="#6366f1" opacity={0.6} />;
    }
    return null;
  };

const CustomTooltip = ({ active, payload, label, units }: {
  active?: boolean; payload?: { value: number }[]; label?: number; units: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-q-700 border border-q-500 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400">Iteration {label}</p>
      <p className="text-violet-300 font-mono font-semibold">
        E = {payload[0].value.toFixed(5)} {units}
      </p>
    </div>
  );
};

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
        <Tooltip content={<CustomTooltip units={units} />} />
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
          dot={CustomDot(currentIdx)}
          activeDot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
