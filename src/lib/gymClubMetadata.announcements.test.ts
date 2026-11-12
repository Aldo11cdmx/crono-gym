/**
 * @vitest-environment jsdom
 *
 * Regression cover for the ghost count on /hoy: the badge is the length of the
 * announcement feed, so every duplicate the local mirror kept inflated it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  cleanAnnouncementMeta,
  clearAnnouncementCaches,
  dedupeLocalAnnouncements,
  readLocalAnnouncements,
  saveLocalAnnouncement,
} from "./gymClubMetadata";

const ANNOUNCEMENTS_KEY = "cronos-announcements";
const ANNOUNCEMENT_META_KEY = "cronos_announcements_meta_v1";

type Row = { id: string; title: string; active: boolean };

beforeEach(() => {
  window.localStorage.clear();
});

function seedFeed(rows: Row[]) {
  window.localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(rows));
}

describe("dedupeLocalAnnouncements", () => {
  it("collapses repeated ids in the local feed", () => {
    seedFeed([
      { id: "a-1", title: "Piscina", active: true },
      { id: "a-1", title: "Piscina", active: true },
      { id: "a-2", title: "Sauna", active: true },
    ]);

    const result = dedupeLocalAnnouncements<Row>();

    expect(result.removed).toBe(1);
    expect(readLocalAnnouncements<Row>()).toHaveLength(2);
  });

  it("collapses rows that only differ by id but share a title", () => {
    seedFeed([
      { id: "local-1", title: "Mantenimiento", active: true },
      { id: "local-announcement-1", title: "  MANTENIMIENTO ", active: true },
    ]);

    const result = dedupeLocalAnnouncements<Row>();

    expect(result.removed).toBe(1);
    expect(readLocalAnnouncements<Row>()).toHaveLength(1);
  });

  it("keeps distinct announcements with different titles", () => {
    seedFeed([
      { id: "a-1", title: "Piscina", active: true },
      { id: "a-2", title: "Sauna", active: true },
      { id: "a-3", title: "Evento", active: true },
    ]);

    const result = dedupeLocalAnnouncements<Row>();

    expect(result.removed).toBe(0);
    expect(readLocalAnnouncements<Row>()).toHaveLength(3);
  });

  it("leaves an empty feed untouched", () => {
    window.localStorage.removeItem(ANNOUNCEMENTS_KEY);
    expect(dedupeLocalAnnouncements<Row>()).toEqual({ kept: 0, removed: 0 });
  });
});

describe("cleanAnnouncementMeta", () => {
  it("drops the title-shaped twin of an id-shaped metadata key", () => {
    const meta = {
      imageUrl: "https://cdn.test/qr.jpg",
      category: "info",
      pinned: false,
      active: true,
    };
    window.localStorage.setItem(
      ANNOUNCEMENT_META_KEY,
      JSON.stringify({
        "b0a1c2d3-e4f5-6789-abcd-ef0123456789": meta,
        "Mantenimiento del gimnasio": meta,
      }),
    );

    const result = cleanAnnouncementMeta();

    expect(result.removed).toContain("Mantenimiento del gimnasio");
    const stored = JSON.parse(window.localStorage.getItem(ANNOUNCEMENT_META_KEY) ?? "{}");
    expect(Object.keys(stored)).toEqual(["b0a1c2d3-e4f5-6789-abcd-ef0123456789"]);
  });

  it("drops non-object entries left by the v1 save path", () => {
    window.localStorage.setItem(
      ANNOUNCEMENT_META_KEY,
      JSON.stringify({
        broken: null,
        alsoBroken: "texto",
        "b0a1c2d3-e4f5-6789-abcd-ef0123456789": { imageUrl: "https://cdn.test/a.jpg" },
      }),
    );

    const result = cleanAnnouncementMeta();

    expect(result.removed.sort()).toEqual(["alsoBroken", "broken"]);
    const stored = JSON.parse(window.localStorage.getItem(ANNOUNCEMENT_META_KEY) ?? "{}");
    expect(Object.keys(stored)).toEqual(["b0a1c2d3-e4f5-6789-abcd-ef0123456789"]);
  });

  it("keeps a lone metadata key without a twin", () => {
    const meta = { imageUrl: "https://cdn.test/only.jpg" };
    window.localStorage.setItem(
      ANNOUNCEMENT_META_KEY,
      JSON.stringify({ "b0a1c2d3-e4f5-6789-abcd-ef0123456789": meta }),
    );

    expect(cleanAnnouncementMeta().removed).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(ANNOUNCEMENT_META_KEY) ?? "{}")).toEqual({
      "b0a1c2d3-e4f5-6789-abcd-ef0123456789": meta,
    });
  });

  it("is idempotent: a second run removes nothing", () => {
    const meta = { imageUrl: "https://cdn.test/x.jpg", pinned: false };
    window.localStorage.setItem(
      ANNOUNCEMENT_META_KEY,
      JSON.stringify({
        "local-1": meta,
        "Aviso uno": meta,
      }),
    );

    cleanAnnouncementMeta();
    const second = cleanAnnouncementMeta();

    expect(second.removed).toEqual([]);
  });
});

describe("clearAnnouncementCaches", () => {
  it("removes both the feed and the metadata mirror", () => {
    seedFeed([{ id: "a-1", title: "Piscina", active: true }]);
    window.localStorage.setItem(ANNOUNCEMENT_META_KEY, JSON.stringify({ "a-1": { pinned: true } }));

    clearAnnouncementCaches();

    expect(window.localStorage.getItem(ANNOUNCEMENTS_KEY)).toBeNull();
    expect(window.localStorage.getItem(ANNOUNCEMENT_META_KEY)).toBeNull();
  });
});

describe("saveLocalAnnouncement", () => {
  it("replaces the row with the same id instead of appending a copy", () => {
    saveLocalAnnouncement({ id: "a-1", title: "Piscina", active: true });
    saveLocalAnnouncement({ id: "a-1", title: "Piscina (cerrada)", active: false });

    const rows = readLocalAnnouncements<Row>();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Piscina (cerrada)");
  });
});