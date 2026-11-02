import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "num inline-flex h-[18px] min-w-[18px] items-center justify-center border border-line-2 bg-bg px-1 text-[10px] text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
