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
    encoding?: string;
  }) => post<VQEResult>("/vqe/run", params),

  checkAnsatz: (problem: string, ansatz: string, n_qubits: number, reps: number, custom_description?: string) =>
    post<AnsatzCheckResult>("/ansatz/check", { problem, ansatz, n_qubits, reps, custom_description }),

  submitIBMJob: (params: {
    ibm_token: string;
    hamiltonian: string;
    ansatz: string;
    reps: number;
    max_iter: number;
    optimizer: string;
    init_strategy: string;
    seed: number;
    encoding?: string;
    custom_pauli_list?: [number, string][];
    backend_name?: string;
  }) => post<{
    job_id: string;
    backend_name: string;
    simulator_energy: number;
    hamiltonian_name: string;
    ansatz_name: string;
    units: string;
    n_qubits: number;
    status: string;
  }>("/vqe/ibm/submit", params),

  fetchIBMResult: (ibm_token: string, job_id: string) =>
    post<{
      job_id: string;
      status: string;
      hardware_energy: number | null;
      error: string | null;
    }>("/vqe/ibm/result", { ibm_token, job_id }),
};
