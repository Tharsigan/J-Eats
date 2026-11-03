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
