/**
 * Reloj de simulación del lado del cliente.
 *
 * El backend es la fuente de verdad (manda `clock` por SSE ~10 veces por
 * segundo). Entre mensajes extrapolamos para animar a 60 fps y corregimos el
 * error de a poco, sin saltos, salvo que la diferencia sea grande (reset).
 */
import type { ClockState } from "./types";

const HORIZON_H = 48;

interface Internal {
  t: number;
  syncedAt: number;
  speed: number;
  paused: boolean;
  replanning: boolean;
  secondsPerSimHour: number;
}

const state: Internal = {
  t: 0,
  syncedAt: 0,
  speed: 1,
  paused: false,
  replanning: false,
  secondsPerSimHour: 3.75,
};

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function running() {
  return !state.paused && !state.replanning;
}

export function getSimTime(): number {
  if (!running()) return state.t;
  const dt = (now() - state.syncedAt) / 1000;
  return Math.min(HORIZON_H - 1e-3, state.t + (dt * state.speed) / state.secondsPerSimHour);
}

export function syncClock(c: ClockState, secondsPerSimHour?: number) {
  if (secondsPerSimHour) state.secondsPerSimHour = secondsPerSimHour;
  const predicted = getSimTime();
  const error = c.t - predicted;
  const snap = Math.abs(error) > 0.4 || !running() || c.paused || c.replanning;
  state.t = snap ? c.t : predicted + error * 0.35;
  state.syncedAt = now();
  state.speed = c.speed;
  state.paused = c.paused;
  state.replanning = c.replanning;
}

export function clockFlags() {
  return { speed: state.speed, paused: state.paused, replanning: state.replanning };
}
