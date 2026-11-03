import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[1.4rem] border border-border bg-surface p-5 shadow-[var(--shadow)]", className)} {...props} />;
}
