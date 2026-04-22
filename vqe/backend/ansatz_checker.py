import os
import json
from typing import Dict, List, Any
import numpy as np
import anthropic

PROBLEM_PROFILES = {
    "h2": {
        "name": "H₂ Molecule",
        "type": "quantum_chemistry",
        "n_qubits": 2,
        "description": "2-qubit hydrogen molecule, STO-3G basis, Jordan-Wigner mapping. Ground state has strong electron correlation.",
        "particle_conserving": True,
        "symmetries": ["particle number", "spin"],
    },
    "lih": {
        "name": "LiH Molecule",
        "type": "quantum_chemistry",
        "n_qubits": 4,
        "description": "4-qubit LiH in reduced active space. Moderate correlation. Requires particle conservation.",
        "particle_conserving": True,
        "symmetries": ["particle number", "spin"],
    },
    "heisenberg": {
        "name": "Heisenberg Spin Chain",
        "type": "condensed_matter",
        "n_qubits": 2,
        "description": "2-qubit isotropic Heisenberg model. Ground state is a spin singlet. Requires entanglement.",
        "particle_conserving": False,
        "symmetries": ["SU(2) spin rotation"],
    },
    "ising": {
        "name": "Transverse Ising Model",
        "type": "condensed_matter",
        "n_qubits": 3,
        "description": "3-qubit transverse field Ising. Near-critical. Ground state has significant quantum fluctuations.",
        "particle_conserving": False,
        "symmetries": ["Z2 parity"],
    },
    "maxcut": {
        "name": "MaxCut (QAOA target)",
        "type": "combinatorial_optimization",
        "n_qubits": 4,
        "description": "Graph MaxCut mapped to Ising Hamiltonian. Cost function is diagonal in Z basis.",
        "particle_conserving": False,
        "symmetries": [],
    },
    "custom": {
        "name": "Custom Hamiltonian",
        "type": "unknown",
        "n_qubits": None,
        "description": "User-defined problem.",
        "particle_conserving": False,
        "symmetries": [],
    },
}

ANSATZ_PROFILES = {
    "real_amplitudes": {
        "name": "RealAmplitudes",
        "gate_set": ["Ry", "CNOT"],
        "entanglement": "linear",
        "particle_conserving": False,
        "complex_amplitudes": False,
        "typical_use": "Simple optimization problems, real-valued ground states",
        "strengths": ["Low parameter count", "No barren plateaus for shallow depths", "Hardware friendly"],
        "weaknesses": ["Cannot represent complex amplitudes", "Limited expressibility for correlated states"],
    },
    "efficient_su2": {
        "name": "EfficientSU2",
        "gate_set": ["Ry", "Rz", "CNOT"],
        "entanglement": "linear",
        "particle_conserving": False,
        "complex_amplitudes": True,
        "typical_use": "General quantum chemistry, spin models",
        "strengths": ["Full SU(2) per qubit", "Balanced expressibility vs cost", "Hardware friendly"],
        "weaknesses": ["No particle conservation", "May over-parameterize simple problems"],
    },
    "hea": {
        "name": "Hardware-Efficient Ansatz (HEA)",
        "gate_set": ["Rx", "Rz", "CNOT"],
        "entanglement": "linear",
        "particle_conserving": False,
        "complex_amplitudes": True,
        "typical_use": "NISQ-era experiments, generic optimization",
        "strengths": ["Maximally hardware friendly", "Flexible parameterization"],
        "weaknesses": ["Prone to barren plateaus at large depth", "No chemistry structure", "May violate symmetries"],
    },
    "uccsd_like": {
        "name": "UCCSD-inspired",
        "gate_set": ["Ry", "Rz", "CNOT", "X"],
        "entanglement": "all-to-all (excitation driven)",
        "particle_conserving": True,
        "complex_amplitudes": True,
        "typical_use": "Molecular electronic structure, Fermionic systems",
        "strengths": ["Particle-number conserving", "Chemically motivated structure", "Near-FCI accuracy"],
        "weaknesses": ["Deep circuits (hardware demanding)", "High parameter count", "Less suited for non-chemistry problems"],
    },
}


