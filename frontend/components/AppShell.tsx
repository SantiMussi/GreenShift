"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReplanBanner } from "@/components/hud/ReplanBanner";
import { Closing, Intro } from "@/components/presentation/Intro";
import { ScriptCaptions, ShortcutsOverlay } from "@/components/presentation/Overlays";
import { useKeyboardShortcuts, useScriptRunner } from "@/components/presentation/usePresentation";
import { ScenarioDock } from "@/components/ScenarioDock";
import { Logo, TopBar } from "@/components/TopBar";
import { BSideView } from "@/components/views/BSideView";
import { ControlView } from "@/components/views/ControlView";
import { KpiView } from "@/components/views/KpiView";
import { TimelineView } from "@/components/views/TimelineView";
import { API_URL, useStore } from "@/lib/store";

export function AppShell() {
  const connect = useStore((s) => s.connect);
  const snap = useStore((s) => s.snap);
  const view = useStore((s) => s.view);
  const intro = useStore((s) => s.intro);
  const closing = useStore((s) => s.closing);

  const syncTheme = useStore((s) => s.syncTheme);

  useEffect(() => connect(), [connect]);
  useEffect(() => syncTheme(), [syncTheme]);
  useKeyboardShortcuts();
  useScriptRunner();

  return (
    <TooltipProvider delayDuration={250}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-fg focus:px-3 focus:py-2 focus:text-bg">
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh flex-col lg:h-dvh">
        <TopBar />
        <main id="main" className="relative min-h-0 flex-1">
          {!snap ? (
            <Boot />
          ) : (
            <>
              <ControlView active={view === "control" && intro === null && !closing} />
              <AnimatePresence mode="wait">
                {view !== "control" && (
                  <motion.div
                    key={view}
                    className="absolute inset-0 z-20 overflow-y-auto bg-bg"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    {view === "timeline" && <TimelineView />}
                    {view === "kpis" && <KpiView />}
                    {view === "bside" && <BSideView />}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>
        <ScenarioDock />
      </div>
      <AnimatePresence>{intro !== null && snap && <Intro key="intro" />}</AnimatePresence>
      <Closing />
      <ReplanBanner />
      <ScriptCaptions />
      <ShortcutsOverlay />
    </TooltipProvider>
  );
}

function Boot() {
  const connection = useStore((s) => s.connection);
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo />
      {connection === "offline" ? (
        <div className="max-w-md space-y-2">
          <p className="text-[14px] text-fg">No hay conexión con el motor de planificación.</p>
          <p className="text-[12.5px] text-muted">
            Verificá que el backend esté corriendo en <span className="num text-fg-2">{API_URL}</span> (con{" "}
            <span className="num text-fg-2">npm run dev</span> en la raíz se levantan ambos). Reintentando…
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative h-px w-40 overflow-hidden bg-line">
            <div className="scan h-full w-1/3 bg-lime" />
          </div>
          <span className="label">Cargando plan inicial</span>
        </div>
      )}
    </div>
  );
}
