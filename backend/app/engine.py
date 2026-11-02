"""Motor de simulación: reloj, escenarios, replanificación y difusión SSE."""

from __future__ import annotations

import asyncio
import json
import copy
import time
from dataclasses import asdict

from .adapters import Dataset, get_source
from .domain import HORIZON_HOURS, N_SLOTS, SLOT_HOURS, SLOTS_PER_HOUR, STRATEGIES, Job, Problem, RegionSeries, Schedule, Task
from .scenarios import FAILURE_SLOTS, SCENARIO_IDS, SCENARIOS, surge_jobs, transform_job, transform_series
from .scheduler import schedule_first_region, schedule_green, schedule_immediate
from .scheduler import metrics
from .scheduler.cpsat import Objective
from .seed import KIND_LABEL

SECONDS_PER_SIM_HOUR = 3.75  # a 1x, 48 h simuladas = 3 minutos
TICK_S = 0.1
PLANNER_SOLVE_W = 65.0  # CPU a pleno durante cada optimización (estimado)
PLANNER_IDLE_W = 12.0  # servicio del planificador siempre encendido (estimado)


class Engine:
    def __init__(self, dataset: Dataset | None = None, time_limit_s: float = 4.0) -> None:
        self.dataset = dataset or get_source().load()
        self.time_limit_s = time_limit_s
        self.regions = self.dataset.regions
        self.base_series = self.dataset.series
        self.base_jobs = {j.id: j for j in self.dataset.jobs}
        self.objective: Objective = "co2"
        self.speed = 1
        self.paused = False
        self.replanning = False
        self.subscribers: set[asyncio.Queue] = set()
        self.version = 0
        self._lock = asyncio.Lock()
        self._initial_cache: dict[str, tuple] = {}
        self.reset_state()

    # ------------------------------------------------------------------ estado
    def reset_state(self) -> None:
        self.t = 0.0
        self.scenario = "base"
        self.series: dict[str, RegionSeries] = {rid: s.copy() for rid, s in self.base_series.items()}
        self.jobs: dict[str, Job] = dict(self.base_jobs)
        self.plans: dict[str, Schedule] = {s: Schedule(strategy=s) for s in STRATEGIES}
        self.remainders: dict[str, list[Task]] = {s: [] for s in STRATEGIES}
        self.replans: list[dict] = []
        self.events: list[dict] = []
        self.last_replan: dict | None = None
        self.failed_region: str | None = None
        cached = self._initial_cache.get(self.objective)
        if cached:  # el plan inicial es determinístico: no hace falta resolverlo de nuevo
            self.plans, self.replans, self.last_replan, self.events = copy.deepcopy(cached)
            self.version += 1
            return
        self._replan(0, "Plan inicial")
        self._initial_cache[self.objective] = copy.deepcopy((self.plans, self.replans, self.last_replan, self.events))

    @property
    def slot(self) -> int:
        return min(N_SLOTS - 1, int(self.t * SLOTS_PER_HOUR))

    def _started_any(self, now: int) -> set[str]:
        return {p.job_id for sched in self.plans.values() for p in sched.placements if p.start < now}

    def _log(self, kind: str, text: str) -> None:
        self.events.append({"t": round(self.t, 2), "kind": kind, "text": text})
        self.events = self.events[-40:]

    # ------------------------------------------------------------- escenarios
    def apply_scenario(self, scenario: str) -> None:
        if scenario not in SCENARIO_IDS:
            raise ValueError(f"Escenario desconocido: {scenario}")
        now = self.slot + (1 if self.t * SLOTS_PER_HOUR > self.slot else 0)
        now = min(now, N_SLOTS - 1)
        self.scenario = scenario
        self.failed_region = self._busiest_green_region(now) if scenario == "falla_region" else None

        # 1) Datos: el futuro se recalcula desde la base + el escenario nuevo.
        new = transform_series(scenario, self.base_series, now, self.failed_region or "cba")
        for rid, s in new.items():
            cur = self.series[rid]
            for attr in ("intensity", "tariff", "fixed_load_kw", "capacity_kw"):
                getattr(s, attr)[:now] = getattr(cur, attr)[:now]
        self.series = new

        # 2) Trabajos: los que ya arrancaron quedan como están.
        started = self._started_any(now)
        jobs: dict[str, Job] = {}
        for jid, job in self.base_jobs.items():
            jobs[jid] = self.jobs[jid] if jid in started else transform_job(scenario, job, now)
        for jid, job in self.jobs.items():
            if jid.startswith("OC-") and jid in started:
                jobs[jid] = job
        if scenario == "ola_calor":
            for job in surge_jobs(now):
                jobs.setdefault(job.id, job)
        self.jobs = jobs

        # 3) Falla: los trabajos en curso en la región caída se cortan y el
        #    remanente se replanifica (reanudación desde checkpoint).
        interrupted = 0
        failed = self.failed_region
        if failed:
            for strat, sched in self.plans.items():
                kept = []
                for p in sched.placements:
                    if p.region == failed and p.start < now < p.end:
                        kept.append(p.truncated(now))
                        self.remainders[strat].append(
                            Task(id=f"{p.task_id}·r", job_id=p.job_id, power_kw=p.power_kw, duration=p.end - now,
                                 earliest=now, deadline=self.jobs[p.job_id].deadline, home=p.home,
                                 allowed=self.jobs[p.job_id].allowed, data_gb=p.data_gb)
                        )
                        if strat == "verde":
                            interrupted += 1
                    else:
                        kept.append(p)
                sched.placements = kept

        title = next(s.title for s in SCENARIOS if s.id == scenario)
        extra = ""
        if failed:
            name = next(r.name for r in self.regions if r.id == failed)
            extra = f" · {name} fuera de servicio 10 h"
            if interrupted:
                extra += f", {interrupted} trabajo(s) reanudado(s) desde checkpoint"
        self._log("scenario", f"Escenario: {title}{extra}")
        self._replan(now, f"Escenario «{title}»")

    def _busiest_green_region(self, now: int) -> str:
        load = {r.id: 0.0 for r in self.regions}
        for p in self.plans["verde"].placements:
            overlap = min(p.end, now + FAILURE_SLOTS) - max(p.start, now)
            if overlap > 0:
                load[p.region] += overlap * p.power_kw
        return max(load, key=lambda rid: (load[rid], rid == "cba"))

    def set_objective(self, objective: Objective) -> None:
        self.objective = objective
        label = {"co2": "mínimo CO₂", "mixto": "CO₂ + costo", "costo": "mínimo costo"}[objective]
        self._log("objective", f"Objetivo del planificador: {label}")
        self._replan(self.slot + 1 if self.t > 0 else 0, f"Objetivo {label}")

    # --------------------------------------------------------- planificación
    def _replan(self, now: int, reason: str) -> None:
        prev_green = {p.task_id: p.region for p in self.plans["verde"].placements}
        for strat in STRATEGIES:
            sched = self.plans[strat]
            frozen = [p for p in sched.placements if p.start < now]
            frozen_ids = {p.task_id for p in frozen}
            tasks = [Task.from_job(j, now) for jid, j in self.jobs.items() if jid not in frozen_ids]
            tasks += [r for r in self.remainders[strat] if r.id not in frozen_ids]
            problem = Problem(regions=self.regions, series=self.series, tasks=tasks, now=now, committed=frozen)
            if strat == "verde":
                result = schedule_green(problem, self.objective, time_limit_s=self.time_limit_s)
            elif strat == "inmediato":
                result = schedule_immediate(problem)
            else:
                result = schedule_first_region(problem)
            result.placements = frozen + result.placements
            self.plans[strat] = result

        stats = self.plans["verde"].stats
        assert stats is not None
        moves = []
        for p in self.plans["verde"].placements:
            if p.start < now:
                continue
            origin = prev_green.get(p.task_id, p.home)
            if origin != p.region or (p.task_id not in prev_green and p.region != p.home):
                moves.append({"task_id": p.task_id, "job_id": p.job_id, "from": origin, "to": p.region})
        energy_wh = PLANNER_SOLVE_W * stats.wall_time_s / 3600
        amba = self.series["amba"].intensity[min(now, N_SLOTS - 1)]
        record = {
            "id": len(self.replans) + 1,
            "at_slot": now,
            "at_h": round(now * SLOT_HOURS, 2),
            "reason": reason,
            "status": stats.status,
            "wall_time_s": round(stats.wall_time_s, 3),
            "n_tasks": stats.n_tasks,
            "n_vars": stats.n_vars,
            "energy_wh": round(energy_wh, 4),
            "co2_g": round(energy_wh / 1000 * amba, 4),
            "moves": moves,
        }
        self.replans.append(record)
        self.last_replan = record
        self.version += 1
        self._log("replan", f"CP-SAT {stats.status.lower()} en {stats.wall_time_s:.2f} s · {len(moves)} movimiento(s)")

    # ------------------------------------------------------------ serializar
    def snapshot(self) -> dict:
        plans = {}
        for strat, sched in self.plans.items():
            m = metrics.compute(sched, self.jobs, self.regions, self.series)
            plans[strat] = {
                "placements": [asdict(p) for p in sched.placements],
                "unscheduled": sched.unscheduled,
                "stats": asdict(sched.stats) if sched.stats else None,
                "metrics": m,
            }
        imm = plans["inmediato"]["metrics"]
        green = plans["verde"]["metrics"]
        avoided = imm["emissions_kg"] - green["emissions_kg"]
        solve_wh = sum(r["energy_wh"] for r in self.replans)
        rigid = [j.id for j in self.jobs.values() if j.slack <= SLOTS_PER_HOUR or len(j.allowed) == 1]
        not_moved_deadline = [
            j.id for j in self.jobs.values()
            if j.slack <= SLOTS_PER_HOUR and len(j.allowed) != 1
        ]
        return {
            "version": self.version,
            "clock": self.clock(),
            "scenario": self.scenario,
            "failed_region": self.failed_region,
            "objective": self.objective,
            "scenarios": [asdict(s) for s in SCENARIOS],
            "horizon_h": HORIZON_HOURS,
            "slot_h": SLOT_HOURS,
            "n_slots": N_SLOTS,
            "seconds_per_sim_hour": SECONDS_PER_SIM_HOUR,
            "data_source": {
                "id": self.dataset.source_id,
                "label": self.dataset.source_label,
                "simulated": self.dataset.simulated,
                "notes": self.dataset.notes,
            },
            "regions": [asdict(r) for r in self.regions],
            "series": {rid: asdict(s) for rid, s in self.series.items()},
            "jobs": [
                {**asdict(j), "allowed": list(j.allowed), "slack": j.slack, "kind_label": KIND_LABEL.get(j.kind, j.kind)}
                for j in sorted(self.jobs.values(), key=lambda j: (j.arrival, j.id))
            ],
            "plans": plans,
            "summary": {
                "avoided_kg": round(avoided, 2),
                "reduction_pct": round(100 * avoided / imm["emissions_kg"], 1) if imm["emissions_kg"] else 0.0,
                "savings_usd": round(imm["cost_usd"] - green["cost_usd"], 2),
                "fixed_load_kg": metrics.fixed_load_emissions_kg(self.regions, self.series),
                **metrics.equivalences(avoided),
            },
            "planner": {
                "solve_w": PLANNER_SOLVE_W,
                "idle_w": PLANNER_IDLE_W,
                "solve_wh": round(solve_wh, 4),
                "idle_wh_horizon": round(PLANNER_IDLE_W * HORIZON_HOURS, 1),
                "replans": self.replans[-12:],
                "rigid_jobs": rigid,
                "not_moved_deadline": not_moved_deadline,
            },
            "last_replan": self.last_replan,
            "events": self.events[-12:],
        }

    def clock(self) -> dict:
        return {
            "t": round(self.t, 4),
            "speed": self.speed,
            "paused": self.paused,
            "replanning": self.replanning,
            "version": self.version,
            "server_time": time.time(),
        }

    # ---------------------------------------------------------- tiempo real
    async def broadcast(self, event: str, data: dict) -> None:
        payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        for q in list(self.subscribers):
            if q.qsize() > 50:  # cliente lento: descartamos ticks viejos
                continue
            q.put_nowait(payload)

    async def push_snapshot(self) -> None:
        await self.broadcast("snapshot", self.snapshot())

    async def run_locked(self, fn, *args) -> None:
        """Ejecuta una operación que replanifica fuera del event loop, con el
        reloj detenido mientras CP-SAT trabaja."""
        async with self._lock:
            self.replanning = True
            await self.broadcast("clock", self.clock())
            try:
                await asyncio.to_thread(fn, *args)
            finally:
                self.replanning = False
            await self.push_snapshot()

    async def loop(self) -> None:
        last = time.perf_counter()
        while True:
            await asyncio.sleep(TICK_S)
            now = time.perf_counter()
            dt = now - last
            last = now
            if not self.paused and not self.replanning:
                self.t += dt * self.speed / SECONDS_PER_SIM_HOUR
                if self.t >= HORIZON_HOURS:
                    await self.run_locked(self.reset_state)
                    continue
            await self.broadcast("clock", self.clock())
