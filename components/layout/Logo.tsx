import { cn } from "@/lib/utils";

export function Logo({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("relative flex h-11 w-11 items-center justify-center", inverted && "brightness-110")}>
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden>
          <defs>
            <linearGradient id="jeats-sky" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="55%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill="url(#jeats-sky)" />
          <path
            d="M8 40c8-6 16 2 24-2s16-10 24-4"
            fill="#166534"
            opacity="0.9"
          />
          <path d="M10 46c10-8 18 0 22-4 8-6 16-2 22 2v8H10z" fill="#14532d" />
          <ellipse cx="32" cy="22" rx="18" ry="10" fill="white" opacity="0.22" />
          <text
            x="32"
            y="30"
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill="#0f172a"
            fontFamily="ui-sans-serif, system-ui"
          >
            J EATS
          </text>
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={cn("block text-sm font-bold", inverted ? "text-white" : "text-text")}>J Eats</span>
          <span className={cn("block text-[10px] uppercase tracking-wider", inverted ? "text-white/70" : "text-muted")}>
            Campus bites
          </span>
        </span>
      )}
    </span>
  );
}
