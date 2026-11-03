import { cn } from "@/lib/utils";

type Props = {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function Chip({ active, disabled, onClick, children, className }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
        active
          ? "border-brand bg-brand/15 text-brand"
          : "border-border bg-surface-2/40 text-muted hover:border-brand/40 hover:text-text",
        disabled && "cursor-not-allowed opacity-40 hover:border-border hover:text-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
