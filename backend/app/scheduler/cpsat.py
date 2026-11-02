"""Planificador verde con Google OR-Tools CP-SAT.

Formulación (por cada tarea *j*, región permitida *r* y slot de inicio *s*
dentro de su ventana ``[earliest, deadline - duración]``):

    x[j,r,s] ∈ {0,1}        la tarea j arranca en s en la región r
    skip[j]  ∈ {0,1}        la tarea no entra en el horizonte (se reporta)

    Σ_{r,s} x[j,r,s] + skip[j] = 1                              (una sola vez)
    Σ_{j,s: s ≤ t < s+d_j} P_j · x[j,r,s] ≤ Cap_r(t) − Fija_r(t)  (capacidad kW)
    Σ_{j,s: s ≤ t < s+d_j}       x[j,r,s] ≤ MaxPar_r(t)          (paralelismo)

    min Σ c[j,r,s] · x[j,r,s] + M · Σ skip[j]

con c = α·CO₂/CO₂_ref + (1−α)·Costo/Costo_ref (escalado a entero) más un
término mínimo de demora y de migración para desempatar. Los deadlines se
cumplen por construcción: sólo existen variables para inicios válidos.
"""

from __future__ import annotations

import time
from typing import Literal

from ortools.sat.python import cp_model

from ..domain import N_SLOTS, Placement, Problem, Schedule, SolveStats
from .common import (
    allowed_regions,
    move_overhead_g,
    residual_capacity,
    run_cost_usd,
    run_emissions_g,
)

Objective = Literal["co2", "mixto", "costo"]

ALPHA: dict[str, float] = {"co2": 0.97, "mixto": 0.5, "costo": 0.03}
SCALE = 1_000_000
SKIP_PENALTY = 10**10
MOVE_PENALTY = 40  # preferir no mover datos si la ganancia es marginal
DELAY_PENALTY = 1


def schedule_green(
    problem: Problem,
    objective: Objective = "co2",
    time_limit_s: float = 4.0,
    workers: int = 8,
) -> Schedule:
    t0 = time.perf_counter()
    alpha = ALPHA[objective]
    cap, par = residual_capacity(problem)
    regions = {r.id: r for r in problem.regions}

    # Referencias para normalizar CO₂ y costo (correr cada tarea en origen ya).
    e_ref = 0.0
    c_ref = 0.0
    for task in problem.tasks:
        s = max(task.earliest, problem.now)
        reg = regions[task.home]
        e_ref += run_emissions_g(task.power_kw, reg, problem.series[task.home], s, s + task.duration)
        c_ref += run_cost_usd(task.power_kw, reg, problem.series[task.home], s, s + task.duration)
    e_ref = max(e_ref, 1.0)
    c_ref = max(c_ref, 1e-6)

    model = cp_model.CpModel()
    x: dict[tuple[str, str, int], cp_model.IntVar] = {}
    skip: dict[str, cp_model.IntVar] = {}
    coverage: dict[tuple[str, int], list[tuple[cp_model.IntVar, int]]] = {}
    obj_terms: list[tuple[cp_model.IntVar, int]] = []

    for task in problem.tasks:
        earliest = max(task.earliest, problem.now)
        latest = min(task.deadline, N_SLOTS) - task.duration
        choices: list[cp_model.IntVar] = []
        for rid in allowed_regions(task, problem):
            reg = regions[rid]
            series = problem.series[rid]
            for s in range(earliest, latest + 1):
                # Descartar de antemano inicios imposibles (región caída o sin lugar).
                if any(cap[rid][t] < task.power_kw or par[rid][t] < 1 for t in range(s, s + task.duration)):
                    continue
                v = model.NewBoolVar(f"x_{task.id}_{rid}_{s}")
                x[(task.id, rid, s)] = v
                choices.append(v)
                emis = run_emissions_g(task.power_kw, reg, series, s, s + task.duration)
                emis += move_overhead_g(task, rid, problem.series[task.home], s)
                cost = run_cost_usd(task.power_kw, reg, series, s, s + task.duration)
                score = alpha * emis / e_ref + (1 - alpha) * cost / c_ref
                coef = int(round(score * SCALE)) + DELAY_PENALTY * (s - earliest)
                if rid != task.home:
                    coef += MOVE_PENALTY
                obj_terms.append((v, coef))
                for t in range(s, s + task.duration):
                    coverage.setdefault((rid, t), []).append((v, task.power_kw))
        sk = model.NewBoolVar(f"skip_{task.id}")
        skip[task.id] = sk
        model.AddExactlyOne(choices + [sk])
        obj_terms.append((sk, SKIP_PENALTY))

    for (rid, t), items in coverage.items():
        if sum(p for _, p in items) > cap[rid][t]:
            model.Add(sum(p * v for v, p in items) <= max(0, cap[rid][t]))
        if len(items) > par[rid][t]:
            model.Add(sum(v for v, _ in items) <= max(0, par[rid][t]))

    model.Minimize(sum(c * v for v, c in obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_workers = workers
    solver.parameters.random_seed = 7
    status = solver.Solve(model)

    sched = Schedule(strategy="verde")
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        by_task = {t.id: t for t in problem.tasks}
        for (tid, rid, s), v in x.items():
            if solver.BooleanValue(v):
                task = by_task[tid]
                sched.placements.append(
                    Placement(
                        task_id=tid,
                        job_id=task.job_id,
                        region=rid,
                        start=s,
                        end=s + task.duration,
                        power_kw=task.power_kw,
                        home=task.home,
                        data_gb=task.data_gb,
                    )
                )
        sched.unscheduled = [tid for tid, v in skip.items() if solver.BooleanValue(v)]
        obj = solver.ObjectiveValue()
    else:  # pragma: no cover - el modelo siempre es factible gracias a skip
        sched.unscheduled = [t.id for t in problem.tasks]
        obj = 0.0

    sched.stats = SolveStats(
        status=solver.StatusName(status),
        wall_time_s=time.perf_counter() - t0,
        n_tasks=len(problem.tasks),
        n_vars=len(x) + len(skip),
        objective=obj,
    )
    return sched
