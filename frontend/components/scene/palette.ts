import { useStore, type Theme } from "@/lib/store";

/**
 * Colores de la escena 3D, uno por tema. three.js no entiende variables CSS, así que se resuelven acá.
 * Criterio: fondo, mapa y servidores en tres escalones bien separados de luminosidad
 * (en oscuro: fondo oscuro → mapa medio → servidores claros; en claro: al revés).
 */
export interface ScenePalette {
  light: boolean;
  bg: string;
  warnBg: string; // fondo de la escena en modo "Sin GreenShift"
  gridCell: string;
  gridSection: string;
  slab: string;
  outline: string;
  dotBase: [number, number, number];
  tintMul: number; // oscurece los colores de intensidad sobre fondo claro
  rack: string;
  rackMetal: number;
  disc: string;
  ledOff: string;
  ledFixed: string;
  gaugePlate: string;
  gaugeRing: string;
  glass: string;
  glassOpacity: number;
  ambient: number;
  sun: number;
  region: Record<string, string>;
  strategy: Record<string, string>;
  particleAlpha: number;
  particleBoost: number;
}

export const PALETTE: Record<Theme, ScenePalette> = {
  dark: {
    light: false,
    bg: "#0f1318",
    warnBg: "#2b0e12",
    gridCell: "#1b232b",
    gridSection: "#27323d",
    slab: "#34414e",
    outline: "#c2cdd8",
    dotBase: [0.3, 0.36, 0.42],
    tintMul: 1,
    rack: "#aab6c2",
    rackMetal: 0.35,
    disc: "#1c232a",
    ledOff: "#2a323a",
    ledFixed: "#e3edf5",
    gaugePlate: "#1c232a",
    gaugeRing: "#8794a1",
    glass: "#bcd0e0",
    glassOpacity: 0.1,
    ambient: 0.7,
    sun: 1.1,
    region: { amba: "#7fb2ff", cba: "#cfa3ff", nqn: "#4fe0c2" },
    strategy: { inmediato: "#ff6a3d", primera_region: "#a9b2bd", verde: "#c5f04a" },
    particleAlpha: 0.7,
    particleBoost: 1.25,
  },
  light: {
    light: true,
    bg: "#e3e8d8",
    warnBg: "#f1d3cc",
    gridCell: "#d0d7c3",
    gridSection: "#bcc5ac",
    slab: "#f6f8ef",
    outline: "#4f5d47",
    dotBase: [0.66, 0.71, 0.64],
    tintMul: 0.72,
    rack: "#3e4954",
    rackMetal: 0.3,
    disc: "#cdd5bf",
    ledOff: "#56626e",
    ledFixed: "#b9c7d4",
    gaugePlate: "#cfd6c2",
    gaugeRing: "#5a6672",
    glass: "#6b7a86",
    glassOpacity: 0.14,
    ambient: 0.9,
    sun: 0.6,
    region: { amba: "#2d6bd0", cba: "#8a48d0", nqn: "#0b8f77" },
    strategy: { inmediato: "#cf4a18", primera_region: "#66727f", verde: "#4a7a00" },
    particleAlpha: 0.95,
    particleBoost: 0.85,
  },
};

export function useScenePalette() {
  return PALETTE[useStore((s) => s.theme)];
}
