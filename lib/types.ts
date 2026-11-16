export type Role = "customer" | "courier" | "cafeteria" | "admin";
export type CustomerSubRole = "student" | "academic" | "non-academic";
export type VerificationStatus = "pending" | "approved" | "rejected";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  campusId: string;
  customerSubRole?: CustomerSubRole;
  idNumber?: string;
  verificationStatus?: VerificationStatus;
  verificationDocUrl?: string;
  verificationDocName?: string;
  /** Cafeteria operators manage exactly one vendor. */
  vendorId?: string;
  status?: "active" | "suspended";
  phone?: string;
};

export type VerificationDocument = {
  name: string;
  url: string;
  kind: string;
};

export type VerificationApplication = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Exclude<Role, "admin">;
  customerSubRole?: CustomerSubRole;
  idNumber?: string;
  extra?: string;
  documents: VerificationDocument[];
  verificationStatus: VerificationStatus;
  submittedAt: string;
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
  userId?: string;
  createdAt?: string;
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
  customerId?: string;
  vendorId?: string;
  vendorName?: string;
  lines?: OrderLine[];
  deliveryFee?: number;
  destination?: string;
  /** Scheduled pickup / delivery time, e.g. "12:30". */
  slot?: string;
  /** ISO date (yyyy-mm-dd) when the order is scheduled for a later day. */
  scheduledFor?: string;
  preOrder?: boolean;
  notes?: string;
  courierId?: string;
  courierName?: string;
  jobId?: string;
  cancelReason?: string;
  paymentRef?: string;
  paymentStatus?: "paid" | "pending" | "refunded";
  createdAt?: string;
  timeline?: { status: OrderStatus; at: string; note?: string }[];
  reviewed?: boolean;
  discount?: number;
  promoCode?: string;
};

export type OrderLine = {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  spice?: SpiceLevel;
  notes?: string;
  image?: string;
};

export type WalletTxn = {
  id: string;
  label: string;
  amount: number;
  type: "credit" | "debit";
  at: string;
  kind?: "topup" | "payment" | "refund" | "payout" | "earning" | "donation" | "withdrawal";
  ref?: string;
  createdAt?: string;
};

export type CourierJob = {
  id: string;
  from: string;
  to: string;
  payout: number;
  distanceM: number;
  items: number;
  status: "open" | "accepted" | "picked" | "delivered" | "cancelled";
  orderId?: string;
  courierId?: string;
  declinedBy?: string[];
  createdAt?: string;
  completedAt?: string;
  customerName?: string;
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
  type: "sale" | "payout" | "topup" | "refund" | "donation";
  at: string;
  createdAt?: string;
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
  userId?: string;
  role?: Role;
  href?: string;
  createdAt?: string;
  /** For role-wide broadcasts: users who have read it. */
  readBy?: string[];
};

export type MapPoint = {
  id: string;
  name: string;
  kind: "cafeteria" | "pickup";
  x: number;
  y: number;
};

export type SystemLog = { id: string; level: "info" | "warn" | "ok" | "error"; msg: string; at: string; createdAt?: string };

export type PlatformSettings = {
  deliveryFee: number;
  riderPayout: number;
  cashCutoffHour: number;
  orderingOpen: boolean;
  maxActiveJobsPerRider: number;
};

export type Wallet = { userId: string; balance: number; txns: WalletTxn[] };
