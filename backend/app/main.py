"""API de GreenShift (FastAPI). Todo corre local, sin servicios externos."""

from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .engine import Engine

engine: Engine | None = None


def get_engine() -> Engine:
    global engine
    if engine is None:
        engine = Engine(time_limit_s=float(os.environ.get("GREENSHIFT_SOLVER_LIMIT_S", "2.5")))
    return engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    eng = get_engine()
    task = None
    if os.environ.get("GREENSHIFT_NO_CLOCK") != "1":
        task = asyncio.create_task(eng.loop())
    yield
    if task:
        task.cancel()


app = FastAPI(title="GreenShift API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ControlIn(BaseModel):
    action: Literal["play", "pause", "toggle", "reset"] | None = None
    speed: Literal[1, 2, 4] | None = None
    objective: Literal["co2", "mixto", "costo"] | None = None
    t: float | None = None  # salto de reloj (horas), usado por el guion


class ScenarioIn(BaseModel):
    id: str


@app.get("/api/health")
def health() -> dict:
    eng = get_engine()
    return {"ok": True, "source": eng.dataset.source_id, "version": eng.version}


@app.get("/api/state")
def state() -> dict:
    return get_engine().snapshot()


@app.post("/api/control")
async def control(body: ControlIn) -> dict:
    eng = get_engine()
    if body.speed:
        eng.speed = body.speed
    if body.action == "play":
        eng.paused = False
    elif body.action == "pause":
        eng.paused = True
    elif body.action == "toggle":
        eng.paused = not eng.paused
    elif body.action == "reset":
        await eng.run_locked(eng.reset_state)
    if body.t is not None:
        eng.t = max(0.0, min(body.t, 47.99))
    if body.objective and body.objective != eng.objective:
        await eng.run_locked(eng.set_objective, body.objective)
    await eng.broadcast("clock", eng.clock())
    return eng.clock()


@app.post("/api/scenario")
async def scenario(body: ScenarioIn) -> dict:
    eng = get_engine()
    try:
        await eng.run_locked(eng.apply_scenario, body.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True, "scenario": eng.scenario, "replan": eng.last_replan}


@app.get("/api/stream")
async def stream(request: Request) -> StreamingResponse:
    eng = get_engine()
    queue: asyncio.Queue = asyncio.Queue()
    eng.subscribers.add(queue)

    async def gen():
        try:
            yield "retry: 1500\n\n"
            yield f"event: snapshot\ndata: {json.dumps(eng.snapshot(), ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=10)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            eng.subscribers.discard(queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
