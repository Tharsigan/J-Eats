export type Role = "customer" | "courier" | "cafeteria" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  campusId: string;
};

export type SpiceLevel = "mild" | "medium" | "hot";
export type Fulfillment = "pickup" | "delivery";
export type PaymentMethod = "cash" | "card" | "wallet";

export type MenuItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  price: number;
  currency: "LKR";
  image: string;
  rating: number;
  reviewCount: number;
  prepMinutes: [number, number];
  deliveryFrom: number;
  stock: number;
  maxPerOrder: number;
  favourite: boolean;
  tags: string[];
  vendorId: string;
  allergens: string;
  available: boolean;
};

export type Vendor = {
  id: string;
  name: string;
  location: string;
  distanceKm: number;
  openNow: boolean;
  closesAt: string;
};

export type Review = {
  id: string;
  itemId: string;
  author: string;
  rating: number;
  body: string;
  daysAgo: number;
  verified: boolean;
};

export type TimeSlot = {
  id: string;
  label: string;
  hint: string;
  available: boolean;
};

export type CartLine = {
  id: string;
  itemId: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  spice: SpiceLevel;
  notes: string;
  fulfillment: Fulfillment;
  slotId: string | null;
};

export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  customerName: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  payment: PaymentMethod;
  placedAt: string;
  pickupPoint?: string;
};

export type WalletTxn = {
  id: string;
  label: string;
  amount: number;
  type: "credit" | "debit";
  at: string;
};

export type CourierJob = {
  id: string;
  from: string;
  to: string;
  payout: number;
  distanceM: number;
  items: number;
  status: "open" | "accepted" | "picked" | "delivered";
};

export type InventoryRow = {
  id: string;
  name: string;
  stock: number;
  price: number;
  available: boolean;
};

export type LedgerEntry = {
  id: string;
  ref: string;
  party: string;
  amount: number;
  type: "sale" | "payout" | "topup" | "refund";
  at: string;
};

export type Stall = {
  id: string;
  name: string;
  faculty: string;
  cause: string;
  raised: number;
  goal: number;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

export type MapPoint = {
  id: string;
  name: string;
  kind: "cafeteria" | "pickup";
  x: number;
  y: number;
};
