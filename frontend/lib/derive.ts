import type { Placement, Snapshot, StrategyId } from "./types";

export const SLOTS_PER_HOUR = 2;

export function slotAt(t: number, n = 96) {
  return Math.max(0, Math.min(n - 1, Math.floor(t * SLOTS_PER_HOUR)));
}

/** Valor interpolado de una serie por slot en el tiempo t (horas). */
export function lerpSeries(arr: number[], t: number) {
  const x = Math.max(0, Math.min(arr.length - 1, t * SLOTS_PER_HOUR - 0.5));
  const i = Math.floor(x);
  const f = x - i;
  const a = arr[i] ?? 0;
  const b = arr[Math.min(arr.length - 1, i + 1)] ?? a;
  return a + (b - a) * f;
}

/** Acumulado (cum tiene n+1 puntos, cum[k] = total hasta el inicio del slot k). */
export function cumAt(cum: number[], t: number) {
  const x = Math.max(0, Math.min(cum.length - 1, t * SLOTS_PER_HOUR));
  const i = Math.floor(x);
  const f = x - i;
  const a = cum[i] ?? 0;
  const b = cum[Math.min(cum.length - 1, i + 1)] ?? a;
  return a + (b - a) * f;
}

export function runningAt(placements: Placement[], t: number) {
  const s = t * SLOTS_PER_HOUR;
  return placements.filter((p) => p.start <= s && s < p.end);
}

export function regionEmissionRate(snap: Snapshot, regionId: string, t: number, plan: StrategyId = "verde") {
  const r = snap.regions.find((x) => x.id === regionId)!;
  const s = snap.series[regionId];
  const slot = slotAt(t, snap.n_slots);
  const intensity = lerpSeries(s.intensity, t);
  const fixedKgH = (s.fixed_load_kw[slot] * r.pue * intensity) / 1000;
  const flexKgH = snap.plans[plan].metrics.region_emis_kg_h[regionId][slot];
  return { intensity, fixedKgH, flexKgH, totalKgH: fixedKgH + flexKgH };
}

export function regionLoad(snap: Snapshot, regionId: string, t: number, plan: StrategyId = "verde") {
  const s = snap.series[regionId];
  const slot = slotAt(t, snap.n_slots);
  const cap = s.capacity_kw[slot];
  const fixed = s.fixed_load_kw[slot];
  const flex = snap.plans[plan].metrics.region_load_kw[regionId][slot];
  return { cap, fixed, flex, down: cap <= 0, util: cap > 0 ? (fixed + flex) / cap : 0 };
}

export function jobById(snap: Snapshot) {
  return new Map(snap.jobs.map((j) => [j.id, j]));
}

const TRANSFER_KWH_PER_GB = 0.02; // igual que el backend (domain.py)

/** CO₂ (kg) de una lista de tramos de un trabajo, con el mismo modelo que el backend: energía × PUE × intensidad + transferencia. */
export function placementsKg(snap: Snapshot, ps: Placement[]) {
  let g = 0;
  for (const p of ps) {
    const pue = snap.regions.find((r) => r.id === p.region)?.pue ?? 1;
    const s = snap.series[p.region].intensity;
    for (let i = p.start; i < Math.min(p.end, s.length); i++) g += p.power_kw * pue * 0.5 * s[i];
    if (p.region !== p.home) g += p.data_gb * TRANSFER_KWH_PER_GB * snap.series[p.home].intensity[Math.min(p.start, s.length - 1)];
  }
  return g / 1000;
}
