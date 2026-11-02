"""Adaptador para datos de despacho al estilo CAMMESA (archivo CSV local).

Formato esperado (``backend/data/cammesa/despacho.csv``), una fila por hora,
región y tecnología::

    hora,region,tecnologia,mwh
    0,amba,ciclo_combinado,812.5
    0,amba,eolica,0
    ...

``hora`` va de 0 a 47 (horizonte de la demo); ``region`` es amba|cba|nqn.
La intensidad horaria se calcula como Σ(MWh·factor) / Σ MWh con los factores
de emisión de abajo (ilustrativos, revisar contra fuentes oficiales antes de
cualquier uso real). Tarifas, cargas y trabajos siguen saliendo del snapshot.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from ..domain import N_SLOTS, SLOTS_PER_HOUR
from .base import CarbonDataSource, Dataset

# g CO2 / kWh por tecnología (valores típicos de literatura, ilustrativos).
EMISSION_FACTORS = {
    "ciclo_combinado": 380,
    "turbina_gas": 560,
    "turbina_vapor": 720,
    "diesel": 780,
    "carbon": 950,
    "hidraulica": 0,
    "nuclear": 0,
    "eolica": 0,
    "solar": 0,
    "biomasa": 50,
}

DEFAULT_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "cammesa" / "despacho.csv"


class CammesaCsvSource:
    id = "cammesa_csv"

    def __init__(self, fallback: CarbonDataSource, path: Path | None = None) -> None:
        self.fallback = fallback
        self.path = path or DEFAULT_PATH

    def _intensity_by_region(self) -> dict[str, list[float]]:
        emis: dict[tuple[str, int], float] = defaultdict(float)
        energy: dict[tuple[str, int], float] = defaultdict(float)
        with self.path.open(newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                key = (row["region"].strip().lower(), int(row["hora"]))
                mwh = float(row["mwh"])
                factor = EMISSION_FACTORS[row["tecnologia"].strip().lower()]
                emis[key] += mwh * factor
                energy[key] += mwh
        out: dict[str, list[float]] = {}
        for region in {k[0] for k in energy}:
            hourly = [emis[(region, h)] / energy[(region, h)] if energy[(region, h)] else 0.0 for h in range(48)]
            out[region] = [round(hourly[s // SLOTS_PER_HOUR], 1) for s in range(N_SLOTS)]
        return out

    def load(self) -> Dataset:
        base = self.fallback.load()
        try:
            intensities = self._intensity_by_region()
        except (OSError, KeyError, ValueError, ZeroDivisionError) as exc:
            base.notes.append(f"No se pudo leer el despacho CAMMESA ({exc}); se usa el snapshot local.")
            return base
        for rid, values in intensities.items():
            if rid in base.series:
                base.series[rid].intensity = values
        base.source_id = self.id
        base.source_label = f"Despacho estilo CAMMESA desde {self.path.name} (local)"
        base.simulated = False
        base.notes.append("Intensidad calculada desde despacho local; tarifas y cargas siguen siendo simuladas.")
        return base
