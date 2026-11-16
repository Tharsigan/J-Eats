"use client";

import { RoleLoginForm } from "@/components/auth/RoleLoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DEMO_PASSWORD, login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { ROLE_HOME } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth";
import type { CustomerSubRole } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const ID_COPY: Record<CustomerSubRole, { label: string; placeholder: string; demo: string }> = {
  student: {
    label: "Registration Number or email",
    placeholder: "SJP-2024-441",
    demo: "mira.demo@example.edu",
  },
  academic: {
    label: "Academic Staff ID or email",
    placeholder: "AC-STAFF-118",
    demo: "anika.staff@sjp.ac.lk",
  },
  "non-academic": {
    label: "Employee Number or email",
    placeholder: "NA-EMP-441",
    demo: "ruwan.ops@sjp.ac.lk",
  },
};

export default function CustomerLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [subRole, setSubRole] = useState<CustomerSubRole>("student");
  const copy = useMemo(() => ID_COPY[subRole], [subRole]);
  const [identifier, setIdentifier] = useState(copy.demo);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const { user, token } = await login({
        role: "customer",
        identifier,
        password,
        customerSubRole: subRole,
      });
      setSession(user, token);
      router.push(ROLE_HOME.customer);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <RoleLoginForm
        title="Customer login"
        subtitle="Sign in as a student or staff member to order campus meals."
        identifierLabel={copy.label}
        identifierPlaceholder={copy.placeholder}
        identifier={identifier}
        onIdentifierChange={setIdentifier}
        password={password}
        onPasswordChange={(value) => {
          setPassword(value);
          setError("");
        }}
        error={error}
        busy={busy}
        onSubmit={submit}
        footer={
          <p className="mt-5 text-sm text-muted">
            Need an account?{" "}
            <Link href="/register/customer" className="font-semibold text-text">
              Register as customer →
            </Link>
            <span className="mt-2 block text-xs">
              Demo · student `mira.demo@example.edu` · academic `anika.staff@sjp.ac.lk` · non-academic `ruwan.ops@sjp.ac.lk` · pending `nimal.pending@sjp.ac.lk` · any password with 6+ characters. Accounts you register use the password you chose.
            </span>
          </p>
        }
      >
        <SegmentedControl
          value={subRole}
          onChange={(value) => {
            setSubRole(value);
            setIdentifier(ID_COPY[value].demo);
            setError("");
          }}
          options={[
            { value: "student", label: "Student" },
            { value: "academic", label: "Academic Staff" },
            { value: "non-academic", label: "Non-Academic Staff" },
          ]}
        />
      </RoleLoginForm>
    </AuthShell>
  );
}
