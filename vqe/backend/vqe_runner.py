import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import SparsePauliOp, Statevector, DensityMatrix, partial_trace
from qiskit.circuit import ParameterVector
from scipy.optimize import minimize
from typing import List, Dict, Tuple, Optional, Any

# Pre-computed qubit Hamiltonians for molecular systems under each fermionic encoding.
# Generated via PySCF + qiskit-nature at STO-3G equilibrium geometries.
# H2: r=0.735 Ang, full space (4 spin-orbitals)
# LiH: r=1.5949 Ang, active space (2e, 2 spatial orbitals)
MOLECULAR_ENCODINGS: Dict[str, Dict[str, Dict]] = {
    "h2": {
        "jw": {
            "n_qubits": 4,
            "ground_truth": -1.1373,
            "pauli_list": [
                (-0.090579, "IIII"), (0.172184, "IIIZ"), (-0.225753, "IIZI"),
                (0.120913, "IIZZ"), (0.172184, "IZII"), (0.168928, "IZIZ"),
                (-0.225753, "ZIII"), (0.166145, "ZIIZ"), (0.045233, "YYYY"),
                (0.045233, "XXYY"), (0.045233, "YYXX"), (0.045233, "XXXX"),
                (0.166145, "IZZI"), (0.174643, "ZIZI"), (0.120913, "ZZII"),
            ],
        },
        "bk": {
            "n_qubits": 4,
            "ground_truth": -1.1373,
            "pauli_list": [
                (-0.090579, "IIII"), (0.172184, "IIIZ"), (-0.225753, "IIZZ"),
                (0.120913, "IIZI"), (0.172184, "IZII"), (0.168928, "IZIZ"),
                (-0.225753, "ZZZI"), (0.166145, "ZZZZ"), (0.045233, "ZXIX"),
                (-0.045233, "IXZX"), (-0.045233, "ZXZX"), (0.045233, "IXIX"),
                (0.166145, "IZZZ"), (0.174643, "ZZIZ"), (0.120913, "ZIZI"),
            ],
        },
        "parity": {
            "n_qubits": 4,
            "ground_truth": -1.1373,
            "pauli_list": [
                (-0.090579, "IIII"), (0.172184, "IIIZ"), (-0.225753, "IIZZ"),
                (0.120913, "IIZI"), (0.172184, "IZZI"), (0.168928, "IZZZ"),
                (-0.225753, "ZZII"), (0.166145, "ZZIZ"), (0.045233, "ZXIX"),
                (-0.045233, "IXZX"), (-0.045233, "ZXZX"), (0.045233, "IXIX"),
                (0.166145, "IZIZ"), (0.174643, "ZZZZ"), (0.120913, "ZIZI"),
            ],
        },
    },
    "lih": {
        "jw": {
            "n_qubits": 4,
            "ground_truth": -0.064,
            "pauli_list": [
                (0.289423, "IIII"), (0.156144, "IIIZ"), (-0.01499, "IIZI"),
                (0.052686, "IIZZ"), (0.156144, "IZII"), (0.121916, "IZIZ"),
                (0.013978, "YYII"), (0.012123, "YYIZ"), (0.013978, "XXII"),
                (0.012123, "XXIZ"), (-0.01499, "ZIII"), (0.055939, "ZIIZ"),
                (0.013978, "IIYY"), (0.012123, "IZYY"), (0.013978, "IIXX"),
                (0.012123, "IZXX"), (0.003253, "YYYY"), (0.003253, "XXYY"),
                (0.003253, "YYXX"), (0.003253, "XXXX"), (-0.001854, "ZIYY"),
                (-0.001854, "ZIXX"), (0.055939, "IZZI"), (-0.001854, "YYZI"),
                (-0.001854, "XXZI"), (0.084484, "ZIZI"), (0.052686, "ZZII"),
            ],
        },
        "bk": {
            "n_qubits": 4,
            "ground_truth": -0.064,
            "pauli_list": [
                (0.289423, "IIII"), (0.156144, "IIIZ"), (-0.01499, "IIZZ"),
                (0.052686, "IIZI"), (0.156144, "IZII"), (0.121916, "IZIZ"),
                (-0.013978, "ZXZI"), (-0.012123, "ZXZZ"), (0.013978, "IXII"),
                (0.012123, "IXIZ"), (-0.01499, "ZZZI"), (0.055939, "ZZZZ"),
                (-0.013978, "IIZX"), (-0.012123, "IZZX"), (0.013978, "IIIX"),
                (0.012123, "IZIX"), (0.003253, "ZXIX"), (-0.003253, "IXZX"),
                (-0.003253, "ZXZX"), (0.003253, "IXIX"), (0.001854, "ZZIX"),
                (-0.001854, "ZZZX"), (0.055939, "IZZZ"), (0.001854, "ZXIZ"),
                (-0.001854, "IXZZ"), (0.084484, "ZZIZ"), (0.052686, "ZIZI"),
            ],
        },
        "parity": {
            "n_qubits": 4,
            "ground_truth": -0.064,
            "pauli_list": [
                (0.289423, "IIII"), (0.156144, "IIIZ"), (-0.01499, "IIZZ"),
                (0.052686, "IIZI"), (0.156144, "IZZI"), (0.121916, "IZZZ"),
                (-0.013978, "ZXZI"), (-0.012123, "ZXZZ"), (0.013978, "IXII"),
                (0.012123, "IXIZ"), (-0.01499, "ZZII"), (0.055939, "ZZIZ"),
                (-0.013978, "IIZX"), (-0.012123, "IZIX"), (0.013978, "IIIX"),
                (0.012123, "IZZX"), (0.003253, "ZXIX"), (-0.003253, "IXZX"),
                (-0.003253, "ZXZX"), (0.003253, "IXIX"), (0.001854, "ZZZX"),
                (-0.001854, "ZZIX"), (0.055939, "IZIZ"), (0.001854, "ZXIZ"),
                (-0.001854, "IXZZ"), (0.084484, "ZZZZ"), (0.052686, "ZIZI"),
            ],
        },
    },
}

