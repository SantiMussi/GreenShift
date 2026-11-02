import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import type { Snapshot } from "@/lib/types";
import fixture from "./fixtures/snapshot.json";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

const snap = fixture as unknown as Snapshot;

describe("GreenShift · test de humo de la interfaz", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => snap.clock }) as unknown as typeof fetch;
    useStore.setState({ snap: null, clock: null, view: "control", connection: "connecting", hudT: 0, intro: null, closing: false });
  });

  it("muestra la pantalla de carga sin snapshot", () => {
    render(<AppShell />);
    expect(screen.getByText(/Cargando plan inicial/i)).toBeInTheDocument();
  });

  it("renderiza el centro de control, los escenarios y la etiqueta de datos simulados", () => {
    render(<AppShell />);
    act(() => useStore.setState({ snap, clock: snap.clock, connection: "online", hudT: snap.clock.t }));
    expect(screen.getAllByText("Buenos Aires (AMBA)").length).toBeGreaterThan(0);
    expect(screen.getByText(/Escenarios en vivo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Datos simulados/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/CO₂ acumulado/i)).toBeInTheDocument();
    for (const sc of snap.scenarios) expect(screen.getByText(sc.title)).toBeInTheDocument();
    // Sin WebGL, cae al mapa 2D
    expect(screen.getByText(/Modo liviano/i)).toBeInTheDocument();
  });

  it("arranca con la intro, se recorre con flechas y entra al centro de control", async () => {
    useStore.setState({ intro: 0 });
    render(<AppShell />);
    act(() => useStore.setState({ snap, clock: snap.clock, connection: "online", hudT: snap.clock.t }));
    expect(screen.getByText(/El mismo kWh no contamina igual/i)).toBeInTheDocument();
    // Durante la intro los números no disparan escenarios.
    act(() => void fireEvent.keyDown(window, { key: "1", code: "Digit1" }));
    const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([url]) => String(url).endsWith("/api/scenario"))).toBe(false);
    act(() => void fireEvent.keyDown(window, { key: "ArrowRight" }));
    expect(await screen.findByText(/Mover lo que puede esperar/i, {}, { timeout: 3000 })).toBeInTheDocument();
    act(() => void fireEvent.keyDown(window, { key: "ArrowRight" }));
    expect(await screen.findByText(/Del dato de la red a la decisión/i, {}, { timeout: 3000 })).toBeInTheDocument();
    act(() => void fireEvent.keyDown(window, { key: "Enter" }));
    expect(useStore.getState().intro).toBeNull();
    expect(calls.some(([url, init]) => String(url).endsWith("/api/control") && String(init?.body).includes("reset"))).toBe(true);
  });

  it("la tecla C muestra el cierre con resultados en vivo", () => {
    render(<AppShell />);
    act(() => useStore.setState({ snap, clock: snap.clock, connection: "online" }));
    act(() => void fireEvent.keyDown(window, { key: "c", code: "KeyC" }));
    expect(screen.getByText(/Menos carbono/i)).toBeInTheDocument();
    expect(screen.getByText(`−${Math.round(snap.summary.reduction_pct)} %`)).toBeInTheDocument();
  });

  it("recorre las cuatro vistas con la tecla M", async () => {
    render(<AppShell />);
    act(() => useStore.setState({ snap, clock: snap.clock, connection: "online", hudT: snap.clock.t }));
    act(() => void fireEvent.keyDown(window, { key: "m", code: "KeyM" }));
    expect(useStore.getState().view).toBe("timeline");
    expect(await screen.findByText(/Línea de tiempo · 48 h/i, {}, { timeout: 3000 })).toBeInTheDocument();
    act(() => void fireEvent.keyDown(window, { key: "m", code: "KeyM" }));
    expect(await screen.findByText(/Indicadores del plan/i, {}, { timeout: 3000 })).toBeInTheDocument();
    act(() => void fireEvent.keyDown(window, { key: "m", code: "KeyM" }));
    expect(await screen.findByText(/Lado B · lo que no se ve/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Efecto rebote/i)).toBeInTheDocument();
  });

  it("las teclas 1–4 piden escenarios y Shift+número cambia la velocidad", () => {
    render(<AppShell />);
    act(() => useStore.setState({ snap, clock: snap.clock, connection: "online" }));
    act(() => void fireEvent.keyDown(window, { key: "3", code: "Digit3" }));
    const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([url, init]) => String(url).endsWith("/api/scenario") && String(init?.body).includes("eolica"))).toBe(true);
    act(() => void fireEvent.keyDown(window, { key: "!", code: "Digit4", shiftKey: true }));
    expect(calls.some(([url, init]) => String(url).endsWith("/api/control") && String(init?.body).includes('"speed":4'))).toBe(true);
  });
});
