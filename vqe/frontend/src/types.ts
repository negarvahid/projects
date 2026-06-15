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
  exact_ground_energy?: number;
  fidelity?: number;
  energy_error?: number;
  measurement_counts?: Record<string, number>;
  shots?: number;
  units: string;
  converged: boolean;
  n_gates: number;
  param_names: string[];
  optimizer: string;
}

export interface NoisePoint {
  noise: number;
  energy: number;
  energy_error: number;
  fidelity: number;
}

export interface NoiseSweepResult {
  noise_levels: number[];
  points: NoisePoint[];
  exact_ground_energy: number;
  noiseless_energy: number;
  max_noise: number;
  shots: number;
  clean_counts: Record<string, number>;
  noisy_counts: Record<string, number>;
  hamiltonian_name: string;
  ansatz_name: string;
  n_qubits: number;
  units: string;
}

export interface BarrenPoint {
  n_qubits: number;
  reps: number;
  n_params: number;
  variance: number;
  mean_grad: number;
}

export interface BarrenResult {
  observable: string;
  ansatz: string;
  n_samples: number;
  points: BarrenPoint[];
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
  supports_encoding?: boolean;
}

export interface AnsatzInfo {
  name: string;
  description: string;
}
