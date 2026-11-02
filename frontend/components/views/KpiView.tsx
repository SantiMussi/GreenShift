"use client";

import { motion } from "framer-motion";
import { Car, Clock3, Leaf, Wallet } from "lucide-react";
import { SimulatedBadge } from "@/components/hud/Panel";
import { STRATEGY } from "@/lib/colors";
import { cumAt } from "@/lib/derive";
import { fmt, fmtKg, fmtUsd } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { StrategyId } from "@/lib/types";

const ORDER: StrategyId[] = ["inmediato", "primera_region", "verde"];

export function KpiView() {
  const snap = useStore((s) => s.snap);
  const t = useStore((s) => s.hudT);
  if (!snap) return null;
  const P = snap.plans;
  const imm = P.inmediato.metrics;
  const g = P.verde.metrics;
  const s = snap.summary;
  const totalImm = imm.emissions_kg + s.fixed_load_kg;
  const totalPct = totalImm ? (100 * s.avoided_kg) / totalImm : 0;
  const avoidedNow = cumAt(imm.cum_kg, t) - cumAt(g.cum_kg, t);
  const costPct = imm.cost_usd ? (100 * s.savings_usd) / imm.cost_usd : 0;

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="wide text-[13px] font-semibold uppercase tracking-[0.16em] text-fg">Indicadores del plan · 48 h</h1>
        <SimulatedBadge />
        <span className="text-[12px] text-muted">
          Objetivo actual:{" "}
          <span className="text-fg-2">{{ co2: "mínimo CO₂", mixto: "CO₂ + costo", costo: "mínimo costo" }[snap.objective]}</span>
        </span>
      </div>

      <section className="mt-5 grid gap-6 border-y border-line py-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="label">CO₂ evitado en cargas flexibles (plan completo)</div>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
            <span className="display num text-[92px] text-lime lg:text-[120px]">{fmtKg(s.avoided_kg)}</span>
            <span className="pb-3">
              <span className="display num block text-[44px] text-fg">−{fmt(s.reduction_pct, 0)}%</span>
              <span className="text-[12px] text-muted">vs. ejecutar de inmediato</span>
            </span>
          </div>
          <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-fg-2">
            Mismo cómputo, mismos deadlines: sólo cambia <em className="not-italic text-fg">cuándo</em> y{" "}
            <em className="not-italic text-fg">dónde</em> corre cada trabajo. Sobre la huella total (incluyendo API y checkout,
            que no se mueven) la reducción es de <span className="num text-fg">{fmt(totalPct, 1)}%</span>.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 self-end">
          <Mini label="Evitado hasta ahora" value={fmtKg(Math.max(0, avoidedNow))} />
          <Mini label="Energía flexible" value={`${fmt(g.energy_kwh / 1000, 1)} MWh`} hint="Casi igual en todas las estrategias" />
          <Mini label="Optimizaciones CP-SAT" value={fmt(snap.planner.replans.length)} />
          <Mini label="Estado del último plan" value={P.verde.stats?.status === "OPTIMAL" ? "Óptimo" : "Factible"} />
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Card
          icon={<Leaf />}
          kind="Ambiental"
          title="Emisiones de las cargas flexibles"
          big={`${fmt(s.reduction_pct, 0)}%`}
          bigLabel="menos CO₂"
          rows={[
            ["CO₂ evitado", fmtKg(s.avoided_kg)],
            ["Huella total (con cargas fijas)", `−${fmt(totalPct, 1)}%`],
            ["CO₂ por mover datos entre regiones", fmtKg(g.transfer_kg)],
          ]}
        >
          <Bars value={(k) => P[k].metrics.emissions_kg} format={fmtKg} />
        </Card>
        <Card
          icon={<Car />}
          kind="Social"
          title="Equivalencias para dimensionar"
          big={fmt(s.car_km)}
          bigLabel="km de auto evitados"
          rows={[
            ["Árboles adultos absorbiendo un año", fmt(s.trees_year, 0)],
            ["Factor auto", "0,12 kg CO₂/km"],
            ["Factor árbol", "21 kg CO₂/año"],
          ]}
          note="Equivalencias aproximadas y redondeadas, sólo para dar escala."
        />
        <Card
          icon={<Wallet />}
          kind="Económico"
          title="Costo eléctrico del cómputo flexible"
          big={fmtUsd(s.savings_usd)}
          bigLabel={`de ahorro (−${fmt(costPct, 0)}%)`}
          rows={[
            ["Plan verde", fmtUsd(g.cost_usd)],
            ["De inmediato", fmtUsd(imm.cost_usd)],
            ["Primera región disponible", fmtUsd(P.primera_region.metrics.cost_usd)],
          ]}
          note="Tarifas horarias simuladas (valle / resto / pico)."
        >
          <Bars value={(k) => P[k].metrics.cost_usd} format={fmtUsd} />
        </Card>
        <Card
          icon={<Clock3 />}
          kind="Servicio"
          title="Calidad de servicio"
          big={`${fmt(g.deadlines_pct, 0)}%`}
          bigLabel="deadlines cumplidos"
          rows={[
            ["Demora media de inicio", `${fmt(g.avg_delay_h, 1)} h (vs. ${fmt(imm.avg_delay_h, 1)} h)`],
            ["Latencia de red añadida (migrados)", `${fmt(g.avg_latency_ms, 0)} ms`],
            ["Trabajos migrados de región", `${g.moved_jobs} de ${g.deadlines_total}`],
            ["Deadlines de inmediato / 1.ª región", `${fmt(imm.deadlines_pct, 0)}% / ${fmt(P.primera_region.metrics.deadlines_pct, 0)}%`],
          ]}
          note="La API y el checkout nunca se mueven: la latencia sólo afecta a trabajos batch."
        />
      </div>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-l border-line pl-3">
      <div className="label !text-[9.5px]">{label}</div>
      <div className="display num mt-1 text-[28px] text-fg">{value}</div>
      {hint && <div className="text-[10.5px] text-muted">{hint}</div>}
    </div>
  );
}

