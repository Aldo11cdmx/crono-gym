export async function reportError(error: Error, context: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) return;
  try {
    const fp = btoa((error.message + (error.stack ?? "")).slice(0, 200)).replace(/=/g, "");
    await fetch("/api/report-error", { method: "POST", body: JSON.stringify({ fingerprint: fp, message: error.message, context }) });
  } catch {
    // ignore
  }
}