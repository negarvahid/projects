import type { VQEResult, AnsatzCheckResult, HamiltonianInfo, AnsatzInfo } from "./types";

// In production (GitHub Pages), set VITE_API_URL to your Render backend URL.
// In dev, Vite proxies /api → localhost:8000 so BASE = "/api" works.
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "") + "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export interface HamiltonianMeta extends HamiltonianInfo {
  category: string;
}

export const api = {
  hamiltonians: () => get<Record<string, HamiltonianMeta>>("/hamiltonians"),
  ansatze: () => get<Record<string, AnsatzInfo>>("/ansatze"),
  problems: () => get<Record<string, { name: string; description: string; type: string }>>("/problems"),

  runVQE: (params: {
    hamiltonian: string;
    ansatz: string;
    reps: number;
    max_iter: number;
    optimizer: string;
    init_strategy: string;
    seed: number;
    custom_pauli_list?: [number, string][];
  }) => post<VQEResult>("/vqe/run", params),

  checkAnsatz: (problem: string, ansatz: string, n_qubits: number, reps: number, custom_description?: string) =>
    post<AnsatzCheckResult>("/ansatz/check", { problem, ansatz, n_qubits, reps, custom_description }),
};
