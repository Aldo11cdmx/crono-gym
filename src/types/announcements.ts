export type AnnouncementCategory = "urgent" | "event" | "info";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  createdAt: string;
  pinned?: boolean;
  active: boolean;
  imageUrl?: string;
}

export function normalizeAnnouncement(row: Record<string, unknown>): Announcement {
  const rawCategory = row.category ?? row.kind;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    body: String(row.body ?? row.message ?? ""),
    category:
      rawCategory === "urgent"
        ? "urgent"
        : rawCategory === "event"
          ? "event"
          : "info",
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    pinned: Boolean(row.pinned),
    active: row.active !== false,
    imageUrl:
      typeof row.banner_path === "string"
        ? row.banner_path
        : typeof row.image_url === "string"
          ? row.image_url
          : typeof row.imageUrl === "string"
            ? row.imageUrl
            : undefined,
  };
}
