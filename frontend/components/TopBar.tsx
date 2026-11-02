"use client";

import { Expand, Keyboard, Moon, Pause, Play, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SimulatedBadge } from "@/components/hud/Panel";
import { toggleFullscreen } from "@/components/presentation/usePresentation";
import { fmtClock } from "@/lib/format";
import { VIEWS, useStore } from "@/lib/store";
import type { Objective } from "@/lib/types";
import { cn } from "@/lib/utils";

const OBJECTIVES: { id: Objective; label: string; hint: string }[] = [
  { id: "co2", label: "CO₂", hint: "Minimizar emisiones (desempata por costo)" },
  { id: "mixto", label: "Mixto", hint: "Mitad emisiones, mitad costo (normalizados)" },
  { id: "costo", label: "Costo", hint: "Minimizar costo eléctrico (desempata por CO₂)" },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="1.5" y="4.5" width="11" height="11" fill="none" stroke="var(--color-dim)" strokeWidth="1.5" />
        <rect x="8" y="7" width="11" height="11" fill="var(--color-lime)" />
      </svg>
      <span className="wide text-[15px] font-bold uppercase tracking-[0.08em] text-fg">
        Green<span className="text-lime">Shift</span>
      </span>
    </div>
  );
}

export function TopBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const clock = useStore((s) => s.clock);
  const t = useStore((s) => s.hudT);
  const objective = useStore((s) => s.snap?.objective ?? "co2");
  const connection = useStore((s) => s.connection);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const control = useStore((s) => s.control);
  const presenting = useStore((s) => s.presenting);
  const c = fmtClock(t);

  return (
    <header className="relative z-30 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur lg:h-14 lg:flex-nowrap lg:py-0">
      <div className="flex items-center gap-4">
        <Logo />
        <div className={cn("hidden h-6 w-px bg-line-2 min-[1800px]:block", presenting && "min-[1800px]:hidden")} />
        <div className={cn("hidden leading-tight min-[1800px]:block", presenting && "min-[1800px]:hidden")}>
          <div className="text-[12px] text-fg-2">Nubeo · Operaciones de cómputo</div>
          <div className="text-[10.5px] text-muted">Planificación consciente del carbono</div>
        </div>
      </div>

      <nav aria-label="Vistas" className="order-3 flex w-full overflow-x-auto no-scrollbar lg:order-none lg:w-auto">
        <div className="flex border border-line">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? "page" : undefined}
              className={cn(
                "wide relative h-8 whitespace-nowrap px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-colors",
                view === v.id ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              <span className="min-[1800px]:hidden">{v.short}</span>
              <span className="hidden min-[1800px]:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-3 border border-line px-3 py-1" aria-label="Reloj de simulación">
          <div className="leading-none">
            <div className="label !text-[9px]">Simulado</div>
            <div className="num mt-0.5 text-[17px] text-fg">
              <span className="text-muted">{c.day}</span> {c.hm}
            </div>
          </div>
          <div className="hidden h-7 w-20 flex-col justify-center 2xl:flex" aria-hidden>
            <div className="relative h-[3px] bg-line">
              <div className="absolute inset-y-0 left-0 bg-fg-2" style={{ width: `${(t / 48) * 100}%` }} />
            </div>
            <div className="num mt-1 flex justify-between text-[9px] text-dim">
              <span>0 h</span>
              <span>48 h</span>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={clock?.paused ? "Reanudar" : "Pausar"}
                onClick={() => control({ action: "toggle" })}
              >
                {clock?.paused ? <Play /> : <Pause />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pausa / reanuda · Espacio</TooltipContent>
          </Tooltip>
          <div className="ml-1 flex border border-line" role="group" aria-label="Velocidad">
            {([1, 2, 4] as const).map((s) => (
              <Button
                key={s}
                variant="segment"
                size="sm"
                data-active={clock?.speed === s}
                aria-pressed={clock?.speed === s}
                onClick={() => control({ speed: s })}
                className="num h-[30px] px-2"
              >
                {s}x
              </Button>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Reiniciar ciclo" onClick={() => control({ action: "reset" })}>
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reiniciar el ciclo de 48 h · R</TooltipContent>
          </Tooltip>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="label hidden !text-[9.5px] 2xl:inline">Objetivo</span>
          <div className="flex border border-line" role="group" aria-label="Objetivo del planificador">
            {OBJECTIVES.map((o) => (
              <Tooltip key={o.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="segment"
                    size="sm"
                    data-active={objective === o.id}
                    aria-pressed={objective === o.id}
                    onClick={() => control({ objective: o.id })}
                    className="h-[30px] px-2.5"
                  >
                    {o.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{o.hint} · O</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <SimulatedBadge />

        <span
          className={cn(
            "size-2 shrink-0",
            connection === "online" ? "bg-lime" : connection === "offline" ? "blink bg-alert" : "bg-dim",
          )}
          title={connection === "online" ? "Conectado al motor" : "Sin conexión con el motor"}
          aria-label={connection === "online" ? "Conectado" : "Desconectado"}
        />
        <div className="hidden items-center lg:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === "dark" ? "Modo claro" : "Modo oscuro"} · T</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Atajos de teclado" onClick={() => useStore.getState().setShowHelp(true)}>
                <Keyboard />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atajos · H</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Modo presentación" onClick={() => toggleFullscreen()}>
                <Expand />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Modo presentación · F</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
