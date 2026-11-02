"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { getSimTime } from "@/lib/clock";
import { runningAt } from "@/lib/derive";
import { project } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { Region } from "@/lib/types";
import { rackHeight } from "./DataCenter";
import { useScenePalette } from "./palette";

type Pair = `${string}>${string}`;

function curveFor(a: Region, b: Region) {
  const [ax, az] = project(a.lon, a.lat);
  const [bx, bz] = project(b.lon, b.lat);
  const start = new THREE.Vector3(ax, rackHeight(a) + 0.1, az);
  const end = new THREE.Vector3(bx, rackHeight(b) + 0.1, bz);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += 0.7 + start.distanceTo(end) * 0.38;
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

/**
 * Arcos luminosos entre regiones:
 * - flujo permanente para cada trabajo que hoy corre fuera de su región de origen;
 * - un pulso brillante cuando el planificador reubica trabajos (replanificación).
 */
export function Arcs({ regions, reduced }: { regions: Region[]; reduced: boolean }) {
  const pal = useScenePalette();
  const pairs = useMemo(() => {
    const out: { key: Pair; from: Region; to: Region; curve: THREE.QuadraticBezierCurve3; pts: THREE.Vector3[] }[] = [];
    for (const a of regions)
      for (const b of regions)
        if (a.id !== b.id) {
          const curve = curveFor(a, b);
          out.push({ key: `${a.id}>${b.id}`, from: a, to: b, curve, pts: curve.getPoints(64) });
        }
    return out;
  }, [regions]);

  return (
    <group>
      {pairs.map((p) => (
        <Arc key={p.key} pair={p.key} curve={p.curve} pts={p.pts} color={pal.region[p.to.id]} reduced={reduced} />
      ))}
    </group>
  );
}

function Arc({
  pair,
  curve,
  pts,
  color,
  reduced,
}: {
  pair: Pair;
  curve: THREE.QuadraticBezierCurve3;
  pts: THREE.Vector3[];
  color: string;
  reduced: boolean;
}) {
  const [from, to] = pair.split(">");
  const line = useRef<any>(null);
  const comets = useRef<THREE.Group>(null);
  const flowLevel = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const s = useStore.getState();
    const snap = s.snap;
    if (!snap || !line.current) return;
    const t = getSimTime();
    // "De inmediato" nunca migra: con ese plan en el mapa los arcos se apagan.
    const flowing = runningAt(snap.plans[s.mapPlan].placements, t).filter((p) => p.home === from && p.region === to).length;
    const age = s.pulse ? (performance.now() - s.pulse.at) / 1000 : 99;
    const pulsing = age < 3.2 && s.mapPlan === "verde" ? s.pulse!.record.moves.filter((m) => m.from === from && m.to === to).length : 0;
    const targetLevel = Math.min(1, flowing * 0.35) + (pulsing ? 1 : 0);
    flowLevel.current += (targetLevel - flowLevel.current) * Math.min(1, delta * 3);

    const mat = line.current.material as THREE.Material & { opacity: number; dashOffset: number };
    mat.opacity = Math.min(1, flowLevel.current * 0.9);
    if (!reduced) mat.dashOffset -= delta * (pulsing ? 1.6 : 0.5);
    line.current.visible = flowLevel.current > 0.02;

    const g = comets.current;
    if (g) {
      const show = pulsing > 0 || flowing > 0;
      g.visible = show;
      g.children.forEach((c, i) => {
        const speed = pulsing ? 0.55 : 0.18;
        const u = reduced ? 0.5 : (age * speed + i / g.children.length + (pulsing ? 0 : performance.now() / 6000)) % 1;
        curve.getPoint(u, tmp);
        c.position.copy(tmp);
        c.scale.setScalar(pulsing ? 1.4 : 0.8);
        c.visible = i < Math.max(1, Math.min(4, flowing + pulsing));
      });
    }
  });

  return (
    <group>
      <Line
        ref={line}
        points={pts}
        color={color}
        lineWidth={2}
        dashed
        dashSize={0.18}
        gapSize={0.09}
        transparent
        opacity={0}
        toneMapped={false}
      />
      <group ref={comets}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
