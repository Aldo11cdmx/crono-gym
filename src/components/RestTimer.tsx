import { useEffect, useState } from "react";
import { Pause, Play, X } from "lucide-react";

import { ACCENT, DIAGRAM, MOTION } from "../design/tokens";

/**
 * How long the ring takes to slide from one second to the next.
 *
 * Just under a second rather than exactly one, so the ring arrives at its new position
 * fractionally *before* the numeral above it changes. The two are driven by the same
 * timer, and a ring that lands after its own number reads as a lag rather than as
 * precision.
 *
 * `MOTION.loop.rest`, so the period is the design system's rather than this file's. The
 * "just under a second" reasoning above is why the token exists in the first place; a
 * second, which is the obvious value, is the one that lags.
 */
const RING_TICK = MOTION.loop.rest;

interface RestTimerProps {
  seconds: number;
  onClose: () => void;
  onFinished: () => void;
}

export function RestTimer({ seconds, onClose, onFinished }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      onFinished();
      return;
    }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining, running, onFinished]);

  const total = Math.max(seconds, 1);
  const progress = remaining / total;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-72 rounded-2xl border border-white/10 bg-neutral-900/80 p-6 text-center shadow-glass backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
          Tiempo de descanso
        </p>

        <div className="relative mx-auto my-2 flex h-32 w-32 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={DIAGRAM.inert}
              strokeWidth="6"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={ACCENT.base}
              strokeWidth="6"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="round"
              /*
               * `MOTION.easeLinear`, not the bare `linear` keyword. Same value -- but the
               * keyword reads as "no curve thought about here", and this ring is the one
               * place in the app where the linear curve is a deliberate choice: the dash
               * shrinks at a constant rate so the remaining time is readable as distance,
               * and any easing would make the countdown lie about how fast it is going.
               */
              style={{ transition: `stroke-dasharray ${RING_TICK} ${MOTION.easeLinear}` }}
            />
          </svg>
          <span className="absolute text-3xl font-semibold tabular-nums">{remaining}</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/5"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pausar" : "Reanudar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}