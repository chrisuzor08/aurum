"use client";

import { MotionConfig, AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, WifiOff } from "lucide-react";
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { Button } from "@/components/common/ui";
import { usePlayerStore } from "@/store/player";

/** Centralised error boundary: a crash in one widget never takes down the whole app shell. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertTriangle className="text-gold" size={32} aria-hidden />
          <h1 className="font-display text-2xl">Something went quiet</h1>
          <p className="text-sm text-secondary">An unexpected error occurred. Your music keeps playing where it can.</p>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-elevated px-4 py-2 text-xs text-gold-highlight shadow-gold"
        >
          <WifiOff size={14} /> You’re offline. Streams and new data will resume when you reconnect.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toast() {
  const notice = usePlayerStore((s) => s.notice);
  const clear = usePlayerStore((s) => s.clearNotice);
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          onClick={clear}
          className="fixed bottom-40 left-1/2 z-[85] max-w-[90vw] -translate-x-1/2 cursor-pointer rounded-full border border-gold/30 bg-elevated px-5 py-2.5 text-center text-sm text-white shadow-gold md:bottom-28"
        >
          {notice}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ClientProviders({ isPremium, skipLimitPerHour, children }: { isPremium: boolean; skipLimitPerHour: number | null; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <PlayerProvider isPremium={isPremium} skipLimitPerHour={skipLimitPerHour}>
          <OfflineBanner />
          {children}
          <Toast />
        </PlayerProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
