/**
 * @vitest-environment jsdom
 *
 * Regression cover for two /hoy symptoms: the badge reported the cache size
 * instead of the real feed, and the announcement photo never reached the card.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, renderHook } from "@testing-library/react";
import { useAnnouncements } from "./useAnnouncements";
import { TipSection } from "@/components/dashboard/sections/TipSection";

const selectMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => selectMock(),
    }),
    auth: {
      getUser: () => getUserMock(),
    },
  },
}));

const ANNOUNCEMENTS_KEY = "cronos-announcements";
const ANNOUNCEMENT_META_KEY = "cronos_announcements_meta_v1";

function seedFeed(rows: unknown[]) {
  window.localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(rows));
}

beforeEach(() => {
  window.localStorage.clear();
  selectMock.mockReturnValue({
    order: () => Promise.resolve({ data: [], error: null }),
  });
  getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });
});

afterEach(() => {
  cleanup();
});

describe("useAnnouncements", () => {
  it("counts each announcement once when the mirror holds duplicates", async () => {
    seedFeed([
      { id: "a-1", title: "Piscina cerrada", body: "Hoy no hay pileta.", category: "info", createdAt: "2026-10-01T00:00:00Z", active: true },
      { id: "a-1", title: "Piscina cerrada", body: "Hoy no hay pileta.", category: "info", createdAt: "2026-10-01T00:00:00Z", active: true },
      { id: "local-announcement-2", title: "piscina cerrada", body: "Hoy no hay pileta.", category: "info", createdAt: "2026-10-01T00:00:00Z", active: true },
    ]);

    const { result } = renderHook(() => useAnnouncements());

    await waitFor(() => expect(result.current.announcements.length).toBeGreaterThan(0));
    expect(result.current.announcements).toHaveLength(1);
    expect(result.current.announcements[0].title).toBe("Piscina cerrada");
  });

  it("drops rows flagged inactive from the badge", async () => {
    seedFeed([
      { id: "a-1", title: "Visible", body: "Uno", category: "info", createdAt: "2026-10-01T00:00:00Z", active: true },
      { id: "a-2", title: "Oculto", body: "Dos", category: "info", createdAt: "2026-10-02T00:00:00Z", active: false },
    ]);

    const { result } = renderHook(() => useAnnouncements());

    await waitFor(() => expect(result.current.announcements.length).toBe(1));
    expect(result.current.announcements[0].title).toBe("Visible");
  });

  it("keeps one row per remote id and folds the photo into imageUrl", async () => {
    selectMock.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: [
            {
              id: "b0a1c2d3-e4f5-6789-abcd-ef0123456789",
              title: "QR del gimnasio",
              message: "Escanea para entrar.",
              kind: "notice",
              banner_path: null,
              starts_at: "2026-10-01T00:00:00Z",
              expires_at: "2026-11-30T00:00:00Z",
            },
          ],
          error: null,
        }),
    });
    // The v1 metadata mirror is where the photo was parked when banner_path was null.
    window.localStorage.setItem(
      ANNOUNCEMENT_META_KEY,
      JSON.stringify({
        "b0a1c2d3-e4f5-6789-abcd-ef0123456789": { imageUrl: "https://cdn.test/qr.jpg" },
      }),
    );

    const { result } = renderHook(() => useAnnouncements());

    await waitFor(() => expect(result.current.announcements.length).toBe(1));
    expect(result.current.announcements[0].imageUrl).toBe("https://cdn.test/qr.jpg");
  });
});

describe("TipSection photo", () => {
  const tip = { id: "t1", text: "Tip de prueba", icon: "lightbulb" as const, category: "entrenamiento" };

  it("renders the photo stored under banner_path only", () => {
    render(
      <TipSection
        tip={tip}
        onNext={() => {}}
        announcements={[
          {
            id: "a-1",
            title: "QR del gimnasio",
            body: "Escanea para entrar.",
            category: "info",
            createdAt: "2026-10-01T00:00:00Z",
            active: true,
            banner_path: "https://cdn.test/qr.jpg",
          } as never,
        ]}
      />,
    );

    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/qr.jpg");
  });

  it("renders the photo stored under image_url only", () => {
    render(
      <TipSection
        tip={tip}
        onNext={() => {}}
        announcements={[
          {
            id: "a-1",
            title: "QR del gimnasio",
            body: "Escanea para entrar.",
            category: "info",
            createdAt: "2026-10-01T00:00:00Z",
            active: true,
            image_url: "https://cdn.test/espejo.jpg",
          } as never,
        ]}
      />,
    );

    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/espejo.jpg");
  });

  it("keeps the badge equal to the number of announcements", () => {
    render(
      <TipSection
        tip={tip}
        onNext={() => {}}
        announcements={[
          { id: "a-1", title: "Uno", body: "1", category: "info", createdAt: "2026-10-01T00:00:00Z", active: true },
          { id: "a-2", title: "Dos", body: "2", category: "info", createdAt: "2026-10-02T00:00:00Z", active: true },
          { id: "a-3", title: "Tres", body: "3", category: "info", createdAt: "2026-10-03T00:00:00Z", active: true },
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: /Avisos \(3\)/ })).toBeTruthy();
  });
});