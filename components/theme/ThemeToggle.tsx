"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const ready = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!ready) {
    return <span className="inline-flex h-9 w-9 rounded-full border border-border sm:w-20" />;
  }
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-text transition hover:bg-surface-2"
    >
      {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="hidden sm:inline">{dark ? "Dark" : "Light"}</span>
    </button>
  );
}
