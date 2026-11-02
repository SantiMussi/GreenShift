export type StrategyId = "inmediato" | "primera_region" | "verde";
export type Objective = "co2" | "mixto" | "costo";
export type ViewId = "control" | "timeline" | "kpis" | "bside";

export interface Region {
  id: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  capacity_kw: number;
  max_parallel: number;
  pue: number;
  latency_ms_from_amba: number;
  mix_note: string;
}

export interface RegionSeries {
  intensity: number[];
  tariff: number[];
  fixed_load_kw: number[];
  capacity_kw: number[];
}

export interface Job {
  id: string;
  name: string;
  kind: string;
  kind_label: string;
  power_kw: number;
  duration: number;
  arrival: number;
  deadline: number;
  home: string;
  data_gb: number;
  allowed: string[];
  slack: number;
}

export interface Placement {
  task_id: string;
  job_id: string;
  region: string;
  start: number;
  end: number;
  power_kw: number;
  home: string;
  data_gb: number;
  interrupted: boolean;
}

export interface Metrics {
  emissions_kg: number;
  transfer_kg: number;
  energy_kwh: number;
  cost_usd: number;
  deadlines_met: number;
  deadlines_total: number;
  deadlines_pct: number;
  unscheduled: number;
  avg_delay_h: number;
  moved_jobs: number;
  avg_latency_ms: number;
  cum_kg: number[];
  region_load_kw: Record<string, number[]>;
  region_emis_kg_h: Record<string, number[]>;
}

export interface Plan {
  placements: Placement[];
  unscheduled: string[];
  stats: { status: string; wall_time_s: number; n_tasks: number; n_vars: number; objective: number } | null;
  metrics: Metrics;
}

export interface Move {
  task_id: string;
  job_id: string;
  from: string;
  to: string;
}

export interface ReplanRecord {
  id: number;
  at_slot: number;
  at_h: number;
  reason: string;
  status: string;
  wall_time_s: number;
  n_tasks: number;
  n_vars: number;
  energy_wh: number;
  co2_g: number;
  moves: Move[];
}

export interface ClockState {
  t: number;
  speed: number;
  paused: boolean;
  replanning: boolean;
  version: number;
  server_time: number;
}

export interface ScenarioInfo {
  id: string;
  key: string;
  title: string;
  subtitle: string;
}

export interface Snapshot {
  version: number;
  clock: ClockState;
  scenario: string;
  failed_region: string | null;
  objective: Objective;
  scenarios: ScenarioInfo[];
  horizon_h: number;
  slot_h: number;
  n_slots: number;
  seconds_per_sim_hour: number;
  data_source: { id: string; label: string; simulated: boolean; notes: string[] };
  regions: Region[];
  series: Record<string, RegionSeries>;
  jobs: Job[];
  plans: Record<StrategyId, Plan>;
  summary: {
    avoided_kg: number;
    reduction_pct: number;
    savings_usd: number;
    fixed_load_kg: number;
    car_km: number;
    trees_year: number;
  };
  planner: {
    solve_w: number;
    idle_w: number;
    solve_wh: number;
    idle_wh_horizon: number;
    replans: ReplanRecord[];
    rigid_jobs: string[];
    not_moved_deadline: string[];
  };
  last_replan: ReplanRecord | null;
  events: { t: number; kind: string; text: string }[];
}
