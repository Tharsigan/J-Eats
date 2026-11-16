"use client";

import { DocumentUploadField } from "@/components/auth/DocumentUploadField";
import { PendingVerification } from "@/components/auth/PendingVerification";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { registerWithDocuments } from "@/lib/api/auth";
import { useState } from "react";

export default function CafeteriaRegisterPage() {
  const [stallName, setStallName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenderDoc, setTenderDoc] = useState<File | null>(null);
  const [foodDoc, setFoodDoc] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    setError("");
    if (!stallName || !ownerName || !email || password.length < 6 || !tenderDoc || !foodDoc) {
      setError("Complete owner details and attach both required certificates.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("role", "cafeteria");
      form.set("name", stallName);
      form.set("email", email);
      form.set("password", password);
      form.set("extra", `Owner: ${ownerName}`);
      form.set("verificationDoc", tenderDoc);
      form.set("verificationDocKind", "University Canteen Tender Approval Letter");
      form.set("verificationDoc2", foodDoc);
      form.set("verificationDocKind2", "Food Handling / Business Registration Certificate");
      await registerWithDocuments(form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Unable to submit registration. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      {submitted ? (
        <PendingVerification loginHref="/login/cafeteria" />
      ) : (
        <Card className="p-8">
          <h1 className="text-3xl font-bold tracking-tight">Cafeteria registration</h1>
          <p className="mt-2 text-sm text-muted">Tender and food-handling documents are reviewed before activation.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="block text-sm font-semibold">
              Cafeteria / stall name
              <input className="field mt-1" value={stallName} onChange={(e) => setStallName(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Owner full name
              <input className="field mt-1" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Owner email
              <input className="field mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input className="field mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <DocumentUploadField
              label="University Canteen Tender Approval Letter"
              hint="Upload the current tender or stall approval letter"
              file={tenderDoc}
              onChange={setTenderDoc}
            />
            <DocumentUploadField
              label="Food Handling / Business Registration Certificate"
              hint="Upload food-handling certification or business registration"
              file={foodDoc}
              onChange={setFoodDoc}
            />
            {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Submitting…" : "Submit for verification"}
            </Button>
          </form>
        </Card>
      )}
    </AuthShell>
  );
}
