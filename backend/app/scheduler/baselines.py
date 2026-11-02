"""Estrategias de referencia para comparar contra el planificador verde.

* ``inmediato``: cada trabajo arranca apenas llega, en su región de origen. Si
  no hay lugar, espera en cola (aunque eso lo haga perder el deadline).
* ``primera_region``: arranca lo antes posible en la primera región con lugar,
  recorriendo las regiones en orden fijo (AMBA → Córdoba → Neuquén).
"""

from __future__ import annotations

from ..domain import N_SLOTS, Placement, Problem, Schedule, SolveStats, StrategyId, Task
from .common import allowed_regions, residual_capacity


def _fits(cap: list[int], par: list[int], start: int, task: Task) -> bool:
    end = start + task.duration
    if end > N_SLOTS:
        return False
    return all(cap[t] >= task.power_kw and par[t] >= 1 for t in range(start, end))


def _book(cap: list[int], par: list[int], start: int, task: Task) -> None:
    for t in range(start, start + task.duration):
        cap[t] -= task.power_kw
        par[t] -= 1


def greedy(problem: Problem, strategy: StrategyId) -> Schedule:
    cap, par = residual_capacity(problem)
    sched = Schedule(strategy=strategy)
    order = sorted(problem.tasks, key=lambda t: (max(t.earliest, problem.now), t.deadline, t.id))
    for task in order:
        earliest = max(task.earliest, problem.now)
        if strategy == "inmediato":
            candidates = [task.home] if task.home in allowed_regions(task, problem) else allowed_regions(task, problem)[:1]
        else:
            candidates = allowed_regions(task, problem)
        best: tuple[int, str] | None = None
        for rid in candidates:
            for s in range(earliest, N_SLOTS - task.duration + 1):
                if _fits(cap[rid], par[rid], s, task):
                    if best is None or s < best[0]:
                        best = (s, rid)
                    break
        if best is None:
            sched.unscheduled.append(task.id)
            continue
        s, rid = best
        _book(cap[rid], par[rid], s, task)
        sched.placements.append(
            Placement(
                task_id=task.id,
                job_id=task.job_id,
                region=rid,
                start=s,
                end=s + task.duration,
                power_kw=task.power_kw,
                home=task.home,
                data_gb=task.data_gb,
            )
        )
    sched.stats = SolveStats(status="GREEDY", wall_time_s=0.0, n_tasks=len(problem.tasks))
    return sched


def schedule_immediate(problem: Problem) -> Schedule:
    return greedy(problem, "inmediato")


def schedule_first_region(problem: Problem) -> Schedule:
    return greedy(problem, "primera_region")
