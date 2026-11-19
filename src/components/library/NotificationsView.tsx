"use client";

import Link from "next/link";
import { Bell, Crown, Music, Megaphone, ListMusic } from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/common/ui";
import { useApi } from "@/hooks/useApi";
import { api } from "@/services/api";
import { relativeTime } from "@/lib/format";
import { cn } from "@/utils/cn";

interface Note {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  release: Music,
  playlist: ListMusic,
  subscription: Crown,
  announcement: Megaphone,
};

export function NotificationsView() {
  const { data, error, loading, retry, setData } = useApi<{ notifications: Note[] }>("/api/notifications");
  const unread = data?.notifications.filter((n) => !n.read).length ?? 0;

  const markAll = async () => {
    await api("/api/notifications", { method: "POST", json: { action: "readAll" } });
    setData({ notifications: (data?.notifications ?? []).map((n) => ({ ...n, read: true })) });
  };

  if (loading && !data)
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.notifications.length === 0)
    return <EmptyState icon={<Bell size={28} />} title="You’re all caught up" text="New releases from artists you follow and subscription updates will appear here." />;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-secondary">{unread} unread</p>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll}>
            Mark all as read
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {data.notifications.map((n) => {
          const Icon = ICONS[n.type] ?? Bell;
          const inner = (
            <div className={cn("flex items-start gap-4 rounded-2xl border p-4 transition", n.read ? "border-white/5 bg-surface" : "border-gold/30 bg-elevated shadow-gold")}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10 text-gold">
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  {n.title}
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-label="Unread" />}
                </p>
                {n.body && <p className="mt-1 line-clamp-2 text-sm text-secondary">{n.body}</p>}
                <p className="mt-2 text-xs text-secondary">{relativeTime(n.createdAt)}</p>
              </div>
            </div>
          );
          return <li key={n.id}>{n.link ? <Link href={n.link} className="block transition hover:opacity-90">{inner}</Link> : inner}</li>;
        })}
      </ul>
    </>
  );
}