function Card({
  icon,
  kind,
  title,
  big,
  bigLabel,
  rows,
  note,
  children,
}: {
  icon: React.ReactNode;
  kind: string;
  title: string;
  big: string;
  bigLabel: string;
  rows: [string, string][];
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="frame flex flex-col p-4"
    >
      <header className="flex items-center gap-2 text-lime [&_svg]:size-4">
        {icon}
        <span className="label !text-lime">{kind}</span>
      </header>
      <h2 className="mt-1 text-[13px] text-fg-2">{title}</h2>
      <div className="mt-4">
        <div className="display num text-[54px] text-fg">{big}</div>
        <div className="mt-1 text-[12px] text-muted">{bigLabel}</div>
      </div>
      {children && <div className="mt-4">{children}</div>}
      <dl className="mt-4 divide-y divide-line border-t border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
            <dt className="text-muted">{k}</dt>
            <dd className="num text-right text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-auto pt-3 text-[10.5px] leading-snug text-dim">{note}</p>}
    </motion.article>
  );
}

function Bars({ value, format }: { value: (k: StrategyId) => number; format: (v: number) => string }) {
  const max = Math.max(...ORDER.map(value), 1);
  return (
    <div className="space-y-1.5">
      {ORDER.map((k) => (
        <div key={k} className="grid grid-cols-[92px_1fr_auto] items-center gap-2 text-[11px]">
          <span className="text-muted">{STRATEGY[k].short}</span>
          <div className="h-[6px] bg-line">
            <motion.div
              className="h-full"
              style={{ background: STRATEGY[k].color }}
              initial={false}
              animate={{ width: `${(value(k) / max) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <span className="num w-20 text-right text-fg-2">{format(value(k))}</span>
        </div>
      ))}
    </div>
  );
}
