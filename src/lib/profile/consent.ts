/**
 * consent.ts — AI consent versioning and validation logic.
 */

export const CONSENT_VERSION = 1 as const;

export interface ConsentRecord {
  granted: boolean;
  version: number;
  grantedAt: string;
}

/**
 * Checks if the user has a valid consent to share AI context.
 *
 * An explicit `shareAiContext` always wins, so a user who turned consent off keeps it off
 * even in development. Only a *missing* row falls back to the environment: true in DEV for
 * convenience, false anywhere else.
 */
export function hasValidConsent(
  consentRow?: { shareAiContext?: boolean },
  isDev: boolean = import.meta.env.DEV,
): boolean {
  if (typeof consentRow?.shareAiContext === "boolean") {
    return consentRow.shareAiContext;
  }
  return isDev;
}
