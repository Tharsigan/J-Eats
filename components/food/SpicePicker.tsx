import type { SpiceLevel } from "@/lib/types";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVELS: { value: SpiceLevel; label: string }[] = [
  { value: "mild", label: "Mild" },
  { value: "medium", label: "Medium" },
  { value: "hot", label: "Hot" },
];

export function SpicePicker({
  value,
  onChange,
}: {
  value: SpiceLevel;
  onChange: (v: SpiceLevel) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => onChange(l.value)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
            value === l.value
              ? "border-brand bg-brand/15 text-text"
              : "border-border text-muted hover:text-text",
          )}
        >
          <Flame
            className={cn(
              "h-4 w-4",
              l.value === "mild" && "text-muted",
              l.value === "medium" && "text-orange-400",
              l.value === "hot" && "text-rose-500",
            )}
          />
          {l.label}
        </button>
      ))}
    </div>
  );
}
