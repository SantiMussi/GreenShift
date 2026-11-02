"""Cálculos compartidos: energía, emisiones, costo y capacidad residual."""

from __future__ import annotations

from ..domain import (
    N_SLOTS,
    SLOT_HOURS,
    TRANSFER_KWH_PER_GB,
    Placement,
    Problem,
    Region,
    RegionSeries,
    Task,
)


def slot_energy_kwh(power_kw: float, region: Region) -> float:
    return power_kw * region.pue * SLOT_HOURS


def transfer_kwh(data_gb: float) -> float:
    return data_gb * TRANSFER_KWH_PER_GB


def run_emissions_g(task_power: float, region: Region, series: RegionSeries, start: int, end: int) -> float:
    e = slot_energy_kwh(task_power, region)
    return sum(e * series.intensity[t] for t in range(start, min(end, N_SLOTS)))


def run_cost_usd(task_power: float, region: Region, series: RegionSeries, start: int, end: int) -> float:
    e = slot_energy_kwh(task_power, region)
    return sum(e * series.tariff[t] for t in range(start, min(end, N_SLOTS)))


def move_overhead_g(task: Task | Placement, region_id: str, home_series: RegionSeries, start: int) -> float:
    """Emisiones de mover los datos de la región de origen a la de ejecución."""
    if region_id == task.home:
        return 0.0
    return transfer_kwh(task.data_gb) * home_series.intensity[min(start, N_SLOTS - 1)]


def residual_capacity(problem: Problem) -> tuple[dict[str, list[int]], dict[str, list[int]]]:
    """Capacidad (kW) y lugares paralelos libres por región y slot, una vez
    descontadas las cargas fijas y lo ya comprometido."""
    cap: dict[str, list[int]] = {}
    par: dict[str, list[int]] = {}
    for r in problem.regions:
        s = problem.series[r.id]
        cap[r.id] = [
            max(0, int(s.capacity_kw[t] - s.fixed_load_kw[t])) if s.capacity_kw[t] > 0 else 0
            for t in range(N_SLOTS)
        ]
        par[r.id] = [r.max_parallel if s.capacity_kw[t] > 0 else 0 for t in range(N_SLOTS)]
    for p in problem.committed:
        for t in range(max(p.start, 0), min(p.end, N_SLOTS)):
            cap[p.region][t] -= p.power_kw
            par[p.region][t] -= 1
    return cap, par


def allowed_regions(task: Task, problem: Problem) -> list[str]:
    ids = [r.id for r in problem.regions]
    return [rid for rid in ids if not task.allowed or rid in task.allowed]
