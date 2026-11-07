export interface RoutineDayMeta {
  id: string;
  order: number;
  weekday: number | null;
  label: string;
  kind: "training" | "rest" | "mobility" | "empty";
}

export interface RoutineMeta {
  v: 1;
  text: string;
  mode: "single" | "weekly";
  days: RoutineDayMeta[];
}

export function validateRoutineMeta(value: unknown): value is RoutineMeta {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return false;
  if (typeof v.text !== "string") return false;
  if (v.mode !== "single" && v.mode !== "weekly") return false;
  if (!Array.isArray(v.days)) return false;
  const ids = new Set<string>();
  const orders = new Set<number>();
  const weekdays = new Set<number>();
  for (const d of v.days) {
    if (!d || typeof d !== "object") return false;
    const day = d as Record<string, unknown>;
    if (typeof day.id !== "string") return false;
    if (typeof day.order !== "number" || !Number.isInteger(day.order) || day.order < 0) return false;
    if (day.weekday !== null && (typeof day.weekday !== "number" || !Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6)) return false;
    if (typeof day.label !== "string") return false;
    if (day.kind !== "training" && day.kind !== "rest" && day.kind !== "mobility" && day.kind !== "empty") return false;
    if (ids.has(day.id)) return false;
    if (orders.has(day.order)) return false;
    if (day.weekday !== null && weekdays.has(day.weekday)) return false;
    ids.add(day.id);
    orders.add(day.order);
    if (day.weekday !== null) weekdays.add(day.weekday);
  }
  return true;
}

export function parseRoutineMeta(raw: string): { text: string; meta: RoutineMeta | null } {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { text: "", meta: null };
  if (!trimmed.startsWith("{")) return { text: raw, meta: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (!validateRoutineMeta(parsed)) return { text: raw, meta: null };
    return { text: parsed.text, meta: parsed };
  } catch {
    return { text: raw, meta: null };
  }
}

export function buildRoutineDescription(text: string, meta: RoutineMeta | null): string {
  if (!meta) return text;
  const payload: RoutineMeta = { ...meta, text };
  const json = JSON.stringify(payload);
  if (json.length > 4096) throw new Error("routine_meta_too_large");
  return json;
}
