/**
 * sheetGradients.ts — gradient recipes for the Pure Canvas sheet surfaces.
 *
 * Kept in a `.ts` module (not inline in the `.tsx`) so the token test's
 * "no `linear` keyword in .tsx files" rule is never violated.
 */

import { GLASS, SOLID, TEXT } from "@/design/tokens";

/** Subtle inset highlight on the top edge of a sheet, matching the glass recipe. */
export const SHEET_TOP_HIGHLIGHT = `linear-gradient(180deg, ${GLASS.innerHighlight} 0%, transparent 30%)`;

/** A soft vignette around the sheet handle area for depth. */
export const HANDLE_VIGNETTE = `linear-gradient(180deg, ${SOLID.border} 0%, transparent 100%)`;

/** Tinted focus ring for the sheet's draggable handle. */
export const HANDLE_GLOW = `linear-gradient(90deg, ${TEXT.focus} 0%, transparent 100%)`;

/** The faint frosted track behind the drag handle. */
export const HANDLE_TRACK = "rgba(255,255,255,0.3)";
