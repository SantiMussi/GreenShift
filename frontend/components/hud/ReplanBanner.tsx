"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fmt } from "@/lib/format";
import { useStore } from "@/lib/store";

const STATUS: Record<string, string> = { OPTIMAL: "óptimo", FEASIBLE: "factible" };

/** Aviso visible de replanificación: mientras CP-SAT trabaja y al terminar. */
export function ReplanBanner() {
  const replanning = useStore((s) => s.clock?.replanning ?? false);
  const pulse = useStore((s) => s.pulse);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (!pulse) return;
    setShowDone(true);
    const id = setTimeout(() => setShowDone(false), 4200);
    return () => clearTimeout(id);
  }, [pulse]);

  const r = pulse?.record;
  const visible = replanning || (showDone && r);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[64px] z-40 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={replanning ? "busy" : `done-${r?.id}`}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="frame relative overflow-hidden px-4 py-2"
          >
            {replanning ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="label !text-lime">Replanificando</span>
                  <span className="text-[12px] text-fg-2">CP-SAT busca el plan con menos CO₂ que cumpla deadlines y capacidad…</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden">
                  <div className="scan h-full w-1/3 bg-lime" />
                </div>
              </>
            ) : (
              r && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="label !text-lime">Plan actualizado</span>
                  <span className="text-[12px] text-fg-2">{r.reason}</span>
                  <span className="num text-[11.5px] text-muted">
                    {STATUS[r.status] ?? r.status.toLowerCase()} en {fmt(r.wall_time_s, 2)} s · {fmt(r.n_vars)} variables
                  </span>
                  <span className="num text-[11.5px] text-fg">
                    {r.moves.length} {r.moves.length === 1 ? "trabajo reubicado" : "trabajos reubicados"}
                  </span>
                </div>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
