/**
 * useMediaSrc.ts — an image that is there even when the network is not.
 *
 * The exercise demonstrations are remote files. When they load, they are kept
 * on the device, so the next time the same exercise appears the demonstration
 * plays even with no connection; when they do not load, the stored copy is
 * served instead of an empty box.
 *
 * The hook owns three states that every caller used to spell differently:
 * the URL to render, whether the medium could not be shown at all, and the
 * two handlers the `<img>` needs.
 *
 * Storing a medium costs a second request for the same file, which the
 * browser's own cache usually answers without touching the network.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { readMedia, writeMedia } from "./mediaCache";
import type { ResolvedMedia } from "./mediaResolver";

export interface MediaSrc {
  /** The URL to render. */
  src: string;
  /** True when the medium could not be shown at all. */
  failed: boolean;
  /** Call when the image loaded: it is kept for the next time. */
  onLoad: () => void;
  /** Call when the image failed: serves the stored copy, or gives up. */
  onError: () => void;
}

/** Keeps a medium on the device. A failure here is not a failure to show it. */
async function keepMedia(media: ResolvedMedia): Promise<void> {
  if (media.url === "") return;
  try {
    const res = await fetch(media.url);
    if (!res.ok) return;
    const blob = await res.blob();
    await writeMedia(media.key, media.url, media.kind, blob);
  } catch {
    // Offline, blocked or gone: the next attempt will do the same.
  }
}

export function useMediaSrc(media: ResolvedMedia): MediaSrc {
  const [src, setSrc] = useState(media.url);
  const [failed, setFailed] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    // Another medium: what the last one did says nothing about this one.
    setSrc(media.url);
    setFailed(false);
  }, [media.key, media.url]);

  useEffect(
    () => () => {
      if (objectUrl.current && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
      }
    },
    [],
  );

  const onLoad = useCallback(() => {
    void keepMedia(media);
  }, [media]);

  const onError = useCallback(() => {
    void readMedia(media.key).then((blob) => {
      if (!blob) {
        setFailed(true);
        return;
      }
      if (typeof URL.createObjectURL !== "function") {
        setFailed(true);
        return;
      }
      if (objectUrl.current && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(objectUrl.current);
      }
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      setSrc(url);
    });
  }, [media.key]);

  return { src, failed, onLoad, onError };
}
