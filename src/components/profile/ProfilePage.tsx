/**
 * ProfilePage.tsx — `/perfil`, the premium athlete command center.
 *
 * Three tabs that answer the three questions an athlete brings to the profile:
 *
 *  1. Biometría y metas — body data, energy targets, training chips.
 *  2. Mi gimnasio — bar and plates, import entry point.
 *  3. Preferencias y sistema — local role, feature flags, export, sign-out.
 *
 * The data layer is identical to ProfileView — same hooks and pure functions —
 * so the numbers here agree with every other screen. The difference is the
 * command-center layout: related controls live in the same tab rather than in
 * a single scroll.
 *
 * Visual language follows Apple Health / Cronos Performance Instrument:
 *   - Elevated hero card with avatar halo and HUD minipanel.
 *   - iOS-style segmented control for tab switching.
 *   - Crystal pills (border-only) instead of filled buttons.
 *   - iOS Grouped containers for form sections.
 *   - Macro card on the biometría tab.
 */

import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Check, LogOut, Sparkles, Upload } from "lucide-react";
import { supabase } from "@lib/supabase";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { GymSettingsTrigger } from "@/components/workout/GymSettingsTrigger";
import { ImportWizard } from "@/components/import/ImportWizard";
import { DeveloperGate } from "@/components/profile/DeveloperGate";
import { FeatureFlagSwitch } from "@/components/profile/FeatureFlagSwitch";
import { useProfile, useBodyMetrics } from "@/hooks/useProfile";
import { useGymSettings } from "@/context/GymSettingsContext";
import { useLocalState } from "@/hooks/useLocalState";
import { useLocalSession } from "@/lib/localSession";
import {
  ACTIVITY_LABELS,
  EXPERIENCE_LABELS,
  GYM_LABELS,
  GOAL_LABELS,
  PROFILE_LABELS,
  SEX_LABELS,
} from "@/lib/i18n";
import { ACTIVITY_FACTORS, ageFrom, cmToIn, kgToLb, type EnergyReport, type Profile } from "@/lib/profile";
import { bmiOf, configuredSizes } from "./ProfileView";
import type { LocalStateRow } from "@/lib/profile/localState";
import {
  ACCENT,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SOLID,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";
import type { WorkspaceOutletContext } from "@/App";
import type { BodyweightEntry } from "@/types/supabase";
import { COACH_PATH } from "@/components/shell/navItems";

const PROFILE_TABS = ["biometric", "gym", "preferences"] as const;
type ProfileTabId = (typeof PROFILE_TABS)[number];

export { bmiOf, configuredSizes };

const BADGE_ROLE: Record<string, string> = {
  athlete: PROFILE_LABELS.badgeAthlete,
  developer: PROFILE_LABELS.badgeDeveloper,
  coach: PROFILE_LABELS.badgeCoach,
};

const EXPERIENCE_BADGE: Record<string, string> = {
  beginner: PROFILE_LABELS.badgeBeginner,
  intermediate: PROFILE_LABELS.badgeIntermediate,
  advanced: PROFILE_LABELS.badgeAdvanced,
};

function initialsOf(name: string | null): string {
  if (!name || !name.trim()) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
}

function kcal(value: number | null): string {
  return value === null ? PROFILE_LABELS.notSet : `${value} kcal`;
}

function exportProfile(profile: Profile, row: LocalStateRow | null) {
  const data = {
    exportedAt: new Date().toISOString(),
    profile,
    localState: row,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cronos-perfil-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProfilePage() {
  const { userId, email } = useOutletContext<WorkspaceOutletContext>();
  const { profile, energy, loading, saving, error, update, refresh } = useProfile(userId);
  const gym = useGymSettings();
  const local = useLocalState();
  const session = useLocalSession();
  const bodyMetrics = useBodyMetrics(userId);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTabId>("biometric");
  const [wizardOpen, setWizardOpen] = useState(false);

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
    return (
      <div style={pageStyle}>
        <Skeleton variant="block" height="24px" width="200px" style={{ marginBottom: SPACE.md }} />
        <Skeleton variant="block" height="120px" style={{ marginBottom: SPACE.lg }} />
        <Skeleton variant="block" height="200px" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div style={pageStyle}>
        <GlassCard>
          <p style={mutedStyle}>{PROFILE_LABELS.notLoaded}</p>
          <GlassButton variant="secondary" onClick={() => void refresh()}>
            {PROFILE_LABELS.retry}
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = PROFILE_TABS.indexOf(activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = PROFILE_TABS[(index + 1) % PROFILE_TABS.length];
      setActiveTab(next);
      event.currentTarget
        .querySelector<HTMLButtonElement>(`[data-profile-tab="${next}"]`)
        ?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const next = PROFILE_TABS[(index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length];
      setActiveTab(next);
      event.currentTarget
        .querySelector<HTMLButtonElement>(`[data-profile-tab="${next}"]`)
        ?.focus();
    }
  };

  return (
    <div style={pageStyle}>
      {/* Hero Header — elevated glass card with avatar, identity and HUD */}
      <GlassCard
        raised
        style={heroCardStyle}
      >
        <div style={heroBodyStyle}>
          <span
            aria-hidden="true"
            style={avatarStyle}
          >
            <span style={avatarTextStyle}>{initialsOf(profile.display_name)}</span>
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={heroTitleStyle}>{PROFILE_LABELS.title}</h1>
            <p style={{ ...mutedStyle, margin: `${SPACE.xs} 0 0` }}>{profile.display_name || email || PROFILE_LABELS.notSet}</p>
            <div style={{ display: "flex", gap: SPACE.xs, marginTop: SPACE.sm, flexWrap: "wrap" }}>
              <span style={badgeStyle}>
                {BADGE_ROLE[session.role] ?? session.role} · {EXPERIENCE_BADGE[profile.experience_level] ?? profile.experience_level}
              </span>
              <span style={badgeProStyle}>
                {PROFILE_LABELS.badgePro}
              </span>
            </div>
          </div>
        </div>

        {/* Minipanel HUD — physiological data in crystal boxes */}
        <div style={hudStyle}>
          <HudBox
            label={PROFILE_LABELS.energyHudBmi}
            value={
              bmi === null
                ? PROFILE_LABELS.notSet
                : `${bmi} · ${bmiBand(bmi)}`
            }
          />
          <HudBox
            label={PROFILE_LABELS.energyBmr}
            value={kcal(energy?.bmr ?? null)}
          />
          <HudBox
            label={PROFILE_LABELS.energyTdee}
            value={kcal(energy?.tdee ?? null)}
          />
        </div>
      </GlassCard>

      {/* Segmented Control — iOS-style tab strip */}
      <nav
        role="tablist"
        aria-label={PROFILE_LABELS.tabsAriaLabel}
        onKeyDown={handleTabKeyDown}
        style={tabStripStyle}
      >
        {PROFILE_TABS.map((tabId) => {
          const tab = PROFILE_LABELS.tabs[tabId];
          const isActive = tabId === activeTab;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              data-profile-tab={tabId}
              id={`profile-tab-${tabId}`}
              aria-selected={isActive}
              aria-controls={`profile-panel-${tabId}`}
              aria-label={tab.aria}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tabId)}
              style={{
                ...segmentedTabStyle,
                ...(isActive ? selectedSegmentedTabStyle : idleSegmentedTabStyle),
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Panels */}
      {activeTab === "biometric" && (
        <BiometricTabContent
          profile={profile}
          email={email}
          energy={energy}
          bodyMetrics={bodyMetrics}
          age={age}
          bmi={bmi}
          saving={saving}
          update={update}
        />
      )}

      {activeTab === "gym" && (
        <GymTabContent
          gym={gym}
          onOpenWizard={() => setWizardOpen(true)}
        />
      )}

      {activeTab === "preferences" && (
        <PreferencesTabContent
          session={session}
          local={local}
          flags={flags}
          navigate={navigate}
          onSignOut={() => void supabase.auth.signOut()}
          onExport={() => exportProfile(profile, local.row)}
        />
      )}

      {wizardOpen && (
        <ImportWizard
          userId={userId}
          onClose={() => setWizardOpen(false)}
          onImported={() => setWizardOpen(false)}
        />
      )}

      {error && (
        <p role="alert" style={{ ...hintStyle, color: ACCENT.text, marginTop: SPACE.md }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- presentational

const BMI_BANDS: readonly { max: number; label: string }[] = [
  { max: 18.5, label: PROFILE_LABELS.bmiBandUnderweight },
  { max: 25, label: PROFILE_LABELS.bmiBandNormal },
  { max: 30, label: PROFILE_LABELS.bmiBandOverweight },
  { max: Infinity, label: PROFILE_LABELS.bmiBandObese },
];

function bmiBand(bmi: number): string {
  return BMI_BANDS.find((band) => bmi < band.max)?.label ?? "";
}

/**
 * An individual box in the physiological HUD strip.
 *
 * Crystal fill, hairline border, a small label and a large numeric value.
 */
function HudBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={hudBoxStyle}>
      <span style={hudLabelStyle}>{label}</span>
      <span style={hudValueStyle}>{value}</span>
    </div>
  );
}

/**
 * A thin crystal pill for single-select choices — experience level, activity,
 * goal.  Transparent background always; only the border and text colour shift
 * when selected, per the design brief.
 */
function CrystalPillRow<T extends string>({
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
              ...crystalPillBaseStyle,
              ...(active ? crystalPillActiveStyle : crystalPillIdleStyle),
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** iOS-style grouped form section: a crystal container with a captioned field. */
function GroupedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={groupedSectionStyle}>
      <span style={fieldLabelStyle}>{title}</span>
      {children}
    </div>
  );
}

/**
 * Macro card — a single-line summary of the daily energy budget split.
 *
 * Shows the TDEE target and the three macronutrient grams in the format the
 * design brief specifies: "2291 kcal · 120g Prot · 280g Carb · 65g Grasas".
 */
function MacroCard({ energy }: { energy: EnergyReport | null }) {
  if (!energy || energy.target <= 0) {
    return null;
  }

  return (
    <GlassCard style={{ marginBottom: SPACE.lg }}>
      <h2 style={macroCardTitleStyle}>{PROFILE_LABELS.energyLabel}</h2>
      <p style={macroSummaryStyle}>
        {PROFILE_LABELS.energyMacroSummary(
          energy.target,
          energy.proteinGrams ?? 0,
          energy.carbsGrams ?? 0,
          energy.fatGrams ?? 0,
        )}
      </p>
      <div style={macroGridStyle}>
        <MacroCell label={PROFILE_LABELS.energyProtein} value={`${energy.proteinGrams ?? PROFILE_LABELS.notSet} g`} />
        <MacroCell label={PROFILE_LABELS.energyCarbs} value={`${energy.carbsGrams ?? PROFILE_LABELS.notSet} g`} />
        <MacroCell label={PROFILE_LABELS.energyFats} value={`${energy.fatGrams ?? PROFILE_LABELS.notSet} g`} />
      </div>
      {energy.clampedByFloor && (
        <p style={{ ...hintStyle, color: ACCENT.text, marginTop: SPACE.sm }}>
          {PROFILE_LABELS.energyFloorNote(energy.floor)}
        </p>
      )}
    </GlassCard>
  );
}

function MacroCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={macroCellStyle}>
      <dt style={macroLabelStyle}>{label}</dt>
      <dd style={macroValueStyle}>{value}</dd>
    </div>
  );
}

// ----------------------------------------------------------------- tab contents

function BiometricTabContent({
  profile,
  email,
  energy,
  bodyMetrics,
  age,
  bmi,
  saving,
  update,
}: {
  profile: Profile;
  email: string;
  energy: EnergyReport | null;
  bodyMetrics: ReturnType<typeof useBodyMetrics>;
  age: number | null;
  bmi: number | null;
  saving: boolean;
  update: (patch: Partial<Profile>) => Promise<boolean>;
}) {
  return (
    <>
      <GroupedSection title={PROFILE_LABELS.identityLabel}>
        <input
          type="text"
          value={profile.display_name ?? ""}
          placeholder={PROFILE_LABELS.namePlaceholder}
          onChange={(event) => void update({ display_name: event.target.value })}
          style={inputStyle}
          disabled={saving}
        />
        <dl style={readoutGridStyle}>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.emailLabel}</dt>
            <dd style={readoutValueStyle}>{email || PROFILE_LABELS.notSet}</dd>
          </div>
        </dl>
      </GroupedSection>

      <GroupedSection title={PROFILE_LABELS.bodyLabel}>
        <dl style={readoutGridStyle}>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.birthDateLabel}</dt>
            <dd style={readoutValueStyle}>{profile.birth_date ?? PROFILE_LABELS.notSet}</dd>
          </div>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.ageLabel}</dt>
            <dd style={readoutValueStyle}>
              {age === null
                ? PROFILE_LABELS.notSet
                : age < 18
                  ? PROFILE_LABELS.ageMinor(age)
                  : PROFILE_LABELS.ageYears(age)}
            </dd>
          </div>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.sexLabel}</dt>
            <dd style={readoutValueStyle}>{profile.sex ? (SEX_LABELS[profile.sex] ?? profile.sex) : PROFILE_LABELS.notSet}</dd>
          </div>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.heightLabel}</dt>
            <dd style={readoutValueStyle}>
              {profile.height_cm === null
                ? PROFILE_LABELS.notSet
                : profile.unit_system === "imperial"
                  ? `${cmToIn(profile.height_cm)} in`
                  : `${profile.height_cm} cm`}
            </dd>
          </div>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.weightLabel}</dt>
            <dd style={readoutValueStyle}>
              {profile.weight_kg === null
                ? PROFILE_LABELS.notSet
                : profile.unit_system === "imperial"
                  ? `${kgToLb(profile.weight_kg)} lb`
                  : `${profile.weight_kg} kg`}
            </dd>
          </div>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.bodyMassIndex}</dt>
            <dd style={readoutValueStyle}>
              {bmi === null ? PROFILE_LABELS.notSet : `${bmi} · ${bmiBand(bmi)}`}
            </dd>
          </div>
        </dl>
      </GroupedSection>

      <MacroCard energy={energy} />

      <GroupedSection title={PROFILE_LABELS.trainingLabel}>
        <div style={{ marginBottom: SPACE.md }}>
          <span style={fieldLabelStyle}>{PROFILE_LABELS.experienceLabel}</span>
          <CrystalPillRow<Profile["experience_level"]>
            values={(["beginner", "intermediate", "advanced"] as const).map((v) => ({
              value: v,
              label: EXPERIENCE_LABELS[v],
            }))}
            selected={profile.experience_level}
            onSelect={(value) => void update({ experience_level: value })}
          />
        </div>

        <div style={{ marginBottom: SPACE.md }}>
          <span style={fieldLabelStyle}>{PROFILE_LABELS.activityLabel}</span>
          <CrystalPillRow<Profile["activity_level"]>
            values={(Object.keys(ACTIVITY_LABELS) as Profile["activity_level"][]).map((v) => ({
              value: v,
              label: `${ACTIVITY_LABELS[v]} ×${ACTIVITY_FACTORS[v]}`,
            }))}
            selected={profile.activity_level}
            onSelect={(value) => void update({ activity_level: value })}
          />
        </div>

        <div style={{ marginBottom: SPACE.md }}>
          <span style={fieldLabelStyle}>{PROFILE_LABELS.goalLabel}</span>
          <CrystalPillRow<Profile["goal"]>
            values={(["lose_weight", "gain_muscle", "strength", "maintain", "endurance"] as const).map(
              (v) => ({ value: v, label: GOAL_LABELS[v] }),
            )}
            selected={profile.goal}
            onSelect={(value) => void update({ goal: value })}
          />
        </div>
      </GroupedSection>

      <GroupedSection title={PROFILE_LABELS.weightTrendTitle}>
        <WeightTrend
          weights={bodyMetrics.weights}
          loading={bodyMetrics.loading}
          unitSystem={profile.unit_system}
          latestWeight={bodyMetrics.latestWeight}
          changeLast30Days={bodyMetrics.changeLast30Days}
        />
      </GroupedSection>
    </>
  );
}

