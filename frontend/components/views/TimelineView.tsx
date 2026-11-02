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

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-line py-2.5 text-[12px] text-fg-2">
        <span className="flex items-center gap-2">
          <Glyph>
            <rect x={1} y={3} width={46} height={12} rx={3} fill="var(--color-fg)" fillOpacity={0.05} stroke="var(--color-line-2)" />
            <rect x={45} y={0} width={3} height={18} fill="var(--color-fg-2)" />
          </Glyph>
          Ventana hasta el deadline
        </span>
        <span className="flex items-center gap-2">
          <Glyph>
            <rect x={2} y={4.5} width={16} height={9} fill="none" stroke={STRATEGY[compare].color} strokeWidth={1.5} strokeDasharray="4 3" />
            <line x1={21} x2={31} y1={9} y2={9} stroke="var(--color-lime)" strokeWidth={1.75} markerEnd="url(#lg-arrow)" />
            <rect x={34} y={4.5} width={13} height={9} rx={2} fill="var(--color-nqn)" />
            <defs>
              <marker id="lg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--color-lime)" />
              </marker>
            </defs>
          </Glyph>
          {compare === "inmediato" ? "Sin GreenShift" : STRATEGY[compare].short} → con GreenShift
        </span>
        {snap.regions.map((r) => (
          <span key={r.id} className="flex items-center gap-2">
            <span className="h-2.5 w-5 rounded-[2px]" style={{ background: REGION_COLOR[r.id] }} /> {r.short}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="h-[6px] w-5 bg-lime" /> CO₂ ahorrado
        </span>
        <span className="flex items-center gap-2 text-muted">
          <span className="h-2.5 w-5 bg-[repeating-linear-gradient(135deg,var(--color-alert)_0_2px,transparent_2px_5px)]" /> Cortado por falla
        </span>
        <span className="flex items-center gap-2 text-muted">
          <span className="h-2.5 w-5 bg-amba/10" /> Noche
        </span>
      </div>

      <div className="mt-3">
        <TimelineChart snap={snap} t={t} compare={compare} />
      </div>
    </div>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg width={50} height={18} viewBox="0 0 50 18" aria-hidden className="shrink-0">
      {children}
    </svg>
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
