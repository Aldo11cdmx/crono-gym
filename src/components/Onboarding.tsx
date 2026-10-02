/**
 * Onboarding.tsx — first-run profile capture.
 *
 * Multi-step so each screen asks for one kind of input, with the legal
 * minor check surfaced before anything else is submitted. Steps are validated
 * individually: a user can move forward and come back.
 *
 * The unit toggle is a display preference only. Weight/height are always
 * stored metric; `toDisplayUnits`/`fromDisplayUnits` handle the edges.
 */

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import {
  ACTIVITY_FACTORS,
  ageFrom,
  calorieFloor,
  cmToIn,
  computeEnergyTargets,
  feetInchesToInches,
  fromDisplayUnits,
  kgToLb,
  lbToKg,
  toDisplayUnits,
  validateProfileInput,
  type BiologicalSex,
  type Profile,
  type UnitSystem,
} from "../lib/profile";

/**
 * Local onboarding draft. Kept separate from `Profile` so the imperial input
 * fields can hold partial values (null = not answered yet) without widening
 * the stored profile shape.
 */
interface Draft {
  unitSystem: UnitSystem;
  birthDate: string;
  sex: BiologicalSex | null;
  weightKg: number | null;
  heightCm: number | null;
  weightLb: number | null;
  feet: number | null;
  inches: number | null;
  experience: Profile["experience_level"];
  activity: Profile["activity_level"];
  goal: Profile["goal"];
  guardianConsent: boolean;
}

type DraftPatch = (patch: Partial<Draft>) => void;

interface OnboardingProps {
  profile: Profile;
  onSave: (patch: Partial<Profile>) => Promise<boolean>;
  onFinish: () => void;
}

const STEPS = [
  { key: "units", title: "Unidades", subtitle: "Cómo quieres ver tus medidas" },
  { key: "about", title: "Sobre ti", subtitle: "Datos básicos para calcular tu energía" },
  { key: "body", title: "Medidas", subtitle: "Altura y peso de referencia" },
  { key: "training", title: "Entrenamiento", subtitle: "Tu experiencia y objetivo" },
  { key: "summary", title: "Resumen", subtitle: "Tu punto de partida" },
] as const;

const EXPERIENCE: { value: Profile["experience_level"]; label: string; hint: string }[] = [
  { value: "beginner", label: "Principiante", hint: "Menos de 1 año entrenando" },
  { value: "intermediate", label: "Intermedio", hint: "1 a 3 años" },
  { value: "advanced", label: "Avanzado", hint: "Más de 3 años" },
];

const GOALS: { value: Profile["goal"]; label: string }[] = [
  { value: "lose_weight", label: "Perder peso" },
  { value: "gain_muscle", label: "Ganar músculo" },
  { value: "strength", label: "Ganar fuerza" },
  { value: "maintain", label: "Mantener" },
  { value: "endurance", label: "Resistencia" },
];

const ACTIVITY: { value: Profile["activity_level"]; label: string }[] = [
  { value: "sedentary", label: "Sedentario", },
  { value: "light", label: "Ligera", },
  { value: "moderate", label: "Moderada", },
  { value: "active", label: "Alta", },
  { value: "athlete", label: "Atleta", },
];

