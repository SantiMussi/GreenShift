"""Indicadores por estrategia (ambientales, económicos y de servicio)."""

from __future__ import annotations

from collections import defaultdict

from ..domain import N_SLOTS, SLOT_HOURS, Job, Region, RegionSeries, Schedule
from .common import move_overhead_g, slot_energy_kwh, transfer_kwh

# Equivalencias aproximadas (ilustrativas, ver README).
KG_CO2_PER_KM_CAR = 0.12  # auto mediano a nafta
KG_CO2_PER_TREE_YEAR = 21.0  # árbol adulto, absorción anual promedio


def compute(
    sched: Schedule,
    jobs: dict[str, Job],
    regions: list[Region],
    series: dict[str, RegionSeries],
) -> dict:
    reg = {r.id: r for r in regions}
    emis_slot = [0.0] * N_SLOTS  # g
    load = {r.id: [0.0] * N_SLOTS for r in regions}  # kW de trabajos flexibles
    emis_rate = {r.id: [0.0] * N_SLOTS for r in regions}  # kg/h
    energy = 0.0
    cost = 0.0
    transfer_g = 0.0

    for p in sched.placements:
        r = reg[p.region]
        s = series[p.region]
        e = slot_energy_kwh(p.power_kw, r)
        for t in range(p.start, min(p.end, N_SLOTS)):
            g = e * s.intensity[t]
            emis_slot[t] += g
            load[p.region][t] += p.power_kw
            emis_rate[p.region][t] += g / 1000 / SLOT_HOURS
            energy += e
            cost += e * s.tariff[t]
        if not p.task_id.endswith("·r"):
            ov = move_overhead_g(p, p.region, series[p.home], p.start)
            if ov:
                transfer_g += ov
                energy += transfer_kwh(p.data_gb)
                emis_slot[min(p.start, N_SLOTS - 1)] += ov

    cum = [0.0]
    for g in emis_slot:
        cum.append(cum[-1] + g / 1000)

    by_job: dict[str, list] = defaultdict(list)
    for p in sched.placements:
        by_job[p.job_id].append(p)
    unscheduled_jobs = {tid.split("·")[0] for tid in sched.unscheduled}

    met = 0
    delays: list[float] = []
    moved_lat: list[int] = []
    moved = 0
    for jid, job in jobs.items():
        segs = sorted(by_job.get(jid, []), key=lambda p: p.start)
        if jid in unscheduled_jobs or not segs:
            continue
        if segs[-1].end <= job.deadline:
            met += 1
        delays.append((segs[0].start - job.arrival) * SLOT_HOURS)
        if any(p.region != job.home for p in segs):
            moved += 1
            far = max(segs, key=lambda p: abs(reg[p.region].latency_ms_from_amba - reg[job.home].latency_ms_from_amba))
            moved_lat.append(abs(reg[far.region].latency_ms_from_amba - reg[job.home].latency_ms_from_amba))

    n = max(len(jobs), 1)
    return {
        "emissions_kg": round(cum[-1], 2),
        "transfer_kg": round(transfer_g / 1000, 2),
        "energy_kwh": round(energy, 1),
        "cost_usd": round(cost, 2),
        "deadlines_met": met,
        "deadlines_total": len(jobs),
        "deadlines_pct": round(100 * met / n, 1),
        "unscheduled": len(unscheduled_jobs),
        "avg_delay_h": round(sum(delays) / len(delays), 2) if delays else 0.0,
        "moved_jobs": moved,
        "avg_latency_ms": round(sum(moved_lat) / len(moved_lat), 1) if moved_lat else 0.0,
        "cum_kg": [round(v, 3) for v in cum],
        "region_load_kw": {k: [round(v, 1) for v in vals] for k, vals in load.items()},
        "region_emis_kg_h": {k: [round(v, 2) for v in vals] for k, vals in emis_rate.items()},
    }


def fixed_load_emissions_kg(regions: list[Region], series: dict[str, RegionSeries]) -> float:
    total = 0.0
    for r in regions:
        s = series[r.id]
        for t in range(N_SLOTS):
            total += slot_energy_kwh(s.fixed_load_kw[t], r) * s.intensity[t]
    return round(total / 1000, 1)


def equivalences(avoided_kg: float) -> dict:
    return {
        "car_km": round(avoided_kg / KG_CO2_PER_KM_CAR),
        "trees_year": round(avoided_kg / KG_CO2_PER_TREE_YEAR, 1),
    }