function GymTabContent({
  gym,
  onOpenWizard,
}: {
  gym: ReturnType<typeof useGymSettings>;
  onOpenWizard: () => void;
}) {
  return (
    <>
      <GroupedSection title={PROFILE_LABELS.gymSettingsLabel}>
        <p style={{ ...mutedStyle, margin: `0 0 ${SPACE.md}` }}>{PROFILE_LABELS.gymSettingsHint}</p>
        <p style={{ ...hintStyle, margin: `0 0 ${SPACE.md}` }}>
          {GYM_LABELS.barWeightSummary(gym.barKg)}
          {" "}
          {GYM_LABELS.platesSummary(configuredSizes(gym.inventory))}
        </p>
        <GymSettingsTrigger context={GYM_LABELS.profileTriggerContext} />
      </GroupedSection>

      <GroupedSection title={PROFILE_LABELS.importLabel}>
        <p style={{ ...mutedStyle, margin: `0 0 ${SPACE.md}` }}>{PROFILE_LABELS.importHint}</p>
        <GlassButton
          variant="secondary"
          icon={<Upload size={16} aria-hidden="true" />}
          onClick={onOpenWizard}
        >
          {PROFILE_LABELS.importOpen}
        </GlassButton>
      </GroupedSection>
    </>
  );
}

