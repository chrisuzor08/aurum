"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiInit } from "@/services/api";

/** Loads JSON from an endpoint with loading / error / retry state. */
export function useApi<T>(url: string | null, init?: ApiInit) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<T>(url, initRef.current)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, retry, setData };
}
