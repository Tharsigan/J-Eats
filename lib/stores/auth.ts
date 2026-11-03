"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User } from "../types";
import { AUTH_COOKIE, TOKEN_COOKIE } from "../rbac";

type AuthState = {
  user: User | null;
  token: string | null;
  setSession: (user: User, token: string) => void;
  logout: () => void;
};

function writeCookies(role: Role | "", token: string) {
  if (typeof document === "undefined") return;
  const secure = "";
  document.cookie = `${AUTH_COOKIE}=${role}; Path=/; SameSite=Lax${secure}`;
  document.cookie = `${TOKEN_COOKIE}=${token}; Path=/; SameSite=Lax${secure}`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setSession: (user, token) => {
        writeCookies(user.role, token);
        set({ user, token });
      },
      logout: () => {
        writeCookies("", "");
        set({ user: null, token: null });
      },
    }),
    {
      name: "jeats-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.user && state.token) writeCookies(state.user.role, state.token);
      },
    },
  ),
);
