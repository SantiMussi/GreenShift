import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreenShift · Nubeo",
  description: "Planificador de cómputo consciente del carbono sobre la red eléctrica argentina (demo con datos simulados).",
};

export const viewport: Viewport = {
  themeColor: "#151a20",
  width: "device-width",
  initialScale: 1,
};

// ?theme=light|dark fuerza el tema; si no, se usa el último elegido (por defecto oscuro).
const THEME_SCRIPT = `try{var q=new URLSearchParams(location.search).get("theme");var t=q==="light"||q==="dark"?q:localStorage.getItem("gs-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
