import { useEffect, useState } from "react";
import { Pause, Play, X } from "lucide-react";

import { ACCENT, DIAGRAM } from "../design/tokens";

/**
 * How long the ring takes to slide from one second to the next.
 *
 * Just under a second rather than exactly one, so the ring arrives at its new position
 * fractionally *before* the numeral above it changes. The two are driven by the same
 * timer, and a ring that lands after its own number reads as a lag rather than as
 * precision.
 */
const RING_TICK = "0.9s";

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
              style={{ transition: `stroke-dasharray ${RING_TICK} linear` }}
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