HAMILTONIANS = {
    "h2": {
        "name": "H₂ Molecule",
        "description": "Hydrogen molecule at equilibrium (STO-3G, 2q reduced). Select an encoding for the full 4-qubit representation.",
        "n_qubits": 2,
        "supports_encoding": True,
        "pauli_list": [
            (-1.0523, "II"), (0.3979, "ZI"), (-0.3979, "IZ"),
            (-0.0112, "ZZ"), (0.1809, "XX"), (0.1809, "YY"),
        ],
        "ground_truth": -1.8572,
        "units": "Hartree",
        "category": "Quantum Chemistry",
    },
    "lih": {
        "name": "LiH Molecule (4q)",
        "description": "Lithium hydride, reduced active space (STO-3G). Supports encoding selection.",
        "n_qubits": 4,
        "supports_encoding": True,
        "pauli_list": [
            (-7.4994, "IIII"), (0.1808, "ZZII"), (0.1808, "IIZZ"),
            (0.1808, "IZIZ"), (0.1808, "ZIIZ"), (0.0453, "XXYY"),
            (0.0453, "YYXX"), (0.0453, "XYYX"), (0.0453, "YXXY"),
            (0.1722, "ZIIZ"), (-0.2226, "IZZI"),
        ],
        "ground_truth": -7.8823,
        "units": "Hartree",
        "category": "Quantum Chemistry",
    },
    "heisenberg2": {
        "name": "Heisenberg Chain (2q)",
        "description": "2-qubit isotropic Heisenberg model, J=1",
        "n_qubits": 2,
        "pauli_list": [(1.0, "XX"), (1.0, "YY"), (1.0, "ZZ")],
        "ground_truth": -3.0,
        "units": "J",
        "category": "Spin Models",
    },
    "heisenberg3": {
        "name": "Heisenberg Chain (3q)",
        "description": "3-qubit open Heisenberg spin chain, J=1",
        "n_qubits": 3,
        "pauli_list": [
            (1.0, "XXI"), (1.0, "YYI"), (1.0, "ZZI"),
            (1.0, "IXX"), (1.0, "IYY"), (1.0, "IZZ"),
        ],
        "ground_truth": -4.0,
        "units": "J",
        "category": "Spin Models",
    },
    "xxz": {
        "name": "XXZ Chain (2q, Δ=0.5)",
        "description": "Anisotropic Heisenberg (XXZ) model with Δ=0.5",
        "n_qubits": 2,
        "pauli_list": [(1.0, "XX"), (1.0, "YY"), (0.5, "ZZ")],
        "ground_truth": -2.5,
        "units": "J",
        "category": "Spin Models",
    },
    "ising": {
        "name": "Transverse Ising (3q)",
        "description": "3-qubit transverse field Ising, J=1, h=0.5",
        "n_qubits": 3,
        "pauli_list": [
            (1.0, "ZZI"), (1.0, "IZZ"),
            (0.5, "XII"), (0.5, "IXI"), (0.5, "IIX"),
        ],
        "ground_truth": -2.7321,
        "units": "J",
        "category": "Spin Models",
    },
    "ising4": {
        "name": "Transverse Ising (4q)",
        "description": "4-qubit transverse field Ising, J=1, h=0.5, open chain",
        "n_qubits": 4,
        "pauli_list": [
            (1.0, "ZZII"), (1.0, "IZZI"), (1.0, "IIZZ"),
            (0.5, "XIII"), (0.5, "IXII"), (0.5, "IIXI"), (0.5, "IIIX"),
        ],
        "ground_truth": -4.1,
        "units": "J",
        "category": "Spin Models",
    },
    "maxcut4": {
        "name": "MaxCut (4-node cycle)",
        "description": "MaxCut on 4-node cycle graph mapped to Ising Hamiltonian",
        "n_qubits": 4,
        "pauli_list": [
            (0.5, "ZZII"), (0.5, "IZZI"), (0.5, "IIZZ"), (0.5, "ZIIZ"),
        ],
        "ground_truth": -2.0,
        "units": "",
        "category": "Combinatorial Optimization",
    },
    "maxcut5": {
        "name": "MaxCut (5-node cycle)",
        "description": "MaxCut on 5-node cycle graph — odd cycle, frustration!",
        "n_qubits": 5,
        "pauli_list": [
            (0.5, "ZZIII"), (0.5, "IZZII"), (0.5, "IIZZI"),
            (0.5, "IIIZZ"), (0.5, "ZIIIZ"),
        ],
        "ground_truth": -2.0,
        "units": "",
        "category": "Combinatorial Optimization",
    },
    "custom": {
        "name": "Custom Hamiltonian",
        "description": "User-defined Pauli operator",
        "n_qubits": 2,
        "pauli_list": [(-1.0, "ZZ"), (0.5, "XI"), (0.5, "IX")],
        "ground_truth": None,
        "units": "",
        "category": "Custom",
    },
}

