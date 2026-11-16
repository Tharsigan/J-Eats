"use client";

import { DB_EVENT } from "../mock-db/db";
import { USE_MOCKS } from "../api/client";
import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { data: T | undefined; error: string; loading: boolean };

/**
 * Run an API service call and keep the result fresh.
 *
 * In mock mode every write to the demo database broadcasts an event, so all
 * mounted views (and other tabs) refetch and stay in sync. Against the real
 * Flask API the hook falls back to polling every `pollMs` milliseconds.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = [], pollMs = 15_000) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: "", loading: true });
  const fetcherRef = useRef(fetcher);
  const seq = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const data = await fetcherRef.current();
      if (id === seq.current) setState({ data, error: "", loading: false });
    } catch (err) {
      if (id === seq.current) {
        setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : "Something went wrong." }));
      }
    }
  }, []);

  const key = JSON.stringify(deps);
  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener(DB_EVENT, onChange);
    const timer = USE_MOCKS ? undefined : window.setInterval(onChange, pollMs);
    return () => {
      window.removeEventListener(DB_EVENT, onChange);
      if (timer) window.clearInterval(timer);
    };
  }, [key, reload, pollMs]);

  return { ...state, reload, setData: (data: T) => setState({ data, error: "", loading: false }) };
}

/** Wrap an async action with busy / error / success state for buttons and forms. */
export function useAction() {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const run = useCallback(async <R,>(key: string, fn: () => Promise<R>, success?: string | ((r: R) => string)) => {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      if (success) setMessage(typeof success === "function" ? success(result) : success);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return undefined;
    } finally {
      setBusy("");
    }
  }, []);

  return { busy, error, message, run, setError, setMessage };
}
