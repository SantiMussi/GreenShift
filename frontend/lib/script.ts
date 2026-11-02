import type { ViewId } from "./types";

export interface ScriptStep {
  at: number; // segundos desde el inicio del guion
  caption: string;
  view?: ViewId;
  scenario?: string;
  reset?: boolean;
}

/** Guion automático de 3 minutos. A 1x, 180 s reales = 48 h simuladas. */
export const SCRIPT: ScriptStep[] = [
  {
    at: 0,
    reset: true,
    view: "control",
    caption: "Nubeo corre su cómputo en tres regiones. Cada kWh tiene un costo de carbono distinto según la hora y el lugar.",
  },
  {
    at: 13,
    caption: "Las columnas son emisiones en vivo: más altas, más CO₂ por hora; más rojas, red más sucia.",
  },
  {
    at: 26,
    view: "timeline",
    caption: "El planificador (CP-SAT) corre los trabajos flexibles donde y cuando la red es más limpia. Punteado: dónde habrían corrido sin planificar.",
  },
  {
    at: 44,
    view: "control",
    scenario: "eolica",
    caption: "Entra un frente de viento en la Patagonia. El plan se recalcula en vivo y migra más trabajo a Neuquén.",
  },
  {
    at: 70,
    scenario: "falla_region",
    caption: "Se cae la región con más carga planificada: la API hace failover y los trabajos se reanudan desde checkpoint sin perder deadlines.",
  },
  {
    at: 98,
    scenario: "ola_calor",
    caption: "Ola de calor: más térmica, tarifas pico y tres trabajos urgentes. El planificador se adapta en segundos.",
  },
  {
    at: 122,
    view: "kpis",
    caption: "Resultado: menos CO₂ y menos costo, con los mismos deadlines cumplidos.",
  },
  {
    at: 140,
    view: "bside",
    scenario: "deadlines",
    caption: "Lado B: con deadlines ajustados hay menos margen. También medimos lo que consume el propio planificador y el efecto rebote.",
  },
  {
    at: 163,
    view: "control",
    scenario: "base",
    caption: "GreenShift: la misma infraestructura, con menos carbono. Datos simulados; el modelo es reemplazable por datos de CAMMESA.",
  },
];

export const SCRIPT_DURATION = 180;