interface PreferencesTabContentProps {
  session: { userId: string | null; role: string; loading: boolean };
  local: ReturnType<typeof useLocalState>;
  flags: LocalStateRow["flags"];
  navigate: ReturnType<typeof useNavigate>;
  onSignOut: () => void;
  onExport: () => void;
}

function PreferencesTabContent({
  session,
  local,
  flags,
  navigate,
  onSignOut,
  onExport,
}: PreferencesTabContentProps) {
  return (
    <>
      <GroupedSection title={PROFILE_LABELS.devLabel}>
        <p style={{ ...hintStyle, margin: `0 0 ${SPACE.md}` }}>
          {session.loading
            ? PROFILE_LABELS.loading
            : `${PROFILE_LABELS.godRoleTitle}: ${BADGE_ROLE[session.role] ?? session.role}`}
        </p>
      </GroupedSection>

      <DeveloperGate fallback={null}>
        <GroupedSection title={PROFILE_LABELS.godTitle}>
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
        </GroupedSection>
      </DeveloperGate>

      <GroupedSection title={PROFILE_LABELS.premiumLabel}>
        <PremiumCoachCard onCoachPress={() => void navigate(COACH_PATH)} />
      </GroupedSection>

      <GroupedSection title={PROFILE_LABELS.exportTitle}>
        <p style={{ ...mutedStyle, margin: `0 0 ${SPACE.md}` }}>{PROFILE_LABELS.exportHint}</p>
        <GlassButton variant="secondary" icon={<Upload size={16} aria-hidden="true" />} onClick={onExport}>
          {PROFILE_LABELS.exportButton}
        </GlassButton>
      </GroupedSection>

      <GlassButton
        variant="ghost"
        icon={<LogOut size={16} aria-hidden="true" />}
        onClick={onSignOut}
      >
        {PROFILE_LABELS.signOut}
      </GlassButton>
    </>
  );
}

