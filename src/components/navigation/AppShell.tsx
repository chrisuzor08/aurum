"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Compass, Crown, Flame, Heart, Home, Library, LogOut, Search, Settings, UserRound, X, ListMusic, Download, History, Users, ShieldCheck, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Artwork, IconButton } from "@/components/common/ui";
import { FullPlayer } from "@/components/player/FullPlayer";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { api } from "@/services/api";
import { usePlayerStore } from "@/store/player";
import { cn } from "@/utils/cn";
import { initials } from "@/lib/format";

export interface ShellUser {
  username: string;
  avatarUrl: string | null;
  isPremium: boolean;
  role: "user" | "admin";
}

const PRIMARY = [
  { href: "/", label: "Home", icon: Home },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/search", label: "Search", icon: Search },
  { href: "/premium", label: "Premium", icon: Crown },
] as const;

const LIBRARY_LINKS = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/liked", label: "Liked Songs", icon: Heart },
  { href: "/playlists", label: "My Playlists", icon: ListMusic },
  { href: "/following", label: "Followed Artists", icon: Users },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/history", label: "Listening History", icon: History },
] as const;

export function AppShell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasPlayer = usePlayerStore((s) => Boolean(s.trackId));

  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-background text-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-background/95 px-4 py-6 md:flex">
        <Link href="/" className="font-display px-3 text-2xl tracking-[0.2em] text-gold-gradient">
          AURUM
        </Link>
        <nav aria-label="Primary" className="mt-10 space-y-1">
          {PRIMARY.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} Icon={item.icon} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <p className="mt-8 px-3 text-[11px] uppercase tracking-[0.2em] text-secondary">Your music</p>
        <nav aria-label="Library" className="mt-3 space-y-1">
          {LIBRARY_LINKS.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} Icon={item.icon} active={isActive(pathname, item.href)} small />
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-gold/15 bg-surface p-4">
          <p className="font-display text-base text-gold-highlight">{user?.isPremium ? "Premium member" : "Experience AURUM Premium"}</p>
          <p className="mt-1 text-xs text-secondary">{user?.isPremium ? "Ad-free, offline and high-fidelity." : "Ad-free listening, downloads and synced lyrics."}</p>
          {!user?.isPremium && (
            <Link href="/premium" className="mt-3 inline-flex h-8 items-center rounded-full bg-gold-gradient px-4 text-xs font-semibold text-[#0A0A0A] shadow-gold">
              Go Premium
            </Link>
          )}
        </div>
      </aside>

      {/* Top bar: avatar top-left, notifications top-right (all breakpoints) */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between bg-background/80 px-4 backdrop-blur-xl md:left-64 md:px-8">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open profile menu"
          aria-expanded={drawerOpen}
          className="flex items-center gap-3 rounded-full transition hover:opacity-90"
        >
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-gold/40 bg-elevated shadow-gold">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : user ? (
              <span className="font-display text-sm text-gold">{initials(user.username)}</span>
            ) : (
              <UserRound size={18} className="text-gold" />
            )}
          </span>
          <span className="hidden text-sm text-secondary sm:block">{user ? user.username : "Guest"}</span>
          {user?.isPremium && <Crown size={14} className="text-gold" aria-label="Premium member" />}
        </button>
        <Link href="/" className="font-display text-xl tracking-[0.2em] text-gold-gradient md:hidden">
          AURUM
        </Link>
        <NotificationBell signedIn={Boolean(user)} />
      </header>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />

      <main id="main" className={cn("min-h-dvh pt-20 md:ml-64 md:pt-24", hasPlayer ? "pb-44 md:pb-32" : "pb-28 md:pb-12")}>
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">{children}</div>
      </main>

      <MiniPlayer />
      <FullPlayer />

      {/* Mobile bottom navigation */}
      <nav aria-label="Primary mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="grid h-16 grid-cols-4">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px] transition", active ? "text-gold" : "text-secondary hover:text-white")}
                >
                  <item.icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {item.label}
                  <span className={cn("h-0.5 w-6 rounded-full transition", active ? "bg-gold" : "bg-transparent")} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ href, label, Icon, active, small }: { href: string; label: string; Icon: ComponentType<{ size?: number }>; active: boolean; small?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 transition duration-200",
        small ? "h-9 text-sm" : "h-11 text-[15px]",
        active ? "bg-gold/10 text-gold" : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      {active && <span className="absolute left-0 top-2 h-7 w-0.5 rounded-full bg-gold shadow-gold" aria-hidden />}
      <Icon size={small ? 16 : 19} />
      {label}
    </Link>
  );
}

function NotificationBell({ signedIn }: { signedIn: boolean }) {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    if (!signedIn) return;
    api<{ unread: number }>("/api/notifications?countOnly=1")
      .then((r) => setUnread(r.unread))
      .catch(() => setUnread(0));
  }, [signedIn, pathname]);
  return (
    <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:bg-white/5 hover:text-gold">
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold-gradient px-1 text-[10px] font-semibold text-[#0A0A0A]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

const DRAWER_ITEMS = [
  { href: "/profile", label: "My Profile", icon: UserRound },
  { href: "/profile#edit", label: "Edit Profile", icon: Pencil },
  { href: "/liked", label: "Liked Songs", icon: Heart },
  { href: "/playlists", label: "My Playlists", icon: ListMusic },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/history", label: "Listening History", icon: History },
  { href: "/following", label: "Followed Artists", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function NavDrawer({ open, onClose, user }: { open: boolean; onClose: () => void; user: ShellUser | null }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setLoggingOut(false);
      onClose();
      router.push("/");
      router.refresh();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="scrim"
            aria-label="Close menu"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.nav
            key="drawer"
            aria-label="Account navigation"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-sm flex-col border-r border-gold/10 bg-elevated p-6 shadow-gold-lg"
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-xl tracking-[0.2em] text-gold-gradient">AURUM</span>
              <IconButton label="Close menu" onClick={onClose}>
                <X size={20} />
              </IconButton>
            </div>
            {user ? (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/5 bg-surface p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
                  <Artwork src={user.avatarUrl} seed={user.username} alt="" rounded="rounded-full" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.username}</p>
                  <p className="text-xs text-gold">{user.isPremium ? "Premium member" : "Free plan"}</p>
                </div>
              </div>
            ) : (
              <div className="mb-6 space-y-2">
                <Link href="/login" className="block rounded-full bg-gold-gradient py-2.5 text-center text-sm font-semibold text-[#0A0A0A]">Sign in</Link>
                <Link href="/register" className="block rounded-full border border-gold/50 py-2.5 text-center text-sm text-gold">Create account</Link>
              </div>
            )}
            <ul className="flex-1 space-y-1 overflow-y-auto">
              {(user ? DRAWER_ITEMS : DRAWER_ITEMS.slice(-1)).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={onClose} className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/80 transition hover:bg-white/5 hover:text-gold">
                    <item.icon size={18} className="text-gold/80" /> {item.label}
                  </Link>
                </li>
              ))}
              {user?.role === "admin" && (
                <li>
                  <Link href="/admin" onClick={onClose} className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/80 transition hover:bg-white/5 hover:text-gold">
                    <ShieldCheck size={18} className="text-gold/80" /> Admin Dashboard
                  </Link>
                </li>
              )}
            </ul>
            {user && (
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="mt-4 flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 text-sm text-white/80 transition hover:border-gold/50 hover:text-gold disabled:opacity-50"
              >
                <LogOut size={16} /> {loggingOut ? "Signing out…" : "Logout"}
              </button>
            )}
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
