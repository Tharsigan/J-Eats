"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useState, type FormEvent, type ReactNode } from "react";

export function RoleLoginForm({
  title,
  subtitle,
  identifierLabel,
  identifierPlaceholder,
  identifier,
  onIdentifierChange,
  password,
  onPasswordChange,
  error,
  busy,
  onSubmit,
  children,
  footer,
  extraNote,
}: {
  title: string;
  subtitle: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  identifier: string;
  onIdentifierChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  extraNote?: ReactNode;
}) {
  const [show, setShow] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Card className="p-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {children}
        <label className="block text-sm font-semibold">
          {identifierLabel}
          <input
            className="field mt-1"
            value={identifier}
            placeholder={identifierPlaceholder}
            onChange={(e) => onIdentifierChange(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <span className="relative mt-1 block">
            <input
              className={`field ${error ? "border-danger" : ""}`}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
              onClick={() => setShow((v) => !v)}
            >
              {show ? "Hide" : "Show password"}
            </button>
          </span>
        </label>
        {extraNote}
        {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
      {footer}
    </Card>
  );
}
