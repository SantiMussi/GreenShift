"""Persistencia local en SQLite (snapshot sembrado, sin dependencias externas)."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .domain import N_SLOTS, Job, Region, RegionSeries
from .seed import REGIONS, build_jobs, build_series

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "greenshift.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY, name TEXT, short TEXT, lat REAL, lon REAL,
  capacity_kw INTEGER, max_parallel INTEGER, pue REAL, latency_ms_from_amba INTEGER, mix_note TEXT
);
CREATE TABLE IF NOT EXISTS series (
  region_id TEXT, slot INTEGER, intensity REAL, tariff REAL, fixed_load_kw REAL, capacity_kw REAL,
  PRIMARY KEY (region_id, slot)
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, name TEXT, kind TEXT, power_kw INTEGER, duration INTEGER,
  arrival INTEGER, deadline INTEGER, home TEXT, data_gb INTEGER, allowed TEXT
);
"""


def seed(path: Path = DEFAULT_DB, force: bool = False) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        return path
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    try:
        con.executescript(SCHEMA)
        con.execute("INSERT INTO meta VALUES ('source', 'snapshot-ilustrativo')")
        con.execute("INSERT INTO meta VALUES ('note', 'Datos simulados con forma realista. No son mediciones.')")
        for r in REGIONS:
            con.execute(
                "INSERT INTO regions VALUES (?,?,?,?,?,?,?,?,?,?)",
                (r.id, r.name, r.short, r.lat, r.lon, r.capacity_kw, r.max_parallel, r.pue,
                 r.latency_ms_from_amba, r.mix_note),
            )
        for rid, s in build_series().items():
            con.executemany(
                "INSERT INTO series VALUES (?,?,?,?,?,?)",
                [(rid, t, s.intensity[t], s.tariff[t], s.fixed_load_kw[t], s.capacity_kw[t]) for t in range(N_SLOTS)],
            )
        for j in build_jobs():
            con.execute(
                "INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?,?,?)",
                (j.id, j.name, j.kind, j.power_kw, j.duration, j.arrival, j.deadline, j.home, j.data_gb,
                 json.dumps(list(j.allowed))),
            )
        con.commit()
    finally:
        con.close()
    return path


def load(path: Path = DEFAULT_DB) -> tuple[list[Region], dict[str, RegionSeries], list[Job], dict[str, str]]:
    seed(path)
    con = sqlite3.connect(path)
    try:
        meta = dict(con.execute("SELECT key, value FROM meta").fetchall())
        regions = [Region(*row) for row in con.execute(
            "SELECT id, name, short, lat, lon, capacity_kw, max_parallel, pue, latency_ms_from_amba, mix_note "
            "FROM regions ORDER BY rowid")]
        series: dict[str, RegionSeries] = {}
        for r in regions:
            rows = con.execute(
                "SELECT intensity, tariff, fixed_load_kw, capacity_kw FROM series WHERE region_id=? ORDER BY slot",
                (r.id,),
            ).fetchall()
            series[r.id] = RegionSeries(
                [row[0] for row in rows], [row[1] for row in rows], [row[2] for row in rows], [row[3] for row in rows]
            )
        jobs = [
            Job(id=row[0], name=row[1], kind=row[2], power_kw=row[3], duration=row[4], arrival=row[5],
                deadline=row[6], home=row[7], data_gb=row[8], allowed=tuple(json.loads(row[9])))
            for row in con.execute("SELECT * FROM jobs ORDER BY arrival, id")
        ]
    finally:
        con.close()
    return regions, series, jobs, meta


if __name__ == "__main__":
    import sys

    force = "--force" in sys.argv
    existed = DEFAULT_DB.exists()
    path = seed(force=force)
    print(("Base resembrada en" if force else "Base lista en" if existed else "Base sembrada en"), path)