export function Onboarding({ profile, onSave, onFinish }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local draft so navigating back and forth never loses input.
  const [draft, setDraft] = useState<Draft>({
    unitSystem: profile.unit_system as UnitSystem,
    birthDate: profile.birth_date ?? "",
    sex: profile.sex as BiologicalSex | null,
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    // Imperial inputs, kept separately to avoid precision loss.
    weightLb: profile.weight_kg !== null ? kgToLb(profile.weight_kg) : null,
    feet: 0,
    inches: 0,
    experience: profile.experience_level as Profile["experience_level"],
    activity: profile.activity_level as Profile["activity_level"],
    goal: profile.goal as Profile["goal"],
    guardianConsent: profile.guardian_consent_at !== null,
  });

  /** Patch helper so step components never see the raw setter. */
  function patchDraft(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  const step = STEPS[stepIndex];

  /**
 * Resolves the canonical metric height.
   *
   * In imperial mode the feet/inches split is authoritative; in metric mode the
   * direct cm field is. A half-filled imperial pair falls back to `heightCm` so
   * a user typing "5" in feet does not briefly report a 5-inch height.
   */
  const effectiveHeightCm = useMemo(() => {
    if (draft.unitSystem === "imperial") {
      const feet = draft.feet ?? 0;
      const inches = draft.inches ?? 0;
      if (feet > 0 || inches > 0) {
        return fromDisplayUnits(
          { weight: draft.weightLb ?? 0, height: feetInchesToInches(feet, inches) },
          "imperial",
        ).height;
      }
    }
    return draft.heightCm;
  }, [draft.unitSystem, draft.feet, draft.inches, draft.heightCm, draft.weightLb]);

  const effectiveWeightKg = useMemo(
    () =>
      draft.unitSystem === "imperial" && draft.weightLb !== null
        ? lbToKg(draft.weightLb)
        : draft.weightKg,
    [draft.unitSystem, draft.weightLb, draft.weightKg],
  );

  const age = ageFrom(draft.birthDate || null);
  const needsGuardian = age !== null && age < 18;

  const energy = useMemo(
    () =>
      computeEnergyTargets({
        birth_date: draft.birthDate || null,
        sex: draft.sex,
        height_cm: effectiveHeightCm,
        weight_kg: effectiveWeightKg,
        activity_level: draft.activity,
        goal: draft.goal,
      }),
    [draft.birthDate, draft.sex, effectiveHeightCm, effectiveWeightKg, draft.activity, draft.goal],
  );

  /** Validation for the current step; earlier steps must already be satisfied. */
  const stepValid = useMemo(() => {
    switch (step.key) {
      case "units":
        return true;
      case "about": {
        const result = validateProfileInput({
          birthDate: draft.birthDate,
          sex: draft.sex,
          heightCm: draft.heightCm,
          weightKg: draft.weightKg,
          guardianConsent: draft.guardianConsent,
        });
        // Only birth date and sex are required here; body metrics come next.
        return Boolean(draft.birthDate) && draft.sex !== null && !result.errors.birthDate && !result.errors.sex;
      }
      case "body":
        return (
          effectiveHeightCm !== null &&
          effectiveHeightCm >= 100 &&
          effectiveHeightCm <= 250 &&
          effectiveWeightKg !== null &&
          effectiveWeightKg >= 25 &&
          effectiveWeightKg <= 400
        );
      case "training":
        return true;
      case "summary":
        return true;
      default:
        return true;
    }
  }, [step.key, draft.birthDate, draft.sex, draft.guardianConsent, draft.heightCm, draft.weightKg, effectiveHeightCm, effectiveWeightKg]);

  async function handleNext() {
    setError(null);
    if (!stepValid) return;

    if (step.key === "summary") {
      setSaving(true);
      const ok = await onSave({
        unit_system: draft.unitSystem,
        birth_date: draft.birthDate,
        sex: draft.sex,
        height_cm: effectiveHeightCm,
        weight_kg: effectiveWeightKg,
        experience_level: draft.experience,
        activity_level: draft.activity,
        goal: draft.goal,
        guardian_consent_at: draft.guardianConsent ? new Date().toISOString() : null,
        onboarding_completed_at: new Date().toISOString(),
      });
      setSaving(false);
      if (!ok) {
        setError("No se pudo guardar tu perfil. Revisa los datos e inténtalo de nuevo.");
        return;
      }
      onFinish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  const display = useMemo(() => {
    if (effectiveWeightKg === null || effectiveHeightCm === null) return null;
    return toDisplayUnits(
      { weight: effectiveWeightKg, height: effectiveHeightCm },
      draft.unitSystem,
    );
  }, [effectiveWeightKg, effectiveHeightCm, draft.unitSystem]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Configura tu perfil</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Paso {stepIndex + 1} de {STEPS.length} · {step.subtitle}
        </p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 shadow-glass backdrop-blur-md">
        {step.key === "units" && (
          <StepUnits
            value={draft.unitSystem}
            onChange={(unitSystem) => setDraft((d) => ({ ...d, unitSystem }))}
          />
        )}

        {step.key === "about" && (
          <StepAbout
            birthDate={draft.birthDate}
            sex={draft.sex}
            age={age}
            needsGuardian={needsGuardian}
            guardianConsent={draft.guardianConsent}
            onChange={patchDraft}
          />
        )}

        {step.key === "body" && (
          <StepBody
            unitSystem={draft.unitSystem}
            draft={draft}
            setDraft={setDraft}
            heightCm={effectiveHeightCm}
            weightKg={effectiveWeightKg}
            displayLabels={
              display
                ? { weight: display.weightLabel, height: display.heightLabel }
                : { weight: "kg", height: "cm" }
            }
          />
        )}

        {step.key === "training" && (
          <StepTraining draft={draft} setDraft={setDraft} />
        )}

        {step.key === "summary" && (
          <StepSummary
            draft={draft}
            energy={energy}
            display={display}
            needsGuardian={needsGuardian}
          />
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <footer className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(i - 1, 0))}
            disabled={stepIndex === 0}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs text-neutral-300 transition hover:bg-white/5 disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Atrás
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!stepValid || saving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-neutral-950 transition hover:brightness-110 disabled:opacity-40"
          >
            {step.key === "summary" ? (
              <>
                <Check className="h-4 w-4" /> {saving ? "Guardando…" : "Finalizar"}
              </>
            ) : (
              <>
                Siguiente <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </footer>
      </div>

      <LegalNotice />
    </div>
  );
}

// ---------------------------------------------------------------- steps

function StepUnits({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (v: UnitSystem) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Sistema de unidades</legend>
      <p className="mt-1 text-xs text-neutral-500">
        Solo afecta a cómo se muestran las medidas. Guardamos siempre en kg y cm.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {([
          { value: "metric", label: "Métrico", hint: "kg · cm" },
          { value: "imperial", label: "Imperial", hint: "lb · in" },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              value === option.value
                ? "border-accent bg-accent/10"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="block text-xs text-neutral-500">{option.hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function StepAbout({
  birthDate,
  sex,
  age,
  needsGuardian,
  guardianConsent,
  onChange,
}: {
  birthDate: string;
  sex: BiologicalSex | null;
  age: number | null;
  needsGuardian: boolean;
  guardianConsent: boolean;
  onChange: DraftPatch;
}) {
  return (
    <fieldset className="space-y-5">
      <div>
        <label htmlFor="birth-date" className="mb-1 block text-xs text-neutral-400">
          Fecha de nacimiento
        </label>
        <input
          id="birth-date"
          type="date"
          value={birthDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChange({ birthDate: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {age !== null && age < 13 && (
          <p className="mt-1.5 text-xs text-red-400">
            La edad mínima para usar la app es 13 años.
          </p>
        )}
      </div>

      {needsGuardian && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={guardianConsent}
            onChange={(e) => onChange({ guardianConsent: e.target.checked })}
            className="mt-0.5 accent-accent"
          />
          <span>
            <span className="block text-xs text-amber-200">
              Menor de 18 años detected
            </span>
            <span className="block text-[11px] leading-relaxed text-amber-100/70">
              Necesitas el consentimiento de un adulto responsable. Al continuar
              confirmas que lo tienes.
            </span>
          </span>
        </label>
      )}

      <div>
        <span className="mb-1.5 block text-xs text-neutral-400">Sexo biológico</span>
        <p className="mb-2 text-[11px] text-neutral-500">
          Se usa únicamente en la fórmula de energía (Mifflin-St Jeor). Puedes elegir
          &quot;Prefiero no decirlo&quot;.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            { value: "male", label: "Hombre" },
            { value: "female", label: "Mujer" },
            { value: "other", label: "Prefiero no decirlo" },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ sex: option.value })}
              aria-pressed={sex === option.value}
              className={`rounded-lg border px-3 py-2 text-xs transition ${
                sex === option.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-white/10 text-neutral-300 hover:border-white/20"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function StepBody({
  unitSystem,
  draft,
  setDraft,
  heightCm,
  weightKg,
  displayLabels,
}: {
  unitSystem: UnitSystem;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  heightCm: number | null;
  weightKg: number | null;
  displayLabels: { weight: string; height: string };
}) {
  const imperial = unitSystem === "imperial";
  const heightHint =
    heightCm !== null ? (imperial ? `${cmToIn(heightCm)} in` : `${heightCm} cm`) : null;

  return (
    <fieldset className="space-y-5">
      <div>
        <span className="mb-1 block text-xs text-neutral-400">
          Altura {imperial ? "(pies y pulgadas)" : "(cm)"}
        </span>
        {imperial ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Pies"
              value={draft.feet}
              onChange={(feet) => setDraft((d) => ({ ...d, feet }))}
            />
            <NumberField
              label="Pulgadas"
              value={draft.inches}
              onChange={(inches) => setDraft((d) => ({ ...d, inches }))}
            />
          </div>
        ) : (
          <NumberField
            label="Altura"
            value={draft.heightCm}
            onChange={(v) => setDraft((d) => ({ ...d, heightCm: v }))}
          />
        )}
        {heightHint && <p className="mt-1.5 text-[11px] text-neutral-500">≈ {heightHint}</p>}
      </div>

      <div>
        <span className="mb-1 block text-xs text-neutral-400">
          Peso actual ({displayLabels.weight})
        </span>
        <NumberField
          label="Peso"
          value={imperial ? draft.weightLb : draft.weightKg}
          onChange={(v) =>
            setDraft((d) =>
              imperial ? { ...d, weightLb: v } : { ...d, weightKg: v },
            )
          }
        />
        {weightKg !== null && (
          <p className="mt-1.5 text-[11px] text-neutral-500">≈ {weightKg} kg</p>
        )}
      </div>
    </fieldset>
  );
}

function StepTraining({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <fieldset className="space-y-5">
      <div>
        <span className="mb-1.5 block text-xs text-neutral-400">Nivel de experiencia</span>
        <div className="space-y-2">
          {EXPERIENCE.map((option) => (
            <ChoiceRow
              key={option.value}
              label={option.label}
              hint={option.hint}
              selected={draft.experience === option.value}
              onSelect={() => setDraft((d) => ({ ...d, experience: option.value }))}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs text-neutral-400">Actividad diaria</span>
        <div className="space-y-2">
          {ACTIVITY.map((option) => (
            <ChoiceRow
              key={option.value}
              label={option.label}
              hint={`Factor ×${ACTIVITY_FACTORS[option.value]}`}
              selected={draft.activity === option.value}
              onSelect={() => setDraft((d) => ({ ...d, activity: option.value }))}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs text-neutral-400">Objetivo principal</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOALS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, goal: option.value }))}
              aria-pressed={draft.goal === option.value}
              className={`rounded-lg border px-3 py-2 text-xs transition ${
                draft.goal === option.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-white/10 text-neutral-300 hover:border-white/20"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function StepSummary({
  draft,
  energy,
  display,
  needsGuardian,
}: {
  draft: Draft;
  energy: ReturnType<typeof computeEnergyTargets>;
  display: { weight: number; height: number; weightLabel: string; heightLabel: string } | null;
  needsGuardian: boolean;
}) {
  const floor = calorieFloor({ birth_date: draft.birthDate || null });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Metabolismo basal" value={energy.bmr !== null ? `${energy.bmr} kcal` : "—"} />
        <Stat label="Gasto total (TDEE)" value={energy.tdee !== null ? `${energy.tdee} kcal` : "—"} />
        <Stat
          label="Objetivo diario"
          value={energy.maintenance > 0 ? `${energy.target} kcal` : "—"}
          highlight
        />
        <Stat
          label="Proteína sugerida"
          value={energy.proteinGrams !== null ? `${energy.proteinGrams} g` : "—"}
        />
      </div>

      {energy.weeklyRate !== 0 && energy.maintenance > 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-neutral-400">
          Proyección estimada:{" "}
          <span className="font-semibold text-neutral-200">
            {energy.weeklyRate > 0 ? "+" : ""}
            {energy.weeklyRate} kg/semana
          </span>
          {energy.expectedChangePercent !== null && (
            <> ({(energy.expectedChangePercent > 0 ? "+" : "") + energy.expectedChangePercent}% de tu peso)</>
          )}
          . Es una estimación; ajusta según tu progreso.
        </p>
      )}

      {energy.clampedByFloor && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          Tu objetivo se ha ajustado al mínimo de {floor} kcal. {" "}
          {needsGuardian ? "Para menores de 18 años el mínimo es 1.200 kcal" : "El mínimo para adultos es 1.500 kcal"}
          , por seguridad. Baja más rápido no es recomendable.
        </div>
      )}

      {needsGuardian && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Registraremos el consentimiento de tu adulto responsable junto a tu perfil.
        </p>
      )}

      {display && (
        <dl className="space-y-1 border-t border-white/10 pt-4 text-xs">
          <SummaryRow
            label="Medidas"
            value={`${display.height} ${display.heightLabel} · ${display.weight} ${display.weightLabel}`}
          />
          <SummaryRow
            label="Objetivo"
            value={GOALS.find((g) => g.value === draft.goal)?.label ?? draft.goal}
          />
          <SummaryRow
            label="Nivel"
            value={EXPERIENCE.find((e) => e.value === draft.experience)?.label ?? draft.experience}
          />
          <SummaryRow
            label="Actividad"
            value={`${ACTIVITY.find((a) => a.value === draft.activity)?.label ?? draft.activity} (×${ACTIVITY_FACTORS[draft.activity]})`}
          />
        </dl>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- atoms

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      value={value === null ? "" : value}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number.parseFloat(raw));
      }}
      className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm outline-none focus:border-accent"
    />
  );
}

function ChoiceRow({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
        selected ? "border-accent bg-accent/10" : "border-white/10 hover:border-white/20"
      }`}
    >
      <span className="text-xs text-neutral-200">{label}</span>
      <span className="text-[11px] text-neutral-500">{hint}</span>
    </button>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight ? "border-accent/40 bg-accent/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${highlight ? "text-accent" : "text-neutral-100"}`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-300">{value}</dd>
    </div>
  );
}

function LegalNotice() {
  return (
    <p className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-neutral-600">
      <Info className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        Los datos de salud y los cálculos de energía son orientativos y no sustituyen
        el consejo de un profesional de la salud. Tus datos se almacenan de forma
        privada y solo tú puedes acceder a ellos.
      </span>
    </p>
  );
}