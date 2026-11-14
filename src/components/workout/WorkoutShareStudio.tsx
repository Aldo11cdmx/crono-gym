/**
 * WorkoutShareStudio.tsx — the share step of the post-workout summary.
 *
 * One canvas, four compositions. The preview and the exported PNG come from the
 * same `drawShareCard` call, so the athlete never shares a different card than
 * the one that was on screen. Export goes through `canvas.toBlob`, which is the
 * only path that needs no new dependency.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  TEXT,
  TYPE,
} from "../../design/tokens";
import {
  SHARE_BACKGROUNDS,
  SHARE_CARDS,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  drawShareCard,
  type ShareBackgroundId,
  type ShareCardId,
  type ShareCardInput,
} from "../../lib/workout/shareCard";
import { SHARE_STUDIO_LABELS } from "../../lib/i18n";

export interface WorkoutShareStudioProps {
  input: ShareCardInput;
  /** Leaves the summary for good and returns to the home screen. */
  onDone: () => void;
}

type CopyState = "idle" | "copied" | "error";

export function WorkoutShareStudio({ input, onDone }: WorkoutShareStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cardId, setCardId] = useState<ShareCardId>("minimal");
  const [background, setBackground] = useState<ShareBackgroundId>("obsidian");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [saved, setSaved] = useState(false);

  const activeCard = useMemo(
    () => SHARE_CARDS.find((card) => card.id === cardId) ?? SHARE_CARDS[0],
    [cardId],
  );

  // Repaints on every change of card, background or session numbers. The canvas
  // keeps a fixed pixel size so the export is always 1080x1350.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    drawShareCard(context, cardId, background, input);
  }, [cardId, background, input]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const toBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          resolve(null);
          return;
        }
        canvas.toBlob((blob) => resolve(blob), "image/png");
      }),
    [],
  );

  const handleCopy = useCallback(async () => {
    const blob = await toBlob();
    if (!blob) {
      setCopyState("error");
      return;
    }
    try {
      // Safari and Firefox only accept a PNG in the clipboard when the write
      // happens straight from the blob; a data URL is silently dropped.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }, [toBlob]);

  const handleSave = useCallback(async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cronos-${cardId}-${Date.now()}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }, [toBlob, cardId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, padding: SPACE.md }}>
      <div
        role="tablist"
        aria-label={SHARE_STUDIO_LABELS.cardsAriaLabel}
        style={{ display: "flex", gap: SPACE.xs, overflowX: "auto", paddingBottom: SPACE.xs }}
      >
        {SHARE_CARDS.map((card, index) => {
          const selected = card.id === cardId;
          return (
            <button
              key={card.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setCardId(card.id)}
              style={{
                flex: "0 0 auto",
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.md}px`,
                borderRadius: RADIUS.pill,
                border: `1px solid ${selected ? ACCENT.base : GLASS.border}`,
                background: selected ? ACCENT.subtle : "transparent",
                color: selected ? TEXT.primary : TEXT.secondary,
                fontSize: TYPE.caption.size,
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {index + 1}: {card.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          borderRadius: RADIUS.card,
          overflow: "hidden",
          border: `1px solid ${GLASS.border}`,
          background: "#000",
        }}
      >
        <canvas
          ref={canvasRef}
          width={SHARE_CARD_WIDTH}
          height={SHARE_CARD_HEIGHT}
          role="img"
          aria-label={`${activeCard.label} · ${SHARE_STUDIO_LABELS.canvasAriaLabel}`}
          style={{ width: "100%", maxWidth: 320, height: "auto", display: "block" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
        <span
          style={{
            fontSize: TYPE.caption.size,
            fontWeight: TYPE.caption.weight,
            letterSpacing: TYPE.caption.tracking,
            textTransform: "uppercase",
            color: TEXT.secondary,
          }}
        >
          {SHARE_STUDIO_LABELS.background}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
          {SHARE_BACKGROUNDS.map((option) => {
            const selected = option.id === background;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setBackground(option.id)}
                style={{
                  minHeight: MOTION.minTouchTarget,
                  padding: `0 ${SPACE.md}px`,
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${selected ? ACCENT.base : GLASS.border}`,
                  background: selected ? ACCENT.subtle : "transparent",
                  color: selected ? TEXT.primary : TEXT.secondary,
                  fontSize: TYPE.caption.size,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: SPACE.sm }}>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: GLASS.fill,
            color: TEXT.primary,
            fontSize: TYPE.subhead.size,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.xs,
            cursor: "pointer",
          }}
        >
          {copyState === "copied" ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {copyState === "copied"
            ? SHARE_STUDIO_LABELS.copied
            : copyState === "error"
              ? SHARE_STUDIO_LABELS.copyFailed
              : SHARE_STUDIO_LABELS.copy}
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: GLASS.fill,
            color: TEXT.primary,
            fontSize: TYPE.subhead.size,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.xs,
            cursor: "pointer",
          }}
        >
          <Download size={18} aria-hidden="true" />
          {saved ? SHARE_STUDIO_LABELS.saved : SHARE_STUDIO_LABELS.savePng}
        </button>
      </div>

      <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary, textAlign: "center" }}>
        {SHARE_STUDIO_LABELS.hint}
      </p>

      <button
        type="button"
        onClick={onDone}
        style={{
          width: "100%",
          minHeight: 56,
          borderRadius: RADIUS.button,
          border: "none",
          background: ACCENT.base,
          color: TEXT.onAccent,
          fontSize: TYPE.headline.size,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {SHARE_STUDIO_LABELS.done}
      </button>
    </div>
  );
}