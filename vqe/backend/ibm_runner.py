"""
IBM Quantum runner for VQE.

Flow:
  1. Run classical VQE to obtain optimal parameters (noiseless simulator).
  2. Bind those parameters into the ansatz.
  3. Transpile the bound circuit for the chosen IBM backend.
  4. Submit a single EstimatorV2 job and return the job_id to the client.
  5. The client polls fetch_ibm_result(job_id) until the job is done.

Security contract:
  - ibm_token is NEVER logged, stored, or returned in any response.
  - QiskitRuntimeService is created per-request; no credentials hit disk.
  - The token variable is deleted immediately after the service is created.
"""

import logging
import numpy as np
from typing import Optional, List, Tuple, Dict, Any

from qiskit.quantum_info import SparsePauliOp
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_ibm_runtime import QiskitRuntimeService, EstimatorV2

from vqe_runner import (
    run_vqe, build_ansatz, HAMILTONIANS, MOLECULAR_ENCODINGS
)

logger = logging.getLogger(__name__)

# Keep library loggers quiet — request bodies (which carry the token) could
# otherwise end up in debug output.
logging.getLogger("qiskit_ibm_runtime").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

def _get_hamiltonian_config(
    hamiltonian_key: str,
    encoding: Optional[str],
    custom_pauli_list: Optional[List[Tuple[float, str]]],
) -> Dict[str, Any]:
    if hamiltonian_key == "custom" and custom_pauli_list:
        return {
            "name": "Custom Hamiltonian",
            "n_qubits": len(custom_pauli_list[0][1]),
            "pauli_list": custom_pauli_list,
            "units": "",
        }
    if (
        encoding
        and hamiltonian_key in MOLECULAR_ENCODINGS
        and encoding in MOLECULAR_ENCODINGS[hamiltonian_key]
    ):
        enc_data = MOLECULAR_ENCODINGS[hamiltonian_key][encoding]
        enc_label = {"jw": "Jordan-Wigner", "bk": "Bravyi-Kitaev", "parity": "Parity"}[encoding]
        base = HAMILTONIANS[hamiltonian_key]
        return {
            "name": f"{base['name']} [{enc_label}]",
            "n_qubits": enc_data["n_qubits"],
            "pauli_list": enc_data["pauli_list"],
            "units": base.get("units", "Hartree"),
        }
    return HAMILTONIANS[hamiltonian_key]


def _connect(token: str) -> QiskitRuntimeService:
    """Open a runtime service. The caller MUST `del` the token after calling."""
    return QiskitRuntimeService(channel="ibm_quantum_platform", token=token)


def _pick_backend(service: QiskitRuntimeService, n_qubits: int, backend_name: Optional[str]):
    if backend_name:
        return service.backend(backend_name)
    # least_busy filter kwargs differ across runtime versions; try richest first.
    try:
        return service.least_busy(operational=True, simulator=False, min_num_qubits=n_qubits)
    except TypeError:
        # newer versions dropped simulator=
        return service.least_busy(operational=True, min_num_qubits=n_qubits)


def _normalize_status(job) -> str:
    """job.status() returns a string in new runtime, an enum in old. Return UPPER string."""
    s = job.status()
    return (s.name if hasattr(s, "name") else str(s)).upper()


def _extract_energy(result) -> float:
    """EstimatorV2 returns a PubResult whose data.evs may be a scalar or ndarray."""
    evs = result[0].data.evs
    arr = np.asarray(evs).reshape(-1)
    return float(arr[0])


# ──────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────

def submit_ibm_job(
    ibm_token: str,
    hamiltonian_key: str,
    ansatz_key: str,
    reps: int,
    max_iter: int,
    optimizer: str,
    init_strategy: str,
    seed: int,
    encoding: Optional[str] = None,
    custom_pauli_list: Optional[List[Tuple[float, str]]] = None,
    backend_name: Optional[str] = None,
) -> Dict[str, Any]:
    # Step 1 — classical VQE locally to find optimal parameters
    sim_result = run_vqe(
        hamiltonian_key, ansatz_key, reps, max_iter,
        optimizer, init_strategy, custom_pauli_list, seed, encoding,
    )
    optimal_params = sim_result["iterations"][-1]["params"]
    simulator_energy = sim_result["final_energy"]

    # Step 2 — build the bound ansatz
    # NOTE: no measure_all(). EstimatorV2 computes expectation values; adding
    # measurements would invalidate the circuit layout used by apply_layout.
    ham_config = _get_hamiltonian_config(hamiltonian_key, encoding, custom_pauli_list)
    n_qubits = ham_config["n_qubits"]
    hamiltonian = SparsePauliOp.from_list([(p, c) for c, p in ham_config["pauli_list"]])

    qc, params = build_ansatz(ansatz_key, n_qubits, reps)
    param_dict = {p: float(v) for p, v in zip(params, optimal_params)}
    bound_circuit = qc.assign_parameters(param_dict)

    # Step 3 — open service, pick backend
    service = _connect(ibm_token)
    del ibm_token  # drop the reference before any potentially-logging call

    backend = _pick_backend(service, n_qubits, backend_name)

    # Step 4 — transpile for that backend and map the observable to the layout
    pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
    isa_circuit = pm.run(bound_circuit)
    isa_hamiltonian = hamiltonian.apply_layout(isa_circuit.layout)

    # Step 5 — submit as a single job (mode=backend, no Session needed).
    # Running inside a `with Session(...)` block and then exiting would close
    # the session and can cancel the job on some plans.
    estimator = EstimatorV2(mode=backend)
    job = estimator.run([(isa_circuit, isa_hamiltonian)])

    return {
        "job_id": job.job_id(),
        "backend_name": getattr(backend, "name", str(backend)),
        "simulator_energy": simulator_energy,
        "hamiltonian_name": ham_config["name"],
        "ansatz_name": sim_result["ansatz_name"],
        "units": ham_config.get("units", ""),
        "n_qubits": n_qubits,
        "status": "submitted",
    }


def fetch_ibm_result(ibm_token: str, job_id: str) -> Dict[str, Any]:
    service = _connect(ibm_token)
    del ibm_token

    job = service.job(job_id)
    status = _normalize_status(job)

    if status in ("QUEUED", "RUNNING", "INITIALIZING", "VALIDATING"):
        return {
            "job_id": job_id,
            "status": status.lower(),
            "hardware_energy": None,
            "error": None,
        }

    if status in ("ERROR", "CANCELLED", "FAILED"):
        err_msg: Optional[str] = None
        try:
            if hasattr(job, "error_message"):
                err_msg = job.error_message()
        except Exception as e:
            err_msg = str(e)
        return {
            "job_id": job_id,
            "status": "error",
            "hardware_energy": None,
            "error": err_msg or status,
        }

    # DONE — try to extract the expectation value.
    try:
        result = job.result()
        hardware_energy = _extract_energy(result)
        return {
            "job_id": job_id,
            "status": "done",
            "hardware_energy": round(hardware_energy, 6),
            "error": None,
        }
    except Exception as e:
        return {
            "job_id": job_id,
            "status": "error",
            "hardware_energy": None,
            "error": f"Failed to parse result: {e}",
        }
