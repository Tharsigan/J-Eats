import type { Role } from "./types";
import {
  BarChart3,
  Bike,
  ClipboardCheck,
  ClipboardList,
  LayoutGrid,
  MapPin,
  ScrollText,
  Settings,
  ShoppingBag,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: Record<Role, NavItem[]> = {
  customer: [
    { href: "/customer", label: "Home", icon: LayoutGrid },
    { href: "/customer/explore", label: "Explore Food", icon: UtensilsCrossed },
    { href: "/customer/orders", label: "My Orders", icon: ClipboardList },
    { href: "/customer/pre-orders", label: "Pre-Orders", icon: ShoppingBag },
    { href: "/customer/wallet", label: "Wallet", icon: Wallet },
    { href: "/customer/track", label: "Track Order", icon: MapPin },
    { href: "/customer/profile", label: "Profile", icon: UserRound },
  ],
  courier: [
    { href: "/courier", label: "Dashboard", icon: LayoutGrid },
    { href: "/courier/jobs", label: "Delivery Jobs", icon: Bike },
    { href: "/courier/navigate", label: "Active Delivery", icon: MapPin },
    { href: "/courier/earnings", label: "Earnings", icon: Wallet },
  ],
  cafeteria: [
    { href: "/cafeteria", label: "Dashboard", icon: LayoutGrid },
    { href: "/cafeteria/menu", label: "Menu Management", icon: UtensilsCrossed },
    { href: "/cafeteria/orders", label: "Orders", icon: ClipboardList },
    { href: "/cafeteria/queue", label: "Analytics", icon: BarChart3 },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutGrid },
    { href: "/admin#pending-approvals", label: "Pending Approvals", icon: ClipboardCheck },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/ledger", label: "Transactions", icon: ScrollText },
    { href: "/admin/analytics", label: "Reports", icon: BarChart3 },
    { href: "/admin/logs", label: "System Settings", icon: Settings },
  ],
};

export const MARKETING_NAV = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore Food" },
  { href: "/login", label: "My Orders", target: "/customer/orders" },
  { href: "/login", label: "Pre-Orders", target: "/customer/pre-orders" },
  { href: "/login", label: "Wallet", target: "/customer/wallet" },
  { href: "/login", label: "Track Order", target: "/customer/track" },
  { href: "/login", label: "Profile", target: "/customer/profile" },
];

export const WORKSPACE_META: Record<
  Role,
  { workspace: string; account: string; subtitle: string; crumb: string }
> = {
  customer: {
    workspace: "Customer workspace",
    account: "Student account",
    subtitle: "Good food. Right on campus.",
    crumb: "Customer",
  },
  courier: {
    workspace: "Rider workspace",
    account: "Approved rider",
    subtitle: "Good food. Right on campus.",
    crumb: "Rider",
  },
  cafeteria: {
    workspace: "Cafeteria workspace",
    account: "Approved cafeteria",
    subtitle: "Central Canteen · operator workspace",
    crumb: "Cafeteria",
  },
  admin: {
    workspace: "Admin workspace",
    account: "Authorised administrator",
    subtitle: "Campus operations · authorised access",
    crumb: "Admin",
  },
};
