import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn("h-4 w-4", i < Math.round(value) ? "fill-amber-400" : "fill-transparent text-muted")}
        />
      ))}
    </span>
  );
}
