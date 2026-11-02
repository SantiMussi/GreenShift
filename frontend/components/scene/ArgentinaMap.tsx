"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { MAINLAND, MALVINAS, TIERRA_DEL_FUEGO, pointInPolygon, project } from "@/lib/geo";
import { intensityRGB } from "@/lib/colors";
import { getSimTime } from "@/lib/clock";
import { lerpSeries } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { PALETTE, useScenePalette } from "./palette";

const TOP = 0.06;
const SHAPES = [MAINLAND, TIERRA_DEL_FUEGO, MALVINAS].map((poly) => poly.map(([lon, lat]) => project(lon, lat)));

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ArgentinaMap() {
  const pal = useScenePalette();
  const slabs = useMemo(
    () =>
      SHAPES.map((pts) => {
        const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, TOP - 0.12, 0);
        return geo;
      }),
    [],
  );

  return (
    <group>
      {slabs.map((geo, i) => (
        <mesh key={i} geometry={geo} receiveShadow>
          <meshStandardMaterial color={pal.slab} roughness={0.9} metalness={0.15} />
        </mesh>
      ))}
      {SHAPES.map((pts, i) => (
        <Line
          key={i}
          points={[...pts, pts[0]].map(([x, z]) => [x, TOP + 0.002, z] as [number, number, number])}
          color={pal.outline}
          lineWidth={1}
          transparent
          opacity={0.75}
        />
      ))}
      <DotMatrix />
    </group>
  );
}

/** Mapa en matriz de puntos: cada punto se tiñe con la intensidad de la región más cercana. */
function DotMatrix() {
  const regions = useStore((s) => s.snap?.regions);
  const ref = useRef<THREE.Points>(null);
  const last = useRef(-1);

  const { geometry, weights } = useMemo(() => {
    const step = 0.105;
    const pos: number[] = [];
    const xs = SHAPES.flat().map((p) => p[0]);
    const zs = SHAPES.flat().map((p) => p[1]);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += step) {
      for (let z = Math.min(...zs); z < Math.max(...zs); z += step) {
        if (SHAPES.some((poly) => pointInPolygon(x, z, poly))) pos.push(x, TOP + 0.004, z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(pos.length).fill(0.2), 3));
    const n = pos.length / 3;
    const w: { id: string; w: Float32Array }[] = (regions ?? []).map((r) => {
      const [rx, rz] = project(r.lon, r.lat);
      const arr = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const dx = pos[i * 3] - rx;
        const dz = pos[i * 3 + 2] - rz;
        arr[i] = Math.exp(-(dx * dx + dz * dz) / 1.1);
      }
      return { id: r.id, w: arr };
    });
    return { geometry: g, weights: w };
  }, [regions]);

  const map = useMemo(() => (typeof document !== "undefined" ? dotTexture() : null), []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (elapsed - last.current < 0.25) return;
    last.current = elapsed;
    const snap = useStore.getState().snap;
    if (!snap || !ref.current) return;
    const t = getSimTime();
    const col = geometry.getAttribute("color") as THREE.BufferAttribute;
    const n = col.count;
    const pal = PALETTE[useStore.getState().theme];
    const base = pal.dotBase;
    const tints = weights.map(({ id, w }) => {
      const down = snap.series[id].capacity_kw[Math.floor(t * 2)] <= 0;
      const rgb = down ? [255, 64, 72] : intensityRGB(lerpSeries(snap.series[id].intensity, t));
      return { w, rgb: rgb.map((v) => (v / 255) * pal.tintMul) };
    });
    for (let i = 0; i < n; i++) {
      let r = base[0];
      let g = base[1];
      let b = base[2];
      for (const { w, rgb } of tints) {
        const k = w[i] * 0.95;
        r += (rgb[0] - r) * k;
        g += (rgb[1] - g) * k;
        b += (rgb[2] - b) * k;
      }
      col.setXYZ(i, r, g, b);
    }
    col.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        sizeAttenuation
        vertexColors
        map={map ?? undefined}
        transparent
        alphaTest={0.05}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}
