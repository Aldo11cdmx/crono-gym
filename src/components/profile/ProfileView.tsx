/**
 * ProfileView.tsx — `/perfil`.
 *
 * The screen a user opens to answer "what have you got me set up as?", so it
 * shows the *stored* values rather than an editable copy of them. Two things are
 * editable inline -- experience level and goal -- because both are the answers a
 * lifter's circumstances change most often, and making them mean "edit the
 * profile in a modal, then come back" for a single tap is how they stop matching
 * reality. Everything else is read-only here, because everything else is either
 * a fact about the body (which belongs in onboarding, where the legal checks
 * live) or the rack (which belongs in `GymSettingsPanel`).
 *
 * The gym-settings gear is the same component the workout logger uses, so this
 * screen gets a working entry point for free and cannot ship one whose close
 * handler is wired to the wrong place.
 *
 * `email` arrives through the router outlet rather than being re-read from
 * Supabase: `AuthGate` already resolved the session, and a second `getSession()`
 * would be a second source of truth that can disagree with the gate's.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Check, LogOut, Sparkles, Upload } from "lucide-react";
import { supabase } from "@lib/supabase";
import { GlassButton, GlassCard } from "@/components/ui";
import { GymSettingsTrigger } from "@/components/workout/GymSettingsTrigger";
import { ImportWizard } from "@/components/import/ImportWizard";
import { DeveloperGate } from "@/components/profile/DeveloperGate";
import { FeatureFlagSwitch } from "@/components/profile/FeatureFlagSwitch";
import { useLocalState } from "@/hooks/useLocalState";
import { useGymSettings } from "@/context/GymSettingsContext";
import { useProfile } from "@/hooks/useProfile";
import {
  ACTIVITY_LABELS,
  EXPERIENCE_LABELS,
  GYM_LABELS,
  GOAL_LABELS,
  PROFILE_LABELS,
  SEX_LABELS,
} from "@/lib/i18n";
import { ACTIVITY_FACTORS, ageFrom, cmToIn, kgToLb, type Profile } from "@/lib/profile";
import {
  ACCENT,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SOLID,
  SPACE,
  TEXT,
  TYPE,
} from "@/design/tokens";
import type { WorkspaceOutletContext } from "@/App";
import { COACH_PATH } from "@/components/shell/navItems";

/** BMI bands, in the order a clinician reads them. */
const BMI_BANDS: readonly { max: number; label: string }[] = [
  { max: 18.5, label: "Delgada" },
  { max: 25, label: "Normal" },
  { max: 30, label: "Sobrepeso" },
  { max: Infinity, label: "Obesidad" },
];

/**
 * Body-mass index, or null.
 *
 * A screening number, not a diagnosis, so it is shown with its band rather than
 * as a bare figure -- "22.4" on its own invites a reading it cannot support.
 */
