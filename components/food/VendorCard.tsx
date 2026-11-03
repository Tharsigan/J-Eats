import type { Vendor } from "@/lib/types";
import { ChevronRight, Store } from "lucide-react";
import Link from "next/link";

export function VendorCard({ vendor }: { vendor: Vendor }) {
  return (
    <Link
      href="/customer/map"
      className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <Store className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">{vendor.name}</p>
          <p className="text-sm text-muted">{vendor.location}</p>
          <p className="text-sm">
            <span className="font-medium text-brand">{vendor.openNow ? "Open now" : "Closed"}</span>
            <span className="text-muted"> · Closes at {vendor.closesAt}</span>
          </p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted" />
    </Link>
  );
}
