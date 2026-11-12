import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeAnnouncement, type Announcement, type AnnouncementCategory } from "@/types/announcements";
import {
  cleanAnnouncementMeta,
  dedupeLocalAnnouncements,
  findAnnouncementMeta,
  saveAnnouncementMeta,
  saveLocalAnnouncement,
} from "@/lib/gymClubMetadata";
export type { Announcement, AnnouncementCategory };

/**
 * Same key the local mirror uses in `gymClubMetadata`.
 *
 * The two modules used to read it under different names and concatenate both
 * reads, so every stored row counted twice. One key, one read.
 */
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

/**
 * One visible row per announcement.
 *
 * The /hoy badge is the length of this array, so it was reporting the size of
 * the cache rather than the feed: the same key was read twice and both reads
 * were concatenated, so every stored row counted twice, and hidden rows were
 * filtered out downstream instead of here. Rows are collapsed by id, then by
 * normalized title, with the first occurrence (remote before local) winning.
 */
function mergeAnnouncements(remote: Announcement[], local: Announcement[]): Announcement[] {
  const merged: Announcement[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  for (const item of [...remote, ...local]) {
    const id = String(item.id ?? "").trim();
    const title = String(item.title ?? "").trim().toLowerCase();
    if (id && seenIds.has(id)) continue;
    if (title && seenTitles.has(title)) continue;
    if (id) seenIds.add(id);
    if (title) seenTitles.add(title);
    if (item.active === false) continue;
    merged.push(item);
  }

  return merged;
}

/** One visible row per announcement: the stored feed, deduplicated. */
function readFeed(): Announcement[] {
  return mergeAnnouncements(readLocal(), []);
}

/**
 * Runs both local cleanups.
 *
 * `cleanAnnouncementMeta` collapses the metadata mirror, whose v1 save paths
 * wrote the same record under its id and its title. `dedupeLocalAnnouncements`
 * collapses the stored feed itself. Both are idempotent, so the initial state
 * and every change notification can call them without a second cleanup.
 */
function purgeGhostRows() {
  cleanAnnouncementMeta();
  dedupeLocalAnnouncements<Announcement>();
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    purgeGhostRows();
    return readFeed();
  });

  const refresh = useCallback(async () => {
    setAnnouncements(readFeed());
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
        // Remote rows win, local rows fill the gaps. The stored feed is rewritten
        // so a later offline load shows the same set.
        const merged = mergeAnnouncements(remote, readLocal());
        writeLocal(merged);
        setAnnouncements(merged);
      }
    } catch {
      // Local data remains available when the optional Supabase table is offline.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => {
      purgeGhostRows();
      void refresh();
    };
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
    saveLocalAnnouncement(item);
    setAnnouncements(readFeed());
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
    setAnnouncements(readFeed());
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
    try {
      await (supabase as any).from("announcements").delete().eq("id", id);
    } catch {
      // Local deletion remains authoritative for this device.
    }
  }, []);

  return { announcements, save, remove, refresh };
}