import type { TimeSlot } from "@/lib/types";
import { Chip } from "./Chip";

export function TimeSlotPicker({
  slots,
  value,
  onChange,
}: {
  slots: TimeSlot[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {slots.map((s) => (
        <Chip
          key={s.id}
          active={value === s.id}
          disabled={!s.available}
          onClick={() => onChange(s.id)}
        >
          <span className="block font-semibold text-text">{s.label}</span>
          <span className="mt-0.5 block text-xs font-normal text-muted">{s.hint}</span>
        </Chip>
      ))}
    </div>
  );
}
