"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { ArgentinaMap } from "./ArgentinaMap";
import { Arcs } from "./Arcs";
import { DataCenter } from "./DataCenter";
import { Gauges } from "./Gauges";
import { LabelProjector } from "./SceneLabels";
import type { GpuTier } from "./gpu";
import { useScenePalette } from "./palette";

const TARGET = new THREE.Vector3(0.5, 0.3, 0.3);

function Rig() {
  const { camera, size } = useThree();

  useEffect(() => {
    // En pantallas angostas alejamos la cámara para que entren las tres regiones.
    const aspect = size.width / Math.max(size.height, 1);
    const k = aspect < 1 ? 1.65 : aspect < 1.4 ? 1.25 : 1;
    camera.position.set(TARGET.x + 0.8 * k, 8.2 * k, TARGET.z + 7.2 * k);
    camera.lookAt(TARGET);
  }, [camera, size.width, size.height]);

  return null;
}

/** Tiñe el fondo y la niebla hacia rojo cuando el mapa muestra "Sin GreenShift", con transición suave. */
function Tint() {
  const scene = useThree((s) => s.scene);
  const pal = useScenePalette();
  const k = useRef(0);
  const base = useMemo(() => new THREE.Color(), []);
  const warn = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    const want = useStore.getState().mapPlan === "inmediato" ? 1 : 0;
    k.current += (want - k.current) * Math.min(1, delta * 3);
    base.set(pal.bg).lerp(warn.set(pal.warnBg), k.current);
    if (scene.background instanceof THREE.Color) scene.background.copy(base);
    if (scene.fog) scene.fog.color.copy(base);
  });
  return null;
}

function World({ tier, reduced }: { tier: GpuTier; reduced: boolean }) {
  const regions = useStore((s) => s.snap?.regions);
  const sway = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (reduced || !sway.current) return;
    sway.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.05) * 0.045;
  });
  if (!regions) return null;
  const particles = tier === "high" ? 900 : 300;
  return (
    <group ref={sway}>
      <ArgentinaMap />
      {regions.map((r) => (
        <DataCenter key={r.id} region={r} particles={particles} reduced={reduced} />
      ))}
      <Arcs regions={regions} reduced={reduced} />
      <Gauges position={[3.05, 0.0, 1.85]} />
    </group>
  );
}

export default function Scene({ active, tier, reduced }: { active: boolean; tier: GpuTier; reduced: boolean }) {
  const [dpr, setDpr] = useState<number>(tier === "high" ? 1.5 : 1);
  const [fx, setFx] = useState(tier === "high");
  const pal = useScenePalette();

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={dpr}
      camera={{ position: [1.7, 7.6, 9.5], fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: tier !== "high", powerPreference: "high-performance", alpha: false }}
      aria-label="Mapa 3D de Argentina con los tres data centers de Nubeo"
      role="img"
    >
      <color attach="background" args={[pal.bg]} />
      <fog attach="fog" args={[pal.bg, 13, 28]} />
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setFx(false);
        }}
        onIncline={() => tier === "high" && setDpr(1.5)}
      />
      <ambientLight intensity={pal.ambient} />
      <directionalLight position={[4, 9, 6]} intensity={pal.sun} color="#dfe8f0" />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#7fb2ff" />
      <Grid
        position={[0, -0.002, 0]}
        args={[60, 60]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor={pal.gridCell}
        sectionSize={2.5}
        sectionThickness={0.9}
        sectionColor={pal.gridSection}
        fadeDistance={22}
        fadeStrength={1.5}
        infiniteGrid
      />
      <World tier={tier} reduced={reduced} />
      <Rig />
      <LabelProjector />
      <Tint />
      <OrbitControls
        target={TARGET}
        enablePan={false}
        enableDamping
        minDistance={5}
        maxDistance={16}
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
        makeDefault
      />
      {fx && !pal.light && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
          <Vignette darkness={0.4} offset={0.28} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
