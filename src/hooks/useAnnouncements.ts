import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AnnouncementCategory = "urgent" | "event" | "info";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  createdAt: string;
  pinned?: boolean;
  active: boolean;
}

const STORAGE_KEY = "cronos-announcements";
const SEEDS: Announcement[] = [
  {
    id: "seed-welcome",
    title: "Bienvenido a Cronos",
    body: "Revisa tu rutina de hoy y registra cada serie para seguir tu progreso.",
    category: "info",
    createdAt: new Date("2026-01-01T12:00:00Z").toISOString(),
    pinned: true,
    active: true,
  },
];

function readLocal(): Announcement[] {
  if (typeof window === "undefined") return SEEDS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(stored)) return stored as Announcement[];
  } catch {
    // A corrupt local feed is recoverable by restoring the seed.
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEEDS));
  return SEEDS;
}

function writeLocal(items: Announcement[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

function fromRow(row: Record<string, unknown>): Announcement {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    body: String(row.body ?? row.message ?? ""),
    category: row.category === "urgent" || row.category === "event" ? row.category : "info",
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    pinned: Boolean(row.pinned),
    active: row.active !== false,
  };
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(readLocal);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const local = readLocal();
    setAnnouncements(local.filter((item) => item.active));
    try {
      const { data, error } = await (supabase as any)
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        const remote = data.map(fromRow).filter((item) => item.active);
        writeLocal(remote);
        setAnnouncements(remote);
      }
    } catch {
      // Local data remains available when the optional Supabase table is offline.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (input: Pick<Announcement, "title" | "body" | "category">) => {
    const item: Announcement = {
      id: `local-${Date.now()}`,
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
      createdAt: new Date().toISOString(),
      active: true,
    };
    const next = [item, ...readLocal()];
    writeLocal(next);
    setAnnouncements(next);
    try {
      await (supabase as any).from("announcements").insert({
        title: item.title,
        message: item.body,
        kind: item.category === "event" ? "event" : item.category === "urgent" ? "notice" : "notice",
        active: true,
      });
    } catch {
      // Local persistence keeps the feed available when Supabase is unavailable.
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const next = readLocal().filter((item) => item.id !== id);
    writeLocal(next);
    setAnnouncements(next.filter((item) => item.active));
    try {
      await (supabase as any).from("announcements").delete().eq("id", id);
    } catch {
      // Local deletion remains authoritative for this device.
    }
  }, []);

  return { announcements, loading, save, remove, refresh };
}
