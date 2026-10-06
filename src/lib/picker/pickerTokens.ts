/**
 * pickerTokens.ts — design tokens scoped to the ExercisePicker.
 *
 * Mirrors the structure of `design/tokens.ts` so picker components read from the
 * same vocabulary: a surface, a text tier, a motion. The picker adds its own
 * concerns — chip states, card dimensions, the selection bar float — as named
 * values rather than literals, so the sheet tests can assert layout without
 * reading CSS.
 */

import { ACCENT, DIAGRAM, GLASS, MOTION, RADIUS, SPACE, STATUS, SURFACE, TEXT } from "../../design/tokens";

export { ACCENT, DIAGRAM, GLASS, MOTION, RADIUS, SPACE, STATUS, SURFACE, TEXT };

export const PICKER = {
  /** Min height so an empty state reads as empty, not as a gutter. */
  minHeight: "420px",

  /** Height of the search input. */
  searchHeight: "48px",

  /** Min tap target for a card action, per MOTION.minTouchTarget. */
  actionSize: MOTION.minTouchTarget,

  /** Grid gap. */
  gridGap: SPACE.sm,

  /** Card aspect ratio for the GIF preview. */
  cardMediaRatio: "16/9",
} as const;

export const PICKER_COLOR = {
  /** Card fill — slightly above raised so it reads as a card on the canvas. */
  card: SURFACE.raised,

  /** Card border. */
  cardBorder: SURFACE.border,

  /** Card hover elevation. */
  cardHover: SURFACE.overlay,

  /** Selected card ring. */
  selectedRing: ACCENT.base,

  /** Unselected card border opacity for the checkbox state. */
  checkboxBorder: "rgba(255, 255, 255, 0.12)",

  /** Text on a selected card. */
  selectedText: TEXT.primary,

  /** Secondary text on any card. */
  secondaryText: TEXT.secondary,

  /** Disabled action button. */
  disabledAction: TEXT.disabled,

  /** Chip selected fill. */
  chipSelected: ACCENT.subtle,

  /** Chip selected text. */
  chipSelectedText: TEXT.primary,

  /** Chip unselected border. */
  chipBorder: SURFACE.border,

  /** Selection bar background. */
  selectionBar: SURFACE.overlay,

  /** Selection bar border. */
  selectionBarBorder: GLASS.border,

  /** Sheet backdrop scrim. */
  sheetScrim: "rgba(0, 0, 0, 0.72)",

  /** Sheet surface. */
  sheetBg: SURFACE.overlay,
} as const;

export const PICKER_SPACE = {
  gridGap: SPACE.sm,
  sectionGap: SPACE.xl,
  cardPadding: SPACE.md,
  headerGap: SPACE.sm,
  chipHeight: "32px",
  searchBarHeight: PICKER.searchHeight,
  selectionBarHeight: "72px",
} as const;

export const PICKER_RADIUS = {
  card: RADIUS.surface,
  chip: RADIUS.chip,
  input: RADIUS.input,
  sheet: RADIUS.sheet,
  action: RADIUS.round,
} as const;
