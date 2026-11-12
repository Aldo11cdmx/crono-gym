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
