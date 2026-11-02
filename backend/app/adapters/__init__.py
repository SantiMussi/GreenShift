"""Capa de datos reemplazable.

``get_source()`` elige el adaptador según la variable de entorno
``GREENSHIFT_DATA_SOURCE`` (``snapshot`` por defecto, o ``cammesa_csv``).
Cualquier error del adaptador externo cae al snapshot local de respaldo.
"""

from __future__ import annotations

import os

from .base import CarbonDataSource, Dataset
from .cammesa_csv import CammesaCsvSource
from .snapshot import SnapshotSource


def get_source() -> CarbonDataSource:
    kind = os.environ.get("GREENSHIFT_DATA_SOURCE", "snapshot").lower()
    if kind == "cammesa_csv":
        return CammesaCsvSource(fallback=SnapshotSource())
    return SnapshotSource()


__all__ = ["CarbonDataSource", "Dataset", "SnapshotSource", "CammesaCsvSource", "get_source"]
