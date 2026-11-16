"use client";

import { Button } from "@/components/ui/Button";
import { checkImageFile, IMAGE_ACCEPT, imageFileToDataUrl } from "@/lib/image";
import { useRef, useState } from "react";

/** Pick a JPG/PNG from the computer; returns a resized data URL (or "" when removed). */
export function ImageUploadField({
  label = "Food photo",
  hint = "Optional — a default food photo is used if you skip this.",
  value,
  onChange,
}: {
  label?: string;
  hint?: string;
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setError("");
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) {
      setError(problem);
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    try {
      onChange(await imageFileToDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this image.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="text-sm font-semibold">
      {label}
      <p className="mt-1 text-xs font-normal text-muted">{hint} · JPG or PNG, max 5MB</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Selected food photo" className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-border text-xs font-normal text-muted">
            No photo
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT}
          className="field max-w-xs"
          aria-label={label}
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {busy && <span className="text-xs font-normal text-muted">Preparing photo…</span>}
        {value && !busy && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
      {error && <p className="note-danger mt-2 rounded-xl px-3 py-2 text-sm font-normal">{error}</p>}
    </div>
  );
}
