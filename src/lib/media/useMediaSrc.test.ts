/**
 * @vitest-environment jsdom
 *
 * useMediaSrc.test.ts — the image that is there even when the network is not.
 *
 * Three things can happen to a medium, and the hook has to answer all three:
 * it loads and is kept for the next time, it fails and the stored copy is
 * served instead, or it fails and there is nothing stored, in which case the
 * caller draws a placeholder. The last case is the one that used to be the
 * only one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { readMedia, writeMedia } from "./mediaCache";
import { resolveMedia } from "./mediaResolver";
import { useMediaSrc } from "./useMediaSrc";

vi.mock("./mediaCache", () => ({
  readMedia: vi.fn(),
  writeMedia: vi.fn(),
}));

const readMediaMock = vi.mocked(readMedia);
const writeMediaMock = vi.mocked(writeMedia);

const media = resolveMedia("exercise-gif", "0001", "https://cdn.test/0001.gif");

beforeEach(() => {
  readMediaMock.mockReset();
  writeMediaMock.mockReset();
  readMediaMock.mockResolvedValue(null);
  writeMediaMock.mockResolvedValue(undefined);
  // jsdom has no fetch and no object URLs.
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(["gif"]),
  }));
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => "blob:media");
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe("useMediaSrc", () => {
  it("serves the resolved URL", () => {
    const { result } = renderHook(() => useMediaSrc(media));

    expect(result.current.src).toBe("https://cdn.test/0001.gif");
    expect(result.current.failed).toBe(false);
  });

  it("keeps the medium on the device once it has loaded", async () => {
    const { result } = renderHook(() => useMediaSrc(media));

    await act(async () => {
      result.current.onLoad();
    });

    expect(writeMediaMock).toHaveBeenCalledWith(
      "exercise-gif:0001",
      "https://cdn.test/0001.gif",
      "exercise-gif",
      expect.anything(),
    );
  });

  it("gives up when the medium fails and nothing is stored", async () => {
    const { result } = renderHook(() => useMediaSrc(media));

    await act(async () => {
      result.current.onError();
    });

    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  it("serves the stored copy when the network fails", async () => {
    readMediaMock.mockResolvedValue(new Blob(["gif"]));
    const { result } = renderHook(() => useMediaSrc(media));

    await act(async () => {
      result.current.onError();
    });

    await waitFor(() => expect(result.current.src).toBe("blob:media"));
    expect(result.current.failed).toBe(false);
  });

  it("starts over when the medium changes", async () => {
    const other = resolveMedia("exercise-gif", "0002", "https://cdn.test/0002.gif");
    const { result, rerender } = renderHook(({ m }) => useMediaSrc(m), {
      initialProps: { m: media },
    });

    await act(async () => {
      result.current.onError();
    });
    await waitFor(() => expect(result.current.failed).toBe(true));

    rerender({ m: other });

    await waitFor(() => expect(result.current.failed).toBe(false));
    expect(result.current.src).toBe("https://cdn.test/0002.gif");
  });
});