// ----------------------------------------------------------------- weight trend

interface WeightTrendProps {
  weights: BodyweightEntry[];
  loading: boolean;
  unitSystem: "metric" | "imperial";
  latestWeight: number | null;
  changeLast30Days: number | null;
}

function WeightTrend({ weights, loading, unitSystem, latestWeight, changeLast30Days }: WeightTrendProps) {
  const unit = unitSystem === "imperial" ? "lb" : "kg";

  if (loading) {
    return (
      <Skeleton
        variant="block"
        height="64px"
        style={{ borderRadius: RADIUS.control, backgroundColor: GLASS.fillRaised }}
      />
    );
  }

  if (weights.length === 0) {
    return <p style={mutedStyle}>{PROFILE_LABELS.weightTrendEmpty}</p>;
  }

  const sorted = [...weights].reverse();
  const visible = sorted.slice(-12);
  const min = Math.min(...sorted.map((w) => w.weight_kg));
  const max = Math.max(...sorted.map((w) => w.weight_kg));
  const range = max - min || 1;

  const displayLatest = latestWeight !== null
    ? unitSystem === "imperial"
      ? kgToLb(latestWeight)
      : Math.round(latestWeight * 10) / 10
    : null;

  const displayChange = changeLast30Days !== null
    ? unitSystem === "imperial"
      ? kgToLb(changeLast30Days)
      : changeLast30Days
    : null;

  return (
    <div style={trendContainerStyle}>
      <div style={chartBackgroundStyle}>
        {visible.map((entry, i) => {
          const heightPct = ((entry.weight_kg - min) / range) * 100;
          const isLatest = i === visible.length - 1;
          return (
            <div
              key={entry.id}
              aria-label={`${entry.weight_kg} ${unit}, ${formatDateShort(entry.measured_on)}`}
              style={{
                height: `${Math.max(heightPct, 20)}%`,
                ...(isLatest ? latestBarStyle : barStyle),
              }}
            />
          );
        })}
      </div>
      <div style={trendSummaryStyle}>
        {displayLatest !== null && (
          <span style={trendValueStyle}>
            {displayLatest} {unit}
          </span>
        )}
        {displayChange !== null && (
          <span style={{
            ...trendChangeStyle,
            color: displayChange >= 0 ? STATUS.progression.text : STATUS.warning.text,
          }}>
            {displayChange >= 0 ? "+" : ""}{displayChange} {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- premium coach

function PremiumCoachCard({ onCoachPress }: { onCoachPress: () => void }) {
  return (
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
        <h3 style={{
          margin: 0,
          fontSize: TYPE.subhead.size,
          lineHeight: TYPE.subhead.lineHeight,
          fontWeight: TYPE.subhead.weight,
          color: TEXT.primary,
        }}>
          {PROFILE_LABELS.premiumCoachName}
        </h3>
        <p style={{ ...mutedStyle, margin: `${SPACE.xs} 0 ${SPACE.md}` }}>
          {PROFILE_LABELS.premiumCoachHint}
        </p>
        <ul style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.xs,
          margin: `0 0 ${SPACE.md}`,
          padding: 0,
          listStyle: "none",
        }}>
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
              <Check
                size={14}
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 1, color: ACCENT.text }}
              />
              {feature}
            </li>
          ))}
        </ul>
        <GlassButton
          variant="secondary"
          icon={<ArrowRight size={16} aria-hidden="true" />}
          onClick={onCoachPress}
        >
          {PROFILE_LABELS.premiumOpen}
        </GlassButton>
      </div>
    </div>
  );
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
  marginBottom: SPACE.xs,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const readoutGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: SPACE.md,
  margin: 0,
};

