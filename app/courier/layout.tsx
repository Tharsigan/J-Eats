import { RoleShell } from "@/components/layout/RoleShell";

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="courier">{children}</RoleShell>;
}
