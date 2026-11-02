"""Generación determinística del dataset de demo de Nubeo.

TODOS los valores son ILUSTRATIVOS: tienen forma realista (Patagonia con más
eólica nocturna, AMBA con pico de demanda a la noche, Córdoba intermedio con
aporte solar al mediodía) pero no son mediciones reales.
"""

from __future__ import annotations

import math
import random

from .domain import N_SLOTS, SLOTS_PER_HOUR, Job, Region, RegionSeries

REGIONS: list[Region] = [
    Region(
        id="amba",
        name="Buenos Aires (AMBA)",
        short="AMBA",
        lat=-34.60,
        lon=-58.38,
        capacity_kw=1400,
        max_parallel=6,
        pue=1.45,
        latency_ms_from_amba=0,
        mix_note="Térmica a gas dominante; pico de demanda residencial a la noche.",
    ),
    Region(
        id="cba",
        name="Córdoba",
        short="CBA",
        lat=-31.42,
        lon=-64.18,
        capacity_kw=900,
        max_parallel=5,
        pue=1.35,
        latency_ms_from_amba=14,
        mix_note="Mix intermedio: térmica, hidro y aporte solar del centro-cuyo al mediodía.",
    ),
    Region(
        id="nqn",
        name="Neuquén",
        short="NQN",
        lat=-38.95,
        lon=-68.06,
        capacity_kw=420,
        max_parallel=2,
        pue=1.18,
        latency_ms_from_amba=22,
        mix_note="Hidro del Comahue y eólica patagónica, más fuerte de noche.",
    ),
]

# Perfiles base horarios (g CO2/kWh), 00 h a 23 h.
_INTENSITY_SHAPE = {
    "amba": [352, 342, 334, 330, 331, 338, 352, 370, 384, 389, 385, 377,
             373, 370, 374, 382, 394, 408, 428, 446, 452, 441, 414, 382],
    "cba": [318, 312, 306, 303, 305, 312, 320, 316, 296, 276, 258, 246,
            240, 238, 244, 262, 290, 326, 356, 372, 375, 362, 340, 326],
    "nqn": [236, 226, 220, 218, 222, 232, 250, 268, 282, 290, 294, 296,
            298, 296, 292, 288, 284, 278, 270, 262, 254, 248, 242, 238],
}

# Tarifa horaria por bandas (USD/kWh): valle 0-6, resto, pico 18-23.
_TARIFF = {
    "amba": (0.062, 0.078, 0.118),
    "cba": (0.058, 0.072, 0.105),
    "nqn": (0.055, 0.069, 0.098),
}

# Carga fija (API de producción + checkout) base en kW.
_FIXED_BASE = {"amba": 420, "cba": 230, "nqn": 120}


def _ecommerce_shape(h: float) -> float:
    """Tráfico de e-commerce: valle de madrugada, picos al mediodía y a la noche."""
    base = 0.55
    noon = 0.30 * math.exp(-((h - 13) ** 2) / 8)
    night = 0.45 * math.exp(-((h - 21) ** 2) / 6)
    return base + noon + night


def _interp_hourly(values: list[float], slot: int) -> float:
    h = slot / SLOTS_PER_HOUR
    i = int(h) % 24
    j = (i + 1) % 24
    f = h - int(h)
    return values[i] * (1 - f) + values[j] * f


