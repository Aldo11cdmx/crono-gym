/**
 * mediaResolver.ts — the single place that turns a stored media path into a URL.
 *
 * The app had a dozen media call sites and three different conventions:
 *
 *  - the catalog stores `videos/0001-2gPfomN.gif`, relative to the dataset,
 *  - the equipment map stores `public/images/gym-equipment/CG-EQP-0001_….jpg`,
 *    which Vite serves at the root as `/images/gym-equipment/…`,
 *  - the seeded `exercises` table stores an absolute GitHub raw URL.
 *
 * Only one call site knew about the `public/` prefix, so the equipment photos
 * 404'd in three places and the picker thumbnails 404'd in all of them. This
 * module knows the conventions; the components only know what to show.
 *
 * It also names each medium. A medium is identified by *what it is* (the kind
 * and the id of the thing it depicts), never by the URL that serves it: a
 * change of CDN must not invalidate a cached medium, and a cached medium must
 * not be mistaken for a different one.
 */

/** Where the dataset serves its own media. */
export const MEDIA_BASE_URL =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main";

/** The two folders the dataset uses for its media, relative to its base. */
const DATASET_FOLDERS = ["videos/", "images/"];

export type MediaKind = "exercise-gif" | "exercise-image" | "equipment-photo";

export interface ResolvedMedia {
  /** Identity of the medium. Stable across URL changes. */
  key: string;
  /** Absolute URL to render. Empty when there is no medium. */
  url: string;
}

const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const INLINE_URL = /^(?:data|blob):/i;

/** True for URLs that already point somewhere: `https://…`, `//…`, `data:…`. */
export function isAbsoluteMediaUrl(path: string): boolean {
  return ABSOLUTE_URL.test(path) || INLINE_URL.test(path);
}

/**
 * Turns a stored path into a URL the browser can load.
 *
 * - absolute and inline URLs are returned untouched;
 * - `public/…` becomes `/…`, because Vite serves `public/` at the root;
 * - a path already rooted at `/` is returned untouched;
 * - `videos/…` and `images/…` are the dataset's own media, and become
 *   absolute GitHub raw URLs;
 * - anything else is treated as an asset of the app itself.
 */
export function resolveMediaUrl(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") return "";
  if (isAbsoluteMediaUrl(trimmed)) return trimmed;
  if (trimmed.startsWith("public/")) return `/${trimmed.slice("public/".length)}`;
  if (trimmed.startsWith("/")) return trimmed;
  if (DATASET_FOLDERS.some((folder) => trimmed.startsWith(folder))) {
    return `${MEDIA_BASE_URL}/${trimmed}`;
  }
  return `/${trimmed}`;
}

/** The identity of a medium: what it depicts, not where it is served from. */
export function mediaKey(kind: MediaKind, id: string): string {
  return `${kind}:${id}`;
}

/** Resolves a medium into the pair the UI needs: its identity and its URL. */
export function resolveMedia(kind: MediaKind, id: string, path: string): ResolvedMedia {
  return { key: mediaKey(kind, id), url: resolveMediaUrl(path) };
}
