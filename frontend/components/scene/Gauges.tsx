"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSimTime } from "@/lib/clock";
import { PALETTE, useScenePalette } from "./palette";
import { cumAt } from "@/lib/derive";
import { useStore } from "@/lib/store";
import type { StrategyId } from "@/lib/types";
import { registerAnchor } from "./labels";

const H = 1.7;
const R = 0.15;

/** Medidores 3D de CO₂ acumulado: "de inmediato" vs "planificador verde". */
export function Gauges({ position }: { position: [number, number, number] }) {
  const pal = useScenePalette();
  return (
    <group position={position}>
      <Gauge strategy="inmediato" x={-0.36} />
      <Gauge strategy="verde" x={0.36} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <planeGeometry args={[1.25, 0.55]} />
        <meshBasicMaterial color={pal.gaugePlate} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Gauge({ strategy, x }: { strategy: StrategyId; x: number }) {
  const fill = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const pal = useScenePalette();
  const color = pal.strategy[strategy];

  useFrame((_, delta) => {
    const snap = useStore.getState().snap;
    if (!snap || !fill.current || !cap.current) return;
    const t = getSimTime();
    const max = Math.max(
      snap.plans.inmediato.metrics.emissions_kg,
      snap.plans.primera_region.metrics.emissions_kg,
      1,
    );
    const target = Math.max(0.002, cumAt(snap.plans[strategy].metrics.cum_kg, t) / max);
    const cur = fill.current.scale.y;
    const next = cur + (target - cur) * Math.min(1, delta * 4);
    fill.current.scale.y = next;
    fill.current.position.y = (next * H) / 2;
    cap.current.position.y = next * H + 0.003;
  });

  return (
    <group position-x={x}>
      {/* Tubo de vidrio */}
      <mesh position-y={H / 2}>
        <cylinderGeometry args={[R, R, H, 48, 1, true]} />
        <meshStandardMaterial color={pal.glass} transparent opacity={pal.glassOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <mesh key={f} position-y={f * H} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[R + 0.004, R + 0.03, 48]} />
          <meshBasicMaterial color={pal.gaugeRing} />
        </mesh>
      ))}
      {/* Relleno */}
      <mesh ref={fill} scale-y={0.002}>
        <cylinderGeometry args={[R * 0.86, R * 0.86, H, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.4} transparent opacity={0.88} />
      </mesh>
      <mesh ref={cap} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[R * 0.86, 48]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <object3D ref={registerAnchor(`gauge:${strategy}`)} position={[0, 0, 0.3]} />
    </group>
  );
}
