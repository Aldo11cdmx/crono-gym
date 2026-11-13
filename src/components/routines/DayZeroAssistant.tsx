import { useEffect, useMemo, useState } from "react";
import { ACCENT, RADIUS, SURFACE, TEXT } from "@/design/tokens";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import type { CatalogExercise } from "@/lib/catalog/types";
import {
  buildDayZeroPlan,
  isAvailableForDayZero,
  type DayZeroFrequency,
  type DayZeroGoal,
  type DayZeroLevel,
  type DayZeroPlan,
} from "@/lib/routines/dayZeroPlan";

/**
 * The assistant's questions and the catalog constraint live in `dayZeroPlan.ts`;
 * this component is the three taps and the collapse.
 *
 * It no longer writes the routine itself: the page that owns the routine list
 * persists it and shows it, because that is the only place that knows the user.
 */

const DAY_ZERO_KEY = "cronos_day_zero_routines_v1";

/** Kept for callers that imported the old name of the plan. */
export type DayZeroRoutine = DayZeroPlan;

export type { DayZeroPlan };

export interface DayZeroAssistantProps {
  onCreated: (plan: DayZeroPlan) => void;
}

export function DayZeroAssistant({ onCreated }: DayZeroAssistantProps) {
  const [frequency, setFrequency] = useState<DayZeroFrequency>(3);
  const [goal, setGoal] = useState<DayZeroGoal>("general_fitness");
  const [level, setLevel] = useState<DayZeroLevel>("beginner");
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    void loadCatalog()
      .then((rows) => {
        if (!alive) return;
        setCatalog(rows);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        console.error("[DayZeroAssistant] No se pudo cargar el catÃ¡logo", error);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const available = useMemo(() => catalog.filter(isAvailableForDayZero), [catalog]);

  function createRoutine() {
    if (available.length === 0) return;
    const plan = buildDayZeroPlan({ catalog, frequency, goal, level });
    if (plan.days.every((day) => day.exercises.length === 0)) return;
    try {
      const current = JSON.parse(window.localStorage.getItem(DAY_ZERO_KEY) ?? "[]");
      window.localStorage.setItem(
        DAY_ZERO_KEY,
        JSON.stringify([plan, ...(Array.isArray(current) ? current : [])]),
      );
    } catch {
      // The callback still lets the current screen confirm the generated routine.
    }
    onCreated(plan);
    setCollapsed(true);
    setStep(0);
  }

  if (collapsed) {
    return (
      <section
        className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 p-4"
        style={{ borderRadius: RADIUS.card, background: SURFACE.raised, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT.text }}>
            Cronos Smart Day 0
          </p>
          <p className="mt-1 text-sm" style={{ color: TEXT.secondary }}>
            Rutina generada. Ajusta los ejercicios cuando quieras.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="min-h-11 shrink-0 px-4 text-sm font-semibold"
          style={{ borderRadius: RADIUS.control, background: ACCENT.base, color: TEXT.onAccent }}
        >
          Crear otra rutina
        </button>
      </section>
    );
  }

  return (
    <section
      className="mb-4 w-full p-4"
      style={{ borderRadius: RADIUS.card, background: SURFACE.raised, border: `1px solid ${SURFACE.border}` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT.text }}>
        Cronos Smart Day 0
      </p>
      <h2 className="mt-1 text-base font-bold" style={{ color: TEXT.primary }}>
        Crea tu rutina en 3 pasos
      </h2>
      {status === "loading" && (
        <p className="mt-3 text-sm" style={{ color: TEXT.tertiary }} aria-live="polite">
          Cargando catÃ¡logoâ€¦
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm" style={{ color: TEXT.secondary }} aria-live="polite">
          No se pudo cargar el catÃ¡logo. Revisa tu conexiÃ³n y vuelve a intentarlo.
        </p>
      )}
      {status === "ready" && step === 0 && (
        <Choice
          title="Â¿CuÃ¡ntos dÃ­as entrenas?"
          options={[2, 3, 4, 5].map((value) => `${value} dÃ­as`)}
          value={`${frequency} dÃ­as`}
          onChange={(value) => {
            setFrequency(Number(value.split(" ")[0]) as DayZeroFrequency);
            setStep(1);
          }}
        />
      )}
      {status === "ready" && step === 1 && (
        <Choice
          title="Â¿CuÃ¡l es tu objetivo?"
          options={["Fuerza", "Hipertrofia", "Fitness general"]}
          value={goal === "strength" ? "Fuerza" : goal === "hypertrophy" ? "Hipertrofia" : "Fitness general"}
          onChange={(value) => {
            setGoal(value === "Fuerza" ? "strength" : value === "Hipertrofia" ? "hypertrophy" : "general_fitness");
            setStep(2);
          }}
        />
      )}
      {status === "ready" && step === 2 && (
        <Choice
          title="Â¿CuÃ¡l es tu nivel?"
          options={["Principiante", "Intermedio", "Avanzado"]}
          value={level === "beginner" ? "Principiante" : level === "intermediate" ? "Intermedio" : "Avanzado"}
          onChange={(value) => {
            setLevel(value === "Principiante" ? "beginner" : value === "Intermedio" ? "intermediate" : "advanced");
            createRoutine();
          }}
        />
      )}
      <p className="mt-3 text-xs" style={{ color: TEXT.tertiary }}>
        {status === "ready" ? `${available.length} ejercicios disponibles en Cronos Gym` : "Preparando el catÃ¡logoâ€¦"}
      </p>
    </section>
  );
}

function Choice({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <p className="col-span-full text-sm" style={{ color: TEXT.secondary }}>
        {title}
      </p>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            className="min-h-11 px-3 text-left text-sm"
            style={{
              borderRadius: RADIUS.control,
              background: active ? ACCENT.base : SURFACE.sunken,
              color: active ? TEXT.onAccent : TEXT.secondary,
              fontWeight: active ? 600 : 400,
            }}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}