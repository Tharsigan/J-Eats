import { WorkspaceShell } from "./WorkspaceShell";
import type { Role } from "@/lib/types";

export function RoleShell({ role, children }: { role: Role; children: React.ReactNode }) {
  return <WorkspaceShell role={role}>{children}</WorkspaceShell>;
}
