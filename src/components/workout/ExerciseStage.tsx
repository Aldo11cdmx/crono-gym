/**
 * ExerciseStage.tsx — one exercise, centred, with its media above it.
 *
 * The change from the old screen is not the styling, it is the *unit of attention*. The
 * logger showed every exercise stacked, so an athlete logging bench press was looking at
 * rows for six other movements they were not doing. Here there is one exercise, centred,
 * with the set table directly under it, and the carousel above is the only way to move on.
 *
 * The media placeholder
 * ---------------------
 * Most of the catalog has no `gif_url`, and the instruction was explicit: a fixed-ratio
 * placeholder rather than a broken layout. Three things matter and all three are about
 * *stability* rather than looks:
 *
 * 1. The aspect ratio is declared on the frame, so the space exists before the image
 *    does. An image arriving into an unreserved space pushes the set table down the
 *    screen, and on this screen the set table is where the athlete is looking.
 * 2. A real `<img>` that fails still reserves its box, because `width`/`height` are set.
 *    A GIF URL in the catalog that 404s is common, and without the reservation the row
 *    it sits in collapses and the numbers below jump.
 * 3. The placeholder is labelled. "GIF" in the corner of an empty box tells a screen
 *    reader nothing and tells a sighted athlete the asset is missing rather than pending.
 *
 * `object-fit: contain` on the frame, because the catalog's demos are inconsistent
 * aspect ratios and `cover` clips anatomy at the top of the frame — an athlete
 * looking up mid-set cannot afford to lose the bar or their hands.
 */

