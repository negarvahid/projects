"""
IBM Quantum runner for VQE.

Security contract:
  - ibm_token is NEVER logged, stored, or returned in any response.
  - QiskitRuntimeService is always created with save=False so credentials
    are never written to disk on the server.
  - The token variable is deleted immediately after the service is created.
"""

import logging
from typing import Optional, List, Tuple, Dict, Any

from qiskit.quantum_info import SparsePauliOp
from qiskit_ibm_runtime import QiskitRuntimeService, EstimatorV2, Session

from vqe_runner import (
    run_vqe, build_ansatz, HAMILTONIANS, MOLECULAR_ENCODINGS
)

logger = logging.getLogger(__name__)

# Never log at a level that would capture request bodies.
# Explicitly suppress ibm-runtime's own loggers too.
logging.getLogger("qiskit_ibm_runtime").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)


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
    if encoding and hamiltonian_key in MOLECULAR_ENCODINGS and encoding in MOLECULAR_ENCODINGS[hamiltonian_key]:
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
    """
    1. Run classical VQE to find optimal parameters.
    2. Transpile the bound circuit.
    3. Submit one Estimator job to IBM Quantum with those parameters.
    Returns job_id and metadata. Does NOT return or log the token.
    """

    # Step 1 — classical VQE to get optimal params
    sim_result = run_vqe(
        hamiltonian_key, ansatz_key, reps, max_iter,
        optimizer, init_strategy, custom_pauli_list, seed, encoding,
    )
    optimal_params = sim_result["iterations"][-1]["params"]
    simulator_energy = sim_result["final_energy"]

    # Step 2 — build bound circuit
    ham_config = _get_hamiltonian_config(hamiltonian_key, encoding, custom_pauli_list)
    n_qubits = ham_config["n_qubits"]
    hamiltonian = SparsePauliOp.from_list([(p, c) for c, p in ham_config["pauli_list"]])

    qc, params = build_ansatz(ansatz_key, n_qubits, reps)
    param_dict = {p: float(v) for p, v in zip(params, optimal_params)}
    bound_circuit = qc.assign_parameters(param_dict)
    bound_circuit.measure_all()

    # Step 3 — connect to IBM (save=False: never write to disk)
    service = QiskitRuntimeService(
        channel="ibm_quantum",
        token=ibm_token,
        save=False,
    )
    del ibm_token  # drop reference immediately

    if backend_name:
        backend = service.backend(backend_name)
    else:
        backend = service.least_busy(
            operational=True,
            simulator=False,
            min_num_qubits=n_qubits,
        )

    # Transpile for the target backend
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
    isa_circuit = pm.run(bound_circuit)
    isa_hamiltonian = hamiltonian.apply_layout(isa_circuit.layout)

    # Step 4 — submit Estimator job (non-blocking)
    with Session(backend=backend) as session:
        estimator = EstimatorV2(session=session)
        job = estimator.run([(isa_circuit, isa_hamiltonian)])

    return {
        "job_id": job.job_id(),
        "backend_name": backend.name,
        "simulator_energy": simulator_energy,
        "hamiltonian_name": ham_config["name"],
        "ansatz_name": sim_result["ansatz_name"],
        "units": ham_config.get("units", ""),
        "n_qubits": n_qubits,
        "status": "submitted",
    }


def fetch_ibm_result(ibm_token: str, job_id: str) -> Dict[str, Any]:
    """
    Fetch the result of a previously submitted IBM job.
    Token is never logged or stored.
    """
    service = QiskitRuntimeService(
        channel="ibm_quantum",
        token=ibm_token,
        save=False,
    )
    del ibm_token

    job = service.job(job_id)
    status = job.status()

    if status.name in ("QUEUED", "RUNNING", "INITIALIZING"):
        return {
            "job_id": job_id,
            "status": status.name.lower(),
            "hardware_energy": None,
            "error": None,
        }

    if status.name == "ERROR":
        return {
            "job_id": job_id,
            "status": "error",
            "hardware_energy": None,
            "error": str(job.error_message()),
        }

    # DONE
    result = job.result()
    hardware_energy = float(result[0].data.evs)

    return {
        "job_id": job_id,
        "status": "done",
        "hardware_energy": round(hardware_energy, 6),
        "error": None,
    }
