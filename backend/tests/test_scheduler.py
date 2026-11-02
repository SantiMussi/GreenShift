"""El planificador nunca debe violar deadlines, capacidad ni paralelismo."""

from __future__ import annotations

import random
from collections import defaultdict

import pytest

from app.domain import N_SLOTS, Placement, Problem, Task
from app.engine import Engine
from app.scheduler import schedule_first_region, schedule_green, schedule_immediate
from app.scheduler.common import run_emissions_g
from app.seed import REGIONS, build_series

SCENARIOS = ["eolica", "falla_region", "ola_calor", "deadlines", "base"]


def check_feasible(problem: Problem, placements: list[Placement], enforce_deadlines: bool = True) -> None:
    tasks = {t.id: t for t in problem.tasks}
    seen: set[str] = set()
    load: dict[tuple[str, int], float] = defaultdict(float)
    count: dict[tuple[str, int], int] = defaultdict(int)
    for p in problem.committed:
        for t in range(p.start, p.end):
            load[(p.region, t)] += p.power_kw
            count[(p.region, t)] += 1
    for p in placements:
        assert p.task_id in tasks, f"tarea desconocida {p.task_id}"
        assert p.task_id not in seen, f"{p.task_id} planificada dos veces"
        seen.add(p.task_id)
        task = tasks[p.task_id]
        assert p.end - p.start == task.duration
        assert p.start >= max(task.earliest, problem.now), f"{p.task_id} arranca antes de llegar"
        assert p.end <= N_SLOTS
        if enforce_deadlines:
            assert p.end <= task.deadline, f"{p.task_id} termina en {p.end} > deadline {task.deadline}"
        if task.allowed:
            assert p.region in task.allowed
        for t in range(p.start, p.end):
            load[(p.region, t)] += p.power_kw
            count[(p.region, t)] += 1
    for r in problem.regions:
        s = problem.series[r.id]
        for t in range(N_SLOTS):
            new_load = sum(p.power_kw for p in placements if p.region == r.id and p.covers(t))
            if new_load == 0:
                continue
            assert s.capacity_kw[t] > 0, f"{r.id} caída en slot {t} pero tiene trabajos"
            assert load[(r.id, t)] + s.fixed_load_kw[t] <= s.capacity_kw[t] + 1e-6, f"capacidad excedida {r.id}@{t}"
            assert count[(r.id, t)] <= r.max_parallel, f"paralelismo excedido {r.id}@{t}"


def random_problem(seed: int, n_tasks: int = 18, tight: bool = False) -> Problem:
    rng = random.Random(seed)
    series = build_series(seed)
    tasks = []
    for i in range(n_tasks):
        dur = rng.randint(2, 10)
        arrival = rng.randint(0, N_SLOTS - dur - 1)
        slack = rng.randint(0, 3) if tight else rng.randint(0, 30)
        tasks.append(
            Task(
                id=f"T{i}", job_id=f"T{i}", power_kw=rng.choice([40, 80, 120, 180, 240]), duration=dur,
                earliest=arrival, deadline=min(N_SLOTS, arrival + dur + slack),
                home=rng.choice(["amba", "cba", "nqn"]),
                allowed=("amba",) if rng.random() < 0.1 else (),
            )
        )
    if rng.random() < 0.5:  # una región caída en una ventana al azar
        rid = rng.choice(["amba", "cba", "nqn"])
        a = rng.randint(0, N_SLOTS - 20)
        for t in range(a, a + 20):
            series[rid].capacity_kw[t] = 0
    return Problem(regions=REGIONS, series=series, tasks=tasks, now=rng.choice([0, 0, 10]))


@pytest.mark.parametrize("seed", range(12))
def test_green_never_violates_constraints(seed: int) -> None:
    problem = random_problem(seed, tight=seed % 3 == 0)
    sched = schedule_green(problem, time_limit_s=2)
    check_feasible(problem, sched.placements)
    planned = {p.task_id for p in sched.placements}
    assert planned | set(sched.unscheduled) == {t.id for t in problem.tasks}


@pytest.mark.parametrize("seed", range(6))
def test_baselines_respect_capacity(seed: int) -> None:
    problem = random_problem(seed)
    for fn in (schedule_immediate, schedule_first_region):
        # Los baselines pueden perder deadlines (esperan en cola) pero nunca exceder capacidad.
        check_feasible(problem, fn(problem).placements, enforce_deadlines=False)


def test_immediate_starts_at_arrival_when_there_is_room() -> None:
    series = build_series()
    task = Task(id="A", job_id="A", power_kw=50, duration=4, earliest=6, deadline=40, home="cba", allowed=())
    sched = schedule_immediate(Problem(regions=REGIONS, series=series, tasks=[task]))
    assert sched.placements[0].start == 6 and sched.placements[0].region == "cba"


def test_green_picks_cleaner_slot() -> None:
    series = build_series()
    task = Task(id="A", job_id="A", power_kw=100, duration=4, earliest=0, deadline=N_SLOTS, home="amba", allowed=())
    problem = Problem(regions=REGIONS, series=series, tasks=[task])
    green = schedule_green(problem).placements[0]
    imm = schedule_immediate(problem).placements[0]
    reg = {r.id: r for r in REGIONS}
    e_green = run_emissions_g(100, reg[green.region], series[green.region], green.start, green.end)
    e_imm = run_emissions_g(100, reg[imm.region], series[imm.region], imm.start, imm.end)
    assert e_green < e_imm


def test_infeasible_task_is_reported_not_forced() -> None:
    series = build_series()
    for rid in series:
        series[rid].capacity_kw = [0.0] * N_SLOTS
    task = Task(id="X", job_id="X", power_kw=50, duration=2, earliest=0, deadline=10, home="amba", allowed=())
    sched = schedule_green(Problem(regions=REGIONS, series=series, tasks=[task]))
    assert sched.placements == [] and sched.unscheduled == ["X"]


@pytest.fixture(scope="module")
def engine() -> Engine:
    return Engine(time_limit_s=2)


@pytest.mark.parametrize("t,scenario", list(zip([4.2, 13.7, 22.1, 30.4, 41.0], SCENARIOS)))
def test_engine_scenarios_keep_plan_feasible(engine: Engine, t: float, scenario: str) -> None:
    engine.t = t
    engine.apply_scenario(scenario)
    green = engine.plans["verde"]
    for p in green.placements:
        job = engine.jobs[p.job_id]
        assert p.end <= job.deadline or p.start < engine.slot, f"{p.task_id} pierde su deadline"
        assert p.start >= job.arrival
    # Capacidad total respetada en el plan completo (pasado + futuro).
    for r in engine.regions:
        s = engine.series[r.id]
        for t_ in range(N_SLOTS):
            running = [p for p in green.placements if p.region == r.id and p.covers(t_)]
            if running:
                assert s.capacity_kw[t_] > 0
                assert len(running) <= r.max_parallel
    if scenario == "falla_region":
        failed = engine.failed_region
        now = engine.slot
        assert not any(p.region == failed and p.covers(now + 1) for p in green.placements)
    snap = engine.snapshot()
    green_kg = snap["plans"]["verde"]["metrics"]["emissions_kg"]
    assert green_kg < snap["plans"]["inmediato"]["metrics"]["emissions_kg"]