import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { DANGER, DIAGRAM, GLASS, MOTION, RADIUS, SPACE, SURFACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { TARGET_LABELS, BODY_PART_LABELS, EQUIPMENT_LABELS } from "../../lib/i18n";
import type { Exercise } from "@/types/supabase";

export interface ExerciseStageProps {
  exercise: Exercise;
  /** Progress on this exercise, as "2 de 4". */
  progress: string;
  /** What the athlete did last time, or null when the movement is new. */
  lastSession?: string | null;
  /** The action chips row. */
  actions?: ReactNode;
  /**
   * Removes this exercise from the session.
   *
   * Kept as a prop rather than dropped with the old per-section header. Taking an
   * exercise out of a session is a real thing an athlete does -- the plan named a
   * movement they are not doing today -- and losing it would mean the only way to get
   * rid of one is to rebuild the session.
   */
  onRemove?: () => void;
  /** The set table, rendered below the fold of this component. */
  children?: ReactNode;
  /**
   * Optional ghosted navigation arrows, shown when the carousel has been retired
   * in favour of gestural swipe + explicit prev/next buttons over the media.
   */
  navPrev?: () => void;
  navNext?: () => void;
}

export function ExerciseStage({
  exercise,
  progress,
  lastSession,
  actions,
  onRemove,
  children,
  navPrev,
  navNext,
}: ExerciseStageProps) {
  return (
    <section
      aria-label={exercise.name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SPACE.lg,
        position: "relative",
        maxWidth: "560px",
        width: "100%",
        margin: "0 auto",
      }}
    >
      <ExerciseMedia exercise={exercise} />

      {navPrev && (
        <button
          type="button"
          aria-label="Ejercicio anterior"
          title="Ejercicio anterior"
          onClick={navPrev}
          style={{
            position: "absolute",
            left: SPACE.sm,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: Z_INDEX.sticky,
            width: MOTION.minTouchTarget,
            height: MOTION.minTouchTarget,
            borderRadius: RADIUS.round,
            border: `1px solid ${GLASS.borderStrong}`,
            background: "transparent",
            color: TEXT.secondary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: TYPE.caption.size,
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      )}

      {navNext && (
        <button
          type="button"
          aria-label="Ejercicio siguiente"
          title="Ejercicio siguiente"
          onClick={navNext}
          style={{
            position: "absolute",
            right: SPACE.sm,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: Z_INDEX.sticky,
            width: MOTION.minTouchTarget,
            height: MOTION.minTouchTarget,
            borderRadius: RADIUS.round,
            border: `1px solid ${GLASS.borderStrong}`,
            background: "transparent",
            color: TEXT.secondary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: TYPE.caption.size,
            fontWeight: 600,
          }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}

      <header style={{ textAlign: "center", maxWidth: "42ch" }}>
        <h2
          style={{
            margin: 0,
            fontSize: TYPE.title1.size,
            lineHeight: TYPE.title1.lineHeight,
            fontWeight: TYPE.title1.weight,
            letterSpacing: TYPE.title1.tracking,
            color: TEXT.primary,
          }}
        >
          {exercise.name}
        </h2>

        <p
          style={{
            margin: `${SPACE.xs} 0 0`,
            fontSize: TYPE.caption.size,
            lineHeight: TYPE.caption.lineHeight,
            color: TEXT.tertiary,
          }}
        >
          {[
            TARGET_LABELS[exercise.target] ?? exercise.target,
            BODY_PART_LABELS[exercise.body_part] ?? exercise.body_part,
            EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <p
          style={{
            margin: `${SPACE.sm} 0 0`,
            display: "inline-flex",
            alignItems: "center",
            gap: SPACE.sm,
            padding: "2px 10px",
            borderRadius: RADIUS.pill,
            border: `1px solid ${GLASS.border}`,
            background: GLASS.fill,
            fontFamily: TYPE.mono.font,
            fontSize: TYPE.caption.size,
            fontVariantNumeric: "tabular-nums",
            color: TEXT.secondary,
          }}
        >
          {progress}
          {lastSession && (
            <>
              <span aria-hidden="true" style={{ color: TEXT.disabled }}>
                ·
              </span>
              <span>{lastSession}</span>
            </>
          )}
        </p>
      </header>

      {/*
        `Quitar` sits under the chips rather than beside the title: taking an exercise
        out of a session is a correction, not a navigation, and it should not be within
        a thumb's reach of the title the athlete is reading.
      */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            minHeight: MOTION.minTouchTarget,
            padding: "0 8px",
            border: "none",
            background: "transparent",
            color: DANGER.text,
            fontSize: TYPE.caption.size,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Quitar {exercise.name} de la sesión
        </button>
      )}

      {actions}

      {/* The table is the reason the screen exists, so it spans the full width even
          though everything above it is centred. A centred set table would leave the
          inputs marching off both edges on a phone. */}
      <div style={{ width: "100%", maxWidth: "560px" }}>{children}</div>
    </section>
  );
}

/**
 * The exercise's demonstration, or a placeholder shaped like one.
 *
 * The frame owns the ratio and the overflow; the image is told to fill it. That
 * separation is what makes a missing, a slow and a wrong-shaped asset all behave the
 * same way from the layout's point of view.
 */
function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  /*
   * Defensive about a missing `gif_url` rather than trusting the column.
   *
   * `exercises.gif_url` is declared non-nullable in the generated types, but the old
   * carousel already treated it as optional -- truthiness, not `.trim()` -- and rows
   * written before the column existed, or by an import, do reach this screen without
   * one. Reading `.trim()` off undefined would turn a missing demo into a blank screen,
   * which is the exact failure the placeholder exists to prevent.
   */
  const gif = typeof exercise.gif_url === "string" ? exercise.gif_url.trim() : "";
  const hasGif = gif !== "";

  return (
    <div style={mediaFrame}>
      {hasGif ? (
        <img
          src={gif}
          alt={`Demostración de ${exercise.name}`}
          // `eager` rather than `lazy`: this is above the fold and above the set table,
          // and a lazy image that has not loaded when the athlete looks up is a blank
          // frame in the most-watched 300ms of the screen.
          loading="eager"
          decoding="async"
          // The reservation. With these set, a 404 leaves the box standing rather than
          // collapsing the row and shoving the inputs up.
          width={640}
          height={360}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            // The container carries the black backing, so transparent GIF pixels
            // fall through to SURFACE.base with zero flash.
            backgroundColor: "transparent",
            // `invert` turns the GIF's native white background into black so it
            // vanishes against the dark container; `hue-rotate(180)` approximately
            // compensates so the figure's colours do not come through as a negative.
            // `screen` blends the result against the black frame, darkening any
            // remaining mid-tones to integrate with the Apple dark-mode aesthetic.
            filter: "invert(1) hue-rotate(180deg)",
            mixBlendMode: "screen",
          }}
        />
      ) : (
        <MediaPlaceholder name={exercise.name} />
      )}
    </div>
  );
}

/**
 * The placeholder.
 *
 * `DIAGRAM.regionFill` rather than `SURFACE.elevated`, because this is a *figure* and not
 * a panel: it is drawing an illustration, and `regionFill` is the token for the inside of
 * a drawn region. The icon is `DIAGRAM.figureStroke`, one step above the frame, which is
 * what stops the whole thing reading as one flat grey rectangle.
 */
function MediaPlaceholder({ name }: { name: string }) {
  return (
    <div
      // Decorative: the exercise's name is the heading right underneath, so announcing
      // "no demonstration available" here would repeat what the screen already says.
      aria-hidden="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.sm,
        width: "100%",
        height: "100%",
        backgroundColor: DIAGRAM.regionFill,
      }}
    >
      <ImageOff size={28} style={{ color: DIAGRAM.figureStroke }} />
      <span
        style={{
          fontSize: TYPE.caption.size,
          color: TEXT.disabled,
          textAlign: "center",
          padding: `0 ${SPACE.lg}`,
        }}
      >
        Sin demostración para {name}
      </span>
    </div>
  );
}

/**
 * 16:9, the shape every exercise demo in the catalog already is.
 *
 * Fixed rather than intrinsic on purpose -- see the note at the top of the file. `100%`
 * width with `margin: 0 auto` is what centres it while still letting a phone go
 * full-bleed.
 */
const mediaFrame: CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  aspectRatio: "16 / 9",
  borderRadius: RADIUS.card,
  overflow: "hidden",
  border: `1px solid ${GLASS.border}`,
  boxShadow: GLASS.shadow,
  // Black backing so the GIF's white backgrounds are absorbed by mix-blend-mode below.
  backgroundColor: SURFACE.base,
  transition: `opacity ${MOTION.normal} ${MOTION.standard}`,
};
