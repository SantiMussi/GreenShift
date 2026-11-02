"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { SCRIPT_DURATION } from "@/lib/script";
import { useStore } from "@/lib/store";

/** Subtítulos del guion automático + barra de progreso. */
export function ScriptCaptions() {
  const script = useStore((s) => s.script);
  return (
    <AnimatePresence>
      {script.running && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none fixed inset-x-0 bottom-[112px] z-40 flex justify-center px-4"
        >
          <div className="frame w-full max-w-3xl px-5 py-3.5" role="status" aria-live="polite">
            <div className="mb-2 flex items-center justify-between">
              <span className="label !text-lime">Guion automático</span>
              <span className="num text-[11px] text-muted">
                {fmtSec(script.elapsed)} / {fmtSec(SCRIPT_DURATION)}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={script.step}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-[17px] leading-snug text-fg [text-wrap:balance] lg:text-[19px]"
              >
                {script.caption}
              </motion.p>
            </AnimatePresence>
            <div className="mt-3 h-px bg-line">
              <div className="h-full bg-lime" style={{ width: `${(script.elapsed / SCRIPT_DURATION) * 100}%` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

const SHORTCUTS: [string[], string][] = [
  [["Espacio"], "Pausa / reanuda la simulación"],
  [["T"], "Cambia entre modo oscuro y modo claro (para proyectores con luz en la sala)"],
  [["D"], "Mapa con GreenShift ↔ sin GreenShift (de inmediato)"],
  [["M"], "Cambia de vista (control → línea de tiempo → indicadores → lado B)"],
  [["1", "2", "3", "4"], "Escenarios: ola de calor, falla de región, mucha eólica, deadlines ajustados"],
  [["0"], "Vuelve a operación normal"],
  [["⇧ 1", "⇧ 2", "⇧ 4"], "Velocidad 1x / 2x / 4x (o V para alternar)"],
  [["I"], "Vuelve a la intro (→ / Enter avanzan, ← retrocede, Esc la saltea)"],
  [["C"], "Pantalla de cierre con los resultados en vivo"],
  [["P"], "Inicia / detiene el guion automático de 3 minutos"],
  [["O"], "Objetivo: mínimo CO₂ → CO₂ + costo → mínimo costo"],
  [["F"], "Pantalla completa (modo presentación)"],
  [["R"], "Reinicia el ciclo de 48 h"],
  [["H"], "Muestra / oculta esta ayuda"],
];

export function ShortcutsOverlay() {
  const open = useStore((s) => s.showHelp);
  const close = () => useStore.getState().setShowHelp(false);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Atajos de teclado"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="frame w-full max-w-xl bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="label !text-fg">Atajos de teclado</h2>
              <button onClick={close} className="text-muted hover:text-fg" aria-label="Cerrar" autoFocus>
                <X className="size-4" />
              </button>
            </header>
            <ul className="divide-y divide-line">
              {SHORTCUTS.map(([keys, text]) => (
                <li key={text} className="flex items-center gap-4 px-4 py-2.5">
                  <span className="flex w-36 shrink-0 flex-wrap gap-1">
                    {keys.map((k) => (
                      <Kbd key={k} className="h-[22px] px-1.5 text-[11px] text-fg-2">
                        {k}
                      </Kbd>
                    ))}
                  </span>
                  <span className="text-[13px] text-fg-2">{text}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-muted">
              Los números 1–4 eligen escenarios; para la velocidad se usa Shift + número (ver README).
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
