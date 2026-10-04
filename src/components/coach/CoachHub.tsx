/**
 * CoachHub.tsx — the Coach module's home screen.
 *
 * Presentation only. Every value it renders arrives from `useCoachContext` or
 * `useCoachNotes`, and the context it shows is derived rather than stored, so
 * nothing here has to decide what is true -- only how to say it.
 *
 * The organising rule is that a missing input is stated, never filled in. A blank
 * bodyweight shows as "no weight registered" and a user with no sessions sees a
 * `dataGaps` list explaining which number is missing and what would fill it. The
 * alternative -- showing a zero, or a dash, or a "not enough data yet" without
 * saying which -- is how a training app ends up quietly lying about a body.
 */

import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Award, NotebookPen, Sparkles, Trash2 } from "lucide-react";
import { ACCENT, MOTION, RADIUS, SCRIM, SPACE, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { COACH_LABELS as T, UNRANKED_REASONS } from "@/lib/i18n";
import type { CoachContext, CoachNote } from "@/lib/coach/types";
import { useCoachContext, useCoachNotes } from "@/hooks/useCoach";
import { useGymSettings } from "@/context/GymSettingsContext";
import { CoachChat } from "./CoachChat";
import { RANGES_PATH } from "@/components/shell/navItems";

export interface CoachHubProps {
  userId: string;
}

export function CoachHub({ userId }: CoachHubProps) {
  const { context, loading, error } = useCoachContext(userId);
  const notes = useCoachNotes(userId);
  /*
   * The chat needs the rack, not just the training log: the coach is told which
   * plates exist so a proposed load is one the athlete can actually put on the bar.
   * Read here rather than passed down, because it comes from a provider that wraps
   * the app and threading it through the hub would only add a prop it never uses.
   */
  const gym = useGymSettings();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2
          className="flex items-center gap-2"
          style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          <Sparkles size={22} aria-hidden="true" color={ACCENT.base} />
          {T.title}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {T.subtitle}
        </p>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.border}`,
            backgroundColor: ACCENT.muted,
            padding: "10px 14px",
            fontSize: TYPE.subhead.size,
            color: TEXT.primary,
          }}
        >
          {T.errorTitle}: {error}
        </div>
      )}

      {loading || !context ? (
        <ContextSkeleton />
      ) : (
        <>
          <ContextSection context={context} />
          <RanksSection context={context} />
          {/*
            Inside the loaded branch on purpose: the chat projects this exact context
            into what the model is told, so rendering it against a skeleton would mean
            asking a coach about a briefing that does not exist yet.
          */}
          <CoachChat context={context} gymSettings={gym} />
        </>
      )}

      <RecommendationsSection
        recommendations={notes.recommendations}
        onDismiss={(id) => void notes.dismissRecommendation(id)}
      />

      <NotesSection
        notes={notes.notes}
        loading={notes.loading}
        saving={notes.saving}
        onAdd={notes.addNote}
        onRemove={(id) => void notes.removeNote(id)}
      />
    </div>
  );
}

// ------------------------------------------------------------ context

function ContextSkeleton() {
  return (
    <GlassCard>
      <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}>{T.contextTitle}</h3>
      <p
        role="status"
        style={{ margin: "6px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}
      >
        {T.loading}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, marginTop: SPACE.md }}>
        <Skeleton width="55%" />
        <Skeleton width="40%" />
        <Skeleton width="70%" />
      </div>
    </GlassCard>
  );
}

function ContextSection({ context }: { context: CoachContext }) {
  return (
    <GlassCard>
      <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}>{T.contextTitle}</h3>
      <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
        {T.contextSubtitle}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: SPACE.md,
          marginTop: SPACE.md,
        }}
      >
        {context.profile && (
          <Fact label={T.goal} value={GOAL_LABELS[context.profile.goal] ?? context.profile.goal} />
        )}
        {context.profile && (
          <Fact
            label={T.experience}
            value={EXPERIENCE_LABELS[context.profile.experienceLevel] ?? context.profile.experienceLevel}
          />
        )}
        <Fact
          label={T.bodyweight}
          value={
            context.bodyweight.latestKg === null
              ? T.noBodyweight
              : `${context.bodyweight.latestKg} kg`
          }
          hint={
            context.bodyweight.changeLast30Days === null
              ? undefined
              : T.bodyweightChange(context.bodyweight.changeLast30Days)
          }
        />
      </div>

      <h4 style={{ margin: `${SPACE.lg}px 0 0`, fontSize: TYPE.subhead.size, fontWeight: 600 }}>
        {T.volumeTitle}
      </h4>
      {context.volume.totalWorkouts === 0 ? (
        <p style={{ margin: "6px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{T.noWorkouts}</p>
      ) : (
        <p style={{ margin: "6px 0 0", fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
          {T.workouts(context.volume.totalWorkouts)} · {T.thisMonth(context.volume.workoutsThisMonth)} ·{" "}
          {T.monthlyVolume(context.volume.monthlyVolume)}
        </p>
      )}

      {context.energy && (
        <>
          <h4 style={{ margin: `${SPACE.lg}px 0 0`, fontSize: TYPE.subhead.size, fontWeight: 600 }}>
            {T.nutritionTitle}
          </h4>
          <p style={{ margin: "6px 0 0", fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
            {T.calories(context.energy.targetKcal)}
            {context.energy.proteinGrams !== null &&
              ` · ${T.protein(context.energy.proteinGrams)}`}
          </p>
        </>
      )}

      {context.dataGaps.length > 0 && <DataGaps gaps={context.dataGaps} />}
    </GlassCard>
  );
}

/**
 * What the context could not assemble.
 *
 * Rendered inside the context card rather than as a separate banner, because a gap
 * is a footnote on the briefing, not an error: the briefing is still correct about
 * everything it does know.
 */
function DataGaps({ gaps }: { gaps: CoachContext["dataGaps"] }) {
  return (
    <div
      style={{
        marginTop: SPACE.lg,
        paddingTop: SPACE.md,
        borderTop: `1px solid ${TEXT.tertiary}22`,
      }}
    >
      <h4 style={{ margin: 0, fontSize: TYPE.caption.size, fontWeight: 600, color: TEXT.secondary }}>
        {T.gapsTitle}
      </h4>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
        {gaps.map((gap) => (
          <li key={gap} style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary, lineHeight: 1.5 }}>
            {T.gaps[gap] ?? gap}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: TYPE.label.size,
          textTransform: "uppercase",
          letterSpacing: TYPE.label.tracking,
          color: TEXT.tertiary,
        }}
      >
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: TYPE.body.size, fontWeight: 600 }}>{value}</p>
      {hint && (
        <p style={{ margin: "2px 0 0", fontSize: TYPE.label.size, color: TEXT.tertiary }}>{hint}</p>
      )}
    </div>
  );
}

// -------------------------------------------------------------- ranks

function RanksSection({ context }: { context: CoachContext }) {
  const classified = context.muscles.filter((m) => m.classified);
  const pending = context.muscles.filter((m) => !m.classified);

  return (
    <GlassCard>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: SPACE.md,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}>{T.ranksTitle}</h3>
          <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
            {T.ranksSubtitle}
          </p>
        </div>
        <Link
          to={RANGES_PATH}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: MOTION.minTouchTarget,
            fontSize: TYPE.caption.size,
            fontWeight: 600,
            color: ACCENT.text,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <Award size={15} aria-hidden="true" />
          {T.openRanks}
        </Link>
      </div>

      {classified.length === 0 ? (
        <p style={{ margin: `${SPACE.md}px 0 0`, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {T.noClassifiedMuscles}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: `${SPACE.md}px 0 0`,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: SPACE.sm,
          }}
        >
          {classified.map((muscle) => (
            <li key={muscle.slug}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${TEXT.tertiary}33`,
                  backgroundColor: `${ACCENT.base}14`,
                  padding: "4px 10px",
                  fontSize: TYPE.caption.size,
                }}
              >
                <span style={{ color: TEXT.primary }}>{muscle.label}</span>
                <span style={{ color: TEXT.tertiary }}>{muscle.rankLabel}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <p style={{ margin: `${SPACE.md}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          {T.unrankedMuscles(pending.length)}
          {/*
            The reason is named once, from the first pending muscle, rather than a
            label per muscle: the reasons repeat across the anatomy and a wall of
            identical badges would bury the count.
          */}
          {pending[0].unrankedReason && (
            <> · {UNRANKED_REASONS[pending[0].unrankedReason] ?? pending[0].unrankedReason}</>
          )}
        </p>
      )}
    </GlassCard>
  );
}

// --------------------------------------------------------------- notes

function NotesSection({
  notes,
  loading,
  saving,
  onAdd,
  onRemove,
}: {
  notes: CoachNote[];
  loading: boolean;
  saving: boolean;
  onAdd: (draft: { author: "coach" | "user"; body: string; muscleSlug: null }) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const fieldId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Cleared on the promise, not on the click: an empty submit is rejected by the
    // hook, and clearing eagerly would wipe the text of a note that was not saved.
    void onAdd({ author: "user", body: draft, muscleSlug: null }).then((ok) => {
      if (ok) setDraft("");
    });
  };

  return (
    <GlassCard>
      <h3
        className="flex items-center gap-2"
        style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}
      >
        <NotebookPen size={16} aria-hidden="true" />
        {T.notesTitle}
      </h3>
      <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
        {T.notesSubtitle}
      </p>

      <form onSubmit={submit} style={{ marginTop: SPACE.md }}>
        <label
          htmlFor={fieldId}
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: TYPE.label.size,
            textTransform: "uppercase",
            letterSpacing: TYPE.label.tracking,
            color: TEXT.tertiary,
          }}
        >
          {T.notesPlaceholder}
        </label>
        <textarea
          id={fieldId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder={T.notesPlaceholder}
          style={{
            width: "100%",
            resize: "vertical",
            borderRadius: RADIUS.control,
            border: `1px solid ${TEXT.tertiary}33`,
            backgroundColor: SCRIM.recessed,
            color: TEXT.primary,
            padding: "10px 12px",
            fontSize: TYPE.subhead.size,
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: SPACE.sm }}>
          <GlassButton
            type="submit"
            variant="primary"
            disabled={saving || draft.trim() === ""}
            style={{ opacity: saving || draft.trim() === "" ? 0.5 : 1 }}
          >
            {T.notesSave}
          </GlassButton>
        </div>
      </form>

      {loading ? (
        <Skeleton variant="block" />
      ) : notes.length === 0 ? (
        <p style={{ margin: `${SPACE.md}px 0 0`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          {T.notesEmpty}
        </p>
      ) : (
        <>
          <p style={{ margin: `${SPACE.md}px 0 0`, fontSize: TYPE.label.size, color: TEXT.tertiary }}>
            {T.notesCount(notes.length)}
          </p>
          <ul style={{ listStyle: "none", margin: `${SPACE.sm}px 0 0`, padding: 0, display: "grid", gap: SPACE.sm }}>
            {notes.map((note) => (
              <NoteRow key={note.id} note={note} onRemove={onRemove} />
            ))}
          </ul>
        </>
      )}
    </GlassCard>
  );
}

/**
 * One note, with its author stated.
 *
 * The `author` label is rendered even though every note in this build is the
 * user's. That is the point: the Step 2 assistant writes into the same list, and a
 * reader has to be able to tell the model's words from their own. A log that only
 * started labelling provenance once the AI arrived would have no way to introduce it.
 */
function NoteRow({ note, onRemove }: { note: CoachNote; onRemove: (id: string) => void }) {
  const day = note.createdAt.slice(0, 10);
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: SPACE.sm,
        borderRadius: RADIUS.control,
        border: `1px solid ${TEXT.tertiary}22`,
        padding: "10px 12px",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: TYPE.label.size,
            textTransform: "uppercase",
            letterSpacing: TYPE.label.tracking,
            color: note.author === "coach" ? ACCENT.text : TEXT.tertiary,
          }}
        >
          {note.author === "coach" ? T.notesAuthorCoach : T.notesAuthorUser} · {day}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: TYPE.subhead.size, whiteSpace: "pre-wrap" }}>{note.body}</p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(note.id)}
        aria-label={T.notesDelete(day)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: MOTION.minTouchTarget,
          height: MOTION.minTouchTarget,
          flexShrink: 0,
          borderRadius: RADIUS.control,
          border: "1px solid transparent",
          backgroundColor: "transparent",
          color: TEXT.tertiary,
          cursor: "pointer",
        }}
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

// ------------------------------------------------------- recommendations

function RecommendationsSection({
  recommendations,
  onDismiss,
}: {
  recommendations: ReturnType<typeof useCoachNotes>["recommendations"];
  onDismiss: (id: string) => void;
}) {
  return (
    <GlassCard>
      <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}>{T.recommendationsTitle}</h3>
      <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
        {T.recommendationsSubtitle}
      </p>

      {recommendations.length === 0 ? (
        <p style={{ margin: `${SPACE.md}px 0 0`, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {T.recommendationsEmpty}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: `${SPACE.md}px 0 0`, padding: 0, display: "grid", gap: SPACE.sm }}>
          {recommendations.map((recommendation) => (
            <RecommendationRow
              key={recommendation.id}
              recommendation={recommendation}
              onDismiss={onDismiss}
            />
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

/**
 * One recommendation, labelled by its `kind`.
 *
 * The heading is derived from the discriminant rather than stored on the row, so an
 * `exercise_swap` cannot be filed under a training adjustment by a bad insert. The
 * two kinds read very differently to an athlete -- "swap this movement" is a
 * different kind of instruction from "train less" -- so they are not interchangeable
 * rows in a generic list.
 */
function RecommendationRow({
  recommendation,
  onDismiss,
}: {
  recommendation: ReturnType<typeof useCoachNotes>["recommendations"][number];
  onDismiss: (id: string) => void;
}) {
  const heading =
    recommendation.kind === "exercise_swap"
      ? recommendation.exerciseName
      : T.recommendationAreas[recommendation.area] ?? recommendation.area;

  /*
   * The advice itself, then the reason underneath. For an adjustment those differ --
   * `change` is what to do and `reason` is why -- but for a swap they are the same
   * text, so the reason row is suppressed rather than printed twice.
   */
  const body = recommendation.kind === "training_adjustment" ? recommendation.change : null;

  return (
    <li
      style={{
        borderRadius: RADIUS.control,
        border: `1px solid ${ACCENT.border}`,
        backgroundColor: `${ACCENT.base}0f`,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: SPACE.sm,
        }}
      >
        <strong style={{ fontSize: TYPE.subhead.size }}>{heading}</strong>
        <button
          type="button"
          onClick={() => onDismiss(recommendation.id)}
          style={{
            flexShrink: 0,
            minHeight: MOTION.minTouchTarget,
            padding: "0 10px",
            borderRadius: RADIUS.control,
            border: `1px solid ${TEXT.tertiary}33`,
            backgroundColor: "transparent",
            color: TEXT.tertiary,
            fontSize: TYPE.label.size,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {T.recommendationDismiss}
        </button>
      </div>
      {body && (
        <p style={{ margin: "4px 0 0", fontSize: TYPE.subhead.size, color: TEXT.secondary }}>{body}</p>
      )}
      <p style={{ margin: "4px 0 0", fontSize: TYPE.label.size, color: TEXT.tertiary }}>
        {recommendation.reason}
      </p>
    </li>
  );
}

// ---------------------------------------------------------------- enums

/** Spanish names for the profile enums, which the database stores in English. */
const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Perder peso",
  maintain: "Mantener",
  gain_muscle: "Ganar músculo",
  strength: "Fuerza",
  endurance: "Resistencia",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

/** Exported for the test that asserts every enum value has a Spanish label. */
export const COACH_ENUM_LABELS = { goal: GOAL_LABELS, experience: EXPERIENCE_LABELS } as const;
