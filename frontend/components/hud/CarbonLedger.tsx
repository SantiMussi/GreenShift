"use client";

import { STRATEGY } from "@/lib/colors";
import { cumAt } from "@/lib/derive";
import { fmt, fmtKg } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { StrategyId } from "@/lib/types";
import { Panel } from "./Panel";

const ORDER: StrategyId[] = ["inmediato", "primera_region", "verde"];

export function CarbonLedger() {
  const snap = useStore((s) => s.snap);
  const t = useStore((s) => s.hudT);
  if (!snap) return null;
  const now = Object.fromEntries(ORDER.map((k) => [k, cumAt(snap.plans[k].metrics.cum_kg, t)])) as Record<StrategyId, number>;
  const max = Math.max(...ORDER.map((k) => snap.plans[k].metrics.emissions_kg), 1);
  const avoided = now.inmediato - now.verde;
  const pct = now.inmediato > 0 ? (100 * avoided) / now.inmediato : 0;

  return (
    <Panel title="CO₂ acumulado · cargas flexibles" right={<span className="label num !tracking-normal">48 h</span>}>
      <div className="flex items-end justify-between">
        <div>
          <div className="label !text-[9.5px]">Evitado hasta ahora</div>
          <div className="display num mt-1 text-[44px] text-lime">{fmtKg(Math.max(0, avoided))}</div>
        </div>
        <div className="pb-1 text-right">
          <div className="display num text-[26px] text-fg">−{fmt(Math.max(0, pct), 0)}%</div>
          <div className="text-[10.5px] text-muted">vs. de inmediato</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {ORDER.map((k) => (
          <div key={k}>
            <div className="flex justify-between text-[11px]">
              <span className="text-fg-2">{STRATEGY[k].label}</span>
              <span className="num text-fg">{fmtKg(now[k])}</span>
            </div>
            <div className="relative mt-1 h-[4px] bg-line">
              <div
                className="absolute inset-y-0 left-0 opacity-25"
                style={{ width: `${(snap.plans[k].metrics.emissions_kg / max) * 100}%`, background: STRATEGY[k].color }}
              />
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-300"
                style={{ width: `${(now[k] / max) * 100}%`, background: STRATEGY[k].color }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10.5px] leading-snug text-muted">
        Barra tenue: proyección del plan a 48 h. Cargas fijas (API, checkout) no movibles:{" "}
        <span className="num text-fg-2">{fmtKg(snap.summary.fixed_load_kg)}</span>, iguales en todas las estrategias.
      </p>
    </Panel>
  );
}
