"use client";

import { create } from "zustand";
import { getSimTime, syncClock } from "./clock";
import type { ClockState, Objective, ReplanRecord, Snapshot, StrategyId, ViewId } from "./types";

export type Theme = "dark" | "light";

/** El tema lo fija un script en el <head> antes de pintar (ver app/layout.tsx); acá solo se lee. */
function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export const VIEWS: { id: ViewId; label: string; short: string }[] = [
  { id: "control", label: "Centro de control", short: "Control" },
  { id: "timeline", label: "Línea de tiempo", short: "Gantt" },
  { id: "kpis", label: "Indicadores", short: "KPIs" },
  { id: "bside", label: "Lado B", short: "Lado B" },
];

/** La intro se muestra al abrir la app, salvo con ?intro=0 (útil para recargar en plena demo). */
function introAtStart(): number | null {
  if (typeof window === "undefined") return 0;
  return new URLSearchParams(window.location.search).get("intro") === "0" ? null : 0;
}

export interface ReplanPulse {
  record: ReplanRecord;
  at: number; // performance.now()
}

interface State {
  snap: Snapshot | null;
  clock: ClockState | null;
  connection: "connecting" | "online" | "offline";
  hudT: number; // tiempo simulado para la UI (se actualiza ~10 Hz)
  view: ViewId;
  showHelp: boolean;
  presenting: boolean;
  pulse: ReplanPulse | null;
  rebound: number; // elasticidad del efecto rebote (0..1)
  script: { running: boolean; startedAt: number; elapsed: number; caption: string; step: number };
  intro: number | null; // paso de la intro abierta, o null si ya se entró a la app
  closing: boolean; // pantalla de cierre
  theme: Theme; // modo claro u oscuro (se recuerda en el navegador)
  mapPlan: StrategyId; // qué plan dibuja el mapa: el verde o "de inmediato" (cómo sería sin GreenShift)

  setView: (v: ViewId) => void;
  cycleView: () => void;
  setShowHelp: (v: boolean) => void;
  setPresenting: (v: boolean) => void;
  setRebound: (v: number) => void;
  setScript: (s: Partial<State["script"]>) => void;
  setIntro: (step: number | null) => void;
  setClosing: (v: boolean) => void;
  setMapPlan: (p: StrategyId) => void;
  setTheme: (t: Theme) => void;
  syncTheme: () => void;
  enterApp: () => Promise<void>;

  control: (body: { action?: "play" | "pause" | "toggle" | "reset"; speed?: 1 | 2 | 4; objective?: Objective; t?: number }) => Promise<void>;
  scenario: (id: string) => Promise<void>;
  connect: () => () => void;
}

export const useStore = create<State>((set, get) => ({
  snap: null,
  clock: null,
  connection: "connecting",
  hudT: 0,
  view: "control",
  showHelp: false,
  presenting: false,
  pulse: null,
  rebound: 0.35,
  script: { running: false, startedAt: 0, elapsed: 0, caption: "", step: -1 },
  intro: introAtStart(),
  closing: false,
  theme: "dark",
  mapPlan: "verde",

  setView: (view) => set({ view }),
  cycleView: () => {
    const i = VIEWS.findIndex((v) => v.id === get().view);
    set({ view: VIEWS[(i + 1) % VIEWS.length].id });
  },
  setShowHelp: (showHelp) => set({ showHelp }),
  setPresenting: (presenting) => set({ presenting }),
  setRebound: (rebound) => set({ rebound }),
  setScript: (s) => set({ script: { ...get().script, ...s } }),
  setIntro: (intro) => set({ intro }),
  setClosing: (closing) => set({ closing }),
  setMapPlan: (mapPlan) => set({ mapPlan }),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("gs-theme", theme);
    } catch {
      /* sin almacenamiento: el tema vale solo para esta sesión */
    }
    set({ theme });
  },
  syncTheme: () => set({ theme: readTheme() }),
  // Al terminar la intro arranca el día desde cero, para que la demo empiece limpia.
  enterApp: async () => {
    set({ intro: null, closing: false, view: "control", mapPlan: "verde" });
    await get().control({ action: "reset", speed: 1 });
    await get().control({ action: "play" });
  },

  control: async (body) => {
    try {
      const res = await fetch(`${API_URL}/api/control`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const clock = (await res.json()) as ClockState;
      syncClock(clock);
      set({ clock });
    } catch {
      set({ connection: "offline" });
    }
  },

  scenario: async (id) => {
    if (get().snap?.scenario === id && id !== "falla_region") return;
    // Feedback inmediato: el reloj se congela mientras CP-SAT trabaja.
    const c = get().clock;
    if (c) set({ clock: { ...c, replanning: true } });
    try {
      await fetch(`${API_URL}/api/scenario`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      set({ connection: "offline" });
    }
  },

  connect: () => {
    let es: EventSource | null = null;
    let raf = 0;
    let lastHud = 0;
    let closed = false;
    let fetching = false;

    const open = () => {
      if (closed) return;
      es = new EventSource(`${API_URL}/api/stream`);
      es.addEventListener("open", () => set({ connection: "online" }));
      es.addEventListener("error", () => set({ connection: "offline" }));
      es.addEventListener("snapshot", (ev) => {
        const snap = JSON.parse((ev as MessageEvent).data) as Snapshot;
        const prev = get().snap;
        syncClock(snap.clock, snap.seconds_per_sim_hour);
        const lr = snap.last_replan;
        const isNewReplan = lr && prev && prev.last_replan?.id !== lr.id && lr.id > 1;
        set({
          snap,
          clock: snap.clock,
          connection: "online",
          ...(isNewReplan ? { pulse: { record: lr, at: performance.now() } } : {}),
        });
      });
      es.addEventListener("clock", (ev) => {
        const clock = JSON.parse((ev as MessageEvent).data) as ClockState;
        syncClock(clock);
        set({ clock });
        // Si nos perdimos el snapshot (p. ej. el backend arrancó tarde) o quedó viejo, lo pedimos.
        const snap = get().snap;
        if ((!snap || snap.version !== clock.version) && !fetching && !clock.replanning) {
          fetching = true;
          fetch(`${API_URL}/api/state`)
            .then((r) => r.json())
            .then((s: Snapshot) => {
              if (!get().snap || get().snap!.version < s.version) set({ snap: s });
            })
            .catch(() => undefined)
            .finally(() => setTimeout(() => (fetching = false), 1000));
        }
      });
    };

    const loop = (ts: number) => {
      if (ts - lastHud > 100) {
        lastHud = ts;
        set({ hudT: getSimTime() });
      }
      raf = requestAnimationFrame(loop);
    };

    open();
    raf = requestAnimationFrame(loop);
    return () => {
      closed = true;
      es?.close();
      cancelAnimationFrame(raf);
    };
  },
}));
