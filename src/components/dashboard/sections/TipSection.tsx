import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb, RotateCcw, Zap } from "lucide-react";

import { ACCENT, GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { GlassButton } from "@/components/ui/GlassButton";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface Tip {
  id: string;
  text: string;
  icon: "lightbulb" | "zap";
  category: string;
}

export interface TipSectionProps {
  tip: Tip | string;
  tips?: Tip[] | string[];
  onNext: () => void;
}

function tipText(value: Tip | string): string {
  return typeof value === "string" ? value : value.text;
}

function tipIcon(value: Tip | string): "lightbulb" | "zap" {
  return typeof value === "string" ? "lightbulb" : value.icon;
}

export function TipSection({ tip, tips, onNext }: TipSectionProps) {
  const reduce = useReducedMotion();
  const items = useMemo(() => (tips && tips.length > 0 ? tips : [tip]), [tip, tips]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  const go = useCallback(
    (nextIndex: number) => {
      if (items.length <= 1) {
        onNext();
        return;
      }
      const normalized = ((nextIndex % items.length) + items.length) % items.length;
      setIndex(normalized);
      onNext();
    },
    [items.length, onNext],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(index + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(index - 1);
      }
    },
    [go, index],
  );

  const current = items[index] ?? tip;
  const Icon = tipIcon(current) === "zap" ? Zap : Lightbulb;

  return (
    <div
      data-testid="cronos-ia-carousel"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Consejos de Cronos IA"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="outline-none focus-visible:ring-2"
      style={{
        borderRadius: RADIUS.surface,
        border: `1px solid ${GLASS.border}`,
        background: "rgba(255,255,255,0.03)",
        padding: SPACE.md,
        transition: reduce ? undefined : "opacity 150ms ease",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: RADIUS.control,
            display: "grid",
            placeItems: "center",
            background: ACCENT.subtle,
            border: `1px solid ${ACCENT.border}`,
            color: ACCENT.text,
            flexShrink: 0,
          }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p style={{ ...TYPE.label, color: TEXT.tertiary, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Consejo
          </p>
          <p aria-live="polite" aria-atomic="true" style={{ ...TYPE.body, color: TEXT.secondary, margin: `${SPACE.xs} 0 0` }}>
            {tipText(current)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        {items.length > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Consejo anterior"
              onClick={() => go(index - 1)}
              className="inline-flex items-center justify-center rounded-full focus-visible:ring-2"
              style={{ minWidth: 44, minHeight: 44, border: `1px solid ${GLASS.border}`, background: "rgba(255,255,255,0.03)", color: TEXT.secondary }}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Siguiente consejo"
              onClick={() => go(index + 1)}
              className="inline-flex items-center justify-center rounded-full focus-visible:ring-2"
              style={{ minWidth: 44, minHeight: 44, border: `1px solid ${GLASS.border}`, background: "rgba(255,255,255,0.03)", color: TEXT.secondary }}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span />
        )}

        <GlassButton variant="secondary" icon={<RotateCcw size={16} />} onClick={onNext}>
          Siguiente tip
        </GlassButton>
      </div>

      {items.length > 1 ? (
        <div role="tablist" aria-label="Indicadores de consejos" className="mt-2 flex items-center justify-end gap-1">
          {items.map((item, i) => {
            const active = i === index;
            return (
              <button
                key={typeof item === "string" ? `${item}-${i}` : item.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Ir al consejo ${i + 1} de ${items.length}`}
                onClick={() => go(i)}
                className="inline-flex items-center justify-center focus-visible:ring-2"
                style={{ minWidth: 44, minHeight: 44, background: "transparent", border: "none", padding: 0 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: active ? 18 : 8,
                    height: 8,
                    borderRadius: RADIUS.pill,
                    background: active ? ACCENT.base : GLASS.borderStrong,
                    display: "block",
                  }}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
