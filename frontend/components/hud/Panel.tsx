import { cn } from "@/lib/utils";

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("frame", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
          <h2 className="label">{title}</h2>
          {right}
        </header>
      )}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "wide inline-flex h-5 items-center gap-1.5 border border-amber/40 bg-amber/[0.07] px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-amber",
        className,
      )}
      title="Perfiles ilustrativos con forma realista. No son mediciones de la red."
    >
      <span className="size-1 rounded-full bg-amber" />
      Datos simulados
    </span>
  );
}