ANSATZE = {
    "real_amplitudes": {
        "name": "RealAmplitudes",
        "description": "Ry rotations + linear CNOT. Only real amplitudes.",
        "type": "heuristic",
    },
    "efficient_su2": {
        "name": "EfficientSU2",
        "description": "Ry+Rz layers + linear CNOT. Full SU(2) single-qubit coverage.",
        "type": "heuristic",
    },
    "hea": {
        "name": "Hardware-Efficient (HEA)",
        "description": "Rx+Rz layers + CNOT. Designed for NISQ hardware.",
        "type": "heuristic",
    },
    "strongly_entangling": {
        "name": "Strongly Entangling Layers",
        "description": "Rx+Ry+Rz rotations with varying-range CNOT entanglement per layer.",
        "type": "heuristic",
    },
    "uccsd_like": {
        "name": "UCCSD-inspired",
        "description": "Unitary Coupled Cluster structure. Chemistry-motivated.",
        "type": "chemistry",
    },
}


def _real_amplitudes(n_qubits: int, reps: int) -> Tuple[QuantumCircuit, List]:
    params = ParameterVector("θ", n_qubits * (reps + 1))
    qc = QuantumCircuit(n_qubits)
    idx = 0
    for q in range(n_qubits):
        qc.ry(params[idx], q); idx += 1
    for _ in range(reps):
        for q in range(n_qubits - 1):
            qc.cx(q, q + 1)
        for q in range(n_qubits):
            qc.ry(params[idx], q); idx += 1
    return qc, list(params)


