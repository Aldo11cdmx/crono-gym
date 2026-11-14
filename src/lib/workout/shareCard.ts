/**
 * shareCard.ts — the four exportable cards of the post-workout summary.
 *
 * Everything here is drawn into a plain 2D canvas, with no DOM library and no
 * new dependency: the same function paints the on-screen preview and the PNG
 * the athlete keeps, so what is shared is exactly what was seen. Sizes are
 * expressed in "design pixels" on a 1080x1350 board and scaled to the context,
 * which is why the code below never touches the viewport.
 *
 * The renderer is pure (context in, pixels out). The model that feeds it is
 * built by `buildShareCardInput` from the finished session, so this module can
 * be tested without a browser.
 */

import { ACCENT, SURFACE, TEXT } from "../../design/tokens";

/** The board every card is composed on, in design pixels (4:5, a phone story). */
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

export type ShareCardId = "minimal" | "metrics-map" | "bento" | "hero-map";
export type ShareBackgroundId = "obsidian" | "crimson" | "editorial" | "glass";

export interface ShareExerciseLine {
  name: string;
  sets: number;
  bestWeightKg: number;
  bestReps: number;
}

export interface ShareMuscleSlice {
  label: string;
  sets: number;
  region: "anterior" | "posterior";
}

export interface ShareCardInput {
  routineTitle: string;
  dateLabel: string;
  durationLabel: string;
  volumeKg: number;
  totalSets: number;
  exerciseCount: number;
  exercises: readonly ShareExerciseLine[];
  muscles: readonly ShareMuscleSlice[];
}

export const SHARE_CARDS: readonly { id: ShareCardId; label: string }[] = [
  { id: "minimal", label: "Minimal centrada" },
  { id: "metrics-map", label: "Métricas + Mapa Dual" },
  { id: "bento", label: "Bento 2×2" },
  { id: "hero-map", label: "Mapa Hero + Volumen" },
];

export const SHARE_BACKGROUNDS: readonly { id: ShareBackgroundId; label: string }[] = [
  { id: "obsidian", label: "Obsidiana" },
  { id: "crimson", label: "Carmesí" },
  { id: "editorial", label: "Editorial" },
  { id: "glass", label: "Cristal" },
];

interface Paint {
  top: string;
  bottom: string;
  glow: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  accent: string;
  tile: string;
  tileBorder: string;
}

