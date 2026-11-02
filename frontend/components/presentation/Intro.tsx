"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SimulatedBadge } from "@/components/hud/Panel";
import { Logo } from "@/components/TopBar";
import { Kbd } from "@/components/ui/kbd";
import { REGION_COLOR, STRATEGY } from "@/lib/colors";
import { fmt, fmtSlot } from "@/lib/format";
import { useStore } from "@/lib/store";
import { COURSE, TEAM } from "@/lib/team";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

export const INTRO_STEPS = ["El problema", "La idea", "Cómo funciona"] as const;

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Pantallas de entrada antes del centro de control: reemplazan a las slides. */
export function Intro() {
  const step = useStore((s) => s.intro);
  const snap = useStore((s) => s.snap);
  if (step === null || !snap) return null;
  const last = step === INTRO_STEPS.length - 1;

  return (
    <motion.div
      className="fixed inset-0 z-[45] flex flex-col overflow-y-auto bg-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.5, ease: EASE }}
      role="dialog"
      aria-modal="true"
      aria-label={`Introducción, paso ${step + 1} de ${INTRO_STEPS.length}: ${INTRO_STEPS[step]}`}
    >
      <header className="flex items-center justify-between gap-4 px-6 py-4 lg:px-12">
        <Logo />
        <div className="flex items-center gap-4">
          <SimulatedBadge />
          <span className="num text-[13px] text-muted">
            {String(step + 1).padStart(2, "0")} / {String(INTRO_STEPS.length).padStart(2, "0")}
          </span>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-[1560px] flex-1 flex-col justify-center px-6 py-3 lg:px-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {step === 0 && <StepProblem snap={snap} />}
            {step === 1 && <StepIdea snap={snap} />}
            {step === 2 && <StepFlow />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line px-6 py-4 lg:px-12">
        <ol className="flex flex-1 gap-2" aria-label="Pasos de la introducción">
          {INTRO_STEPS.map((label, i) => (
            <li key={label} className="min-w-0 flex-1">
              <button
                onClick={() => useStore.getState().setIntro(i)}
                className="group block w-full text-left"
                aria-current={i === step ? "step" : undefined}
              >
                <span className={cn("block h-[3px] transition-colors", i <= step ? "bg-lime" : "bg-line-2")} />
                <span className={cn("label mt-2 block truncate !text-[10px]", i === step ? "!text-fg" : "group-hover:!text-fg-2")}>
                  {label}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="hidden items-center gap-3 text-[12px] text-muted md:flex">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> navegar <Kbd>Esc</Kbd> saltar
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => useStore.getState().setIntro(step - 1)}
              className="flex h-11 items-center gap-2 border border-line-2 px-4 text-[13px] text-fg-2 hover:text-fg"
            >
              <ArrowLeft className="size-4" /> Anterior
            </button>
          )}
          <button
            onClick={() => (last ? useStore.getState().enterApp() : useStore.getState().setIntro(step + 1))}
            className={cn(
              "flex h-11 items-center gap-2 px-5 text-[13.5px] font-medium transition-[filter]",
              last ? "bg-lime text-bg hover:brightness-110" : "bg-fg text-bg hover:brightness-125",
            )}
            autoFocus
          >
            {last ? "Entrar al centro de control" : "Siguiente"} <ArrowRight className="size-4" />
          </button>
        </div>
      </footer>
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="label !text-[12px] !text-lime">{children}</p>;
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="display mt-4 max-w-[24ch] text-[clamp(40px,5vw,96px)] text-fg [text-wrap:balance]">{children}</h1>
  );
}

/* ------------------------------------------------------------ 1. Problema */

function StepProblem({ snap }: { snap: Snapshot }) {
  const reduce = useReducedMotion();
  const day = snap.series.amba.intensity.slice(0, 48);
  const W = 900;
  const H = 360;
  const lo = Math.min(...day) - 20;
  const hi = Math.max(...day) + 15;
  const x = (i: number) => 10 + (i / (day.length - 1)) * (W - 20);
  const y = (v: number) => H - 30 - ((v - lo) / (hi - lo)) * (H - 70);
  const d = day.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const peak = day.indexOf(Math.max(...day));
  const valley = day.indexOf(Math.min(...day));
  const drop = (100 * (day[peak] - day[valley])) / day[peak];

  return (
    <div>
      <Eyebrow>El problema</Eyebrow>
      <Headline>El mismo kWh no contamina igual a cualquier hora.</Headline>
    <div className="mt-8 grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div>
        <p className="max-w-xl text-[clamp(17px,1.5vw,24px)] leading-snug text-fg-2">
          Los trabajos batch (backups, ETL, entrenamiento de modelos) corren apenas alguien los lanza, o a una hora fija, sin
          mirar la red. Muchas veces eso es a la noche, cuando la red quema más gas.
        </p>
        <p className="mt-4 max-w-xl text-[clamp(17px,1.5vw,24px)] leading-snug text-fg">
          ¿Y si esperaran a la hora y el lugar más limpios, sin pasarse de su deadline?
        </p>
        <p className="mt-10 text-[13px] text-muted">
          {TEAM.join(" · ")}
          <br />
          {COURSE}
        </p>
      </div>
      <figure>
        <svg viewBox={`0 0 ${W} ${H + 30}`} className="h-auto w-full" role="img" aria-label={`Intensidad de carbono del AMBA en un día: pico de ${fmt(day[peak])} g/kWh a las ${fmtSlot(peak).slice(4)} y mínimo de ${fmt(day[valley])} a las ${fmtSlot(valley).slice(4)}`}>
          <defs>
            <linearGradient id="intro-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--c-inmediato)" stopOpacity={0.32} />
              <stop offset="1" stopColor="var(--c-inmediato)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <line x1={10} x2={W - 10} y1={H - 30} y2={H - 30} stroke="var(--color-line-2)" strokeWidth={2} />
          {[0, 12, 24, 36, 47].map((i) => (
            <text key={i} x={x(i)} y={H + 2} textAnchor={i === 0 ? "start" : i === 47 ? "end" : "middle"} fontSize={20} fill="var(--color-muted)" className="num">
              {String(Math.floor(i / 2)).padStart(2, "0")} h
            </text>
          ))}
          <motion.path
            d={`${d}L${x(day.length - 1)},${H - 30}L${x(0)},${H - 30}Z`}
            fill="url(#intro-area)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 1.2, duration: 0.8 }}
          />
          <motion.path
            d={d}
            fill="none"
            stroke="var(--c-inmediato)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.5 }}>
            <circle cx={x(peak)} cy={y(day[peak])} r={10} fill="var(--c-inmediato)" />
            <text x={x(peak) - 18} y={y(day[peak]) + 7} textAnchor="end" fontSize={24} fill="var(--c-inmediato)">
              Pico {fmtSlot(peak).slice(4)} · <tspan fontWeight={700}>{fmt(day[peak])}</tspan> g CO₂/kWh
            </text>
            <circle cx={x(valley)} cy={y(day[valley])} r={10} fill="var(--color-lime)" />
            <text x={x(valley) + 18} y={y(day[valley]) + 34} fontSize={24} fill="var(--color-lime)">
              Madrugada {fmtSlot(valley).slice(4)} · <tspan fontWeight={700}>{fmt(day[valley])}</tspan> (−{fmt(drop, 0)} %)
            </text>
          </motion.g>
        </svg>
        <figcaption className="mt-2 text-[13px] text-muted">Intensidad de carbono de la red en el AMBA durante un día (datos simulados).</figcaption>
      </figure>
    </div>
    </div>
  );
}

/* --------------------------------------------------------------- 2. Idea */

const JOB = { name: "Entrenamiento del modelo antifraude", kw: 210, slots: 12, arrival: 38, deadline: 64 };

function StepIdea({ snap }: { snap: Snapshot }) {
  const reduce = useReducedMotion();
  const from = 24;
  const to = 72;
  const W = 1200;
  const CH = 250;
  const LANE_Y = CH + 40;
  const x = (s: number) => 150 + ((s - from) / (to - from)) * (W - 170);
  const y = (v: number) => CH - 20 - ((v - 150) / (480 - 150)) * (CH - 40);

  // Dónde convendría correr este trabajo: el mejor bloque de 6 h antes del deadline, según los datos.
  const best = useMemo(() => {
    const avg = (rid: string, s: number) => {
      const r = snap.regions.find((q) => q.id === rid)!;
      const vals = snap.series[rid].intensity.slice(s, s + JOB.slots);
      return (vals.reduce((a, b) => a + b, 0) / vals.length) * r.pue;
    };
    const base = avg("amba", JOB.arrival);
    let pick = { rid: "amba", start: JOB.arrival, score: base };
    for (const r of snap.regions)
      for (let s = JOB.arrival; s + JOB.slots <= JOB.deadline; s++) {
        const sc = avg(r.id, s);
        if (sc < pick.score) pick = { rid: r.id, start: s, score: sc };
      }
    return { ...pick, saving: (100 * (base - pick.score)) / base };
  }, [snap]);
  const region = snap.regions.find((r) => r.id === best.rid)!;
  const slots = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <div>
      <Eyebrow>La idea</Eyebrow>
      <Headline>Mover lo que puede esperar a la hora y al lugar más limpios.</Headline>
      <p className="mt-4 max-w-3xl text-[clamp(17px,1.5vw,24px)] leading-snug text-fg-2">
        Sin pasarse del deadline y sin tocar lo que no se mueve: la API y el checkout siguen donde están.
      </p>
      <svg viewBox={`0 0 ${W} ${LANE_Y + 120}`} className="mt-4 h-auto max-h-[34vh] w-full" role="img" aria-label={`Ejemplo: un trabajo de 6 horas pasa de las 19 h en AMBA a ${region.name} a las ${fmtSlot(best.start).slice(4)}, con ${fmt(best.saving, 0)} % menos CO₂`}>
        {[24, 36, 48, 60, 72].map((s) => (
          <g key={s}>
            <line x1={x(s)} x2={x(s)} y1={0} y2={LANE_Y + 100} stroke="var(--color-line)" strokeDasharray="3 6" />
            <text x={x(s)} y={LANE_Y + 118} textAnchor="middle" fontSize={18} fill="var(--color-muted)" className="num">
              {fmtSlot(s)}
            </text>
          </g>
        ))}
        <rect x={x(40)} y={0} width={x(62) - x(40)} height={LANE_Y + 100} fill="#7fb2ff" opacity={0.03} />
        {snap.regions.map((r, i) => {
          const d = slots.map((s, k) => `${k ? "L" : "M"}${x(s).toFixed(1)},${y(snap.series[r.id].intensity[Math.min(s, 95)]).toFixed(1)}`).join("");
          const lastV = snap.series[r.id].intensity[to - 1];
          return (
            <g key={r.id}>
              <motion.path
                d={d}
                fill="none"
                stroke={REGION_COLOR[r.id]}
                strokeWidth={3.5}
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.3, delay: reduce ? 0 : i * 0.2, ease: "easeInOut" }}
              />
              <text x={140} y={y(snap.series[r.id].intensity[from]) + 6} textAnchor="end" fontSize={20} fill={REGION_COLOR[r.id]}>
                {r.short}
              </text>
              <title>{`${r.name}: ${fmt(lastV)} g/kWh`}</title>
            </g>
          );
        })}
        <text x={150} y={20} fontSize={18} fill="var(--color-dim)">g CO₂/kWh</text>

        {/* Carriles: sin planificar vs GreenShift */}
        <text x={140} y={LANE_Y + 26} textAnchor="end" fontSize={18} fill={STRATEGY.inmediato.color}>Sin planificar</text>
        <text x={140} y={LANE_Y + 76} textAnchor="end" fontSize={18} fill={STRATEGY.verde.color}>GreenShift</text>
        <rect x={x(JOB.arrival)} y={LANE_Y + 8} width={x(JOB.arrival + JOB.slots) - x(JOB.arrival)} height={28} fill="none" stroke={STRATEGY.inmediato.color} strokeWidth={2} strokeDasharray="6 4" />
        <text x={x(JOB.arrival) + 10} y={LANE_Y + 28} fontSize={16} fill="var(--color-fg)">AMBA · {fmtSlot(JOB.arrival).slice(4)}</text>
        <motion.g
          initial={{ x: reduce ? 0 : x(JOB.arrival) - x(best.start), y: reduce ? 0 : -50, opacity: 0.4 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.6, duration: 1.1, ease: EASE }}
        >
          <rect x={x(best.start)} y={LANE_Y + 58} width={x(best.start + JOB.slots) - x(best.start)} height={28} fill={REGION_COLOR[best.rid]} />
          <text x={x(best.start) + 10} y={LANE_Y + 78} fontSize={16} fill="var(--color-bg)" fontWeight={600}>
            {region.short} · {fmtSlot(best.start).slice(4)}
          </text>
        </motion.g>
        <line x1={x(JOB.deadline)} x2={x(JOB.deadline)} y1={LANE_Y} y2={LANE_Y + 94} stroke="var(--color-fg)" strokeWidth={2} />
        <text x={x(JOB.deadline) + 8} y={LANE_Y + 94} fontSize={16} fill="var(--color-fg-2)">deadline {fmtSlot(JOB.deadline).slice(4)}</text>
      </svg>
      <motion.p
        className="mt-4 text-[clamp(16px,1.3vw,21px)] text-fg-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 2.6 }}
      >
        Ejemplo: <span className="text-fg">{JOB.name}</span> ({JOB.kw} kW, 6 h). Llega a las {fmtSlot(JOB.arrival).slice(4)};
        corriéndolo en <span style={{ color: REGION_COLOR[best.rid] }}>{region.name}</span> a las {fmtSlot(best.start).slice(4)} emite{" "}
        <span className="num text-lime">{fmt(best.saving, 0)} % menos CO₂</span> y termina antes del deadline.
      </motion.p>
    </div>
  );
}