def _efficient_su2(n_qubits: int, reps: int) -> Tuple[QuantumCircuit, List]:
    params = ParameterVector("θ", 2 * n_qubits * (reps + 1))
    qc = QuantumCircuit(n_qubits)
    idx = 0
    for r in range(reps + 1):
        for q in range(n_qubits):
            qc.ry(params[idx], q); idx += 1
            qc.rz(params[idx], q); idx += 1
        if r < reps:
            for q in range(n_qubits - 1):
                qc.cx(q, q + 1)
    return qc, list(params)


def _hea(n_qubits: int, reps: int) -> Tuple[QuantumCircuit, List]:
    params = ParameterVector("θ", 2 * n_qubits * (reps + 1))
    qc = QuantumCircuit(n_qubits)
    idx = 0
    for r in range(reps + 1):
        for q in range(n_qubits):
            qc.rx(params[idx], q); idx += 1
            qc.rz(params[idx], q); idx += 1
        if r < reps:
            for q in range(n_qubits - 1):
                qc.cx(q, q + 1)
    return qc, list(params)


def _strongly_entangling(n_qubits: int, reps: int) -> Tuple[QuantumCircuit, List]:
    """Strongly Entangling Layers (Schuld et al.): 3 rotations/qubit + varying-range CX."""
    params = ParameterVector("θ", 3 * n_qubits * (reps + 1))
    qc = QuantumCircuit(n_qubits)
    idx = 0
    for r in range(reps + 1):
        for q in range(n_qubits):
            qc.rx(params[idx], q); idx += 1
            qc.ry(params[idx], q); idx += 1
            qc.rz(params[idx], q); idx += 1
        if r < reps and n_qubits > 1:
            offset = (r % (n_qubits - 1)) + 1
            for q in range(n_qubits):
                qc.cx(q, (q + offset) % n_qubits)
    return qc, list(params)


