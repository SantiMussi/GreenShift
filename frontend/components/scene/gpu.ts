export type GpuTier = "none" | "low" | "high";

/** Detecta WebGL y si el renderer es por software, para degradar con gracia. */
export function detectGpu(): GpuTier {
  if (typeof window === "undefined") return "high";
  try {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("gpu");
    if (forced === "none" || forced === "low" || forced === "high") return forced;
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "none";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return "low";
    return "high";
  } catch {
    return "none";
  }
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
