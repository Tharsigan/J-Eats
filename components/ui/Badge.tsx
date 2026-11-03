import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "brand",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "brand" | "soft" | "warn" | "danger" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "brand" && "bg-brand text-white",
        tone === "soft" && "bg-surface-2 text-brand",
        tone === "warn" && "bg-amber-100 text-amber-800",
        tone === "danger" && "bg-rose-100 text-rose-700",
        tone === "muted" && "bg-surface-2 text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
