"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";
import { MENU, REVIEWS } from "@/lib/mock-data/campus";
import { useAuthStore } from "@/lib/stores/auth";
import { useNotifyStore } from "@/lib/stores/notifications";
import { useWalletStore } from "@/lib/stores/wallet";
import { formatRs } from "@/lib/utils";
import { useState } from "react";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const balance = useWalletStore((s) => s.balance);
  const push = useNotifyStore((s) => s.push);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  return (
    <div>
      <PageIntro
        crumb="Customer / Profile & Feedback"
        title="Your campus foodie profile."
        subtitle="Identity labels, wallet snapshot and sample feedback."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <p className="text-xl font-semibold">{user?.name ?? "Mira Sen"}</p>
          <p className="text-sm text-muted">{user?.email}</p>
          <p className="text-sm text-muted">Campus ID {user?.campusId}</p>
          <p className="text-sm">Wallet {formatRs(balance)} · Student account</p>
          <p className="text-xs text-muted">Category is an identity label only. All customers share the same ordering permissions.</p>
        </Card>
        <Card className="space-y-3">
          <p className="font-semibold">Rate {MENU[0].name}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className="text-amber-400">
                <StarRating value={n <= rating ? 5 : 0} max={1} />
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="field min-h-24"
            placeholder="How was lunch?"
          />
          <Button
            onClick={() => {
              push("Thanks for the review", `${rating} stars on ${MENU[0].name}`);
              setBody("");
            }}
          >
            Submit feedback
          </Button>
        </Card>
      </div>
      <div className="mt-4 space-y-3">
        {REVIEWS.map((r) => (
          <Card key={r.id}>
            <p className="font-semibold">{r.author}</p>
            <StarRating value={r.rating} />
            <p className="mt-2 text-sm text-muted">{r.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
