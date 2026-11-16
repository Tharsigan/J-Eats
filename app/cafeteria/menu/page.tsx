"use client";

import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { checkImageFile, IMAGE_ACCEPT, imageFileToDataUrl } from "@/lib/image";
import { createMenuItem, deleteMenuItem, listMyMenu, patchInventory, type NewMenuItem } from "@/lib/api/cafeteria";
import { useAction, useApi } from "@/lib/hooks/useApi";
import type { MenuItem } from "@/lib/types";
import { formatRs } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const CATEGORIES = ["Rice & Curry", "Student pick", "Quick bite", "Snacks", "Breakfast", "Burgers", "Pizza", "Cool down"];
const EMPTY: NewMenuItem = {
  name: "",
  category: "Snacks",
  description: "",
  price: 450,
  stock: 20,
  maxPerOrder: 5,
  image: "",
  prepMin: 10,
  prepMax: 15,
};

function Row({ item, onError }: { item: MenuItem; onError: (msg: string) => void }) {
  const [price, setPrice] = useState(String(item.price));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const photo = useRef<HTMLInputElement>(null);
  const { busy, run, error, setError } = useAction();

  async function changePhoto(file: File | undefined) {
    if (photo.current) photo.current.value = "";
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    await run("photo", async () => patchInventory(item.id, { image: await imageFileToDataUrl(file) }));
  }
  useEffect(() => {
    if (error) onError(error);
  }, [error, onError]);

  const set = (patch: Partial<MenuItem>, key: string) => void run(key, () => patchInventory(item.id, patch));

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
          <Image src={item.image} alt="" fill className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{item.name}</p>
          <p className="text-sm text-muted">
            {item.category} · {formatRs(item.price)} · {item.available ? "on menu" : "hidden"}
            {item.stock === 0 && <Badge tone="danger" className="ml-2">Sold out</Badge>}
            {item.stock > 0 && item.stock <= 5 && <Badge tone="warn" className="ml-2">Low stock</Badge>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted">
          Rs.
          <input
            className="field h-9 w-24"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => Number(price) !== item.price && set({ price: Number(price) }, "price")}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </label>
        <Button variant="outline" size="sm" disabled={!!busy || item.stock === 0} onClick={() => set({ stock: item.stock - 1 }, "stock")}>
          −
        </Button>
        <span className="min-w-10 text-center font-semibold">{item.stock}</span>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => set({ stock: item.stock + 1 }, "stock")}>
          +
        </Button>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => set({ stock: item.stock + 10 }, "stock")}>
          +10
        </Button>
        <input
          ref={photo}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          aria-label={`New photo for ${item.name}`}
          onChange={(e) => void changePhoto(e.target.files?.[0])}
        />
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => photo.current?.click()}>
          {busy === "photo" ? "Uploading…" : "Change photo"}
        </Button>
        <Button size="sm" variant={item.available ? "soft" : "primary"} disabled={!!busy} onClick={() => set({ available: !item.available }, "avail")}>
          {item.available ? "Hide" : "Show"}
        </Button>
        {confirmDelete ? (
          <>
            <Button size="sm" variant="danger" onClick={() => void run("del", () => deleteMenuItem(item.id))}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
            Remove
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function MenuOpsPage() {
  const { data: rows, loading } = useApi(listMyMenu);
  const [form, setForm] = useState<NewMenuItem>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const { busy, error, message, run, setError } = useAction();

  const list = (rows ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const field = <K extends keyof NewMenuItem>(k: K, v: NewMenuItem[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function create() {
    const item = await run("create", () => createMenuItem(form), (m) => `${m.name} added to your menu and is live on Explore Food.`);
    if (item) {
      setForm(EMPTY);
      setShowForm(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        crumb="Cafeteria / Menu Management & Inventory"
        title="Keep the board honest."
        subtitle="Changes publish instantly to the customer menu. Restock before the lunch rush."
      />
      <div className="flex flex-wrap items-center gap-2">
        <input className="field max-w-xs" placeholder="Search your menu" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close form" : "+ Add menu item"}</Button>
        <span className="text-sm text-muted">
          {rows?.length ?? 0} items · {(rows ?? []).reduce((n, r) => n + r.stock, 0)} portions in stock
        </span>
      </div>
      {error && <p className="note-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
      {message && <p className="note-ok rounded-xl px-3 py-2 text-sm">{message}</p>}
      {showForm && (
        <Card>
          <h2 className="text-lg font-bold">New menu item</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label className="text-sm font-semibold">
              Name
              <input className="field mt-1" required value={form.name} onChange={(e) => field("name", e.target.value)} />
            </label>
            <label className="text-sm font-semibold">
              Category
              <select className="field mt-1" value={form.category} onChange={(e) => field("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Description
              <input className="field mt-1" value={form.description} onChange={(e) => field("description", e.target.value)} />
            </label>
            <label className="text-sm font-semibold">
              Price (Rs.)
              <input className="field mt-1" type="number" min={1} value={form.price} onChange={(e) => field("price", Number(e.target.value))} />
            </label>
            <label className="text-sm font-semibold">
              Opening stock
              <input className="field mt-1" type="number" min={0} value={form.stock} onChange={(e) => field("stock", Number(e.target.value))} />
            </label>
            <label className="text-sm font-semibold">
              Max per order
              <input className="field mt-1" type="number" min={1} value={form.maxPerOrder} onChange={(e) => field("maxPerOrder", Number(e.target.value))} />
            </label>
            <label className="text-sm font-semibold">
              Prep time (min–max minutes)
              <span className="mt-1 flex gap-2">
                <input className="field" type="number" min={1} value={form.prepMin} onChange={(e) => field("prepMin", Number(e.target.value))} />
                <input className="field" type="number" min={1} value={form.prepMax} onChange={(e) => field("prepMax", Number(e.target.value))} />
              </span>
            </label>
            <div className="sm:col-span-2">
              <ImageUploadField value={form.image ?? ""} onChange={(v) => field("image", v)} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy === "create"}>
                {busy === "create" ? "Saving…" : "Publish item"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setForm(EMPTY)}>
                Reset
              </Button>
            </div>
          </form>
        </Card>
      )}
      {loading && !rows && <Card className="text-sm text-muted">Loading menu…</Card>}
      {list.map((r) => (
        <Row key={r.id} item={r} onError={setError} />
      ))}
      {rows && rows.length === 0 && <Card className="text-sm text-muted">Your menu is empty. Add your first item above.</Card>}
    </div>
  );
}
