"use client";

import { useCallback, useEffect, useRef } from "react";
import { SCRIPT, SCRIPT_DURATION } from "@/lib/script";
import { INTRO_STEPS } from "./Intro";
import { useStore } from "@/lib/store";
import type { Objective } from "@/lib/types";

const OBJECTIVES: Objective[] = ["co2", "mixto", "costo"];
const SCENARIO_KEYS: Record<string, string> = { "0": "base", "1": "ola_calor", "2": "falla_region", "3": "eolica", "4": "deadlines" };

export async function toggleFullscreen() {
  const s = useStore.getState();
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      s.setPresenting(true);
    } else {
      await document.exitFullscreen();
      s.setPresenting(false);
    }
  } catch {
    s.setPresenting(!s.presenting);
  }
}

/** Corre el guion automático: avanza con el tiempo real y respeta la pausa. */
export function useScriptRunner() {
  const running = useStore((s) => s.script.running);
  const paused = useStore((s) => s.clock?.paused ?? false);
  const replanning = useStore((s) => s.clock?.replanning ?? false);
  const pausedRef = useRef(paused || replanning);
  pausedRef.current = paused || replanning;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let step = -1;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) elapsed += dt;
      const s = useStore.getState();
      const next = SCRIPT.findLastIndex((st) => st.at <= elapsed);
      if (next !== step) {
        step = next;
        const st = SCRIPT[next];
        if (st.reset) {
          s.setIntro(null);
          s.setClosing(false);
          s.setMapPlan("verde");
          void s.control({ action: "reset", speed: 1 }).then(() => s.control({ action: "play" }));
        }
        if (st.view) s.setView(st.view);
        if (st.scenario) void s.scenario(st.scenario);
        s.setScript({ step: next, caption: st.caption });
      }
      s.setScript({ elapsed });
      if (elapsed >= SCRIPT_DURATION) {
        s.setScript({ running: false, caption: "", step: -1 });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

export function useKeyboardShortcuts() {
  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const s = useStore.getState();

    // Intro abierta: flechas, Enter, Espacio y las teclas de un control remoto de presentación la recorren.
    if (s.intro !== null && s.snap) {
      const k = e.key;
      if (["ArrowRight", "ArrowDown", "PageDown", "Enter", " "].includes(k)) {
        e.preventDefault();
        if (s.intro < INTRO_STEPS.length - 1) s.setIntro(s.intro + 1);
        else void s.enterApp();
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) {
        e.preventDefault();
        s.setIntro(Math.max(0, s.intro - 1));
      } else if (k === "Escape") {
        s.setIntro(null);
      } else if (k.toLowerCase() === "f") {
        void toggleFullscreen();
      }
      return;
    }
    if (s.closing) {
      if (e.key === "Escape" || e.key.toLowerCase() === "c") s.setClosing(false);
      else if (e.key.toLowerCase() === "f") void toggleFullscreen();
      return;
    }

    // Shift + 1/2/4 → velocidad (usamos e.code para no depender del layout del teclado).
    const digit = e.code.startsWith("Digit") ? e.code.slice(5) : e.code.startsWith("Numpad") ? e.code.slice(6) : null;
    if (e.shiftKey && digit && ["1", "2", "4"].includes(digit)) {
      e.preventDefault();
      void s.control({ speed: Number(digit) as 1 | 2 | 4 });
      return;
    }
    if (!e.shiftKey && digit && SCENARIO_KEYS[digit]) {
      e.preventDefault();
      void s.scenario(SCENARIO_KEYS[digit]);
      return;
    }
    switch (e.key.toLowerCase()) {
      case " ":
        e.preventDefault();
        void s.control({ action: "toggle" });
        break;
      case "m":
        s.cycleView();
        break;
      case "f":
        void toggleFullscreen();
        break;
      case "p":
        s.setScript(s.script.running ? { running: false, caption: "", step: -1 } : { running: true, elapsed: 0, step: -1 });
        break;
      case "i":
        s.setIntro(0);
        break;
      case "c":
        s.setClosing(true);
        break;
      case "t":
        s.setTheme(s.theme === "dark" ? "light" : "dark");
        break;
      case "d":
        s.setMapPlan(s.mapPlan === "verde" ? "inmediato" : "verde");
        break;
      case "r":
        void s.control({ action: "reset" });
        break;
      case "o": {
        const cur = s.snap?.objective ?? "co2";
        void s.control({ objective: OBJECTIVES[(OBJECTIVES.indexOf(cur) + 1) % OBJECTIVES.length] });
        break;
      }
      case "v": {
        const sp = s.clock?.speed ?? 1;
        void s.control({ speed: sp === 1 ? 2 : sp === 2 ? 4 : 1 });
        break;
      }
      case "h":
      case "?":
        s.setShowHelp(!s.showHelp);
        break;
      case "escape":
        if (s.showHelp) s.setShowHelp(false);
        else if (s.script.running) s.setScript({ running: false, caption: "", step: -1 });
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    const onFs = () => useStore.getState().setPresenting(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [handler]);
}
