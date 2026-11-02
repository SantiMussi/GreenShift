from __future__ import annotations

from pathlib import Path

from .. import db
from .base import Dataset


class SnapshotSource:
    """Snapshot local en SQLite. Es el respaldo que siempre funciona offline."""

    id = "snapshot"

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or db.DEFAULT_DB

    def load(self) -> Dataset:
        regions, series, jobs, meta = db.load(self.path)
        return Dataset(
            regions=regions,
            series=series,
            jobs=jobs,
            source_id=self.id,
            source_label="Snapshot local ilustrativo (SQLite)",
            simulated=True,
            notes=[meta.get("note", "Datos simulados.")],
        )
