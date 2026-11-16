import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

export function PendingVerification({
  title = "Pending Admin Verification",
  loginHref,
}: {
  title?: string;
  loginHref: string;
}) {
  return (
    <Card className="p-8">
      <Badge tone="warn">Pending review</Badge>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="note-warn mt-4 rounded-xl px-3 py-2 text-sm">
        Your documents are under review. An administrator will approve or reject this application before the account
        can sign in.
      </p>
      <p className="mt-3 text-sm text-muted">
        You will not be able to access a dashboard until verification is complete. Keep your campus ID handy for
        follow-up.
      </p>
      <Link href={loginHref} className="mt-6 inline-block">
        <Button variant="soft">Back to login</Button>
      </Link>
    </Card>
  );
}