const readoutLabelStyle: CSSProperties = {
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const readoutValueStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: TYPE.body.size,
  color: TEXT.primary,
  fontVariantNumeric: NUMERIC.align,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: `${SPACE.sm} ${SPACE.md}`,
  borderRadius: RADIUS.control,
  border: `1px solid ${SOLID.borderStrong}`,
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.body.size,
};

// Hero header -----------------------------------------------

const heroCardStyle: CSSProperties = {
  marginBottom: SPACE.xl,
  padding: SPACE.card,
};

const heroBodyStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.md,
  marginBottom: SPACE.lg,
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.hero.size,
  fontWeight: TYPE.hero.weight,
  color: TEXT.primary,
};

const avatarStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 64,
  height: 64,
  flexShrink: 0,
  borderRadius: RADIUS.round,
  backgroundColor: ACCENT.subtle,
  color: ACCENT.text,
  boxShadow: ACCENT.ring,
};

const avatarTextStyle: CSSProperties = {
  fontSize: TYPE.display.size,
  fontWeight: TYPE.display.weight,
  fontVariantNumeric: NUMERIC.align,
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.xs,
  padding: `0 ${SPACE.sm}`,
  height: MOTION.minTouchTarget,
  borderRadius: RADIUS.pill,
  border: `1px solid ${GLASS.borderStrong}`,
  backgroundColor: GLASS.fill,
  fontSize: TYPE.caption.size,
  fontWeight: 600,
  color: TEXT.secondary,
  cursor: "default",
};

const badgeProStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.xs,
  padding: `0 ${SPACE.sm}`,
  height: MOTION.minTouchTarget,
  borderRadius: RADIUS.pill,
  border: `1px solid ${ACCENT.border}`,
  backgroundColor: ACCENT.subtle,
  fontSize: TYPE.caption.size,
  fontWeight: 700,
  color: ACCENT.text,
  cursor: "default",
};

// HUD --------------------------------------------------------

const hudStyle: CSSProperties = {
  display: "flex",
  gap: SPACE.sm,
  flexWrap: "wrap",
};

const hudBoxStyle: CSSProperties = {
  flex: "1 1 0",
  minHeight: MOTION.minTouchTarget,
  padding: SPACE.md,
  borderRadius: RADIUS.control,
  backgroundColor: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  textAlign: "center",
};

const hudLabelStyle: CSSProperties = {
  display: "block",
  fontSize: TYPE.caption.size,
  color: TEXT.tertiary,
  marginBottom: SPACE.xs,
};

const hudValueStyle: CSSProperties = {
  display: "block",
  fontSize: TYPE.body.size,
  fontWeight: 700,
  lineHeight: TYPE.body.lineHeight,
  color: TEXT.primary,
  fontVariantNumeric: NUMERIC.align,
};

// Segmented control -----------------------------------------

