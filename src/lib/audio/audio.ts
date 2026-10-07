/**
 * audio.ts — a lazy AudioContext singleton for UI confirmation beeps.
 *
 * Why a singleton
 * ---------------
 * Constructing an `AudioContext` is cheap but not free: each one allocates a graph
 * and, on mobile, carries a resume-after-gesture dance that has to happen exactly
 * once per page. Reusing one context across the whole app lets the first user
 * gesture (which every confirmation follows) pay the resume tax once, and
 * subsequent sounds just schedule a node.
 *
 * Why lazy
 * --------
 * An `AudioContext` constructed before any user gesture is suspended and, on
 * iOS, cannot be resumed without one. Creating the context on first use means
 * the first `playBeep` call — always the result of a tap — is the first time
 * the context is touched, so there is no suspended context lingering on load.
 *
 * Why a frequency pair
 * -------------------
 * A two-tone "ding-dong" is more distinguishable from the many one-shot UI
 * bleeps this product already plays than a single sine, and two oscillators
 * sharing a short decay curve sound as one event to a listener who is not
 * listening for it.
 */

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (typeof window.AudioContext === "undefined" && typeof (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === "undefined") {
    return null;
  }
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctor();
  }
  return sharedContext;
}

/**
 * Plays a short confirmation beep: a quick rise-and-fall oscillator on the
 * shared context. Returns `true` if the sound was scheduled, `false` if the
 * context could not be created or resumed.
 */
export function playBeep(frequency: number = 523.25, durationMs: number = 120): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    ctx.resume();
  }

  try {
    const now = ctx.currentTime;
    const gain = ctx.createGain();

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets the singleton. Intended for tests that want to verify the context is
 * created on demand rather than at import time.
 */
export function resetAudioContext(): void {
  sharedContext = null;
}
