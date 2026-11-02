"use client";

import { Clapperboard, Square } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SCRIPT_DURATION } from "@/lib/script";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ScenarioDock() {
  const snap = useStore((s) => s.snap);
  const replanning = useStore((s) => s.clock?.replanning ?? false);
  const scenario = useStore((s) => s.scenario);
  const script = useStore((s) => s.script);
  const setScript = useStore((s) => s.setScript);
  if (!snap) return <div className="h-[76px] border-t border-line" />;

  return (
    <footer className="relative z-30 flex flex-col gap-2 border-t border-line bg-bg/92 px-4 py-2.5 backdrop-blur lg:flex-row lg:items-stretch">
      <div className="flex shrink-0 items-center gap-3 lg:w-44 lg:flex-col lg:items-start lg:justify-center lg:gap-0.5">
        <span className="label !text-fg-2">Escenarios en vivo</span>
        <span className="text-[10.5px] text-muted">Cambian los datos y se replanifica</span>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {snap.scenarios.map((sc) => {
          const active = snap.scenario === sc.id;
          return (
            <Tooltip key={sc.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => scenario(sc.id)}
                  disabled={replanning}
                  aria-pressed={active}
                  className={cn(
                    "group relative flex min-h-[52px] items-start gap-2.5 border px-3 py-2 text-left transition-colors disabled:cursor-wait",
                    active ? "border-fg-2/70 bg-fg/[0.05]" : "border-line hover:border-line-2 hover:bg-fg/[0.02]",
                  )}
                >
                  {active && <span className="absolute inset-x-0 top-0 h-[2px] bg-lime" />}
                  <Kbd className={cn("mt-px", active && "border-lime/60 text-lime")}>{sc.key}</Kbd>
                  <span className="min-w-0">
                    <span className={cn("block text-[12.5px] font-medium leading-tight", active ? "text-fg" : "text-fg-2")}>
                      {sc.title}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[10.5px] text-muted">{sc.subtitle}</span>
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{sc.subtitle}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <button
        onClick={() =>
          setScript(script.running ? { running: false, caption: "", step: -1 } : { running: true, elapsed: 0, step: -1 })
        }
        className={cn(
          "relative flex shrink-0 items-center gap-3 overflow-hidden border px-3 py-2 text-left transition-colors lg:w-52",
          script.running ? "border-lime/60 text-fg" : "border-line text-fg-2 hover:border-line-2",
        )}
        aria-pressed={script.running}
      >
        {script.running ? <Square className="size-4 text-lime" /> : <Clapperboard className="size-4 text-lime" />}
        <span>
          <span className="block text-[12.5px] font-medium leading-tight">
            {script.running ? "Detener guion" : "Guion automático"}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted">
            3 minutos, recorre todo <Kbd>P</Kbd>
          </span>
        </span>
        {script.running && (
          <span className="absolute inset-x-0 bottom-0 h-[2px] bg-lime/80" style={{ width: `${(script.elapsed / SCRIPT_DURATION) * 100}%` }} />
        )}
      </button>
    </footer>
  );
}
