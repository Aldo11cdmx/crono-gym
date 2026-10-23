import { describe, expect, it } from "vitest";
import {
  SET_KINDS,
  countsAsWorkingSet,
  isSetKind,
  normalizeSetEntry,
  toWarmupColumn,
} from "./setKind";
import type { SetEntry } from "./types";

/** A set as it would exist before the kind chips shipped. */
const LEGACY_NORMAL = {
  set_number: 1,
  weight: "80",
  reps: "8",
  rpe: "8",
  is_warmup: false,
  completed: false,
};

const LEGACY_WARMUP = { ...LEGACY_NORMAL, is_warmup: true };

describe("SET_KINDS", () => {
  it("offers the four kinds the logger supports", () => {
    expect(SET_KINDS).toEqual(["normal", "warmup", "failure", "drop"]);
  });

  it("names them uniquely", () => {
    expect(new Set(SET_KINDS).size).toBe(SET_KINDS.length);
  });
});

describe("isSetKind", () => {
  it.each(SET_KINDS)("accepts %s", (kind) => {
    expect(isSetKind(kind)).toBe(true);
  });

  it.each(["drop_set", "DROP", "", null, undefined, 3, {}])(
    "rejects %s",
    (value) => {
      expect(isSetKind(value)).toBe(false);
    },
  );
});

describe("countsAsWorkingSet", () => {
  it("excludes only warm-ups", () => {
    expect(countsAsWorkingSet("normal")).toBe(true);
    // A failure set and a drop set are performed on purpose and their load is
    // real; counting them as volume is why people track them at all.
    expect(countsAsWorkingSet("failure")).toBe(true);
    expect(countsAsWorkingSet("drop")).toBe(true);
    expect(countsAsWorkingSet("warmup")).toBe(false);
  });

  it("covers every kind, so a new one cannot slip through unclassified", () => {
    for (const kind of SET_KINDS) {
      expect(typeof countsAsWorkingSet(kind), kind).toBe("boolean");
    }
  });
});

describe("toWarmupColumn", () => {
  it("maps only warm-ups onto the boolean column", () => {
    expect(SET_KINDS.map(toWarmupColumn)).toEqual([false, true, false, false]);
  });

  it("keeps the sync payload shape unchanged", () => {
    // The database column has been a boolean since before drop sets existed, and
    // this is where the richer kind stops.
    for (const kind of SET_KINDS) {
      expect(typeof toWarmupColumn(kind), kind).toBe("boolean");
    }
  });
});

describe("normalizeSetEntry", () => {
  it("reads a legacy set with is_warmup false as a working set", () => {
    expect(normalizeSetEntry(LEGACY_NORMAL, 0)).toEqual({
      set_number: 1,
      weight: "80",
      reps: "8",
      rpe: "8",
      kind: "normal",
      completed: false,
    });
  });

  it("reads a legacy warm-up as the warmup kind", () => {
    // This is the whole reason the function exists: a draft written before the
    // chips shipped has no `kind` at all.
    expect(normalizeSetEntry(LEGACY_WARMUP, 0).kind).toBe("warmup");
    expect(normalizeSetEntry(LEGACY_WARMUP, 0)).not.toHaveProperty("is_warmup");
  });

  it("prefers an explicit kind over the legacy flag", () => {
    // A set can only be one of them; `kind` is the newer truth.
    expect(normalizeSetEntry({ ...LEGACY_WARMUP, kind: "drop" }, 0).kind).toBe("drop");
  });

  it("falls back to normal when both are absent", () => {
    expect(normalizeSetEntry({ weight: "60" }, 0).kind).toBe("normal");
  });

  it("rejects an unknown kind rather than trusting it", () => {
    expect(normalizeSetEntry({ ...LEGACY_NORMAL, kind: "superset" }, 0).kind).toBe("normal");
  });

  it("numbers a set from its position when set_number is missing", () => {
    expect(normalizeSetEntry({ weight: "60" }, 4).set_number).toBe(5);
  });

  it("keeps a valid set_number rather than renumbering", () => {
    expect(normalizeSetEntry({ ...LEGACY_NORMAL, set_number: 7 }, 0).set_number).toBe(7);
  });

  it("drops a non-string weight instead of logging a number", () => {
    // The field is a string because it is live edit state; a number in it would
    // break the controlled input.
    const entry = normalizeSetEntry({ ...LEGACY_NORMAL, weight: 80 }, 0);
    expect(entry.weight).toBe("");
  });

  it("survives a completely malformed entry", () => {
    for (const raw of [null, undefined, "a string", 42, []]) {
      const entry = normalizeSetEntry(raw, 2);
      expect(entry).toEqual({
        set_number: 3,
        weight: "",
        reps: "",
        rpe: "",
        kind: "normal",
        completed: false,
      });
    }
  });

  it("does not treat a truthy non-boolean as completed", () => {
    expect(normalizeSetEntry({ ...LEGACY_NORMAL, completed: "yes" }, 0).completed).toBe(false);
    expect(normalizeSetEntry({ ...LEGACY_NORMAL, completed: true }, 0).completed).toBe(true);
  });

  it("keeps the note attached to the set it was written on", () => {
    // The note is prose about one attempt at one weight -- "la rodilla
    // protestó" -- and there is no other place for it to live. Dropping it
    // here meant a draft came back without the note the athlete had written.
    expect(normalizeSetEntry({ ...LEGACY_NORMAL, notes: "la rodilla protestó" }, 0).notes).toBe(
      "la rodilla protestó",
    );
  });

  it("leaves a set with no note as it was", () => {
    // `undefined` rather than `null`: the two mean the same thing to the
    // reader, and this keeps the shape of a set that never had a note
    // identical to the shape it had before the field existed.
    expect(normalizeSetEntry(LEGACY_NORMAL, 0).notes).toBeUndefined();
  });

  it("drops a note that is not prose", () => {
    expect(normalizeSetEntry({ ...LEGACY_NORMAL, notes: 42 }, 0).notes).toBeUndefined();
  });
});

describe("the SetEntry contract", () => {
  it("carries a kind and no separate warm-up flag", () => {
    // Two sources of truth would admit a row that is both a warm-up and a drop
    // set, and nothing would catch it.
    const entry: SetEntry = {
      set_number: 1,
      weight: "100",
      reps: "5",
      rpe: "9",
      kind: "drop",
      completed: true,
    };
    expect(entry).not.toHaveProperty("is_warmup");
    expect(toWarmupColumn(entry.kind)).toBe(false);
  });
});
