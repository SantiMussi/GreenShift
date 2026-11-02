"use client";

import { useState } from "react";
import { TimelineChart } from "@/components/charts/Timeline";
import { SimulatedBadge } from "@/components/hud/Panel";
import { REGION_COLOR, STRATEGY } from "@/lib/colors";
import { fmt } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { StrategyId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TimelineView() {
  const snap = useStore((s) => s.snap);
  const t = useStore((s) => s.hudT);
  const [compare, setCompare] = useState<StrategyId>("inmediato");
  if (!snap) return null;
  const g = snap.plans.verde.metrics;

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="wide text-[13px] font-semibold uppercase tracking-[0.16em] text-fg">Línea de tiempo · 48 h</h1>
            <SimulatedBadge />
          </div>
          <p className="mt-1.5 max-w-2xl text-[13px] text-fg-2">
            Arriba, la intensidad de carbono de cada región. Abajo, cada trabajo flexible: la barra sólida es el plan verde
            (color = región donde corre); el contorno punteado, dónde habría corrido sin planificar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Stat label="Trabajos migrados" value={`${g.moved_jobs}/${g.deadlines_total}`} />
          <Stat label="Demora media de inicio" value={`${fmt(g.avg_delay_h, 1)} h`} />
          <Stat label="Deadlines cumplidos" value={`${fmt(g.deadlines_pct, 0)}%`} accent />
          <div>
            <div className="label mb-1 !text-[9.5px]">Comparar contra</div>
            <div className="flex border border-line" role="group" aria-label="Estrategia de comparación">
              {(["inmediato", "primera_region"] as StrategyId[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setCompare(k)}
                  aria-pressed={compare === k}
                  className={cn("h-8 px-3 text-[12px]", compare === k ? "bg-fg text-bg" : "text-muted hover:text-fg")}
                >
                  {STRATEGY[k].short}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-2 text-[11.5px] text-fg-2">
        {snap.regions.map((r) => (
          <span key={r.id} className="flex items-center gap-2">
            <span className="h-2.5 w-5" style={{ background: REGION_COLOR[r.id] }} /> Corre en {r.short}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-5 border border-dashed" style={{ borderColor: STRATEGY[compare].color }} />
          {STRATEGY[compare].label}
          {compare === "primera_region" && (
            <span className="text-muted">· si cae en otra región que la de origen, se marca “en AMBA”, etc.</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-px w-5 bg-line-2" />
          <span className="h-2 w-px bg-muted" /> Ventana llegada → deadline
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-5 bg-[repeating-linear-gradient(135deg,#ff4048_0_2px,transparent_2px_5px)]" /> Cortado por falla
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-5 bg-amba/10" /> Noche (20–07 h)
        </span>
      </div>

      <div className="mt-3">
        <TimelineChart snap={snap} t={t} compare={compare} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="label !text-[9.5px]">{label}</div>
      <div className={cn("display num mt-1 text-[26px]", accent ? "text-lime" : "text-fg")}>{value}</div>
    </div>
  );
}
