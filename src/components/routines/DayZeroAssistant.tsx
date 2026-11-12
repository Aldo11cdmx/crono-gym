import { useEffect, useMemo, useState } from "react";
import { estimateSmartLoad } from "@/lib/workout/cronosSmartEngine";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import type { CatalogExercise } from "@/lib/catalog/types";

type Frequency = 2 | 3 | 4 | 5;
type Goal = "strength" | "hypertrophy" | "general_fitness";
type Level = "beginner" | "intermediate" | "advanced";

export interface DayZeroRoutine {
  title: string;
  frequency: Frequency;
  goal: Goal;
  level: Level;
  exercises: Array<{ exerciseId: string; sets: number; reps: number; weightKg: number }>;
}

export function DayZeroAssistant({ onCreated }: { onCreated: (routine: DayZeroRoutine) => void }) {
  const [frequency, setFrequency] = useState<Frequency>(3);
  const [goal, setGoal] = useState<Goal>("general_fitness");
  const [level, setLevel] = useState<Level>("beginner");
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [step, setStep] = useState(0);

  useEffect(() => { void loadCatalog().then(setCatalog); }, []);

  const available = useMemo(
    () => catalog.filter((exercise) => exercise.availableInCronosGym),
    [catalog],
  );

  function createRoutine() {
    const selected = available
      .filter((exercise) => exercise.muscle_group || exercise.body_part)
      .slice(0, Math.max(6, frequency * 3));
    const routine: DayZeroRoutine = {
      title: `Cronos Day 0 · ${frequency} días`,
      frequency,
      goal,
      level,
      exercises: selected.map((exercise) => {
        const load = estimateSmartLoad({
          mode: "biometric_day_0",
          targetStation: exercise.station_key,
          movementPattern: exercise.movement_pattern,
          experienceLevel: level,
          targetReps: goal === "strength" ? 5 : goal === "hypertrophy" ? 10 : 8,
          weightKg: 65,
        });
        return {
          exerciseId: exercise.id,
          sets: goal === "strength" ? 4 : 3,
          reps: load.suggestedReps,
          weightKg: load.weightKg,
        };
      }),
    };
    try {
      const current = JSON.parse(window.localStorage.getItem("cronos_day_zero_routines_v1") ?? "[]");
      window.localStorage.setItem("cronos_day_zero_routines_v1", JSON.stringify([routine, ...(Array.isArray(current) ? current : [])]));
    } catch {
      // The callback still lets the current screen confirm the generated routine.
    }
    onCreated(routine);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#FF3B30]">Cronos Smart Day 0</p>
      <h2 className="mt-1 text-base font-bold text-white">Crea tu rutina en 3 pasos</h2>
      {step === 0 && <Choice title="¿Cuántos días entrenas?" options={[2, 3, 4, 5].map((value) => `${value} días`)} value={`${frequency} días`} onChange={(value) => { setFrequency(Number(value.split(" ")[0]) as Frequency); setStep(1); }} />}
      {step === 1 && <Choice title="¿Cuál es tu objetivo?" options={["Fuerza", "Hipertrofia", "Fitness general"]} value={goal === "strength" ? "Fuerza" : goal === "hypertrophy" ? "Hipertrofia" : "Fitness general"} onChange={(value) => { setGoal(value === "Fuerza" ? "strength" : value === "Hipertrofia" ? "hypertrophy" : "general_fitness"); setStep(2); }} />}
      {step === 2 && <Choice title="¿Cuál es tu nivel?" options={["Principiante", "Intermedio", "Avanzado"]} value={level === "beginner" ? "Principiante" : level === "intermediate" ? "Intermedio" : "Avanzado"} onChange={(value) => { setLevel(value === "Principiante" ? "beginner" : value === "Intermedio" ? "intermediate" : "advanced"); createRoutine(); }} />}
      <p className="mt-3 text-xs text-zinc-500">{available.length} ejercicios disponibles en Cronos Gym</p>
    </section>
  );
}

function Choice({ title, options, value, onChange }: { title: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="mt-3 grid gap-2"><p className="text-sm text-zinc-300">{title}</p>{options.map((option) => <button key={option} type="button" className={`min-h-11 rounded-xl px-3 text-left text-sm ${option === value ? "bg-[#FF3B30] text-white" : "bg-[#2C2C2E] text-zinc-300"}`} onClick={() => onChange(option)}>{option}</button>)}</div>;
}
