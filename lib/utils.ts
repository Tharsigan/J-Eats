export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatRs(amount: number) {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

export function delay(ms = 280) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Friendly relative label for an ISO timestamp, e.g. "Today · 12:08 PM". */
export function formatWhen(iso?: string, fallback = "") {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === -1) return `Yesterday · ${time}`;
  if (diffDays === 1) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${time}`;
}

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Trigger a browser download for generated text (receipts, CSV exports). */
export function downloadText(filename: string, content: string, type = "text/plain") {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