export function bmiOf(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

function bmiBand(bmi: number): string {
  return BMI_BANDS.find((band) => bmi < band.max)?.label ?? "";
}

/** Plate sizes the user actually owns, smallest first. */
export function configuredSizes(
  inventory: Readonly<Record<number, number | undefined>>,
): number[] {
  return Object.keys(inventory)
    .map(Number)
    .filter((size) => (inventory[size] ?? 0) > 0)
    .sort((a, b) => a - b);
}

export function ProfileView() {
  const { userId, email } = useOutletContext<WorkspaceOutletContext>();
  const { profile, energy, loading, saving, error, update, refresh } = useProfile(userId);
  const gym = useGymSettings();
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const local = useLocalState();
  const flags = local.row?.flags ?? {
    maintenance: false,
    aiEnabled: true,
    showAiPreamble: false,
    verboseMode: false,
  };

  const age = useMemo(() => (profile ? ageFrom(profile.birth_date) : null), [profile]);
  const bmi = useMemo(
    () => (profile ? bmiOf(profile.weight_kg, profile.height_cm) : null),
    [profile],
  );

  if (loading && profile === null) {
    return <p style={mutedStyle}>{PROFILE_LABELS.loading}</p>;
  }

  if (profile === null) {
    return (
      <GlassCard>
        <p style={mutedStyle}>{PROFILE_LABELS.notLoaded}</p>
        <GlassButton variant="secondary" onClick={() => void refresh()}>
          {PROFILE_LABELS.retry}
        </GlassButton>
      </GlassCard>
    );
  }

  return (
    <div style={pageStyle}>
      <header style={{ marginBottom: SPACE.xl }}>
        <h1 style={{ margin: 0, fontSize: TYPE.title.size, fontWeight: TYPE.title.weight, color: TEXT.primary }}>
          {PROFILE_LABELS.title}
        </h1>
        <p style={{ margin: `${SPACE.xs} 0 0`, ...mutedStyle }}>{profile.display_name || email || PROFILE_LABELS.notSet}</p>
      </header>

      {/* ------------------------------------------------------ identity */}
      <Section title={PROFILE_LABELS.identityLabel}>
        <Field label={PROFILE_LABELS.nameLabel}>
          <input
            type="text"
            value={profile.display_name ?? ""}
            placeholder={PROFILE_LABELS.namePlaceholder}
            onChange={(event) => void update({ display_name: event.target.value })}
            style={inputStyle}
          />
        </Field>
        <Field label={PROFILE_LABELS.emailLabel}>
          <span style={readOnlyStyle}>{email || PROFILE_LABELS.notSet}</span>
        </Field>
      </Section>

      {/* ----------------------------------------------------------- body */}
      <Section title={PROFILE_LABELS.bodyLabel}>
        <Readouts
          items={[
            {
              label: PROFILE_LABELS.birthDateLabel,
              value: profile.birth_date ?? PROFILE_LABELS.notSet,
            },
            {
              label: PROFILE_LABELS.ageLabel,
              // The minor flag is spelled out, not implied: it changes the legal
              // calorie floor and a bare number hides that it is doing so.
              value:
                age === null
                  ? PROFILE_LABELS.notSet
                  : age < 18
                    ? PROFILE_LABELS.ageMinor(age)
                    : PROFILE_LABELS.ageYears(age),
            },
            {
              label: PROFILE_LABELS.sexLabel,
              value: profile.sex ? (SEX_LABELS[profile.sex] ?? profile.sex) : PROFILE_LABELS.notSet,
            },
            {
              label: PROFILE_LABELS.heightLabel,
              value:
                profile.height_cm === null
                  ? PROFILE_LABELS.notSet
                  : profile.unit_system === "imperial"
                    ? `${cmToIn(profile.height_cm)} in`
                    : `${profile.height_cm} cm`,
            },
            {
              label: PROFILE_LABELS.weightLabel,
              value:
                profile.weight_kg === null
                  ? PROFILE_LABELS.notSet
                  : profile.unit_system === "imperial"
                    ? `${kgToLb(profile.weight_kg)} lb`
                    : `${profile.weight_kg} kg`,
            },
            {
              label: PROFILE_LABELS.bodyMassIndex,
              value: bmi === null ? PROFILE_LABELS.notSet : `${bmi} · ${bmiBand(bmi)}`,
            },
          ]}
        />
      </Section>

      {/* ------------------------------------------------------ training */}
      <Section title={PROFILE_LABELS.trainingLabel}>
        <Field label={PROFILE_LABELS.experienceLabel}>
          <ChipRow<Profile["experience_level"]>
            values={(["beginner", "intermediate", "advanced"] as const).map((v) => ({
              value: v,
              label: EXPERIENCE_LABELS[v],
            }))}
            selected={profile.experience_level}
            onSelect={(value) => void update({ experience_level: value })}
          />
        </Field>

        <Field label={PROFILE_LABELS.activityLabel}>
          <ChipRow<Profile["activity_level"]>
            values={(Object.keys(ACTIVITY_LABELS) as Profile["activity_level"][]).map((v) => ({
              value: v,
              // The multiplier is part of the answer, not a detail: the same
              // weight produces a different target on each one.
              label: `${ACTIVITY_LABELS[v]} ×${ACTIVITY_FACTORS[v]}`,
            }))}
            selected={profile.activity_level}
            onSelect={(value) => void update({ activity_level: value })}
          />
        </Field>

        <Field label={PROFILE_LABELS.goalLabel}>
          <ChipRow<Profile["goal"]>
            values={(["lose_weight", "gain_muscle", "strength", "maintain", "endurance"] as const).map(
              (v) => ({ value: v, label: GOAL_LABELS[v] }),
            )}
            selected={profile.goal}
            onSelect={(value) => void update({ goal: value })}
          />
        </Field>

        {energy && (
          <Readouts
            items={[
              { label: PROFILE_LABELS.energyBmr, value: kcal(energy.bmr) },
              { label: PROFILE_LABELS.energyTdee, value: kcal(energy.tdee) },
              { label: PROFILE_LABELS.energyTarget, value: kcal(energy.target) },
              {
                label: PROFILE_LABELS.energyProtein,
                value:
                  energy.proteinGrams === null
                    ? PROFILE_LABELS.notSet
                    : `${energy.proteinGrams} g`,
              },
            ]}
          />
        )}

        {energy?.clampedByFloor && (
          <p style={{ ...hintStyle, color: ACCENT.text }}>
            {PROFILE_LABELS.energyFloorNote(energy.floor)}
          </p>
        )}
      </Section>

      {/* ----------------------------------------------------------- gym */}
      <Section title={PROFILE_LABELS.gymSettingsLabel}>
        <p style={{ ...mutedStyle, margin: `0 0 ${SPACE.md}` }}>{PROFILE_LABELS.gymSettingsHint}</p>
        <p style={{ ...hintStyle, margin: `0 0 ${SPACE.md}` }}>
          {/*
            The rack in one sentence, so the user can tell whether the panel they
            are about to open is describing the gym they are standing in. It is
            the same `GYM_LABELS` copy the panel renders, not a second phrasing.
          */}
          {GYM_LABELS.barWeightSummary(gym.barKg)}
          {" "}
          {GYM_LABELS.platesSummary(configuredSizes(gym.inventory))}
        </p>
        {/*
          `context` qualifies the accessible name: "Ajustes del gimnasio" alone
          is indistinguishable from this screen's own settings.
        */}
        <GymSettingsTrigger context={GYM_LABELS.profileTriggerContext} />
      </Section>

      {/* -------------------------------------------------------- import */}
      <Section title={PROFILE_LABELS.importLabel}>
        <p style={{ ...mutedStyle, margin: `0 0 ${SPACE.md}` }}>{PROFILE_LABELS.importHint}</p>
        <GlassButton
          variant="secondary"
          icon={<Upload size={16} aria-hidden="true" />}
          onClick={() => setWizardOpen(true)}
        >
          {PROFILE_LABELS.importOpen}
        </GlassButton>
      </Section>

      {/* ------------------------------------------------- developer gate */}
      {/*
        The God Mode panel. Behind `DeveloperGate` because it is the one surface
        here that can touch device-local state and the role itself, and a gate
        that renders nothing while loading is the only honest way to show it:
        an athlete seeing a developer panel for one frame is a leak, and the
        frame is invisible in review.
      */}
      <DeveloperGate fallback={null}>
        <Section title={PROFILE_LABELS.godTitle}>
          <p style={{ ...mutedStyle, margin: `0 0 ${SPACE.md}` }}>{PROFILE_LABELS.godSubtitle}</p>

          <div style={{ marginBottom: SPACE.md }}>
            <span style={{ ...fieldLabelStyle, margin: 0 }}>{PROFILE_LABELS.godFlagsTitle}</span>
            <p style={{ ...hintStyle, margin: `0 0 ${SPACE.sm}` }}>{PROFILE_LABELS.godFlagsHint}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
              <FeatureFlagSwitch
                id="flag-maintenance"
                value={flags?.maintenance ?? false}
                label={PROFILE_LABELS.godFlagMaintenance}
                hint={PROFILE_LABELS.godFlagMaintenanceHint}
                onChange={(next) => void local.save({ flags: { ...flags, maintenance: next } })}
                disabled={local.loading}
              />
              <FeatureFlagSwitch
                id="flag-ai"
                value={flags?.aiEnabled ?? true}
                label={PROFILE_LABELS.godFlagAi}
                hint={PROFILE_LABELS.godFlagAiHint}
                onChange={(next) => void local.save({ flags: { ...flags, aiEnabled: next } })}
                disabled={local.loading}
              />
              <FeatureFlagSwitch
                id="flag-preamble"
                value={flags?.showAiPreamble ?? false}
                label={PROFILE_LABELS.godFlagPreamble}
                hint={PROFILE_LABELS.godFlagPreambleHint}
                onChange={(next) => void local.save({ flags: { ...flags, showAiPreamble: next } })}
                disabled={local.loading}
              />
              <FeatureFlagSwitch
                id="flag-verbose"
                value={flags?.verboseMode ?? false}
                label={PROFILE_LABELS.godFlagVerbose}
                hint={PROFILE_LABELS.godFlagVerboseHint}
                onChange={(next) => void local.save({ flags: { ...flags, verboseMode: next } })}
                disabled={local.loading}
              />
            </div>
          </div>

          <GlassButton
            variant="secondary"
            icon={<Sparkles size={16} aria-hidden="true" />}
            onClick={() => void navigate("/dev/ui")}
          >
            {PROFILE_LABELS.devOpen}
          </GlassButton>
        </Section>
      </DeveloperGate>

      {/* ------------------------------------------------- premium coach */}
      {/*
        The coach's pitch, which is where the redesign moved it from the bottom bar.

        It is a card and not a navigation item because of what the destination is: a
        person deciding whether this is worth paying for. A tab in the thumb zone is
        for things you do mid-set, and a fifth one also put the raised training button
        half a column off centre.

        The link is the only way into `/coach`. The route is deliberately unlisted in
        `navItems.ts`, so this card is what keeps the AI coach's workspace -- the
        briefing, the chat, the notes, the pending recommendations -- reachable at all.
      */}
      <Section title={PROFILE_LABELS.premiumLabel}>
        <div style={{ display: "flex", gap: SPACE.md, alignItems: "flex-start" }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: RADIUS.round,
              backgroundColor: ACCENT.subtle,
              color: ACCENT.text,
            }}
          >
            <Sparkles size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: TYPE.subhead.size,
                lineHeight: TYPE.subhead.lineHeight,
                fontWeight: TYPE.subhead.weight,
                color: TEXT.primary,
              }}
            >
              {PROFILE_LABELS.premiumCoachName}
            </h3>
            <p style={{ ...mutedStyle, margin: `${SPACE.xs} 0 ${SPACE.md}` }}>
              {PROFILE_LABELS.premiumCoachHint}
            </p>
            <ul
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE.xs,
                margin: `0 0 ${SPACE.md}`,
                padding: 0,
                listStyle: "none",
              }}
            >
              {PROFILE_LABELS.premiumFeatures.map((feature) => (
                <li
                  key={feature}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: SPACE.sm,
                    fontSize: TYPE.caption.size,
                    lineHeight: TYPE.caption.lineHeight,
                    color: TEXT.secondary,
                  }}
                >
                  {/*
                    A drawn tick rather than a list bullet, because the section already
                    sets `listStyle: none` and the default disc would be the only thing
                    on the screen not built from tokens.
                  */}
                  <Check
                    size={14}
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: 1, color: ACCENT.text }}
                  />
                  {feature}
                </li>
              ))}
            </ul>
            {/*
              `variant="secondary"`, not the accent fill. This screen's primary action
              is signing in through no button at all -- every control here is a setting --
              and spending the one accent fill on a pitch would make a marketing surface
              look like the thing to press next.
            */}
            <GlassButton
              variant="secondary"
              icon={<ArrowRight size={16} aria-hidden="true" />}
              onClick={() => void navigate(COACH_PATH)}
            >
              {PROFILE_LABELS.premiumOpen}
            </GlassButton>
          </div>
        </div>
      </Section>

      {error && (
        <p role="alert" style={{ ...hintStyle, color: ACCENT.text }}>
          {error}
        </p>
      )}

      {/*
        Signs out through Supabase rather than clearing this screen, so the gate
        re-renders its signed-out state and any cached rank data is dropped by the
        same path used everywhere else. A reload would leave the cached ranks on
        the device for the next account to sign in.
      */}
      <GlassButton
        variant="ghost"
        icon={<LogOut size={16} aria-hidden="true" />}
        onClick={() => void supabase.auth.signOut()}
        disabled={saving}
      >
        {PROFILE_LABELS.signOut}
      </GlassButton>

      {wizardOpen && (
        <ImportWizard
          userId={userId}
          onClose={() => setWizardOpen(false)}
          onImported={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------- primitives

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassCard as="section" style={{ marginBottom: SPACE.lg }}>
      <h2
        style={{
          margin: `0 0 ${SPACE.md}`,
          fontSize: TYPE.label.size,
          fontWeight: 600,
          letterSpacing: TYPE.label.tracking,
          textTransform: "uppercase",
          color: TEXT.tertiary,
        }}
      >
        {title}
      </h2>
      {children}
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: SPACE.md }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

/** A label/value grid, for the values a user reads rather than edits. */
function Readouts({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: SPACE.md,
        margin: 0,
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt style={readoutLabelStyle}>{item.label}</dt>
          <dd
            style={{
              margin: "2px 0 0",
              fontSize: TYPE.body.size,
              color: TEXT.primary,
              fontVariantNumeric: NUMERIC.align,
            }}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ChipRow<T extends string>({
  values,
  selected,
  onSelect,
}: {
  values: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
      {values.map((option) => {
        const active = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(option.value)}
            style={{
              minHeight: 36,
              padding: "0 14px",
              borderRadius: RADIUS.pill,
              borderStyle: "solid",
              borderWidth: 1,
              borderColor: active ? ACCENT.base : GLASS.border,
              background: active ? ACCENT.base : "transparent",
              color: active ? TEXT.onAccent : TEXT.secondary,
              fontSize: TYPE.body.size,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function kcal(value: number | null): string {
  return value === null ? PROFILE_LABELS.notSet : `${value} kcal`;
}

// ------------------------------------------------------------------ styles

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxWidth: 640,
  padding: SPACE.lg,
  margin: "0 auto",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.body.size,
  color: TEXT.tertiary,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const readoutLabelStyle: CSSProperties = {
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: "8px 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${SOLID.borderStrong}`,
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.body.size,
};

const readOnlyStyle: CSSProperties = {
  display: "block",
  minHeight: MOTION.minTouchTarget,
  padding: "8px 0",
  fontSize: TYPE.body.size,
  color: TEXT.secondary,
};