const tabStripStyle: CSSProperties = {
  display: "flex",
  gap: SPACE.xs,
  padding: SPACE.xs,
  marginBottom: SPACE.lg,
  borderRadius: RADIUS.pill,
  backgroundColor: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  overflowX: "auto",
  scrollbarWidth: "none",
};

const segmentedTabStyle: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  minHeight: MOTION.minTouchTarget,
  padding: `0 ${SPACE.md}`,
  borderRadius: RADIUS.pill,
  border: `1px solid transparent`,
  background: "transparent",
  color: TEXT.tertiary,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: `background-color ${MOTION.fast} ${MOTION.standard}, border-color ${MOTION.fast} ${MOTION.standard}, color ${MOTION.fast} ${MOTION.standard}`,
};

const selectedSegmentedTabStyle: CSSProperties = {
  backgroundColor: ACCENT.subtle,
  borderColor: ACCENT.border,
  color: TEXT.primary,
};

const idleSegmentedTabStyle: CSSProperties = {};

// Crystal pills ---------------------------------------------

const crystalPillBaseStyle: CSSProperties = {
  minHeight: MOTION.minTouchTarget,
  padding: `0 ${SPACE.md}`,
  borderRadius: RADIUS.pill,
  borderStyle: "solid",
  borderWidth: 1,
  background: "transparent",
  fontSize: TYPE.body.size,
  fontWeight: 600,
  cursor: "pointer",
  transition: `border-color ${MOTION.fast} ${MOTION.standard}, color ${MOTION.fast} ${MOTION.standard}`,
};

const crystalPillActiveStyle: CSSProperties = {
  borderColor: ACCENT.border,
  color: TEXT.primary,
  boxShadow: `0 0 0 2px ${ACCENT.glow}`,
};

const crystalPillIdleStyle: CSSProperties = {
  borderColor: GLASS.border,
  color: TEXT.secondary,
};

// Grouped sections ------------------------------------------

const groupedSectionStyle: CSSProperties = {
  marginBottom: SPACE.md,
};

// Macro card ------------------------------------------------

const macroCardTitleStyle: CSSProperties = {
  margin: `0 0 ${SPACE.sm}`,
  fontSize: TYPE.label.size,
  fontWeight: 600,
  letterSpacing: TYPE.label.tracking,
  textTransform: "uppercase",
  color: TEXT.tertiary,
};

const macroSummaryStyle: CSSProperties = {
  margin: `0 0 ${SPACE.md}`,
  fontSize: TYPE.body.size,
  fontWeight: 700,
  lineHeight: TYPE.body.lineHeight,
  color: TEXT.primary,
  fontVariantNumeric: NUMERIC.align,
};

const macroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: SPACE.md,
};

const macroCellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
};

const macroLabelStyle: CSSProperties = {
  fontSize: TYPE.caption.size,
  color: TEXT.tertiary,
  marginBottom: SPACE.xs,
};

const macroValueStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.subhead.size,
  fontWeight: 700,
  lineHeight: TYPE.subhead.lineHeight,
  color: TEXT.primary,
  fontVariantNumeric: NUMERIC.align,
};

// Weight trend ---------------------------------------------

const trendContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.md,
};

const chartBackgroundStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: SPACE.xs,
  height: 80,
  padding: SPACE.sm,
  borderRadius: RADIUS.control,
  backgroundColor: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

const barStyle: CSSProperties = {
  flex: 1,
  minHeight: 4,
  borderRadius: RADIUS.sm,
  backgroundColor: ACCENT.subtle,
};

const latestBarStyle: CSSProperties = {
  flex: 1,
  minHeight: 4,
  borderRadius: RADIUS.sm,
  backgroundColor: ACCENT.base,
};

const trendSummaryStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const trendValueStyle: CSSProperties = {
  fontSize: TYPE.mono.size,
  lineHeight: TYPE.mono.lineHeight,
  color: TEXT.primary,
};

const trendChangeStyle: CSSProperties = {
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  fontWeight: 600,
};
