import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Tuple

from vqe_runner import run_vqe, HAMILTONIANS, ANSATZE
from ansatz_checker import check_ansatz, PROBLEM_PROFILES, ANSATZ_PROFILES

app = FastAPI(title="VQE Explorer API")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    # Add your GitHub Pages URL here, e.g.:
    # "https://yourusername.github.io",
]
if os.environ.get("FRONTEND_URL"):
    ALLOWED_ORIGINS.append(os.environ["FRONTEND_URL"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VQERequest(BaseModel):
    hamiltonian: str
    ansatz: str
    reps: int = Field(default=2, ge=1, le=4)
    max_iter: int = Field(default=80, ge=10, le=150)
    optimizer: str = Field(default="COBYLA")
    init_strategy: str = Field(default="random")
    seed: int = Field(default=42, ge=0, le=9999)
    custom_pauli_list: Optional[List[Tuple[float, str]]] = None


class AnsatzCheckRequest(BaseModel):
    problem: str
    ansatz: str
    n_qubits: int = Field(ge=2, le=8)
    reps: int = Field(default=2, ge=1, le=4)
    custom_description: Optional[str] = ""


@app.get("/api/hamiltonians")
def get_hamiltonians():
    return {
        k: {
            "name": v["name"],
            "description": v["description"],
            "n_qubits": v["n_qubits"],
            "category": v.get("category", ""),
        }
        for k, v in HAMILTONIANS.items()
    }


@app.get("/api/ansatze")
def get_ansatze():
    return {k: {"name": v["name"], "description": v["description"]} for k, v in ANSATZE.items()}


@app.get("/api/problems")
def get_problems():
    return {
        k: {"name": v["name"], "description": v["description"], "type": v["type"]}
        for k, v in PROBLEM_PROFILES.items()
        if k != "custom"
    }


@app.post("/api/vqe/run")
def vqe_run(req: VQERequest):
    if req.hamiltonian not in HAMILTONIANS and req.hamiltonian != "custom":
        raise HTTPException(400, f"Unknown hamiltonian: {req.hamiltonian}")
    if req.ansatz not in ANSATZE:
        raise HTTPException(400, f"Unknown ansatz: {req.ansatz}")
    if req.optimizer not in ("COBYLA", "Powell", "Nelder-Mead"):
        raise HTTPException(400, f"Unknown optimizer: {req.optimizer}")
    try:
        result = run_vqe(
            req.hamiltonian, req.ansatz, req.reps, req.max_iter,
            req.optimizer, req.init_strategy,
            req.custom_pauli_list, req.seed,
        )
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/ansatz/check")
def ansatz_check(req: AnsatzCheckRequest):
    if req.ansatz not in ANSATZ_PROFILES:
        raise HTTPException(400, f"Unknown ansatz: {req.ansatz}")
    try:
        result = check_ansatz(
            req.problem, req.ansatz, req.n_qubits, req.reps, req.custom_description or ""
        )
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
