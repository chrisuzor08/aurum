"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { initials } from "@/lib/format";

/* ---------- Buttons ---------- */

type Variant = "gold" | "outline" | "ghost" | "danger";
const variantClass: Record<Variant, string> = {
  gold: "bg-gold-gradient text-[#0A0A0A] font-semibold shadow-gold hover:brightness-110",
  outline: "border border-gold/60 text-gold hover:bg-gold/10",
  ghost: "text-white/80 hover:text-gold hover:bg-white/5",
  danger: "border border-red-400/40 text-red-300 hover:bg-red-400/10",
};

export function Button({
  variant = "gold",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizeClass = { sm: "h-8 px-3 text-xs", md: "h-10 px-5 text-sm", lg: "h-12 px-7 text-base" }[size];
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        variantClass[variant],
        sizeClass,
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  children,
  active = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={props["aria-pressed"] ?? undefined}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full transition duration-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-40",
        active ? "text-gold" : "text-white/75 hover:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-white/5 bg-surface", className)}>{children}</div>;
}

export function Badge({ tone = "gold", children }: { tone?: "gold" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        tone === "gold" ? "bg-gold/15 text-gold-highlight" : "bg-white/10 text-secondary",
      )}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl text-white md:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-[0.2em] text-gold">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-3xl text-white md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-secondary">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/* ---------- States ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-elevated", className)} />;
}

export function CardSkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-40 shrink-0 md:w-48">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      {icon && <div className="mb-4 text-gold">{icon}</div>}
      <h3 className="font-display text-lg text-white">{title}</h3>
      {text && <p className="mt-2 max-w-md text-sm text-secondary">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/5 px-6 py-8 text-center">
      <AlertTriangle className="text-red-300" aria-hidden />
      <p className="text-sm text-white/90">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ---------- Dialog ---------- */

export function Dialog({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close dialog" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} tabIndex={-1} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24 }}
            className={cn("relative w-full max-w-md rounded-3xl border border-gold/20 bg-elevated p-6 shadow-gold-lg", className)}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id={titleId} className="font-display text-xl text-white">
                {title}
              </h2>
              <IconButton label="Close" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Artwork ---------- */

/** Cover art. Uses the stored image when present, otherwise a monochrome gold-on-black generated cover (no fake photos). */
export function Artwork({
  src,
  seed,
  alt,
  label,
  className,
  rounded = "rounded-xl",
  priority = false,
}: {
  src: string | null | undefined;
  seed: string;
  alt: string;
  label?: string;
  className?: string;
  rounded?: string;
  priority?: boolean;
}) {
  const n = [...seed].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 7);
  const x = 20 + (n % 60);
  const y = 15 + ((n >> 5) % 70);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn("aspect-square h-full w-full object-cover", rounded, className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("relative grid aspect-square h-full w-full place-items-center overflow-hidden border border-gold/10", rounded, className)}
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, rgba(245,215,122,0.45), rgba(138,109,31,0.25) 35%, #141414 70%, #0A0A0A 100%)`,
      }}
    >
      <span className="font-display text-[clamp(1rem,3vw,2.25rem)] tracking-wide text-gold-highlight/90">{label ?? initials(seed)}</span>
    </div>
  );
}

/* ---------- Links ---------- */

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("text-sm text-secondary transition hover:text-gold", className)}>
      {children}
    </Link>
  );
}
