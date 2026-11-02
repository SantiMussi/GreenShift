"""Escenarios en vivo. Cada uno transforma los datos *desde el slot actual en
adelante*; el pasado queda congelado tal como ocurrió."""

from __future__ import annotations

from dataclasses import dataclass, replace

from .domain import N_SLOTS, SLOTS_PER_HOUR, Job, RegionSeries
from .seed import SURGE_TEMPLATES

FAILURE_SLOTS = 10 * SLOTS_PER_HOUR


@dataclass(frozen=True)
class Scenario:
    id: str
    key: str
    title: str
    subtitle: str


SCENARIOS: list[Scenario] = [
    Scenario("base", "0", "Operación normal", "Perfiles base del día"),
    Scenario("ola_calor", "1", "Ola de calor y pico de demanda",
             "Más térmica en AMBA y Córdoba, tarifas pico, +35 % de tráfico y 3 trabajos urgentes"),
    Scenario("falla_region", "2", "Falla de una región",
             "La región con más carga planificada cae 10 h: failover de la API y reanudación desde checkpoint"),
    Scenario("eolica", "3", "Semana con mucha eólica",
             "Frente de viento patagónico: baja fuerte la intensidad en Neuquén, sobre todo de noche"),
    Scenario("deadlines", "4", "Deadlines ajustados",
             "Negocio pide resultados antes: la holgura de los trabajos cae al 25 %"),
]
SCENARIO_IDS = {s.id for s in SCENARIOS}


def _hod(slot: int) -> float:
    return (slot / SLOTS_PER_HOUR) % 24


def transform_series(
    scenario: str, base: dict[str, RegionSeries], start: int, failed: str = "cba"
) -> dict[str, RegionSeries]:
    """Devuelve series nuevas: iguales a ``base`` antes de ``start`` no se tocan
    (el llamador conserva el pasado) y transformadas desde ``start``."""
    out = {rid: s.copy() for rid, s in base.items()}
    for t in range(start, N_SLOTS):
        h = _hod(t)
        if scenario == "ola_calor":
            peak = 1.0 if 13 <= h < 23 else 0.0
            for rid in ("amba", "cba"):
                out[rid].intensity[t] = round(base[rid].intensity[t] * (1.12 + 0.14 * peak), 1)
            out["nqn"].intensity[t] = round(base["nqn"].intensity[t] * 1.04, 1)
            for rid, s in out.items():
                s.tariff[t] = round(base[rid].tariff[t] * (1.55 if 18 <= h < 23 else 1.25), 4)
                s.fixed_load_kw[t] = round(base[rid].fixed_load_kw[t] * (1.35 if 10 <= h < 23 else 1.15), 1)
            out["amba"].capacity_kw[t] = base["amba"].capacity_kw[t] * 0.92  # enfriamiento al límite
        elif scenario == "falla_region":
            if t < start + FAILURE_SLOTS:
                # La API y el checkout de la región caída hacen failover a las otras dos.
                moved = out[failed].fixed_load_kw[t]
                others = [rid for rid in out if rid != failed]
                for rid, share in zip(others, (0.65, 0.35)):
                    out[rid].fixed_load_kw[t] = round(out[rid].fixed_load_kw[t] + share * moved, 1)
                out[failed].fixed_load_kw[t] = 0.0
                out[failed].capacity_kw[t] = 0.0
        elif scenario == "eolica":
            night = h < 7 or h >= 20
            out["nqn"].intensity[t] = round(base["nqn"].intensity[t] * (0.55 if night else 0.74), 1)
            out["cba"].intensity[t] = round(base["cba"].intensity[t] * 0.86, 1)
            out["amba"].intensity[t] = round(base["amba"].intensity[t] * 0.91, 1)
    return out


def transform_job(scenario: str, job: Job, now: int) -> Job:
    if scenario != "deadlines":
        return job
    start = max(job.arrival, now)
    tight = start + job.duration + max(0, int(job.slack * 0.25))
    return replace(job, deadline=min(job.deadline, tight))


def surge_jobs(now: int) -> list[Job]:
    jobs = []
    for i, (name, kind, kw, dur_h, slack_h, home, gb) in enumerate(SURGE_TEMPLATES, 1):
        arrival = now + i
        duration = int(dur_h * SLOTS_PER_HOUR)
        if arrival + duration > N_SLOTS:
            continue
        deadline = min(N_SLOTS, arrival + duration + int(slack_h * SLOTS_PER_HOUR))
        jobs.append(Job(id=f"OC-{i:02d}", name=name, kind=kind, power_kw=kw, duration=duration,
                        arrival=arrival, deadline=deadline, home=home, data_gb=gb))
    return jobs
