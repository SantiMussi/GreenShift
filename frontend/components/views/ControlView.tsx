"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CarbonLedger } from "@/components/hud/CarbonLedger";
import { EventFeed } from "@/components/hud/EventFeed";
import { RegionCards } from "@/components/hud/RegionCards";
import { SceneFallback } from "@/components/scene/SceneFallback";
import { SceneLabels } from "@/components/scene/SceneLabels";
import { detectGpu, prefersReducedMotion, type GpuTier } from "@/components/scene/gpu";
import { Button } from "@/components/ui/button";
import { REGION_COLOR, STRATEGY, intensityColor } from "@/lib/colors";
import { cumAt, regionEmissionRate } from "@/lib/derive";
import { fmt, fmtKg } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const PEAK_HOUR = 19.5; // pico nocturno del AMBA (lunes 19:30)

const Scene = dynamic(() => import("@/components/scene/Scene"), { ssr: false });

export function ControlView({ active }: { active: boolean }) {
  const [env, setEnv] = useState<{ tier: GpuTier; reduced: boolean } | null>(null);

  useEffect(() => {
    setEnv({ tier: detectGpu(), reduced: prefersReducedMotion() });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setEnv((e) => (e ? { ...e, reduced: mq.matches } : e));
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <div className="relative flex flex-col lg:absolute lg:inset-0" aria-hidden={!active}>
      <div className="relative h-[58vh] min-h-[360px] lg:absolute lg:inset-0 lg:h-auto">
        {env && (env.tier === "none" ? <SceneFallback /> : <Scene active={active} tier={env.tier} reduced={env.reduced} />)}
        {env && env.tier !== "none" && <SceneLabels />}
        <WarnOverlay />
        <Legend />
      </div>
      <div className="pointer-events-none relative grid gap-3 p-3 lg:absolute lg:inset-0 lg:grid-cols-[300px_1fr_340px] lg:p-4">
        <RegionCards className="pointer-events-auto lg:max-h-full lg:overflow-y-auto no-scrollbar" />
        <MapPlanToggle />
        <div className="pointer-events-auto flex flex-col gap-3">
          <CarbonLedger />
          <EventFeed />
        </div>
      </div>
    </div>
  );
}

/** Alterna qué plan dibuja el mapa, para mostrar cómo se vería el mismo día sin GreenShift. */
function MapPlanToggle() {
  const mapPlan = useStore((s) => s.mapPlan);
  const setMapPlan = useStore((s) => s.setMapPlan);
  const control = useStore((s) => s.control);
  return (
    <div className="flex flex-col items-center gap-1.5 lg:pt-1">
      <div className="pointer-events-auto flex items-center gap-2">
        <span className="label !text-[9.5px]">Mapa</span>
        <div className="frame flex" role="group" aria-label="Plan que muestra el mapa">
          {(["verde", "inmediato"] as const).map((k) => (
            <Button
              key={k}
              variant="segment"
              size="sm"
              data-active={mapPlan === k}
              aria-pressed={mapPlan === k}
              onClick={() => setMapPlan(k)}
              className={cn("h-[30px] gap-1.5 px-3", k === "inmediato" && mapPlan === "inmediato" && "!bg-[#ff4048] !text-white")}
              title="Tecla D"
            >
              <span className="size-1.5" style={{ background: STRATEGY[k].color }} />
              {k === "verde" ? "Con GreenShift" : "Sin GreenShift"}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-[30px] px-3"
          onClick={() => void control({ t: PEAK_HOUR })}
          title="Salta el reloj al pico de la tarde-noche del lunes (19:30), donde más se nota la diferencia"
        >
          Ir al pico · 19:30
        </Button>
      </div>
      <AnimatePresence>{mapPlan === "inmediato" && <WarnBadge key="warn" />}</AnimatePresence>
    </div>
  );
}

/** Capas decorativas del modo "Sin GreenShift": viñeta roja que respira y franjas de precaución arriba y abajo. */
function WarnOverlay() {
  const warn = useStore((s) => s.mapPlan === "inmediato");
  return (
    <AnimatePresence>
      {warn && (
        <motion.div
          key="warn-overlay"
          className="pointer-events-none absolute inset-0 z-10"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="warn-vignette absolute inset-0" />
          <div className="hazard-bar absolute inset-x-0 top-0" />
          <div className="hazard-bar absolute inset-x-0 bottom-0" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Cartel grande: cuánto CO₂ de más se emite hasta ahora por no planificar. */
function WarnBadge() {
  const snap = useStore((s) => s.snap);
  const t = useStore((s) => s.hudT);
  if (!snap) return null;
  const extra = cumAt(snap.plans.inmediato.metrics.cum_kg, t) - cumAt(snap.plans.verde.metrics.cum_kg, t);
  const rate = snap.regions.reduce((acc, r) => acc + regionEmissionRate(snap, r.id, t, "inmediato").totalKgH, 0);
  return (
    <motion.div
      className="warn-card pointer-events-none mt-1 w-[310px] border border-[#ff4048]/80 bg-[#2a0e12]/90 px-4 py-2.5 text-center backdrop-blur"
      initial={{ opacity: 0, y: -14, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <div className="flex items-center justify-center gap-2 text-[#ff6a70]">
        <span className="blink size-2 bg-[#ff4048]" />
        <span className="wide text-[12px] font-bold uppercase tracking-[0.24em]">Sin GreenShift</span>
      </div>
      <div className="display num mt-1 text-[48px] text-[#ff5a62]">+{fmtKg(Math.max(0, extra))}</div>
      <div className="text-[11.5px] font-medium text-[#ffd9d9]">de CO₂ de más hasta ahora</div>
      <div className="mt-1.5 text-[10.5px] text-[#d9b4b6]">
        Emitiendo <span className="num text-[#ffd9d9]">{fmt(rate, 0)} kg/h</span> · cada trabajo corre apenas llega, sin mirar la red
      </div>
    </motion.div>
  );
}

function Legend() {
  const regions = useStore((s) => s.snap?.regions);
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-5 lg:flex">
      <div className="flex items-center gap-2">
        <span className="label !text-[9px]">Intensidad</span>
        <div
          className="h-[5px] w-28"
          style={{
            background: `linear-gradient(to right, ${[120, 240, 330, 400, 470].map((v) => intensityColor(v)).join(",")})`,
          }}
        />
        <span className="num text-[9.5px] text-muted">120 → 470 g/kWh</span>
      </div>
      <div className="flex items-center gap-3">
        {regions?.map((r) => (
          <span key={r.id} className="flex items-center gap-1.5 text-[10.5px] text-fg-2">
            <span className="size-1.5" style={{ background: REGION_COLOR[r.id] }} />
            {r.short}
          </span>
        ))}
      </div>
      <span className="text-[10.5px] text-muted">Arcos: trabajos migrados · LEDs lima: carga flexible</span>
    </div>
  );
}
