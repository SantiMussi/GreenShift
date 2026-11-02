"use client";

import { useMemo } from "react";
import { Panel, SimulatedBadge } from "@/components/hud/Panel";
import { Slider } from "@/components/ui/slider";
import { REGION_COLOR } from "@/lib/colors";
import { fmt, fmtKg, fmtSlot, fmtUsd } from "@/lib/format";
import { useStore } from "@/lib/store";

export function BSideView() {
  const snap = useStore((s) => s.snap);
  const rebound = useStore((s) => s.rebound);
  const setRebound = useStore((s) => s.setRebound);

  const derived = useMemo(() => {
    if (!snap) return null;
    const g = snap.plans.verde.metrics;
    const imm = snap.plans.inmediato.metrics;
    const avoided = snap.summary.avoided_kg;
    const savings = Math.max(0, snap.summary.savings_usd);
    const usdPerKwh = g.cost_usd / Math.max(g.energy_kwh, 1);
    const kgPerKwh = g.emissions_kg / Math.max(g.energy_kwh, 1);
    const kwhPerJob = g.energy_kwh / Math.max(snap.jobs.length, 1);
    const amba = snap.series.amba.intensity;
    const ambaMean = amba.reduce((a, b) => a + b, 0) / amba.length / 1000; // kg/kWh
    const plannerKwh = (snap.planner.solve_wh + snap.planner.idle_wh_horizon) / 1000;
    const plannerKg = plannerKwh * ambaMean;
    const breakEven = savings > 0 ? avoided / ((savings / usdPerKwh) * kgPerKwh) : Infinity;

    const jobs = new Map(snap.jobs.map((j) => [j.id, j]));
    const immByJob = new Map(snap.plans.inmediato.placements.map((p) => [p.job_id, p]));
    const unchanged = snap.plans.verde.placements.filter((p) => {
      const q = immByJob.get(p.job_id);
      return q && q.start === p.start && q.region === p.region;
    }).length;
    return { g, imm, avoided, savings, usdPerKwh, kgPerKwh, kwhPerJob, plannerKwh, plannerKg, breakEven, jobs, unchanged };
  }, [snap]);

  if (!snap || !derived) return null;
  const d = derived;
  const extraKwh = (d.savings * rebound) / d.usdPerKwh;
  const extraKg = extraKwh * d.kgPerKwh;
  const extraJobs = extraKwh / d.kwhPerJob;
  const net = d.avoided - extraKg;
  const plannerShare = d.avoided > 0 ? (100 * d.plannerKg) / d.avoided : 0;
  const rigid = snap.planner.rigid_jobs.map((id) => d.jobs.get(id)!).filter(Boolean);

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="wide text-[13px] font-semibold uppercase tracking-[0.16em] text-fg">Lado B · lo que no se ve en el titular</h1>
        <SimulatedBadge />
      </div>
      <p className="mt-1.5 max-w-3xl text-[13px] text-fg-2">
        Toda tecnología “verde” tiene costos y límites. Acá los medimos: cuánto consume el propio planificador, qué pasa si el
        ahorro se reinvierte en más cómputo y qué trabajos no se pudieron mover.
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Panel title="1 · Consumo del planificador">
          <div className="display num text-[46px] text-fg">{fmt(d.plannerKwh, 2)} kWh</div>
          <div className="text-[12px] text-muted">en 48 h ≈ {fmtKg(d.plannerKg)} de CO₂</div>
          <div className="mt-4 h-[8px] w-full bg-line" aria-hidden>
            <div className="h-full bg-ember" style={{ width: `${Math.max(0.6, Math.min(100, plannerShare))}%` }} />
          </div>
          <p className="mt-2 text-[12.5px] text-fg-2">
            Equivale al <span className="num text-fg">{fmt(plannerShare, 2)}%</span> del CO₂ que evita. Casi todo es el servicio
            encendido ({fmt(snap.planner.idle_w, 0)} W × 48 h); las {snap.planner.replans.length} optimizaciones CP-SAT suman{" "}
            <span className="num text-fg">{fmt(snap.planner.solve_wh, 3)} Wh</span>.
          </p>
          <p className="mt-2 text-[10.5px] text-dim">
            Potencias estimadas: {fmt(snap.planner.solve_w, 0)} W con CPU a pleno mientras resuelve, {fmt(snap.planner.idle_w, 0)} W en reposo.
          </p>
        </Panel>

        <Panel title="2 · Efecto rebote">
          <label htmlFor="rebound" className="text-[12.5px] text-fg-2">
            Si el área de datos reinvierte el <span className="num text-fg">{fmt(rebound * 100, 0)}%</span> del ahorro (
            {fmtUsd(d.savings)}) en lanzar más trabajos…
          </label>
          <Slider
            id="rebound"
            aria-label="Porcentaje del ahorro reinvertido en más cómputo"
            className="mt-3"
            min={0}
            max={100}
            step={5}
            value={[Math.round(rebound * 100)]}
            onValueChange={([v]) => setRebound(v / 100)}
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Fig label="Trabajos extra" value={`+${fmt(extraJobs, 0)}`} />
            <Fig label="CO₂ extra" value={`+${fmtKg(extraKg)}`} tone="ember" />
            <Fig label="Balance neto" value={fmtKg(net)} tone={net > 0 ? "lime" : "ember"} />
          </div>
          <div className="mt-4 flex h-[10px] w-full overflow-hidden bg-line" aria-hidden>
            <div className="h-full bg-lime" style={{ width: `${Math.max(0, (net / d.avoided) * 100)}%` }} />
            <div className="h-full bg-ember/80" style={{ width: `${Math.min(100, (extraKg / d.avoided) * 100)}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-fg-2">
            {d.breakEven > 1
              ? "Aun reinvirtiendo todo el ahorro, el balance sigue siendo positivo: el kWh extra corre en horas limpias."
              : `Si se reinvierte más del ${fmt(d.breakEven * 100, 0)}% del ahorro, el rebote se come toda la reducción.`}{" "}
            Por eso conviene fijar un presupuesto de carbono, no sólo de dinero.
          </p>
        </Panel>

        <Panel title="3 · Lo que no se pudo mover">
          <div className="flex items-baseline gap-3">
            <span className="display num text-[46px] text-fg">{snap.planner.not_moved_deadline.length}</span>
            <span className="text-[12px] text-muted">trabajos con 1 h de holgura o menos</span>
          </div>
          <div className="mt-1 text-[12px] text-fg-2">
            {d.unchanged} de {snap.jobs.length} corrieron igual que “de inmediato”
            {d.g.unscheduled > 0 && (
              <>
                {" · "}
                <span className="text-alert">{d.g.unscheduled} sin lugar antes de su deadline</span>
              </>
            )}
          </div>
          <ul className="mt-3 max-h-48 divide-y divide-line overflow-y-auto border-t border-line no-scrollbar">
            {rigid.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 py-1.5 text-[12px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-1.5 shrink-0" style={{ background: REGION_COLOR[j.home] }} />
                  <span className="truncate text-fg-2">{j.name}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted">
                  {j.allowed.length === 1 ? "residencia de datos" : `holgura ${fmt(j.slack / 2, 1)} h`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Historial de replanificaciones" bodyClassName="p-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line text-muted">
                {["#", "Hora sim.", "Motivo", "Estado", "Tiempo", "Variables", "Mov.", "Energía"].map((h) => (
                  <th key={h} className="label px-3 py-2 !text-[9.5px] font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...snap.planner.replans].reverse().map((r) => (
                <tr key={r.id}>
                  <td className="num px-3 py-1.5 text-muted">{r.id}</td>
                  <td className="num px-3 py-1.5 text-fg-2">{fmtSlot(r.at_slot)}</td>
                  <td className="px-3 py-1.5 text-fg-2">{r.reason}</td>
                  <td className="px-3 py-1.5">
                    <span className={r.status === "OPTIMAL" ? "text-lime" : "text-amber"}>
                      {r.status === "OPTIMAL" ? "óptimo" : "factible"}
                    </span>
                  </td>
                  <td className="num px-3 py-1.5 text-fg">{fmt(r.wall_time_s, 2)} s</td>
                  <td className="num px-3 py-1.5 text-fg-2">{fmt(r.n_vars)}</td>
                  <td className="num px-3 py-1.5 text-fg-2">{r.moves.length}</td>
                  <td className="num px-3 py-1.5 text-fg-2">{fmt(r.energy_wh, 3)} Wh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Límites del modelo">
          <ul className="space-y-2 text-[12.5px] leading-snug text-fg-2">
            <li>· Intensidades por región ilustrativas: en la realidad el SADI está interconectado y la intensidad marginal difiere de la promedio.</li>
            <li>· Se asume que los trabajos se pueden pausar y reanudar desde checkpoint y que su consumo es constante.</li>
            <li>· La transferencia de datos se estima en 0,02 kWh/GB; no modela costos de egreso ni congestión.</li>
            <li>· Mover cómputo no reduce el consumo: reduce el carbono por kWh. Lo más verde sigue siendo no correr lo innecesario.</li>
            <li>· Latencia de red: sólo para trabajos batch migrados ({fmt(d.g.avg_latency_ms, 0)} ms promedio); los servicios en línea no se mueven.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Fig({ label, value, tone }: { label: string; value: string; tone?: "lime" | "ember" }) {
  return (
    <div>
      <div className="label !text-[9px]">{label}</div>
      <div className={`display num mt-1 text-[24px] ${tone === "lime" ? "text-lime" : tone === "ember" ? "text-ember" : "text-fg"}`}>{value}</div>
    </div>
  );
}
