"use client";

import { DocumentUploadField } from "@/components/auth/DocumentUploadField";
import { PendingVerification } from "@/components/auth/PendingVerification";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { registerWithDocuments } from "@/lib/api/auth";
import { useState } from "react";

export default function RiderRegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [vehicle, setVehicle] = useState("bicycle");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    setError("");
    if (!name || !email || password.length < 6 || !idNumber || !idDoc || !licenseDoc) {
      setError("Complete all required fields and attach both verification documents.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("role", "courier");
      form.set("name", name);
      form.set("email", email);
      form.set("password", password);
      form.set("idNumber", idNumber);
      form.set("extra", vehicle);
      form.set("verificationDoc", idDoc);
      form.set("verificationDocKind", "NIC / Student ID");
      form.set("verificationDoc2", licenseDoc);
      form.set("verificationDocKind2", "Driving License / Vehicle Proof");
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
        <PendingVerification loginHref="/login/rider" />
      ) : (
        <Card className="p-8">
          <h1 className="text-3xl font-bold tracking-tight">Rider registration</h1>
          <p className="mt-2 text-sm text-muted">NIC and vehicle proof are reviewed before you can accept jobs.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
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
              NIC / Student ID number
              <input className="field mt-1" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </label>
            <div>
              <p className="text-sm font-semibold">Vehicle / delivery mode</p>
              <div className="mt-2">
                <SegmentedControl
                  value={vehicle}
                  onChange={setVehicle}
                  options={[
                    { value: "bicycle", label: "Bicycle" },
                    { value: "scooter", label: "Scooter" },
                    { value: "walk", label: "On foot" },
                  ]}
                />
              </div>
            </div>
            <DocumentUploadField
              label="NIC / Student ID"
              hint="Upload a clear copy of your NIC or student ID"
              file={idDoc}
              onChange={setIdDoc}
            />
            <DocumentUploadField
              label="Driving License / Vehicle Proof"
              hint="Upload a license, registration, or campus vehicle permit"
              file={licenseDoc}
              onChange={setLicenseDoc}
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
