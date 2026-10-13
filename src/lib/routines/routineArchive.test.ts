/**
 * @vitest-environment jsdom
 *
 * The archive module persists to `localStorage`, which jsdom provides. Tests
 * clear the store between runs so user isolation is not an exercise in guesswork.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  archiveRoutine,
  getArchivedRoutineIds,
  isRoutineArchived,
  unarchiveRoutine,
} from "./routineArchive";

const USER = "user-1";
const OTHER = "user-2";
const R1 = "routine-a";
const R2 = "routine-b";

afterEach(() => {
  localStorage.clear();
});

describe("routineArchive", () => {
  describe("getArchivedRoutineIds", () => {
    it("returns an empty array when nothing has been archived", () => {
      expect(getArchivedRoutineIds(USER)).toEqual([]);
    });

    it("returns an empty array for a null userId", () => {
      expect(getArchivedRoutineIds(null)).toEqual([]);
    });

    it("returns an empty array for an undefined userId", () => {
      expect(getArchivedRoutineIds(undefined)).toEqual([]);
    });

    it("isolated per user", () => {
      archiveRoutine(USER, R1);
      expect(getArchivedRoutineIds(USER)).toEqual([R1]);
      expect(getArchivedRoutineIds(OTHER)).toEqual([]);
    });

    it("survives across calls", () => {
      archiveRoutine(USER, R1);
      archiveRoutine(USER, R2);
      expect(getArchivedRoutineIds(USER).sort()).toEqual([R1, R2]);
    });
  });

  describe("isRoutineArchived", () => {
    it("returns false before archiving", () => {
      expect(isRoutineArchived(USER, R1)).toBe(false);
    });

    it("returns true after archiving", () => {
      archiveRoutine(USER, R1);
      expect(isRoutineArchived(USER, R1)).toBe(true);
    });

    it("returns false for a different routine", () => {
      archiveRoutine(USER, R1);
      expect(isRoutineArchived(USER, R2)).toBe(false);
    });

    it("returns false for a null userId", () => {
      expect(isRoutineArchived(null, R1)).toBe(false);
    });
  });

  describe("archiveRoutine", () => {
    it("is idempotent", () => {
      archiveRoutine(USER, R1);
      archiveRoutine(USER, R1);
      expect(getArchivedRoutineIds(USER)).toEqual([R1]);
    });

    it("does not throw for a null userId", () => {
      expect(() => archiveRoutine(null, R1)).not.toThrow();
    });
  });

  describe("unarchiveRoutine", () => {
    it("removes the routine from the archive", () => {
      archiveRoutine(USER, R1);
      archiveRoutine(USER, R2);
      unarchiveRoutine(USER, R1);
      expect(getArchivedRoutineIds(USER)).toEqual([R2]);
    });

    it("is idempotent", () => {
      expect(() => unarchiveRoutine(USER, R1)).not.toThrow();
      archiveRoutine(USER, R1);
      unarchiveRoutine(USER, R1);
      unarchiveRoutine(USER, R1);
      expect(getArchivedRoutineIds(USER)).toEqual([]);
    });

    it("does not throw for a null userId", () => {
      expect(() => unarchiveRoutine(null, R1)).not.toThrow();
    });
  });
});
