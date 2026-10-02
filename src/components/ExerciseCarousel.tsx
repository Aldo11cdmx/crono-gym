/**
 * ExerciseCarousel.tsx — horizontal strip of exercise bubbles.
 *
 * Doubles as navigation: tapping a bubble selects and focuses that exercise in
 * the main list. Progress is shown as a ring so the strip answers "where am I"
 * at a glance, without reading any text.
 *
 * The strip scrolls the selected bubble into view on selection, including when
 * selection changes from outside the strip.
 */

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Exercise } from "@/types/supabase";

export interface CarouselItem {
  key: string;
  exercise: Exercise;
  /** Completed sets / total sets for this exercise. */
  done: number;
  total: number;
}

interface ExerciseCarouselProps {
  items: CarouselItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function ExerciseCarousel({ items, selectedKey, onSelect }: ExerciseCarouselProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active bubble visible when selection comes from elsewhere.
  useEffect(() => {
    if (!selectedKey || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-key="${CSS.escape(selectedKey)}"]`,
    );
    node?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedKey]);

  if (items.length === 0) return null;

  return (
    <div className="-mx-1">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Ejercicios de la sesión"
        className="flex gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const selected = item.key === selectedKey;
          const complete = item.total > 0 && item.done >= item.total;
          const ratio = item.total > 0 ? Math.min(item.done / item.total, 1) : 0;

          return (
            <button
              key={item.key}
              type="button"
              data-key={item.key}
              role="tab"
              aria-selected={selected}
              aria-label={`${item.exercise.name}, ${item.done} de ${item.total} series`}
              onClick={() => onSelect(item.key)}
              className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 transition ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-white/10 bg-neutral-900 group-hover:border-white/25"
                }`}
              >
                {item.exercise.gif_url ? (
                  <img
                    src={item.exercise.gif_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-neutral-600">GIF</span>
                )}

                {/* Progress ring: SVG so it needs no extra dependency. */}
                {ratio > 0 && (
                  <svg
                    viewBox="0 0 36 36"
                    className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${ratio * 100.5} 100.5`}
                      className={complete ? "text-emerald-400" : "text-accent"}
                    />
                  </svg>
                )}

                {complete && (
                  <CheckCircle2
                    className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-neutral-900 text-emerald-400"
                    aria-hidden="true"
                  />
                )}
              </span>

              <span
                className={`w-full truncate text-center text-[10px] leading-tight ${
                  selected ? "text-accent" : "text-neutral-500"
                }`}
              >
                {shortName(item.exercise.name)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Strips the catalog's equipment prefix ("Barbell Bench Press - Neutral Grip")
 * so the bubble label stays readable in 68px.
 */
function shortName(name: string): string {
  const cleaned = name.replace(/^(barbell|dumbbell|cable|kettlebell|weighted)\s+/i, "");
  const withoutSuffix = cleaned.replace(/\s+-\s+.*$/, "");
  return withoutSuffix.length > 0 ? withoutSuffix : cleaned;
}