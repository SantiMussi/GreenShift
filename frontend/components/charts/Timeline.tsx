"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { scaleLinear } from "@visx/scale";
import { LinePath, AreaClosed } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { REGION_COLOR, STRATEGY } from "@/lib/colors";
import { fmt, fmtSlot } from "@/lib/format";
import type { Job, Placement, Snapshot, StrategyId } from "@/lib/types";
import { useWidth } from "@/lib/useWidth";

const LABEL_W = 268;
const ROW_H = 21;
const GROUP_H = 30;
const AXIS_H = 26;
const CHART_H = 168;
const DAYS = ["Lun", "Mar"];

function nightBands(n: number) {
  const out: [number, number][] = [];
  for (let d = -1; d < 2; d++) out.push([Math.max(0, (d * 24 + 20) * 2), Math.min(n, (d * 24 + 31) * 2)]);
  return out.filter(([a, b]) => b > a);
}

export function TimelineChart({ snap, t, compare }: { snap: Snapshot; t: number; compare: StrategyId }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return <div ref={ref}>{width > 0 && <Inner snap={snap} t={t} compare={compare} width={width} />}</div>;
}

interface Row {
  job: Job;
  green: Placement[];
  ghost: Placement[];
  unscheduled: boolean;
}

function Inner({ snap, t, compare, width }: { snap: Snapshot; t: number; compare: StrategyId; width: number }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const n = snap.n_slots;
  const x = useMemo(() => scaleLinear({ domain: [0, n], range: [LABEL_W, width - 8] }), [n, width]);
  const y = useMemo(() => scaleLinear({ domain: [60, 540], range: [CHART_H - 8, 10] }), []);

  const groups = useMemo(() => {
    const byJob = (ps: Placement[]) => {
      const m = new Map<string, Placement[]>();
      for (const p of ps) m.set(p.job_id, [...(m.get(p.job_id) ?? []), p].sort((a, b) => a.start - b.start));
      return m;
    };
    const green = byJob(snap.plans.verde.placements);
    const ghost = byJob(snap.plans[compare].placements);
    const unsched = new Set(snap.plans.verde.unscheduled.map((id) => id.split("·")[0]));
    const rows: Row[] = snap.jobs.map((job) => ({
      job,
      green: green.get(job.id) ?? [],
      ghost: ghost.get(job.id) ?? [],
      unscheduled: unsched.has(job.id),
    }));
    const order = [...snap.regions.map((r) => r.id), "__none"];
    const key = (r: Row) => (r.green.length ? r.green[r.green.length - 1].region : "__none");
    return order
      .map((rid) => ({
        rid,
        rows: rows.filter((r) => key(r) === rid).sort((a, b) => (a.green[0]?.start ?? 999) - (b.green[0]?.start ?? 999)),
      }))
      .filter((g) => g.rows.length);
  }, [snap, compare]);

  const ganttH = groups.reduce((acc, g) => acc + GROUP_H + g.rows.length * ROW_H, 0);
  const total = CHART_H + AXIS_H + ganttH + 8;
  const nowX = x(t * 2);
  const hours = Array.from({ length: 9 }, (_, i) => i * 6);
  const slotsArr = Array.from({ length: n }, (_, i) => i);

  let yCursor = CHART_H + AXIS_H;

  return (
    <svg
      width={width}
      height={total}
      className="block select-none"
      role="img"
      aria-label="Curvas de intensidad por región y diagrama de Gantt de los trabajos"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const s = x.invert(e.clientX - rect.left);
        setHover(s >= 0 && s < n ? Math.floor(s) : null);
      }}
    >
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-alert)" strokeWidth="1.5" opacity="0.7" />
        </pattern>
        {snap.regions.map((r) => (
          <linearGradient key={r.id} id={`fill-${r.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={REGION_COLOR[r.id]} stopOpacity={0.16} />
            <stop offset="100%" stopColor={REGION_COLOR[r.id]} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* Bandas nocturnas y grilla horaria */}
      {nightBands(n).map(([a, b]) => (
        <rect key={a} x={x(a)} y={0} width={x(b) - x(a)} height={total} fill="#7fb2ff" opacity={0.07} />
      ))}
      {hours.map((h) => (
        <g key={h}>
          <line x1={x(h * 2)} x2={x(h * 2)} y1={0} y2={total} stroke="var(--color-line)" strokeDasharray={h % 24 === 0 ? undefined : "2 4"} />
          {h < 48 && (
            <text x={x(h * 2) + 4} y={CHART_H + 17} fontSize={10} fill="var(--color-muted)" className="num">
              {DAYS[Math.floor(h / 24)]} {String(h % 24).padStart(2, "0")}:00
            </text>
          )}
        </g>
      ))}

      {/* Curvas de intensidad */}
      <g>
        <text x={0} y={16} fontSize={10.5} fill="var(--color-muted)" className="label">
          INTENSIDAD DE CARBONO
        </text>
        <text x={0} y={30} fontSize={10.5} fill="var(--color-dim)">
          g CO₂/kWh por región
        </text>
        {[100, 200, 300, 400, 500].map((v) => (
          <g key={v}>
            <line x1={LABEL_W} x2={width - 8} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
            <text x={LABEL_W - 8} y={y(v) + 3} fontSize={9.5} textAnchor="end" fill="var(--color-dim)" className="num">
              {v}
            </text>
          </g>
        ))}
        {snap.regions.map((r) => {
          const s = snap.series[r.id];
          return (
            <g key={r.id}>
              <AreaClosed
                data={slotsArr}
                x={(i) => x(i + 0.5)}
                y={(i) => y(s.intensity[i])}
                yScale={y}
                curve={curveMonotoneX}
                fill={`url(#fill-${r.id})`}
              />
              <LinePath data={slotsArr} x={(i) => x(i + 0.5)} y={(i) => y(s.intensity[i])} curve={curveMonotoneX} stroke={REGION_COLOR[r.id]} strokeWidth={1.6} />
              {/* Tramos con la región caída */}
              {slotsArr
                .filter((i) => s.capacity_kw[i] <= 0)
                .map((i) => (
                  <rect key={i} x={x(i)} y={6} width={x(1) - x(0)} height={CHART_H - 14} fill="url(#hatch)" opacity={0.35} />
                ))}
            </g>
          );
        })}
        <g transform={`translate(0, 50)`}>
          {snap.regions.map((r, i) => (
            <g key={r.id} transform={`translate(0, ${i * 17})`}>
              <rect width={10} height={2} y={5} fill={REGION_COLOR[r.id]} />
              <text x={16} y={9} fontSize={11} fill="var(--color-fg-2)">
                {r.name}
              </text>
            </g>
          ))}
        </g>
      </g>

      {/* Gantt */}
      {groups.map((g) => {
        const top = yCursor;
        yCursor += GROUP_H + g.rows.length * ROW_H;
        const region = snap.regions.find((r) => r.id === g.rid);
        return (
          <g key={g.rid}>
            <line x1={0} x2={width} y1={top + 0.5} y2={top + 0.5} stroke="var(--color-line-2)" />
            <rect x={0} y={top + 9} width={3} height={13} fill={region ? REGION_COLOR[region.id] : "#ff4048"} />
            <text x={10} y={top + 20} fontSize={10.5} letterSpacing="0.14em" fill="var(--color-fg)" style={{ fontVariationSettings: '"wdth" 118' }}>
              {(region ? `Corren en ${region.name}` : "No planificados").toUpperCase()}
            </text>
            <text x={LABEL_W - 8} y={top + 20} fontSize={10} textAnchor="end" fill="var(--color-muted)" className="num">
              {g.rows.length}
            </text>
            {g.rows.map((row, i) => (
              <GanttRow key={row.job.id} row={row} y0={top + GROUP_H + i * ROW_H} x={x} compare={compare} reduce={!!reduce} width={width} />
            ))}
          </g>
        );
      })}

      {/* Ahora */}
      <rect x={LABEL_W} y={0} width={Math.max(0, nowX - LABEL_W)} height={total} fill="var(--color-bg)" opacity={0.4} pointerEvents="none" />
      <line x1={nowX} x2={nowX} y1={0} y2={total} stroke="var(--color-lime)" strokeWidth={1.25} />
      <rect x={nowX - 22} y={CHART_H + 4} width={44} height={16} fill="var(--color-lime)" />
      <text x={nowX} y={CHART_H + 15.5} fontSize={10} textAnchor="middle" fill="var(--color-bg)" fontWeight={600} className="num">
        AHORA
      </text>

      {hover !== null && (
        <g pointerEvents="none">
          <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={0} y2={CHART_H} stroke="var(--color-fg)" strokeOpacity={0.4} />
          <g transform={`translate(${Math.min(x(hover + 0.5) + 8, width - 150)}, 8)`}>
            <rect width={140} height={20 + snap.regions.length * 15} fill="var(--color-panel)" stroke="var(--color-line-2)" />
            <text x={8} y={14} fontSize={10} fill="var(--color-muted)" className="num">
              {fmtSlot(hover)}
            </text>
            {snap.regions.map((r, i) => (
              <text key={r.id} x={8} y={30 + i * 15} fontSize={11} fill={REGION_COLOR[r.id]} className="num">
                {r.short.padEnd(5, " ")} {fmt(snap.series[r.id].intensity[hover])} g/kWh
              </text>
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}

function GanttRow({
  row,
  y0,
  x,
  compare,
  reduce,
  width,
}: {
  row: Row;
  y0: number;
  x: (v: number) => number;
  compare: StrategyId;
  reduce: boolean;
  width: number;
}) {
  const { job } = row;
  const cy = y0 + ROW_H / 2;
  const h = ROW_H - 7;
  const moved = row.green.some((p) => p.region !== job.home);
  return (
    <g>
      <title>
        {`${job.name} (${job.kind_label})\n${job.power_kw} kW · ${job.duration / 2} h · llega ${fmtSlot(job.arrival)} · deadline ${fmtSlot(job.deadline)}\nOrigen: ${job.home.toUpperCase()}${moved ? " · migrado" : ""}`}
      </title>
      <rect x={0} y={y0} width={width} height={ROW_H} fill="transparent" />
      <circle cx={8} cy={cy} r={2.5} fill={REGION_COLOR[job.home]} />
      <text x={16} y={cy + 3.5} fontSize={11.5} fill="var(--color-fg-2)">
        {job.name.length > 30 ? job.name.slice(0, 29) + "…" : job.name}
      </text>
      <text x={LABEL_W - 8} y={cy + 3.5} fontSize={9.5} textAnchor="end" fill="var(--color-dim)" className="num">
        {job.power_kw} kW
      </text>
      {/* Ventana llegada → deadline */}
      <line x1={x(job.arrival)} x2={x(job.deadline)} y1={cy} y2={cy} stroke="var(--color-line-2)" />
      <line x1={x(job.deadline)} x2={x(job.deadline)} y1={cy - 5} y2={cy + 5} stroke="var(--color-muted)" />
      {/* Donde habría corrido sin el planificador */}
      {row.ghost.map((p) => {
        // "Primera región" a veces manda el trabajo a otra región: se marca con el color y el nombre de esa región.
        const away = p.region !== job.home;
        return (
          <g key={`g-${p.task_id}`}>
            <rect
              x={x(p.start) + 0.5}
              y={cy - h / 2 + 0.5}
              width={Math.max(2, x(p.end) - x(p.start) - 1)}
              height={h - 1}
              fill={away ? REGION_COLOR[p.region] : "none"}
              fillOpacity={away ? 0.18 : 0}
              stroke={away ? REGION_COLOR[p.region] : STRATEGY[compare].color}
              strokeOpacity={0.95}
              strokeWidth={away ? 1.5 : 1}
              strokeDasharray="3 2.5"
            />
            {away && (
              <text x={x(p.start) - 4} y={cy + 3.5} fontSize={9.5} textAnchor="end" fill={REGION_COLOR[p.region]} className="num">
                {`en ${p.region.toUpperCase()}`}
              </text>
            )}
          </g>
        );
      })}
      {/* Plan verde */}
      {row.green.map((p) => (
        <motion.rect
          key={p.task_id}
          initial={false}
          animate={{ x: x(p.start), width: Math.max(2, x(p.end) - x(p.start)) }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 22 }}
          y={cy - h / 2}
          height={h}
          fill={p.interrupted ? "url(#hatch)" : REGION_COLOR[p.region]}
          fillOpacity={p.interrupted ? 1 : 0.88}
          stroke={p.interrupted ? "#ff4048" : "none"}
        />
      ))}
      {row.unscheduled && (
        <text x={x(job.arrival)} y={cy + 3.5} fontSize={10.5} fill="var(--color-alert)">
          sin lugar antes del deadline
        </text>
      )}
    </g>
  );
}
