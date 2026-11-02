import type { StrategyId } from "./types";

/** Para el DOM y los SVG: variables CSS que cambian con el tema. */
export const REGION_COLOR: Record<string, string> = {
  amba: "var(--c-amba)",
  cba: "var(--c-cba)",
  nqn: "var(--c-nqn)",
};

/** Para three.js (no entiende var()): la escena es oscura en los dos temas. */
export const REGION_HEX: Record<string, string> = {
  amba: "#7fb2ff",
  cba: "#cfa3ff",
  nqn: "#4fe0c2",
};

export const STRATEGY: Record<StrategyId, { label: string; short: string; color: string }> = {
  inmediato: { label: "Ejecutar de inmediato", short: "De inmediato", color: "var(--c-inmediato)" },
  primera_region: { label: "Primera región disponible", short: "Primera región", color: "var(--c-primera)" },
  verde: { label: "Planificador verde", short: "Plan verde", color: "var(--c-verde)" },
};

export const STRATEGY_HEX: Record<StrategyId, string> = {
  inmediato: "#ff6a3d",
  primera_region: "#a9b2bd",
  verde: "#c5f04a",
};

// Escala de intensidad (g CO2/kWh): limpia → sucia.
const STOPS: [number, [number, number, number]][] = [
  [120, [92, 236, 170]],
  [240, [197, 240, 74]],
  [330, [245, 193, 78]],
  [400, [255, 122, 61]],
  [470, [255, 64, 72]],
];

export function intensityRGB(g: number): [number, number, number] {
  if (g <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [v1, c1] = STOPS[i];
    const [v0, c0] = STOPS[i - 1];
    if (g <= v1) {
      const f = (g - v0) / (v1 - v0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** Color CSS de una intensidad. En modo claro se oscurece para que se lea sobre papel (salvo sobre la escena). */
export function intensityColor(g: number, onStage = false) {
  const [r, gg, b] = intensityRGB(g);
  const light = !onStage && typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  const k = light ? 0.6 : 1;
  return `rgb(${Math.round(r * k)} ${Math.round(gg * k)} ${Math.round(b * k)})`;
}

export function intensityLabel(g: number) {
  if (g < 200) return "Baja";
  if (g < 300) return "Media";
  if (g < 400) return "Alta";
  return "Muy alta";
}
