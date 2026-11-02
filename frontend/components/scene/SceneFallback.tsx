"use client";

import { MAINLAND, MALVINAS, TIERRA_DEL_FUEGO, project } from "@/lib/geo";
import { REGION_COLOR, intensityColor } from "@/lib/colors";
import { regionEmissionRate, regionLoad } from "@/lib/derive";
import { fmt } from "@/lib/format";
import { useStore } from "@/lib/store";

/** Vista 2D liviana para equipos sin WebGL. Misma información, sin 3D. */
export function SceneFallback() {
  const snap = useStore((s) => s.snap);
  const t = useStore((s) => s.hudT);
  const mapPlan = useStore((s) => s.mapPlan);
  if (!snap) return null;
  const polys = [MAINLAND, TIERRA_DEL_FUEGO, MALVINAS].map((p) => p.map(([lo, la]) => project(lo, la)));
  const d = polys.map((p) => "M" + p.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`).join("L") + "Z").join("");
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="-5 -8 11 17" className="h-full max-h-[90%] w-auto" role="img" aria-label="Mapa 2D de las regiones">
        <path d={d} fill="var(--color-bg-2)" stroke="var(--color-line-2)" strokeWidth={0.03} />
        {snap.regions.map((r) => {
          const [x, z] = project(r.lon, r.lat);
          const { intensity, totalKgH } = regionEmissionRate(snap, r.id, t, mapPlan);
          const down = regionLoad(snap, r.id, t, mapPlan).down;
          const rad = 0.15 + Math.min(1, totalKgH / 650) * 0.5;
          return (
            <g key={r.id}>
              <circle cx={x} cy={z} r={rad} fill={down ? "#ff4048" : intensityColor(intensity)} opacity={0.35} />
              <circle cx={x} cy={z} r={0.08} fill={REGION_COLOR[r.id]} />
              <text x={x + 0.2} y={z - 0.15} fontSize={0.32} fill="var(--color-fg)">
                {r.short} · {down ? "caída" : `${fmt(intensity)} g/kWh`}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-muted">
        Modo liviano: no se detectó aceleración 3D.
      </p>
    </div>
  );
}
