"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";
import { updateProfile } from "@/lib/api/auth";
import { addReview, listMenu, listReviews } from "@/lib/api/menu";
import { listMyOrders } from "@/lib/api/orders";
import { getWallet } from "@/lib/api/wallet";
import { useAction, useApi } from "@/lib/hooks/useApi";
import { useAuthStore } from "@/lib/stores/auth";
import { formatRs, timeAgo } from "@/lib/utils";
import { Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMounted } from "@/lib/hooks/useMounted";
import { useMemo, useState } from "react";

const SUB_ROLE: Record<string, string> = {
  student: "Student account",
  academic: "Academic Staff account",
  "non-academic": "Non-Academic Staff account",
};

export function ProfileView() {
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const { data: wallet } = useApi(getWallet);
  const { data: orders } = useApi(listMyOrders);
  const { data: menu } = useApi(listMenu);
  const { data: reviews } = useApi(() => listReviews(), []);
  const mounted = useMounted();
  const [nameDraft, setName] = useState<string | null>(null);
  const [phoneDraft, setPhone] = useState<string | null>(null);
  const name = nameDraft ?? (mounted ? (user?.name ?? "") : "");
  const phone = phoneDraft ?? (mounted ? (user?.phone ?? "") : "");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [choice, setChoice] = useState("");
  const profile = useAction();
  const review = useAction();


  // Items the customer can review: from delivered orders (verified), else anything on the menu.
  const options = useMemo(() => {
    const delivered = (orders ?? []).filter((o) => o.status === "delivered");
    const seen = new Set<string>();
    const list: { key: string; itemId: string; orderId?: string; label: string }[] = [];
    delivered.forEach((o) =>
      o.lines?.forEach((l) => {
        if (seen.has(l.itemId)) return;
        seen.add(l.itemId);
        list.push({ key: `${o.id}:${l.itemId}`, itemId: l.itemId, orderId: o.id, label: `${l.name} · ${o.id}${o.reviewed ? " · reviewed" : ""}` });
      }),
    );
    (menu ?? []).forEach((m) => {
      if (!seen.has(m.id)) list.push({ key: `menu:${m.id}`, itemId: m.id, label: m.name });
    });
    return list;
  }, [orders, menu]);

  const fromOrder = params.get("order");
  const preferred = fromOrder ? options.find((o) => o.orderId === fromOrder) : undefined;
  const selected = options.find((o) => o.key === choice) ?? preferred ?? options[0];
  const myReviews = (reviews ?? []).filter((r) => r.userId === user?.id);
  const visibleReviews = (reviews ?? []).slice(0, 6);
  const itemName = (id: string) => menu?.find((m) => m.id === id)?.name ?? "Menu item";

  async function saveProfile() {
    const next = await profile.run("save", () => updateProfile({ name, phone }), "Profile saved.");
    if (next && token) {
      setSession({ ...user!, ...next }, token);
      setName(null);
      setPhone(null);
    }
  }

  async function submitReview() {
    if (!selected) return;
    const done = await review.run(
      "review",
      () => addReview({ itemId: selected.itemId, rating, body, orderId: selected.orderId }),
      `Thanks! ${rating}★ review posted for ${itemName(selected.itemId)}.`,
    );
    if (done) setBody("");
  }

  const delivered = (orders ?? []).filter((o) => o.status === "delivered").length;

  return (
    <div>
      <PageIntro
        crumb="Customer / Profile & Feedback"
        title="Your campus foodie profile."
        subtitle="Identity labels, wallet snapshot and your meal reviews."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xl font-semibold">{mounted ? user?.name : ""}</p>
            <Badge tone="soft">{mounted && user?.customerSubRole ? SUB_ROLE[user.customerSubRole] : "Customer"}</Badge>
          </div>
          <p className="text-sm text-muted">{mounted ? user?.email : ""}</p>
          <p className="text-sm text-muted">Campus ID {mounted ? user?.campusId : ""}</p>
          <p className="text-sm">
            Wallet {formatRs(wallet?.balance ?? 0)} · {delivered} completed orders · {myReviews.length} reviews
          </p>
          <label className="block text-sm font-semibold">
            Display name
            <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Mobile (for rider contact)
            <input className="field mt-1" value={phone} placeholder="07X XXX XXXX" onChange={(e) => setPhone(e.target.value)} />
          </label>
          <Button size="sm" onClick={() => void saveProfile()} disabled={profile.busy === "save"}>
            Save profile
          </Button>
          {profile.message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{profile.message}</p>}
          {profile.error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{profile.error}</p>}
          <p className="text-xs text-muted">Category is an identity label only. All customers share the same ordering permissions.</p>
        </Card>
        <Card className="space-y-3">
          <label className="block text-sm font-semibold">
            Rate a meal
            <select className="field mt-1" value={selected?.key ?? ""} onChange={(e) => setChoice(e.target.value)}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                className="text-amber-400"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                <Star className={`h-6 w-6 ${n <= (hover || rating) ? "fill-amber-400" : "fill-transparent text-muted"}`} />
              </button>
            ))}
            <span className="ml-2 self-center text-sm text-muted">{rating}/5</span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="field min-h-24"
            maxLength={400}
            placeholder="How was lunch?"
          />
          <Button onClick={() => void submitReview()} disabled={review.busy === "review" || !body.trim() || !selected}>
            Submit feedback
          </Button>
          {review.message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{review.message}</p>}
          {review.error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{review.error}</p>}
          {selected?.orderId && <p className="text-xs text-muted">Reviews from delivered orders get a “Verified order” badge.</p>}
        </Card>
      </div>
      {myReviews.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-bold">Your reviews</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {myReviews.map((r) => (
              <Card key={r.id}>
                <p className="font-semibold">{itemName(r.itemId)}</p>
                <StarRating value={r.rating} />
                <p className="mt-2 text-sm text-muted">{r.body}</p>
                <p className="mt-2 text-xs text-muted">{timeAgo(r.createdAt)}</p>
              </Card>
            ))}
          </div>
        </>
      )}
      <h2 className="mt-6 text-lg font-bold">Latest from campus foodies</h2>
      <div className="mt-3 space-y-3">
        {visibleReviews.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {r.author} <span className="font-normal text-muted">on {itemName(r.itemId)}</span>
              </p>
              <span className="text-xs text-muted">{r.createdAt ? timeAgo(r.createdAt) : `${r.daysAgo} days ago`}</span>
            </div>
            <StarRating value={r.rating} />
            <p className="mt-2 text-sm text-muted">{r.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
