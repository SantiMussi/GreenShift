"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { REGION_COLOR, STRATEGY, intensityColor } from "@/lib/colors";
import { cumAt, regionEmissionRate, regionLoad } from "@/lib/derive";
import { fmt, fmtKg } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { StrategyId } from "@/lib/types";
import { anchorObjects, labelElements, registerLabel } from "./labels";

/** Dentro del Canvas: proyecta cada ancla a pantalla y mueve su etiqueta DOM. */
export function LabelProjector() {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const [id, el] of labelElements) {
      const obj = anchorObjects.get(id);
      if (!obj) {
        el.style.opacity = "0";
        continue;
      }
      obj.getWorldPosition(v);
      v.project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = visible ? "1" : "0";
    }
  });
  return null;
}

/** Fuera del Canvas: capa DOM con las etiquetas de regiones y medidores. */
export function SceneLabels() {
  const snap = useStore((s) => s.snap);
  const t = useStore((s) => s.hudT);
  const mapPlan = useStore((s) => s.mapPlan);
  if (!snap) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {snap.regions.map((r) => {
        const { intensity, totalKgH } = regionEmissionRate(snap, r.id, t, mapPlan);
        const down = regionLoad(snap, r.id, t, mapPlan).down;
        return (
          <div key={r.id} ref={registerLabel(`region:${r.id}`)} className="absolute left-0 top-0 opacity-0 will-change-transform">
            <div className="flex -translate-x-1/2 flex-col items-center">
              <div className="h-3 w-px bg-line-2" />
              <div className="frame flex items-stretch whitespace-nowrap">
                <div className="wide flex items-center px-2 text-[10.5px] font-semibold tracking-[0.16em]" style={{ color: REGION_COLOR[r.id] }}>
                  {r.short}
                </div>
                <div className="flex items-center gap-1.5 border-l border-line px-2 py-1">
                  {down ? (
                    <span className="blink text-[10.5px] font-semibold tracking-wide text-alert">FUERA DE SERVICIO</span>
                  ) : (
                    <>
                      <span className="size-1.5" style={{ background: intensityColor(intensity) }} />
                      <span className="num text-[12.5px] text-fg">{fmt(intensity)}</span>
                      <span className="text-[9.5px] text-muted">g/kWh</span>
                      <span className="num ml-1 text-[11px] text-fg-2">{fmt(totalKgH)} kg/h</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {(["inmediato", "verde"] as StrategyId[]).map((k) => (
        <div key={k} ref={registerLabel(`gauge:${k}`)} className="absolute left-0 top-0 opacity-0 will-change-transform">
          <div className={`pt-2 whitespace-nowrap ${k === "verde" ? "-translate-x-[20%] text-left" : "-translate-x-[80%] text-right"}`}>
            <div className="label !text-[9px]" style={{ color: STRATEGY[k].color }}>
              {k === "verde" ? "Plan verde" : "De inmediato"}
            </div>
            <div className="num text-[14px] text-fg">{fmtKg(cumAt(snap.plans[k].metrics.cum_kg, t))}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
