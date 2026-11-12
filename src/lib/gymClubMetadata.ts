const ANNOUNCEMENT_META_KEY = "cronos_announcements_meta_v1";
const STORE_META_KEY = "cronos_store_meta_v1";
const CLASS_META_KEY = "cronos_classes_meta_v1";
const ANNOUNCEMENTS_KEY = "cronos-announcements";
const PRODUCTS_KEY = "cronos-products-local-v1";
const CLASSES_KEY = "cronos-classes-local-v1";

export interface AnnouncementMeta {
  imageUrl?: string;
  category?: "urgent" | "event" | "info";
  pinned?: boolean;
  active?: boolean;
}

export interface StoreMeta {
  imageUrl?: string;
  category?: string;
  description?: string;
}

export interface ClassMeta {
  priceCents?: number;
  description?: string;
}

export interface LocalProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price_cents: number;
  stock: number;
  image_path?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface LocalGymClass {
  id: string;
  name: string;
  instructor?: string;
  capacity: number;
  price_cents?: number;
  description?: string;
  is_active?: boolean;
  created_at?: string;
}

function read<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, T>)
      : {};
  } catch {
    return {};
  }
}

function write<T>(key: string, value: Record<string, T>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local metadata is optional; the remote row remains authoritative.
  }
}

function save<T>(key: string, identifiers: string[], value: T) {
  const metadata = read<T>(key);
  for (const identifier of identifiers) {
    if (identifier) metadata[identifier] = value;
  }
  write(key, metadata);
}

function find<T>(key: string, id: unknown, title: unknown): T | undefined {
  const metadata = read<T>(key);
  return metadata[String(id)] ?? metadata[String(title)];
}

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The in-memory state still shows the newly created record.
  }
}

export function saveAnnouncementMeta(
  identifiers: string[],
  value: AnnouncementMeta,
) {
  save(ANNOUNCEMENT_META_KEY, identifiers, value);
}

export function findAnnouncementMeta(id: unknown, title: unknown) {
  return find<AnnouncementMeta>(ANNOUNCEMENT_META_KEY, id, title);
}

export function saveStoreMeta(identifiers: string[], value: StoreMeta) {
  save(STORE_META_KEY, identifiers, value);
}

export function findStoreMeta(id: unknown, name: unknown) {
  return find<StoreMeta>(STORE_META_KEY, id, name);
}

export function saveClassMeta(identifiers: string[], value: ClassMeta) {
  save(CLASS_META_KEY, identifiers, value);
}

export function findClassMeta(id: unknown, name: unknown) {
  return find<ClassMeta>(CLASS_META_KEY, id, name);
}

export function readLocalAnnouncements<T>(): T[] {
  return readList<T>(ANNOUNCEMENTS_KEY);
}

export function saveLocalAnnouncement<T extends { id: string }>(item: T) {
  const items = readList<T>(ANNOUNCEMENTS_KEY);
  writeList(ANNOUNCEMENTS_KEY, [item, ...items.filter((current) => current.id !== item.id)]);
}

/**
 * Drops local mirror entries that duplicate another entry.
 *
 * The v1 save paths appended without de-duplicating, so a reload or a
 * re-publish could leave several copies of one record in the mirror. Storage is
 * device-local, so the copies are dropped instead of merged: the newest entry
 * survives, which is also what the admin editor would have written last.
 *
 * Identity is the id first and the normalized title second, so a record whose
 * id changed between save paths still collapses to one row.
 */
export function dedupeLocalAnnouncements<T extends { id?: unknown; title?: unknown }>(): {
  kept: number;
  removed: number;
} {
  const items = readList<T>(ANNOUNCEMENTS_KEY);
  if (items.length === 0) return { kept: 0, removed: 0 };

  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const kept: T[] = [];
  for (const item of items) {
    const id = String(item?.id ?? "").trim();
    const title = String(item?.title ?? "").trim().toLowerCase();
    if (id && seenIds.has(id)) continue;
    if (title && seenTitles.has(title)) continue;
    if (id) seenIds.add(id);
    if (title) seenTitles.add(title);
    kept.push(item);
  }

  const removed = items.length - kept.length;
  if (removed > 0) writeList(ANNOUNCEMENTS_KEY, kept);
  return { kept: kept.length, removed };
}

/**
 * Collapses the announcement metadata mirror to one key per record.
 *
 * The v1 save paths wrote the same record under both its id and its title, and
 * superseded records left orphan keys behind. The mirror grew without bound
 * while the feed itself stayed short. Metadata is advisory: the remote row or
 * the local feed stays authoritative, so the extra keys are safe to drop.
 *
 * Returns the removed keys so the caller can report the cleanup.
 */
export function cleanAnnouncementMeta(): { removed: string[] } {
  const metadata = read<AnnouncementMeta>(ANNOUNCEMENT_META_KEY);
  const entries = Object.entries(metadata);
  if (entries.length === 0) return { removed: [] };

  const removed: string[] = [];
  const visited = new Set<string>();

  for (const [key, value] of entries) {
    if (!isRecord(value)) {
      delete metadata[key];
      removed.push(key);
      continue;
    }
    if (visited.has(key)) continue;

    // Every key holding this exact record describes one announcement.
    const twins = entries.filter(([, otherValue]) => sameRecord(otherValue, value));
    for (const [twinKey] of twins) visited.add(twinKey);
    if (twins.length < 2) continue;

    // Keep the id-shaped key when there is one; the title-shaped twins are the
    // ones the v1 save path added on top of it.
    const keep = twins.find(([twinKey]) => isIdLike(twinKey))?.[0] ?? twins[0][0];
    for (const [twinKey] of twins) {
      if (twinKey === keep) continue;
      delete metadata[twinKey];
      removed.push(twinKey);
    }
  }

  if (removed.length > 0) write(ANNOUNCEMENT_META_KEY, metadata);
  return { removed };
}

function isIdLike(key: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key) ||
    key.startsWith("local-") ||
    key.startsWith("seed-")
  );
}

function isRecord(value: unknown): value is AnnouncementMeta {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameRecord(a: unknown, b: unknown) {
  if (!isRecord(a) || !isRecord(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

/** Removes the announcement feed and its metadata mirror. */
export function clearAnnouncementCaches() {
  for (const key of [ANNOUNCEMENTS_KEY, ANNOUNCEMENT_META_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // A blocked storage API leaves the in-memory feed authoritative.
    }
  }
}

export function readLocalProducts() {
  return readList<LocalProduct>(PRODUCTS_KEY);
}

export function saveLocalProduct(item: LocalProduct) {
  const items = readLocalProducts();
  writeList(PRODUCTS_KEY, [item, ...items.filter((current) => current.id !== item.id)]);
}

export function readLocalClasses() {
  return readList<LocalGymClass>(CLASSES_KEY);
}

export function saveLocalClass(item: LocalGymClass) {
  const items = readLocalClasses();
  writeList(CLASSES_KEY, [item, ...items.filter((current) => current.id !== item.id)]);
}