/* --------------------------------------------------------- 3. Cómo funciona */

const FLOW: [string, string][] = [
  ["Problema", "El batch corre cuando alguien lo lanza, a veces en el pico más sucio de la red."],
  ["Datos", "Intensidad, tarifa y capacidad por región y hora. Potencia, duración y deadline por trabajo."],
  ["Adquisición", "Copia local en SQLite. Adaptador listo para despacho de CAMMESA."],
  ["Procesamiento", "OR-Tools CP-SAT elige cuándo y dónde, con menos CO₂, sin pasarse de deadlines ni capacidad."],
  ["Información", "Indicadores ambientales, sociales, económicos y de servicio, en vivo."],
  ["Decisión", "Un plan por trabajo: a qué hora y en qué región corre."],
];

function StepFlow() {
  const reduce = useReducedMotion();
  return (
    <div>
      <Eyebrow>Cómo funciona</Eyebrow>
      <Headline>Del dato de la red a la decisión.</Headline>
      <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {FLOW.map(([title, text], i) => {
          const core = title === "Procesamiento";
          return (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.15 + i * 0.12, duration: 0.4, ease: EASE }}
              className={cn("frame flex flex-col gap-3 border-t-[3px] p-5", core ? "border-lime" : "border-t-dim")}
            >
              <span className={cn("num text-[14px]", core ? "text-lime" : "text-muted")}>{String(i + 1).padStart(2, "0")}</span>
              <h2 className="text-[clamp(18px,1.4vw,24px)] font-semibold text-fg">{title}</h2>
              <p className="text-[clamp(14px,1.05vw,17px)] leading-snug text-fg-2">{text}</p>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-6 text-[13px] text-muted">
        FastAPI · OR-Tools CP-SAT · SQLite · Next.js · React Three Fiber · tiempo real por SSE · todo corre sin internet
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- Cierre */

export function Closing() {
  const open = useStore((s) => s.closing);
  const snap = useStore((s) => s.snap);
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && snap && (
        <motion.div
          className="fixed inset-0 z-[45] flex flex-col overflow-y-auto bg-[#c5f04a] px-6 py-8 text-[#0b0d10] lg:px-16 lg:py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          role="dialog"
          aria-modal="true"
          aria-label="Cierre"
        >
          <p className="label !text-[12px] !text-[#0b0d10]">GreenShift</p>
          <div className="mx-auto flex w-full max-w-[1560px] flex-1 flex-col justify-center">
            <motion.h1
              className="display text-[clamp(52px,8vw,140px)]"
              initial={{ y: reduce ? 0 : 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              Misma infraestructura.
              <br />
              Menos carbono.
            </motion.h1>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {closingStats(snap).map(([value, label], i) => (
                <motion.div
                  key={label}
                  className="border-t-[3px] border-[#0b0d10] pt-5"
                  initial={{ y: reduce ? 0 : 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: reduce ? 0 : 0.3 + i * 0.15, duration: 0.5, ease: EASE }}
                >
                  <div className="display num text-[clamp(52px,6vw,104px)]">{value}</div>
                  <div className="mt-2 max-w-sm text-[clamp(16px,1.4vw,22px)] leading-snug text-[#1f2a08]">{label}</div>
                </motion.div>
              ))}
            </div>
            <p className="mt-14 text-[clamp(26px,2.6vw,44px)] font-semibold">Gracias. ¿Preguntas?</p>
          </div>
          <p className="text-[13px] text-[#2b3510]">
            Datos simulados de la demo · el modelo está listo para enchufarle datos reales de CAMMESA ·{" "}
            <span className="num">Esc</span> vuelve a la app
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function closingStats(snap: Snapshot): [string, string][] {
  const s = snap.summary;
  const imm = snap.plans.inmediato.metrics.emissions_kg;
  const total = imm + s.fixed_load_kg ? (100 * s.avoided_kg) / (imm + s.fixed_load_kg) : 0;
  return [
    [`−${fmt(s.reduction_pct, 0)} %`, "de CO₂ en los trabajos que se pueden mover"],
    [`−${fmt(total, 0)} %`, "sobre la huella total de la empresa"],
    [`${fmt(snap.plans.verde.metrics.deadlines_pct, 0)} %`, "de los deadlines cumplidos"],
  ];
}
