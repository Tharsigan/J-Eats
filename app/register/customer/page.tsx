"use client";

import { DocumentUploadField } from "@/components/auth/DocumentUploadField";
import { PendingVerification } from "@/components/auth/PendingVerification";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { registerWithDocuments } from "@/lib/api/auth";
import type { CustomerSubRole } from "@/lib/types";
import { useState } from "react";

const COPY: Record<
  CustomerSubRole,
  { idLabel: string; extraLabel?: string; extraHint?: string; docLabel: string; docHint: string }
> = {
  student: {
    idLabel: "University Registration Number",
    docLabel: "Student ID Card / University Record Book",
    docHint: "Upload a clear copy of your student ID or record book",
  },
  academic: {
    idLabel: "Academic Staff ID",
    extraLabel: "Faculty / Department",
    extraHint: "e.g. Faculty of Applied Sciences",
    docLabel: "Academic Staff ID or Appointment Letter",
    docHint: "Upload your academic ID or appointment letter",
  },
  "non-academic": {
    idLabel: "Employee / Staff Number",
    extraLabel: "Division / Unit",
    extraHint: "e.g. Maintenance Division",
    docLabel: "Non-Academic Staff ID or Service Letter",
    docHint: "Upload your staff ID or service letter",
  },
};

export default function CustomerRegisterPage() {
  const [subRole, setSubRole] = useState<CustomerSubRole>("student");
  const copy = COPY[subRole];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [extra, setExtra] = useState("");
  const [doc, setDoc] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    setError("");
    if (!name || !email || password.length < 6 || !idNumber || !doc || (copy.extraLabel && !extra)) {
      setError("Complete all required fields and attach a verification document.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("role", "customer");
      form.set("name", name);
      form.set("email", email);
      form.set("password", password);
      form.set("idNumber", idNumber);
      form.set("customerSubRole", subRole);
      if (extra) form.set("extra", extra);
      form.set("verificationDoc", doc);
      form.set("verificationDocKind", copy.docLabel);
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
        <PendingVerification loginHref="/login/customer" />
      ) : (
        <Card className="p-8">
          <h1 className="text-3xl font-bold tracking-tight">Customer registration</h1>
          <p className="mt-2 text-sm text-muted">Campus ID verification is required before you can order.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <SegmentedControl
              value={subRole}
              onChange={(value) => {
                setSubRole(value);
                setExtra("");
                setDoc(null);
              }}
              options={[
                { value: "student", label: "Student" },
                { value: "academic", label: "Academic Staff" },
                { value: "non-academic", label: "Non-Academic Staff" },
              ]}
            />
            <label className="block text-sm font-semibold">
              Full name
              <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Email
              <input className="field mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input className="field mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              {copy.idLabel}
              <input className="field mt-1" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </label>
            {copy.extraLabel && (
              <label className="block text-sm font-semibold">
                {copy.extraLabel}
                <input
                  className="field mt-1"
                  placeholder={copy.extraHint}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                />
              </label>
            )}
            <DocumentUploadField label={copy.docLabel} hint={copy.docHint} file={doc} onChange={setDoc} />
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
