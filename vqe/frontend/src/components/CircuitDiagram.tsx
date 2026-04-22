import React from "react";
import type { Gate } from "../types";

const CELL_W = 76;
const ROW_H = 64;
const GATE_W = 52;
const GATE_H = 34;
const LABEL_W = 48;
const PAD = 20;

const GATE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  RY: { fill: "#2e1065", stroke: "#7c3aed", text: "#c4b5fd" },
  RX: { fill: "#1e1b4b", stroke: "#6366f1", text: "#a5b4fc" },
  RZ: { fill: "#0c2a4a", stroke: "#0ea5e9", text: "#7dd3fc" },
  H:  { fill: "#064e3b", stroke: "#10b981", text: "#6ee7b7" },
  X:  { fill: "#422006", stroke: "#f59e0b", text: "#fde68a" },
  Y:  { fill: "#3b0764", stroke: "#a855f7", text: "#d8b4fe" },
  Z:  { fill: "#1e1b4b", stroke: "#818cf8", text: "#c7d2fe" },
  S:  { fill: "#064e3b", stroke: "#34d399", text: "#a7f3d0" },
  T:  { fill: "#064e3b", stroke: "#34d399", text: "#a7f3d0" },
  CX: { fill: "#0c2d4a", stroke: "#0ea5e9", text: "#7dd3fc" },
  DEFAULT: { fill: "#1e293b", stroke: "#475569", text: "#cbd5e1" },
};

function gateColor(name: string) {
  return GATE_COLORS[name] ?? GATE_COLORS.DEFAULT;
}

function formatParam(v: number): string {
  const pi = Math.PI;
  const ratios: [number, string][] = [
    [pi, "π"], [pi / 2, "π/2"], [pi / 4, "π/4"],
    [-pi, "-π"], [-pi / 2, "-π/2"],
  ];
  for (const [val, label] of ratios) {
    if (Math.abs(v - val) < 0.05) return label;
  }
  return v.toFixed(2);
}

interface Props {
  gates: Gate[];
  nQubits: number;
  nCols: number;
}

export default function CircuitDiagram({ gates, nQubits, nCols }: Props) {
  const W = LABEL_W + (nCols + 1) * CELL_W + PAD * 2;
  const H = nQubits * ROW_H + PAD * 2;

  const qubitY = (q: number) => PAD + q * ROW_H + ROW_H / 2;
  const gateX = (col: number) => LABEL_W + col * CELL_W + CELL_W / 2;

  // Group CNOT gates
  const cnotGates = gates.filter((g) => g.name === "CX" || g.name === "CNOT");
  const singleGates = gates.filter((g) => g.name !== "CX" && g.name !== "CNOT");

  return (
    <div className="overflow-x-auto rounded-lg bg-q-900 border border-q-600">
      <svg
        width={Math.max(W, 400)}
        height={H}
        style={{ fontFamily: "'JetBrains Mono', monospace", display: "block" }}
      >
        {/* Qubit lines */}
        {Array.from({ length: nQubits }, (_, i) => (
          <g key={i}>
            <line
              x1={LABEL_W - 8}
              y1={qubitY(i)}
              x2={W - PAD}
              y2={qubitY(i)}
              stroke="#1e3a5f"
              strokeWidth={1.5}
            />
            <text
              x={LABEL_W - 12}
              y={qubitY(i) + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#7ca8d8"
              fontSize={12}
              fontWeight={500}
            >
              q{i}
            </text>
          </g>
        ))}

        {/* CNOT connectors (drawn below gates) */}
        {cnotGates.map((g, idx) => {
          const [ctrl, tgt] = g.qubits;
          const cx = gateX(g.col);
          const cy = qubitY(ctrl);
          const ty = qubitY(tgt);
          return (
            <g key={`cnot-${idx}`}>
              <line x1={cx} y1={cy} x2={cx} y2={ty} stroke="#0ea5e9" strokeWidth={1.5} />
              <circle cx={cx} cy={cy} r={5} fill="#0ea5e9" />
              <circle cx={cx} cy={ty} r={10} fill="none" stroke="#0ea5e9" strokeWidth={1.5} />
              <line x1={cx - 7} y1={ty} x2={cx + 7} y2={ty} stroke="#0ea5e9" strokeWidth={1.5} />
              <line x1={cx} y1={ty - 7} x2={cx} y2={ty + 7} stroke="#0ea5e9" strokeWidth={1.5} />
            </g>
          );
        })}

        {/* Single-qubit gates */}
        {singleGates.map((g, idx) => {
          const q = g.qubits[0];
          const x = gateX(g.col) - GATE_W / 2;
          const y = qubitY(q) - GATE_H / 2;
          const { fill, stroke, text } = gateColor(g.name);
          const hasParam = g.params && g.params.length > 0;

          return (
            <g key={`gate-${idx}`}>
              <rect
                x={x}
                y={y}
                width={GATE_W}
                height={GATE_H}
                rx={5}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              <text
                x={gateX(g.col)}
                y={qubitY(q) + (hasParam ? -6 : 1)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={text}
                fontSize={hasParam ? 11 : 12}
                fontWeight={600}
              >
                {g.name}
              </text>
              {hasParam && (
                <text
                  x={gateX(g.col)}
                  y={qubitY(q) + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={text}
                  fontSize={9}
                  opacity={0.85}
                >
                  {formatParam(g.params![0])}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
