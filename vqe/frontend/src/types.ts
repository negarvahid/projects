export interface Gate {
  name: string;
  qubits: number[];
  col: number;
  params?: number[];
}

export interface VQEIteration {
  iteration: number;
  energy: number;
  params: number[];
  gates: Gate[];
  n_cols: number;
  probabilities: number[];
  bloch_vectors: [number, number, number][];
}

export interface VQEResult {
  iterations: VQEIteration[];
  final_energy: number;
  n_qubits: number;
  n_params: number;
  hamiltonian_name: string;
  ansatz_name: string;
  ground_truth?: number;
  units: string;
  converged: boolean;
  n_gates: number;
  param_names: string[];
  optimizer: string;
}

export interface AnsatzCheckResult {
  suitable: boolean;
  confidence: number;
  verdict: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  technical_explanation: string;
  metrics: {
    expressibility: number;
    entanglement_capability: number;
    parameter_efficiency: number;
    problem_alignment: number;
  };
  problem_name: string;
  ansatz_name: string;
}

export interface HamiltonianInfo {
  name: string;
  description: string;
  n_qubits: number;
}

export interface AnsatzInfo {
  name: string;
  description: string;
}