def build_series(seed: int = 2026) -> dict[str, RegionSeries]:
    rng = random.Random(seed)
    out: dict[str, RegionSeries] = {}
    for r in REGIONS:
        intensity, tariff, fixed, cap = [], [], [], []
        for s in range(N_SLOTS):
            h = s / SLOTS_PER_HOUR
            day = int(h // 24)
            hod = h % 24
            base = _interp_hourly(_INTENSITY_SHAPE[r.id], s)
            # Variación día a día: el segundo día entra un frente con más viento al sur.
            if r.id == "nqn" and day == 1:
                base *= 0.88 if (hod < 7 or hod > 20) else 0.97
            if r.id == "amba" and day == 1:
                base *= 1.03
            noise = 1 + rng.uniform(-0.025, 0.025)
            intensity.append(round(base * noise, 1))

            valle, resto, pico = _TARIFF[r.id]
            tariff.append(pico if 18 <= hod < 23 else valle if hod < 6 else resto)

            fixed.append(round(_FIXED_BASE[r.id] * _ecommerce_shape(hod) * (1 + rng.uniform(-0.03, 0.03)), 1))
            cap.append(float(r.capacity_kw))
        out[r.id] = RegionSeries(intensity, tariff, fixed, cap)
    return out


# (nombre, tipo, kW, horas, llegada_h, holgura_h, región_origen, GB, regiones_permitidas)
_JOB_TEMPLATES: list[tuple[str, str, int, float, float, float, str, int, tuple[str, ...]]] = [
    ("Backup incremental de la base transaccional", "backup", 60, 3.0, 0.5, 8, "amba", 350, ()),
    ("ETL de ventas diario", "etl", 80, 2.5, 1.0, 6, "amba", 150, ()),
    ("Reindexado del buscador de productos", "reindex", 90, 1.5, 3.0, 5, "amba", 60, ()),
    ("Reporte regulatorio BCRA", "report", 50, 1.5, 6.0, 0.5, "amba", 20, ("amba",)),
    ("Render del catálogo de imágenes", "render", 120, 3.0, 8.0, 12, "cba", 220, ()),
    ("Conciliación bancaria", "etl", 70, 2.0, 9.0, 4, "amba", 90, ()),
    ("Simulación Monte Carlo de riesgo", "sim", 150, 4.0, 11.0, 16, "cba", 40, ()),
    ("Agregación de métricas de checkout", "etl", 40, 1.0, 12.0, 1, "amba", 15, ()),
    ("Transcodificación de videos de vendedores", "render", 95, 2.5, 13.0, 9, "amba", 250, ()),
    ("Reindexado del buscador (tarde)", "reindex", 90, 1.5, 15.0, 5, "amba", 60, ()),
    ("Entrenamiento del modelo antifraude", "ml", 210, 6.0, 17.0, 18, "amba", 800, ()),
    ("Reentrenamiento del recomendador", "ml", 180, 5.0, 19.0, 14, "amba", 600, ()),
    ("Scoring crediticio por lotes", "sim", 110, 3.0, 20.0, 8, "cba", 80, ()),
    ("Backup completo semanal", "backup", 70, 4.0, 21.0, 12, "amba", 900, ()),
    ("Compactación del data lake", "etl", 100, 3.0, 22.0, 10, "nqn", 300, ()),
]

KIND_LABEL = {
    "ml": "Entrenamiento ML",
    "etl": "ETL",
    "backup": "Backup",
    "render": "Render",
    "reindex": "Reindexado",
    "sim": "Simulación",
    "report": "Regulatorio",
}


def build_jobs(seed: int = 7) -> list[Job]:
    rng = random.Random(seed)
    jobs: list[Job] = []
    for day in range(2):
        for i, (name, kind, kw, dur_h, arr_h, slack_h, home, gb, allowed) in enumerate(_JOB_TEMPLATES, 1):
            jitter = 0 if day == 0 else rng.choice([-0.5, 0, 0.5, 1.0])
            power = kw if day == 0 else int(kw * rng.uniform(0.9, 1.12))
            arrival = int(round((arr_h + jitter + 24 * day) * SLOTS_PER_HOUR))
            duration = max(1, int(round(dur_h * SLOTS_PER_HOUR)))
            deadline = arrival + duration + int(round(slack_h * SLOTS_PER_HOUR))
            if arrival + duration > N_SLOTS:
                continue
            deadline = min(deadline, N_SLOTS)
            jobs.append(
                Job(
                    id=f"D{day + 1}-{i:02d}",
                    name=name,
                    kind=kind,
                    power_kw=power,
                    duration=duration,
                    arrival=arrival,
                    deadline=deadline,
                    home=home,
                    data_gb=gb,
                    allowed=allowed,
                )
            )
    return jobs


# Trabajos extra que aparecen con la ola de calor (pico de demanda comercial).
SURGE_TEMPLATES: list[tuple[str, str, int, float, float, str, int]] = [
    ("Recálculo de precios dinámicos", "sim", 130, 2.0, 5, "amba", 60),
    ("Detección de fraude en pico de ventas", "ml", 170, 3.0, 6, "amba", 300),
    ("Reindexado urgente de stock", "reindex", 90, 1.5, 3, "amba", 60),
]
