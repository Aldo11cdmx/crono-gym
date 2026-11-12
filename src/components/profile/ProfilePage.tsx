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
  useCallback,
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
import { UserAvatar } from "@/components/common/UserAvatar";
import { useProfile, useBodyMetrics } from "@/hooks/useProfile";
import { useGymSettings } from "@/context/GymSettingsContext";
import { useLocalState } from "@/hooks/useLocalState";
import { useTextScale } from "@/hooks/useTextScale";
import { useAuth } from "@/context/AuthContext";
import { RoleSelector } from "@/components/RoleSelector";
import { setLocalRole } from "@/lib/localSession";
import {
  ACTIVITY_LABELS,
  EXPERIENCE_LABELS,
  GYM_LABELS,
  GOAL_LABELS,
  PROFILE_LABELS,
  SEX_LABELS,
} from "@/lib/i18n";
import { ACTIVITY_FACTORS, ageFrom, kgToLb, type EnergyReport, type Profile } from "@/lib/profile";
import type { LocalStateRow } from "@/lib/profile/localState";
import {
  ACCENT,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";
import type { WorkspaceOutletContext } from "@/App";
import type { BodyweightEntry } from "@/types/supabase";
import { COACH_PATH } from "@/components/shell/navItems";
import { usePermissions } from "@/hooks/usePermissions";
import { Shield, Users } from "lucide-react";

const PROFILE_TABS = ["biometric", "gym", "preferences"] as const;
type ProfileTabId = (typeof PROFILE_TABS)[number];

export function bmiOf(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

export function configuredSizes(
  inventory: Readonly<Record<number, number | undefined>>,
): number[] {
  return Object.keys(inventory)
    .map(Number)
    .filter((size) => (inventory[size] ?? 0) > 0)
    .sort((a, b) => a - b);
}

const BADGE_ROLE: Record<string, string> = {
  athlete: PROFILE_LABELS.badgeAthlete,
  developer: PROFILE_LABELS.badgeDeveloper,
  coach: PROFILE_LABELS.badgeCoach,
};

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
  const { profile, energy, loading, error, update, refresh } = useProfile(userId);
  const gym = useGymSettings();
  const local = useLocalState();
  const { largeText, setLargeText } = useTextScale(userId);
  const { activeRole, setActiveRole } = useAuth();
  const permissions = usePermissions();
  const bodyMetrics = useBodyMetrics(userId);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTabId>("biometric");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

  /**
   * Applies a new device-local role from the "Cambiar rol local" selector.
   *
   * Three writes, one intent: the shared `AuthContext` role (so every screen
   * re-renders), the `localState` row in IndexedDB (so it survives a reload), and
   * a `cronos:role-changed` event (so `useRole`/`useLocalSession` recompute now).
   * `setLocalRole` dispatches the event once the row is written.
   */
  const handleRoleChange = useCallback(
    (role: "athlete" | "coach" | "admin" | "developer") => {
      setActiveRole(role);
      void setLocalRole(role);
      setRoleNotice(`Rol local: ${BADGE_ROLE[role] ?? role}`);
    },
    [setActiveRole],
  );

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
      <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4" style={heroCardStyle}>
        <div style={heroBodyStyle}>
          <UserAvatar name={profile.display_name || "mich"} size={56} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <input
              aria-label={PROFILE_LABELS.nameLabel}
              defaultValue={profile.display_name ?? ""}
              onBlur={(event) => void update({ display_name: event.target.value })}
              className="h-11 w-full max-w-[220px] bg-transparent text-lg font-bold text-white outline-none"
            />
            <p className="m-0 text-xs text-zinc-400">{email || PROFILE_LABELS.notSet}</p>
          </div>
          <span style={badgeProStyle}>{PROFILE_LABELS.badgePro}</span>
        </div>

        {activeTab === "biometric" && <div style={hudStyle}>
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
        </div>}
      </section>

      {/* Segmented Control — iOS-style tab strip */}
      <nav
        role="tablist"
        aria-label={PROFILE_LABELS.tabsAriaLabel}
        onKeyDown={handleTabKeyDown}
        className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-[#2C2C2E] p-1"
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
              className="h-11 min-w-0 truncate rounded-lg px-2 text-xs font-semibold"
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
          energy={energy}
          bodyMetrics={bodyMetrics}
          age={age}
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
          activeRole={activeRole}
          onRoleChange={handleRoleChange}
          roleNotice={roleNotice}
          local={local}
          flags={flags}
          navigate={navigate}
          onSignOut={() => void supabase.auth.signOut()}
          onExport={() => exportProfile(profile, local.row)}
          permissions={permissions}
          largeText={largeText}
          onLargeTextChange={() => void setLargeText(!largeText)}
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
    <div>
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
    <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4" style={{ marginBottom: SPACE.lg }}>
      <h2 style={macroCardTitleStyle}>{PROFILE_LABELS.energyLabel}</h2>
      <p style={macroSummaryStyle}>{energy.target.toLocaleString("es-MX")} kcal</p>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#2C2C2E]" aria-label="Proporción de macronutrientes">
        <span className="inline-block h-full bg-[#FF3B30]" style={{ width: "30%" }} />
        <span className="inline-block h-full bg-[#FF9F0A]" style={{ width: "50%" }} />
        <span className="inline-block h-full bg-[#30D158]" style={{ width: "20%" }} />
      </div>
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
    </section>
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
  energy,
  bodyMetrics,
  age,
  update,
}: {
  profile: Profile;
  energy: EnergyReport | null;
  bodyMetrics: ReturnType<typeof useBodyMetrics>;
  age: number | null;
  update: (patch: Partial<Profile>) => Promise<boolean>;
}) {
  return (
    <>
      <GroupedSection title={PROFILE_LABELS.bodyLabel}>
        <dl style={readoutGridStyle}>
          <div className="flex items-center justify-between gap-3">
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.birthDateLabel}</dt>
            <dd style={readoutValueStyle}>{profile.birth_date ?? PROFILE_LABELS.notSet}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
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
              <span
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                aria-label={PROFILE_LABELS.heightLabel}
                onBlur={(event) => {
                  const value = Number(event.currentTarget.textContent?.replace(/[^\d.]/g, ""));
                  if (Number.isFinite(value) && value > 0) void update({ height_cm: value });
                }}
                className="font-mono text-base font-bold text-white outline-none"
              >{profile.height_cm === null ? PROFILE_LABELS.notSet : `${profile.height_cm} cm`}</span>
            </dd>
          </div>
          <div>
            <dt style={readoutLabelStyle}>{PROFILE_LABELS.weightLabel}</dt>
            <dd style={readoutValueStyle}>
              <span
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                aria-label={PROFILE_LABELS.weightLabel}
                onBlur={(event) => {
                  const value = Number(event.currentTarget.textContent?.replace(/[^\d.]/g, ""));
                  if (Number.isFinite(value) && value > 0) void update({ weight_kg: value });
                }}
                className="font-mono text-base font-bold text-white outline-none"
              >{profile.weight_kg === null ? PROFILE_LABELS.notSet : `${profile.weight_kg} kg`}</span>
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
  activeRole: "athlete" | "coach" | "admin" | "developer";
  onRoleChange: (role: "athlete" | "coach" | "admin" | "developer") => void;
  roleNotice: string | null;
  local: ReturnType<typeof useLocalState>;
  flags: LocalStateRow["flags"];
  navigate: ReturnType<typeof useNavigate>;
  onSignOut: () => void;
  onExport: () => void;
  permissions: ReturnType<typeof usePermissions>;
  largeText: boolean;
  onLargeTextChange: () => void;
}

function PreferencesTabContent({
  activeRole,
  onRoleChange,
  roleNotice,
  local,
  flags,
  navigate,
  onSignOut,
  onExport,
  permissions,
  largeText,
  onLargeTextChange,
}: PreferencesTabContentProps) {
  return (
    <>
      <GroupedSection title="Accesibilidad">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-sm text-white">Tipografía Ampliada (Modo Accesible)</span>
          <button
            type="button"
            onClick={onLargeTextChange}
            aria-pressed={largeText}
            className="h-11 rounded-full border px-4 text-sm font-semibold"
            style={{
              borderColor: largeText ? ACCENT.base : GLASS.border,
              background: largeText ? ACCENT.base : "#2C2C2E",
              color: largeText ? TEXT.onAccent : TEXT.secondary,
            }}
          >
            {largeText ? "Activado" : "Desactivado"}
          </button>
        </div>
      </GroupedSection>
      <GroupedSection title="Acceso a paneles">
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          {permissions.canAccessCoach || permissions.canAccessAdmin ? (
            <>
              <button
                type="button"
                className="flex h-11 items-center justify-between rounded-xl px-4 font-semibold"
                onClick={() => void navigate("/coach")}
              >
                <span className="flex items-center gap-2"><Users size={16} aria-hidden="true" />Ir al Portal Coach</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="flex h-11 items-center justify-between rounded-xl px-4 font-semibold"
                onClick={() => void navigate("/admin")}
              >
                <span className="flex items-center gap-2"><Shield size={16} aria-hidden="true" />Ir al Panel de Administración</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </GroupedSection>

      <GroupedSection title={PROFILE_LABELS.devLabel}>
        <p style={{ ...hintStyle, margin: `0 0 ${SPACE.md}` }}>
          {`${PROFILE_LABELS.godRoleTitle}: ${BADGE_ROLE[activeRole] ?? activeRole}`}
        </p>
        {roleNotice && (
          <p role="status" aria-live="polite" style={{ ...hintStyle, margin: `0 0 ${SPACE.md}`, color: ACCENT.text }}>
            {roleNotice}
          </p>
        )}
        <RoleSelector
          availableRoles={["athlete", "coach", "admin", "developer"]}
          activeRole={activeRole}
          onSelect={onRoleChange}
          title="Cambiar rol local"
        />
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
  paddingBottom: 128,
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

// Hero header -----------------------------------------------

const heroCardStyle: CSSProperties = {
  marginBottom: SPACE.xl,
  padding: SPACE.md,
  background: "#1C1C1E",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
};

const heroBodyStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.md,
  marginBottom: SPACE.lg,
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
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: SPACE.sm,
  marginTop: SPACE.md,
  paddingTop: SPACE.md,
  borderTop: "1px solid rgba(255,255,255,0.1)",
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
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 4,
  padding: SPACE.xs,
  marginBottom: SPACE.lg,
  borderRadius: RADIUS.pill,
  backgroundColor: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

const segmentedTabStyle: CSSProperties = {
  minWidth: 0,
  padding: `0 ${SPACE.xs}`,
  whiteSpace: "nowrap",
  flexShrink: 0,
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.pill,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",
  backgroundColor: "transparent",
  color: TEXT.tertiary,
  fontSize: TYPE.caption.size,
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
  backgroundColor: "transparent",
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
  padding: SPACE.md,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#1C1C1E",
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
  fontSize: "1.5rem",
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
  backgroundColor: "#2C2C2E",
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
