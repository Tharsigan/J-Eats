"use client";

import { Chip } from "@/components/ui/Chip";
import { useEffect, useRef, useState } from "react";

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

function isAllowed(file: File) {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return ALLOWED.includes(file.type) || [".pdf", ".jpg", ".jpeg", ".png"].includes(ext);
}

export function DocumentUploadField({
  label,
  hint,
  file,
  onChange,
  error,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const [preview, setPreview] = useState("");
  const [localError, setLocalError] = useState("");
  const previewRef = useRef("");

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function assignFile(next: File | null) {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
      setPreview("");
    }
    if (next && next.type.startsWith("image/")) {
      const url = URL.createObjectURL(next);
      previewRef.current = url;
      setPreview(url);
    }
    onChange(next);
  }

  const message = localError || error;

  return (
    <label className="block text-sm font-semibold">
      {label}
      <p className="mt-1 text-xs font-normal text-muted">{hint} · PDF, JPG, JPEG or PNG · max 5MB</p>
      <input
        className="field mt-2"
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          if (!next) {
            setLocalError("");
            assignFile(null);
            return;
          }
          if (!isAllowed(next) || next.size > MAX_BYTES) {
            setLocalError("Please upload a PDF or image under 5MB.");
            e.target.value = "";
            assignFile(null);
            return;
          }
          setLocalError("");
          assignFile(next);
        }}
      />
      {file && file.type.startsWith("image/") && preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="mt-3 h-24 w-24 rounded-xl object-cover" />
      )}
      {file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) && (
        <div className="mt-3">
          <Chip disabled>{file.name}</Chip>
        </div>
      )}
      {message && <p className="note-danger mt-2 rounded-xl px-3 py-2 text-sm font-normal">{message}</p>}
    </label>
  );
}