function paint(background: ShareBackgroundId): Paint {
  switch (background) {
    case "crimson":
      return {
        top: "#2a0b0c",
        bottom: SURFACE.base,
        glow: "rgba(255, 59, 48, 0.28)",
        ink: TEXT.primary,
        inkSoft: TEXT.secondary,
        inkFaint: TEXT.tertiary,
        accent: ACCENT.text,
        tile: "rgba(255, 255, 255, 0.06)",
        tileBorder: "rgba(255, 255, 255, 0.14)",
      };
    case "editorial":
      return {
        top: "#101014",
        bottom: "#000000",
        glow: "rgba(255, 255, 255, 0.10)",
        ink: TEXT.primary,
        inkSoft: TEXT.secondary,
        inkFaint: TEXT.tertiary,
        accent: ACCENT.text,
        tile: "rgba(255, 255, 255, 0.04)",
        tileBorder: "rgba(255, 255, 255, 0.10)",
      };
    case "glass":
      return {
        top: SURFACE.l1,
        bottom: SURFACE.base,
        glow: "rgba(255, 255, 255, 0.16)",
        ink: TEXT.primary,
        inkSoft: TEXT.secondary,
        inkFaint: TEXT.tertiary,
        accent: ACCENT.text,
        tile: "rgba(255, 255, 255, 0.09)",
        tileBorder: "rgba(255, 255, 255, 0.18)",
      };
    case "obsidian":
    default:
      return {
        top: "#0b0b0e",
        bottom: SURFACE.base,
        glow: "rgba(255, 59, 48, 0.14)",
        ink: TEXT.primary,
        inkSoft: TEXT.secondary,
        inkFaint: TEXT.tertiary,
        accent: ACCENT.text,
        tile: "rgba(255, 255, 255, 0.05)",
        tileBorder: "rgba(255, 255, 255, 0.10)",
      };
  }
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface TextOptions {
  size: number;
  weight?: number;
  color: string;
  align?: CanvasTextAlign;
  /** Shown after the value, smaller: units, captions, secondary labels. */
  maxWidth?: number;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  options: TextOptions,
) {
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${options.weight ?? 600} ${options.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(value, x, y, options.maxWidth);
}

function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string) {
  ctx.save();
  text(ctx, value.toUpperCase(), x, y, { size: 26, weight: 700, color });
  ctx.restore();
}

function backdrop(ctx: CanvasRenderingContext2D, p: Paint) {
  const gradient = ctx.createLinearGradient(0, 0, 0, SHARE_CARD_HEIGHT);
  gradient.addColorStop(0, p.top);
  gradient.addColorStop(1, p.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  const glow = ctx.createRadialGradient(
    SHARE_CARD_WIDTH / 2,
    -120,
    0,
    SHARE_CARD_WIDTH / 2,
    -120,
    SHARE_CARD_WIDTH * 0.9,
  );
  glow.addColorStop(0, p.glow);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT * 0.6);
}

function footer(ctx: CanvasRenderingContext2D, input: ShareCardInput, p: Paint) {
  const y = SHARE_CARD_HEIGHT - 84;
  ctx.strokeStyle = p.tileBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(88, y - 56);
  ctx.lineTo(SHARE_CARD_WIDTH - 88, y - 56);
  ctx.stroke();

  text(ctx, input.routineTitle, 88, y, {
    size: 30,
    weight: 600,
    color: p.inkSoft,
    maxWidth: 620,
  });
  text(ctx, input.dateLabel, SHARE_CARD_WIDTH - 88, y, {
    size: 30,
    weight: 600,
    color: p.inkFaint,
    align: "right",
  });
}

function muscleBars(
  ctx: CanvasRenderingContext2D,
  input: ShareCardInput,
  p: Paint,
  x: number,
  y: number,
  width: number,
  maxSets: number,
) {
  const rowHeight = 54;
  const slices = [...input.muscles].sort((a, b) => b.sets - a.sets).slice(0, 7);
  if (slices.length === 0) return y;

  slices.forEach((slice, index) => {
    const top = y + index * rowHeight;
    text(ctx, slice.label, x, top + 26, { size: 28, weight: 600, color: p.inkSoft, maxWidth: 260 });
    const barX = x + 280;
    const barMax = width - 280 - 90;
    const filled = maxSets > 0 ? Math.max(6, (slice.sets / maxSets) * barMax) : 6;
    ctx.fillStyle = p.tile;
    rounded(ctx, barX, top + 6, barMax, 20, 10);
    ctx.fill();
    ctx.fillStyle = slice.region === "posterior" ? p.accent : p.ink;
    rounded(ctx, barX, top + 6, filled, 20, 10);
    ctx.fill();
    text(ctx, String(slice.sets), x + width, top + 26, {
      size: 28,
      weight: 700,
      color: p.ink,
      align: "right",
    });
  });

  return y + slices.length * rowHeight;
}

function metric(
  ctx: CanvasRenderingContext2D,
  p: Paint,
  x: number,
  y: number,
  width: number,
  caption: string,
  value: string,
) {
  ctx.fillStyle = p.tile;
  rounded(ctx, x, y, width, 190, 28);
  ctx.fill();
  ctx.strokeStyle = p.tileBorder;
  ctx.lineWidth = 2;
  rounded(ctx, x, y, width, 190, 28);
  ctx.stroke();

  label(ctx, caption, x + 34, y + 56, p.inkFaint);
  text(ctx, value, x + 34, y + 136, { size: 68, weight: 800, color: p.ink });
}

function drawMinimal(ctx: CanvasRenderingContext2D, input: ShareCardInput, p: Paint) {
  const centerX = SHARE_CARD_WIDTH / 2;
  label(ctx, "Cronos · Entreno", centerX, 250, p.accent);
  ctx.textAlign = "center";

  text(ctx, input.routineTitle, centerX, 420, {
    size: 84,
    weight: 800,
    color: p.ink,
    align: "center",
    maxWidth: SHARE_CARD_WIDTH - 200,
  });

  text(ctx, input.durationLabel, centerX, 700, {
    size: 200,
    weight: 800,
    color: p.ink,
    align: "center",
  });
  label(ctx, "de trabajo", centerX, 760, p.inkFaint);

  text(ctx, `${input.totalSets} series · ${input.exerciseCount} ejercicios`, centerX, 900, {
    size: 44,
    weight: 600,
    color: p.inkSoft,
    align: "center",
  });
  footer(ctx, input, p);
}

function drawMetricsMap(ctx: CanvasRenderingContext2D, input: ShareCardInput, p: Paint) {
  label(ctx, "Resumen", 88, 200, p.accent);
  text(ctx, input.routineTitle, 88, 290, {
    size: 66,
    weight: 800,
    color: p.ink,
    maxWidth: SHARE_CARD_WIDTH - 176,
  });

  const gap = 28;
  const tileW = (SHARE_CARD_WIDTH - 176 - gap) / 2;
  metric(ctx, p, 88, 360, tileW, "Volumen", `${Math.round(input.volumeKg)} kg`);
  metric(ctx, p, 88 + tileW + gap, 360, tileW, "Series", String(input.totalSets));
  metric(ctx, p, 88, 360 + 190 + gap, tileW, "Tiempo", input.durationLabel);
  metric(ctx, p, 88 + tileW + gap, 360 + 190 + gap, tileW, "Ejercicios", String(input.exerciseCount));

  const maxSets = input.muscles.reduce((n, m) => Math.max(n, m.sets), 0);
  muscleBars(ctx, input, p, 88, 860, SHARE_CARD_WIDTH - 176, maxSets);
  footer(ctx, input, p);
}

function drawBento(ctx: CanvasRenderingContext2D, input: ShareCardInput, p: Paint) {
  label(ctx, "Bento", 88, 190, p.accent);
  text(ctx, input.routineTitle, 88, 268, {
    size: 56,
    weight: 800,
    color: p.ink,
    maxWidth: SHARE_CARD_WIDTH - 176,
  });

  const gap = 24;
  const tileW = (SHARE_CARD_WIDTH - 176 - gap) / 2;
  const tileH = 300;
  const top = 330;
  metric(ctx, p, 88, top, tileW, "Volumen", `${Math.round(input.volumeKg)} kg`);
  metric(ctx, p, 88 + tileW + gap, top, tileW, "Series", String(input.totalSets));
  metric(ctx, p, 88, top + tileH + gap, tileW, "Tiempo", input.durationLabel);
  metric(ctx, p, 88 + tileW + gap, top + tileH + gap, tileW, "Ejercicios", String(input.exerciseCount));

  const topExercises = input.exercises.slice(0, 4);
  const listTop = top + (tileH + gap) * 2 + 20;
  topExercises.forEach((exercise, index) => {
    const rowY = listTop + index * 62;
    text(ctx, exercise.name, 88, rowY, {
      size: 34,
      weight: 600,
      color: p.inkSoft,
      maxWidth: 600,
    });
    text(ctx, `${Math.round(exercise.bestWeightKg)} kg × ${exercise.bestReps}`, SHARE_CARD_WIDTH - 88, rowY, {
      size: 34,
      weight: 700,
      color: p.ink,
      align: "right",
    });
  });

  footer(ctx, input, p);
}

function drawHeroMap(ctx: CanvasRenderingContext2D, input: ShareCardInput, p: Paint) {
  label(ctx, "Volumen total", 88, 240, p.accent);
  text(ctx, `${Math.round(input.volumeKg)}`, 88, 470, { size: 240, weight: 800, color: p.ink });
  text(ctx, "kg", 88 + ctx.measureText("000").width + 120, 470, {
    size: 72,
    weight: 700,
    color: p.inkFaint,
  });
  text(ctx, `${input.totalSets} series · ${input.exerciseCount} ejercicios`, 88, 540, {
    size: 40,
    weight: 600,
    color: p.inkSoft,
  });

  const maxSets = input.muscles.reduce((n, m) => Math.max(n, m.sets), 0);
  muscleBars(ctx, input, p, 88, 660, SHARE_CARD_WIDTH - 176, maxSets);
  footer(ctx, input, p);
}

const PAINTERS: Record<ShareCardId, (ctx: CanvasRenderingContext2D, input: ShareCardInput, p: Paint) => void> = {
  minimal: drawMinimal,
  "metrics-map": drawMetricsMap,
  bento: drawBento,
  "hero-map": drawHeroMap,
};

/**
 * Paints one card into a context already sized to the board.
 *
 * The context is scaled from design pixels to its own size, so a caller can use
 * 540x675 for a preview or 1080x1350 for the export and get the same layout.
 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  cardId: ShareCardId,
  background: ShareBackgroundId,
  input: ShareCardInput,
) {
  const scale = ctx.canvas.width / SHARE_CARD_WIDTH;
  ctx.save();
  ctx.scale(scale, scale);
  const p = paint(background);
  backdrop(ctx, p);
  PAINTERS[cardId](ctx, input, p);
  ctx.restore();
}

/** `mm:ss` for a duration in seconds, with the unit written out in the card. */
export function shareDurationLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}