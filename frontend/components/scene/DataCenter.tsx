"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSimTime } from "@/lib/clock";
import { intensityRGB } from "@/lib/colors";
import { regionEmissionRate, regionLoad } from "@/lib/derive";
import { project } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { Region } from "@/lib/types";
import { registerAnchor } from "./labels";
import { PALETTE, useScenePalette } from "./palette";

const RACK_W = 0.14;
const LEVELS = 11;
const GRID: [number, number][] = [
  [-0.19, -0.1], [0, -0.1], [0.19, -0.1],
  [-0.19, 0.1], [0, 0.1], [0.19, 0.1],
];

export function rackHeight(region: Region) {
  return 0.5 + (region.capacity_kw / 1400) * 0.75;
}

export function DataCenter({ region, particles, reduced }: { region: Region; particles: number; reduced: boolean }) {
  const [x, z] = project(region.lon, region.lat);
  const h = rackHeight(region);
  const leds = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const lastLed = useRef(-1);
  const pal = useScenePalette();
  const color = pal.region[region.id];

  const ledCount = GRID.length * LEVELS;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  // Posiciones de los LEDs (frente de cada rack).
  const ledMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    GRID.forEach(([gx, gz]) => {
      for (let l = 0; l < LEVELS; l++) {
        dummy.position.set(gx, 0.06 + ((l + 0.5) / LEVELS) * (h - 0.1), gz + RACK_W / 2 + 0.002);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        out.push(dummy.matrix.clone());
      }
    });
    return out;
  }, [dummy, h]);

  useFrame(({ clock }) => {
    const { snap, mapPlan } = useStore.getState();
    const mesh = leds.current;
    if (!snap || !mesh) return;
    const el = clock.getElapsedTime();
    const t = getSimTime();
    const load = regionLoad(snap, region.id, t, mapPlan);
    const p = PALETTE[useStore.getState().theme];

    if (ring.current) {
      const pulse = useStore.getState().pulse;
      const age = pulse ? (performance.now() - pulse.at) / 1000 : 99;
      const hit = mapPlan === "verde" && pulse?.record.moves.some((m) => m.to === region.id) && age < 3;
      // "Sin GreenShift": las regiones que más emiten laten en rojo.
      const hot = mapPlan === "inmediato" && !load.down && regionEmissionRate(snap, region.id, t, "inmediato").totalKgH > 100;
      const phase = (el * 0.9) % 1;
      const s = hot ? (reduced ? 1.3 : 1 + phase * 1.5) : hit && !reduced ? 1 + ((age * 1.4) % 1) * 1.6 : 1;
      ring.current.scale.setScalar(s);
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.color.set(hot ? "#ff4048" : color);
      mat.opacity = hot ? 0.85 * (1 - phase) + 0.1 : hit ? 0.9 * (1 - ((age * 1.4) % 1)) : 0.22;
    }

    if (el - lastLed.current < 0.12) return;
    lastLed.current = el;
    const total = ledCount;
    const fixedLit = load.down ? 0 : Math.round((load.fixed / Math.max(load.cap, 1)) * total);
    const flexLit = load.down ? 0 : Math.round((load.flex / Math.max(load.cap, 1)) * total);
    const blinkOn = Math.floor(el * 2) % 2 === 0;
    // Recorremos nivel por nivel para que la ocupación "suba" por los racks.
    for (let i = 0; i < total; i++) {
      const level = i % LEVELS;
      const rack = Math.floor(i / LEVELS);
      const order = level * GRID.length + rack;
      mesh.setMatrixAt(i, ledMatrices[i]);
      if (load.down) tmpColor.set(blinkOn || reduced ? "#ff4048" : "#4d1b20");
      else if (order < fixedLit) tmpColor.set(p.ledFixed);
      else if (order < fixedLit + flexLit) tmpColor.set("#c5f04a").multiplyScalar(1.6);
      else tmpColor.set(p.ledOff);
      mesh.setColorAt(i, tmpColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group position={[x, 0.06, z]}>
      {/* Plataforma */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <ringGeometry args={[0.42, 0.435, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.003}>
        <ringGeometry args={[0.5, 0.512, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial color={pal.disc} />
      </mesh>
      {/* Racks */}
      {GRID.map(([gx, gz], i) => (
        <mesh key={i} position={[gx, h / 2, gz]} castShadow>
          <boxGeometry args={[RACK_W, h, RACK_W]} />
          <meshStandardMaterial color={pal.rack} metalness={pal.rackMetal} roughness={0.5} />
        </mesh>
      ))}
      <instancedMesh ref={leds} args={[undefined, undefined, ledCount]}>
        <boxGeometry args={[RACK_W * 0.8, ((h - 0.1) / LEVELS) * 0.5, 0.004]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <EmissionColumn regionId={region.id} top={h} count={particles} reduced={reduced} />
      <object3D ref={registerAnchor(`region:${region.id}`)} position={[0, 0, 0.52]} />
    </group>
  );
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform float uDensity;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aSpeed;
  varying float vAlpha;
  void main() {
    float phase = fract(aSeed * 7.13 + uTime * aSpeed);
    float ang = aSeed * 6.2831 * 9.0 + uTime * (0.4 + aSpeed);
    float rad = 0.04 + phase * 0.26 * (0.4 + aSeed);
    vec3 p = vec3(cos(ang) * rad, phase * uHeight, sin(ang) * rad);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float visible = step(aSeed, uDensity);
    vAlpha = visible * smoothstep(0.0, 0.08, phase) * (1.0 - phase);
    gl_PointSize = uSize * uPixelRatio * (1.2 - phase * 0.6) * (60.0 / -mv.z);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uBoost;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * uBoost, a * vAlpha * uAlpha);
  }
`;

/** Columna de partículas: altura/densidad ∝ emisiones (kg/h), tamaño y color ∝ intensidad. */
function EmissionColumn({ regionId, top, count, reduced }: { regionId: string; top: number; count: number; reduced: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      speeds[i] = 0.12 + Math.random() * 0.18;
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 4);
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHeight: { value: 1 },
      uDensity: { value: 0.3 },
      uSize: { value: 4 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color("#c5f04a") },
      uAlpha: { value: 0.7 },
      uBoost: { value: 1.25 },
    }),
    [],
  );
  const target = useMemo(() => new THREE.Color(), []);
  const light = useScenePalette().light;
  const simClock = useRef(0);
  const exag = useRef(0);
  const rojo = useMemo(() => new THREE.Color("#ff4048"), []);

  useFrame(({ gl }, delta) => {
    const { snap, mapPlan } = useStore.getState();
    if (!snap || !mat.current) return;
    const t = getSimTime();
    const pal = PALETTE[useStore.getState().theme];
    const u0 = mat.current.uniforms;
    u0.uAlpha.value = pal.particleAlpha;
    u0.uBoost.value = pal.particleBoost;
    const { intensity, totalKgH } = regionEmissionRate(snap, regionId, t, mapPlan);
    const down = snap.series[regionId].capacity_kw[Math.floor(t * 2)] <= 0;
    // "Sin GreenShift": columnas más densas, altas y rojas, con transición suave.
    exag.current += ((mapPlan === "inmediato" ? 1 : 0) - exag.current) * Math.min(1, delta * 2.5);
    const x = exag.current;
    const density = down ? 0 : Math.min(1, Math.max(0.05, (totalKgH / 650) * (1 + 0.6 * x)));
    const u = mat.current.uniforms;
    simClock.current += delta * (reduced ? 0.15 : 1);
    u.uTime.value = simClock.current;
    u.uDensity.value += (density - u.uDensity.value) * Math.min(1, delta * 2);
    u.uHeight.value += ((0.6 + density * 2.6) * (1 + 0.55 * x) - u.uHeight.value) * Math.min(1, delta * 2);
    u.uSize.value += ((1.1 + (intensity / 450) * 2.6) * (1 + 0.4 * x) - u.uSize.value) * Math.min(1, delta * 2);
    u.uPixelRatio.value = gl.getPixelRatio();
    const [r, g, b] = intensityRGB(intensity);
    target.setRGB((r / 255) * pal.tintMul, (g / 255) * pal.tintMul, (b / 255) * pal.tintMul, THREE.SRGBColorSpace);
    target.lerp(rojo, 0.45 * x);
    (u.uColor.value as THREE.Color).lerp(target, Math.min(1, delta * 3));
  });

  return (
    <points geometry={geometry} position-y={top}>
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={light ? THREE.NormalBlending : THREE.AdditiveBlending}
      />
    </points>
  );
}
