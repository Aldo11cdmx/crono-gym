import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeAnnouncement, type Announcement, type AnnouncementCategory } from "@/types/announcements";
import {
  findAnnouncementMeta,
  readLocalAnnouncements,
  saveAnnouncementMeta,
  saveLocalAnnouncement,
} from "@/lib/gymClubMetadata";
export type { Announcement, AnnouncementCategory };

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

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(readLocal);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const local = [...readLocal(), ...readLocalAnnouncements<Announcement>()];
    setAnnouncements(local.filter((item) => item.active));
    try {
      const { data, error } = await (supabase as any)
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        const remote = data
          .map((row) => {
            const item = normalizeAnnouncement(row as Record<string, unknown>);
            const meta = findAnnouncementMeta(item.id, item.title);
            return {
              ...item,
              ...meta,
              imageUrl: (row as Record<string, unknown>).banner_path as string | undefined ?? meta?.imageUrl ?? item.imageUrl,
              pinned: meta?.pinned ?? item.pinned,
              active: meta?.active ?? item.active,
            };
          })
          .filter((item) => item.active);
        const merged = [...remote, ...local.filter((item) => !remote.some((current) => current.id === item.id))];
        writeLocal(merged);
        setAnnouncements(merged.filter((item) => item.active));
      }
    } catch {
      // Local data remains available when the optional Supabase table is offline.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener("cronos-announcements-changed", onChanged);
    return () => window.removeEventListener("cronos-announcements-changed", onChanged);
  }, [refresh]);

  const save = useCallback(async (input: Pick<Announcement, "title" | "body" | "category" | "imageUrl">) => {
    const item: Announcement = {
      id: `local-${Date.now()}`,
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
      createdAt: new Date().toISOString(),
      active: true,
      imageUrl: input.imageUrl,
    };
    const next = [item, ...readLocal()];
    writeLocal(next);
    saveLocalAnnouncement(item);
    setAnnouncements(next);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).from("announcements").insert({
        title: item.title,
        message: item.body,
        kind: item.category === "event" ? "event" : item.category === "urgent" ? "notice" : "notice",
        banner_path: item.imageUrl ?? null,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        created_by: authData.user?.id,
      }).select("id").single();
      if (!error) {
        saveAnnouncementMeta(
          [String(data?.id ?? ""), item.title],
          { imageUrl: item.imageUrl, category: item.category, pinned: false, active: true },
        );
      }
    } catch {
      // Local persistence keeps the feed available when Supabase is unavailable.
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const next = readLocal().filter((item) => item.id !== id);
    writeLocal(next);
    setAnnouncements(next.filter((item) => item.active));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
    try {
      await (supabase as any).from("announcements").delete().eq("id", id);
    } catch {
      // Local deletion remains authoritative for this device.
    }
  }, []);

  return { announcements, loading, save, remove, refresh };
}
