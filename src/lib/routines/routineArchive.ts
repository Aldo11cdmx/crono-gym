/**
 * routineArchive.ts — device-local archive flags for routines.
 *
 * Archiving is a UI classification, not a server mutation. A routine that is
 * archived is hidden from the active list but is not deleted from Supabase or
 * IndexedDB. The archive is a Set<string> of routine ids persisted in
 * localStorage under a per-user key, so clearing site data or switching
 * devices resets it -- which is the intended behaviour: an archive is a
 * workspace, not a backup.
 */

const STORAGE_KEY = (userId: string) => `cronos:archive:${userId}`;

/** Reads the full archived-id set as a plain array. Never throws. */
export function getArchivedRoutineIds(userId: string | null | undefined): string[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** True when the routine has been archived on this device. */
export function isRoutineArchived(userId: string | null | undefined, routineId: string): boolean {
  return getArchivedRoutineIds(userId).includes(routineId);
}

/** Adds a routine to the archive. Idempotent. */
export function archiveRoutine(userId: string | null | undefined, routineId: string): void {
  if (!userId) return;
  try {
    const ids = new Set(getArchivedRoutineIds(userId));
    ids.add(routineId);
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify([...ids]));
  } catch {
  }
}

/** Removes a routine from the archive. Idempotent. */
export function unarchiveRoutine(userId: string | null | undefined, routineId: string): void {
  if (!userId) return;
  try {
    const ids = new Set(getArchivedRoutineIds(userId));
    ids.delete(routineId);
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify([...ids]));
  } catch {
  }
}