def compute_metrics(problem_key: str, ansatz_key: str, n_qubits: int, reps: int) -> Dict[str, float]:
    problem = PROBLEM_PROFILES.get(problem_key, PROBLEM_PROFILES["custom"])
    ansatz = ANSATZ_PROFILES[ansatz_key]

    # Expressibility: how well the ansatz can approximate arbitrary states
    base_expr = {"real_amplitudes": 0.55, "efficient_su2": 0.80, "hea": 0.75, "uccsd_like": 0.70}
    expressibility = min(1.0, base_expr[ansatz_key] + reps * 0.05)

    # Entanglement capability: ratio of entangling gates to qubits
    n_cnots = (n_qubits - 1) * reps
    entanglement = min(1.0, n_cnots / max(n_qubits * reps, 1))

    # Parameter efficiency: params used vs theoretical minimum for problem
    n_params_map = {
        "real_amplitudes": n_qubits * (reps + 1),
        "efficient_su2": 2 * n_qubits * (reps + 1),
        "hea": 2 * n_qubits * (reps + 1),
        "uccsd_like": n_qubits + (n_qubits + n_qubits - 1) * reps,
    }
    n_params = n_params_map[ansatz_key]
    # Ideal minimum: roughly n_qubits * 2 for simple problems
    ideal_min = n_qubits * 2
    param_efficiency = min(1.0, ideal_min / n_params) if n_params > 0 else 0.0

    # Problem-ansatz alignment score
    alignment = 0.5
    if problem["type"] == "quantum_chemistry" and ansatz_key == "uccsd_like":
        alignment = 0.95
    elif problem["type"] == "quantum_chemistry" and ansatz_key == "efficient_su2":
        alignment = 0.75
    elif problem["type"] == "combinatorial_optimization" and ansatz_key == "real_amplitudes":
        alignment = 0.80
    elif problem["type"] == "condensed_matter" and ansatz_key in ("efficient_su2", "hea"):
        alignment = 0.70
    elif problem.get("particle_conserving") and not ansatz["particle_conserving"]:
        alignment = max(0.2, alignment - 0.3)

    return {
        "expressibility": round(expressibility, 3),
        "entanglement_capability": round(entanglement, 3),
        "parameter_efficiency": round(param_efficiency, 3),
        "problem_alignment": round(alignment, 3),
    }


def check_ansatz(
    problem_key: str,
    ansatz_key: str,
    n_qubits: int,
    reps: int,
    custom_description: str = "",
) -> Dict[str, Any]:
    problem = PROBLEM_PROFILES.get(problem_key, PROBLEM_PROFILES["custom"])
    ansatz = ANSATZ_PROFILES[ansatz_key]
    metrics = compute_metrics(problem_key, ansatz_key, n_qubits, reps)

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    system_prompt = (
        "You are an expert quantum computing scientist specializing in variational quantum algorithms (VQE, QAOA). "
        "Provide concise, technically rigorous assessments of ansatz suitability. "
        "Always respond with valid JSON matching the requested schema exactly."
    )

    user_prompt = f"""Assess whether the following ansatz is appropriate for the given quantum problem.

PROBLEM:
- Name: {problem["name"]}
- Type: {problem["type"]}
- Qubits: {n_qubits}
- Description: {problem["description"]}
- Particle conserving: {problem["particle_conserving"]}
- Symmetries: {problem["symmetries"]}
{f'- Additional context: {custom_description}' if custom_description else ''}

ANSATZ:
- Name: {ansatz["name"]}
- Gate set: {ansatz["gate_set"]}
- Entanglement topology: {ansatz["entanglement"]}
- Particle conserving: {ansatz["particle_conserving"]}
- Complex amplitudes: {ansatz["complex_amplitudes"]}
- Repetitions (reps): {reps}
- Typical use case: {ansatz["typical_use"]}

COMPUTED METRICS:
- Expressibility: {metrics["expressibility"]:.1%}
- Entanglement capability: {metrics["entanglement_capability"]:.1%}
- Parameter efficiency: {metrics["parameter_efficiency"]:.1%}
- Problem-ansatz alignment: {metrics["problem_alignment"]:.1%}

Respond with ONLY this JSON (no markdown, no extra text):
{{
  "suitable": <true or false>,
  "confidence": <0.0 to 1.0>,
  "verdict": "<one crisp sentence>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "technical_explanation": "<2-3 sentence technical deep-dive on why this ansatz does/doesn't fit>"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = message.content[0].text.strip()
    ai_result = json.loads(raw)

    return {
        **ai_result,
        "metrics": metrics,
        "problem_name": problem["name"],
        "ansatz_name": ansatz["name"],
    }
