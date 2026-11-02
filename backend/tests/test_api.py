from __future__ import annotations

import os

os.environ["GREENSHIFT_NO_CLOCK"] = "1"
os.environ["GREENSHIFT_SOLVER_LIMIT_S"] = "2"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_state_and_scenario_roundtrip() -> None:
    with TestClient(app) as client:
        assert client.get("/api/health").json()["ok"] is True
        state = client.get("/api/state").json()
        assert {r["id"] for r in state["regions"]} == {"amba", "cba", "nqn"}
        assert state["data_source"]["simulated"] is True
        assert set(state["plans"]) == {"inmediato", "primera_region", "verde"}
        assert len(state["plans"]["verde"]["metrics"]["cum_kg"]) == state["n_slots"] + 1

        r = client.post("/api/scenario", json={"id": "eolica"})
        assert r.status_code == 200 and r.json()["scenario"] == "eolica"
        assert client.post("/api/scenario", json={"id": "nope"}).status_code == 404

        clock = client.post("/api/control", json={"action": "pause", "speed": 4}).json()
        assert clock["paused"] is True and clock["speed"] == 4