def _uccsd_like(n_qubits: int, reps: int) -> Tuple[QuantumCircuit, List]:
    n_params = n_qubits + (n_qubits + n_qubits - 1) * reps
    params = ParameterVector("θ", n_params)
    qc = QuantumCircuit(n_qubits)
    idx = 0
    for q in range(n_qubits // 2):
        qc.x(q)
    for q in range(n_qubits):
        qc.ry(params[idx], q); idx += 1
    for _ in range(reps):
        for q in range(n_qubits):
            qc.rz(params[idx], q); idx += 1
        for q in range(n_qubits - 1):
            qc.cx(q, q + 1)
            qc.ry(params[idx], q + 1); idx += 1
            qc.cx(q, q + 1)
    return qc, list(params)


def build_ansatz(name: str, n_qubits: int, reps: int) -> Tuple[QuantumCircuit, List]:
    builders = {
        "real_amplitudes": _real_amplitudes,
        "efficient_su2": _efficient_su2,
        "hea": _hea,
        "strongly_entangling": _strongly_entangling,
        "uccsd_like": _uccsd_like,
    }
    if name not in builders:
        raise ValueError(f"Unknown ansatz: {name}")
    return builders[name](n_qubits, reps)


def serialize_circuit(qc: QuantumCircuit, param_name_map: Dict[str, float]) -> Tuple[List[Dict], int]:
    gates = []
    qubit_col = [0] * qc.num_qubits

    for inst in qc.data:
        op = inst.operation
        qubits = [qc.find_bit(q).index for q in inst.qubits]
        col = max(qubit_col[q] for q in qubits)

        gate: Dict[str, Any] = {"name": op.name.upper(), "qubits": qubits, "col": col}

        if op.params:
            vals = []
            for p in op.params:
                if hasattr(p, "name"):
                    vals.append(round(param_name_map.get(p.name, 0.0), 3))
                else:
                    try:
                        vals.append(round(float(p), 3))
                    except Exception:
                        vals.append(0.0)
            gate["params"] = vals

        gates.append(gate)
        for q in qubits:
            qubit_col[q] = col + 1

    return gates, max(qubit_col)


def run_vqe(
    hamiltonian_key: str,
    ansatz_key: str,
    reps: int = 2,
    max_iter: int = 80,
    optimizer: str = "COBYLA",
    init_strategy: str = "random",
    custom_pauli_list: Optional[List[Tuple[float, str]]] = None,
    seed: int = 42,
    encoding: Optional[str] = None,
) -> Dict:
    if hamiltonian_key == "custom" and custom_pauli_list:
        n_qubits = len(custom_pauli_list[0][1])
        ham_config = {
            "name": "Custom Hamiltonian",
            "n_qubits": n_qubits,
            "pauli_list": custom_pauli_list,
            "ground_truth": None,
            "units": "",
        }
    elif encoding and hamiltonian_key in MOLECULAR_ENCODINGS and encoding in MOLECULAR_ENCODINGS[hamiltonian_key]:
        enc_data = MOLECULAR_ENCODINGS[hamiltonian_key][encoding]
        base = HAMILTONIANS[hamiltonian_key]
        enc_label = {"jw": "Jordan-Wigner", "bk": "Bravyi-Kitaev", "parity": "Parity"}[encoding]
        ham_config = {
            "name": f"{base['name']} [{enc_label}]",
            "n_qubits": enc_data["n_qubits"],
            "pauli_list": enc_data["pauli_list"],
            "ground_truth": enc_data["ground_truth"],
            "units": base.get("units", "Hartree"),
        }
        n_qubits = enc_data["n_qubits"]
    else:
        ham_config = HAMILTONIANS[hamiltonian_key]
        n_qubits = ham_config["n_qubits"]

    hamiltonian = SparsePauliOp.from_list([(p, c) for c, p in ham_config["pauli_list"]])
    qc, params = build_ansatz(ansatz_key, n_qubits, reps)
    n_params = len(params)
    iterations: List[Dict] = []

    def cost(x: np.ndarray) -> float:
        param_dict = {p: float(v) for p, v in zip(params, x)}
        param_name_map = {p.name: float(v) for p, v in zip(params, x)}

        bound_qc = qc.assign_parameters(param_dict)
        sv = Statevector(bound_qc)
        energy = float(sv.expectation_value(hamiltonian).real)

        probs = (np.abs(sv.data) ** 2).tolist()

        dm = DensityMatrix(sv)
        bloch_vectors = []
        for q in range(n_qubits):
            qubits_to_trace = [i for i in range(n_qubits) if i != q]
            rdm = partial_trace(dm, qubits_to_trace)
            bx = float(rdm.expectation_value(SparsePauliOp("X")).real)
            by = float(rdm.expectation_value(SparsePauliOp("Y")).real)
            bz = float(rdm.expectation_value(SparsePauliOp("Z")).real)
            bloch_vectors.append([round(bx, 4), round(by, 4), round(bz, 4)])

        gates, n_cols = serialize_circuit(qc, param_name_map)
        iterations.append({
            "iteration": len(iterations),
            "energy": round(energy, 6),
            "params": [round(float(v), 4) for v in x],
            "gates": gates,
            "n_cols": n_cols,
            "probabilities": [round(float(p), 6) for p in probs],
            "bloch_vectors": bloch_vectors,
        })
        return energy

    rng = np.random.default_rng(seed)

    if init_strategy == "zeros":
        x0 = np.zeros(n_params)
    elif init_strategy == "near_zero":
        x0 = rng.uniform(-0.1, 0.1, n_params)
    elif init_strategy == "pi_fractions":
        x0 = rng.choice([0, np.pi / 4, np.pi / 2, np.pi], size=n_params)
    else:  # random
        x0 = rng.uniform(-np.pi, np.pi, n_params)

    opt_kwargs: Dict[str, Any] = {"maxiter": max_iter}
    if optimizer == "COBYLA":
        opt_kwargs["rhobeg"] = 0.5
    elif optimizer == "Nelder-Mead":
        opt_kwargs["xatol"] = 1e-4
        opt_kwargs["fatol"] = 1e-5

    result = minimize(cost, x0, method=optimizer, options=opt_kwargs)

    return {
        "iterations": iterations,
        "final_energy": round(float(result.fun), 6),
        "n_qubits": n_qubits,
        "n_params": n_params,
        "hamiltonian_name": ham_config["name"],
        "ansatz_name": ANSATZE[ansatz_key]["name"],
        "ground_truth": ham_config.get("ground_truth"),
        "units": ham_config.get("units", ""),
        "converged": bool(result.success),
        "n_gates": len(qc.data),
        "param_names": [p.name for p in params],
        "optimizer": optimizer,
    }
