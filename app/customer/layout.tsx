import { RoleShell } from "@/components/layout/RoleShell";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="customer">{children}</RoleShell>;
}
