import { MapPin } from "lucide-react";

export function CampusBanner() {
  return (
    <div className="bg-[#e7f4e9] text-[#14532d]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <p className="inline-flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>
            Deliver to: <strong>University of Sri Jayewardenepura</strong>
            <span className="ml-2 opacity-80">· Pickup available</span>
          </span>
        </p>
        <p className="hidden text-xs sm:block">Good food. Right on campus.</p>
      </div>
    </div>
  );
}
