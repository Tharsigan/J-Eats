"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the hydration pass, true afterwards. Use it to gate UI that
 * depends on browser-persisted stores (auth, cart) without hydration mismatches.
 */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
