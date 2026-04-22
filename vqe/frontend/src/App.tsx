import React from "react";
import { Atom } from "lucide-react";
import VQEVisualizer from "./components/VQEVisualizer";

export default function App() {
  return (
    <div className="min-h-screen bg-q-950">
      {/* Header */}
      <header className="border-b border-q-700 bg-q-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Atom size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">VQE Explorer</h1>
            <p className="text-xs text-slate-500 mt-0.5">Variational Quantum Eigensolver | Interactive Visualizer</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <VQEVisualizer />
      </main>
    </div>
  );
}
