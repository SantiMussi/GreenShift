"use client";

import { REGION_COLOR, intensityColor, intensityLabel } from "@/lib/colors";
import { lerpSeries, regionEmissionRate, regionLoad, runningAt } from "@/lib/derive";
import { fmt, fmtClock } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Region, Snapshot, StrategyId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RegionCards({ className }: { className?: string }) {
  const snap = useStore((s) => s.snap);
  const t = useStore((s) => s.hudT);
  const mapPlan = useStore((s) => s.mapPlan);
  if (!snap) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {snap.regions.map((r) => (
        <RegionCard key={r.id} region={r} snap={snap} t={t} plan={mapPlan} />
      ))}
    </div>
  );
}

function RegionCard({ region, snap, t, plan }: { region: Region; snap: Snapshot; t: number; plan: StrategyId }) {
  const { intensity, totalKgH } = regionEmissionRate(snap, region.id, t, plan);
  const load = regionLoad(snap, region.id, t, plan);
  const running = runningAt(snap.plans[plan].placements, t).filter((p) => p.region === region.id);
  const incoming = running.filter((p) => p.home !== region.id).length;
  const color = REGION_COLOR[region.id];

  return (
    <article className="frame px-3 pb-2.5 pt-2" aria-label={`Región ${region.name}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2" style={{ background: color }} />
          <h3 className="wide text-[11px] font-semibold uppercase tracking-[0.14em] text-fg">{region.name}</h3>
        </div>
        {load.down ? (
          <span className="blink label !text-alert">Caída</span>
        ) : (
          <span className="label !text-[9.5px]">PUE {fmt(region.pue, 2)}</span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="display num text-[34px]" style={{ color: load.down ? "var(--color-dim)" : intensityColor(intensity) }}>
              {fmt(intensity)}
            </span>
            <span className="text-[10.5px] text-muted">g CO₂/kWh</span>
          </div>
          <div className="mt-0.5 text-[10.5px] text-fg-2">
            Intensidad {intensityLabel(intensity).toLowerCase()} · <span className="num">{fmt(totalKgH)}</span> kg/h
          </div>
        </div>
        <Spark values={snap.series[region.id].intensity} t={t} />
      </div>

      <LoadBar fixed={load.fixed} flex={load.flex} cap={load.cap || region.capacity_kw} down={load.down} />
      <div className="mt-1 flex justify-between text-[10.5px] text-muted">
        <span>
          <span className="num text-fg-2">{running.length}</span> trabajos
          {incoming > 0 && (
            <>
              {" "}· <span className="num" style={{ color }}>{incoming}</span> migrados
            </>
          )}
        </span>
        <span className="num">
          {fmt(load.fixed + load.flex)} / {fmt(load.cap || region.capacity_kw)} kW
        </span>
      </div>
    </article>
  );
}

function LoadBar({ fixed, flex, cap, down }: { fixed: number; flex: number; cap: number; down: boolean }) {
  const f = Math.min(1, fixed / cap);
  const x = Math.min(1 - f, flex / cap);
  return (
    <div className="mt-2.5 flex h-[5px] w-full overflow-hidden bg-line" role="img" aria-label={`Carga fija ${fmt(fixed)} kW, flexible ${fmt(flex)} kW`}>
      {down ? (
        <div className="h-full w-full bg-[repeating-linear-gradient(135deg,#ff4048_0_4px,transparent_4px_8px)] opacity-60" />
      ) : (
        <>
          <div className="h-full bg-[#9fb0bf]/70 transition-[width] duration-500" style={{ width: `${f * 100}%` }} />
          <div className="h-full bg-lime transition-[width] duration-500" style={{ width: `${x * 100}%` }} />
        </>
      )}
    </div>
  );
}

/** Mini curva de intensidad: 6 h atrás, 18 h adelante. */
function Spark({ values, t }: { values: number[]; t: number }) {
  const W = 118;
  const H = 34;
  const from = Math.max(0, t - 6);
  const to = Math.min(48, from + 24);
  const pts: [number, number][] = [];
  let min = { v: Infinity, h: 0 };
  for (let h = from; h <= to; h += 0.5) {
    const v = lerpSeries(values, h);
    pts.push([h, v]);
    if (h > t && v < min.v) min = { v, h };
  }
  const x = (h: number) => ((h - from) / (to - from)) * W;
  const y = (v: number) => H - 3 - ((v - 60) / (520 - 60)) * (H - 6);
  const d = pts.map(([h, v], i) => `${i ? "L" : "M"}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const nx = x(t);
  return (
    <svg width={W} height={H + 12} className="shrink-0 overflow-visible" aria-hidden>
      <rect x={nx} y={0} width={W - nx} height={H} fill="var(--color-fg)" opacity={0.04} />
      <path d={d} fill="none" stroke="var(--color-dim)" strokeWidth={1.25} />
      <path d={d} fill="none" stroke="var(--color-fg)" strokeWidth={1.25} style={{ clipPath: `inset(0 ${W - nx}px 0 0)` }} />
      <line x1={nx} x2={nx} y1={0} y2={H} stroke="var(--color-fg)" strokeWidth={1} />
      {isFinite(min.v) && (
        <>
          <circle cx={x(min.h)} cy={y(min.v)} r={2.5} fill="var(--color-lime)" />
          <text x={W} y={H + 10} textAnchor="end" className="num" fontSize={9} fill="var(--color-muted)">
            mín {fmtClock(min.h).hm}
          </text>
        </>
      )}
    </svg>
  );
}
