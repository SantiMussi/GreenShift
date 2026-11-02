from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from ..domain import Job, Region, RegionSeries


@dataclass
class Dataset:
    regions: list[Region]
    series: dict[str, RegionSeries]
    jobs: list[Job]
    source_id: str
    source_label: str
    simulated: bool = True
    notes: list[str] = field(default_factory=list)


class CarbonDataSource(Protocol):
    """Contrato de cualquier proveedor de intensidad de carbono."""

    id: str

    def load(self) -> Dataset: ...
