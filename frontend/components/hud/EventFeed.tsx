"use client";

import { AnimatePresence, motion } from "framer-motion";
import { fmtClock } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Panel } from "./Panel";

const KIND_COLOR: Record<string, string> = {
  scenario: "var(--color-amber)",
  replan: "#c5f04a",
  objective: "#7fb2ff",
  cycle: "var(--color-muted)",
};

export function EventFeed() {
  const events = useStore((s) => s.snap?.events ?? []);
  const items = [...events].reverse().slice(0, 5);
  return (
    <Panel title="Registro del planificador" bodyClassName="p-0">
      <ol className="divide-y divide-line" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((e) => {
            const c = fmtClock(e.t);
            return (
              <motion.li
                key={`${e.t}-${e.text}`}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-2.5 px-3 py-1.5 text-[11px] leading-snug"
              >
                <span className="num shrink-0 text-muted">
                  {c.day} {c.hm}
                </span>
                <span className="mt-[5px] size-1.5 shrink-0" style={{ background: KIND_COLOR[e.kind] ?? "var(--color-muted)" }} />
                <span className="text-fg-2">{e.text}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </Panel>
  );
}
