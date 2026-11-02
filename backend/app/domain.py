"""Modelo de dominio de GreenShift.

El tiempo se discretiza en *slots* de 30 minutos sobre un horizonte de 48 h
(96 slots). Todas las series (intensidad, tarifa, carga fija, capacidad) están
indexadas por slot.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Literal

SLOT_MINUTES = 30
SLOTS_PER_HOUR = 60 // SLOT_MINUTES
HORIZON_HOURS = 48
N_SLOTS = HORIZON_HOURS * SLOTS_PER_HOUR
SLOT_HOURS = SLOT_MINUTES / 60

StrategyId = Literal["inmediato", "primera_region", "verde"]
STRATEGIES: tuple[StrategyId, ...] = ("inmediato", "primera_region", "verde")


@dataclass(frozen=True)
class Region:
    id: str
    name: str
    short: str
    lat: float
    lon: float
    capacity_kw: int
    max_parallel: int
    pue: float
    # Latencia de red (ms) desde AMBA, donde vive el grueso de los datos.
    latency_ms_from_amba: int
    mix_note: str


@dataclass
class RegionSeries:
    """Series temporales por slot para una región."""

    intensity: list[float]  # g CO2 / kWh
    tariff: list[float]  # USD / kWh
    fixed_load_kw: list[float]  # API de producción + checkout (no movibles)
    capacity_kw: list[float]  # capacidad total disponible (0 = región caída)

    def copy(self) -> "RegionSeries":
        return RegionSeries(
            list(self.intensity), list(self.tariff), list(self.fixed_load_kw), list(self.capacity_kw)
        )


@dataclass(frozen=True)
class Job:
    """Trabajo batch flexible tal como lo carga el equipo de la empresa."""

    id: str
    name: str
    kind: str
    power_kw: int
    duration: int  # slots
    arrival: int  # slot
    deadline: int  # slot (el trabajo debe terminar en o antes de este slot)
    home: str  # región donde están los datos
    data_gb: int = 50
    allowed: tuple[str, ...] = ()  # vacío = cualquier región

    @property
    def slack(self) -> int:
        return self.deadline - self.arrival - self.duration


@dataclass(frozen=True)
class Task:
    """Unidad que el planificador ubica. Normalmente 1 Task = 1 Job; si una
    región falla a mitad de un trabajo, el remanente se convierte en otra Task
    (reanudación desde checkpoint)."""

    id: str
    job_id: str
    power_kw: int
    duration: int
    earliest: int
    deadline: int
    home: str
    allowed: tuple[str, ...]
    data_gb: int = 50

    @staticmethod
    def from_job(job: Job, earliest: int | None = None) -> "Task":
        return Task(
            id=job.id,
            job_id=job.id,
            power_kw=job.power_kw,
            duration=job.duration,
            earliest=max(job.arrival, earliest or 0),
            deadline=job.deadline,
            home=job.home,
            allowed=job.allowed,
            data_gb=job.data_gb,
        )


@dataclass(frozen=True)
class Placement:
    task_id: str
    job_id: str
    region: str
    start: int
    end: int  # exclusivo
    power_kw: int
    home: str
    data_gb: int = 50
    interrupted: bool = False  # segmento cortado por una falla de región

    def covers(self, slot: int) -> bool:
        return self.start <= slot < self.end

    def truncated(self, end: int) -> "Placement":
        return replace(self, end=end, interrupted=True)


@dataclass
class SolveStats:
    status: str
    wall_time_s: float
    n_tasks: int
    n_vars: int = 0
    objective: float = 0.0


@dataclass
class Schedule:
    strategy: StrategyId
    placements: list[Placement] = field(default_factory=list)
    unscheduled: list[str] = field(default_factory=list)  # task ids
    stats: SolveStats | None = None


@dataclass
class Problem:
    regions: list[Region]
    series: dict[str, RegionSeries]
    tasks: list[Task]
    now: int = 0
    # Ocupación ya comprometida (trabajos en curso o terminados).
    committed: list[Placement] = field(default_factory=list)

    def region(self, rid: str) -> Region:
        return next(r for r in self.regions if r.id == rid)


# Factores de energía de transferencia de datos (ilustrativo).
TRANSFER_KWH_PER_GB = 0.02
