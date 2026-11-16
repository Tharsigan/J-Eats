"use client";

import { useNotifyStore } from "@/lib/stores/notifications";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

/** Bottom-right toasts for instant feedback after an action. */
export function Toaster() {
  const items = useNotifyStore((s) => s.items);
  const dismiss = useNotifyStore((s) => s.markRead);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-80">
      {items.map((t) => {
        const error = t.at === "error";
        const Icon = error ? CircleAlert : CheckCircle2;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-[var(--shadow)]",
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", error ? "text-danger" : "text-brand")} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="text-xs text-muted">{t.body}</p>}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-muted hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
