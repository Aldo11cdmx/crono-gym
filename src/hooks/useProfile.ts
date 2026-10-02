/**
 * useProfile.ts — reads and writes the current user's profile and body metrics.
 *
 * The `profiles` row is created by a database trigger on sign-up, so reads are a
 * single `maybeSingle()` rather than an insert-or-fetch. Writes go through the
 * same RLS policy as everything else.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@lib/supabase";
import {
  computeEnergyTargets,
  type EnergyReport,
  type Profile,
  type UnitSystem,
} from "../lib/profile";
import type { BodyMeasurement, BodyweightEntry, SessionCheckin } from "@/types/supabase";

/** How many weigh-ins to load for the trend chart. */
const WEIGHT_WINDOW = 90;

export interface ProfileState {
  profile: Profile | null;
  energy: EnergyReport | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  update: (patch: Partial<Profile>) => Promise<boolean>;
}

/**
 * Maps a database row onto the app-level {@link Profile}, defaulting the
 * non-nullable enum columns that PostgREST may still hand back as strings.
 */
function toProfile(row: Record<string, unknown>): Profile {
  return {
    user_id: String(row.user_id),
    display_name: (row.display_name as string | null) ?? null,
    birth_date: (row.birth_date as string | null) ?? null,
    sex: (row.sex as Profile["sex"]) ?? null,
    height_cm: (row.height_cm as number | null) ?? null,
    weight_kg: (row.weight_kg as number | null) ?? null,
    unit_system: (row.unit_system as UnitSystem) ?? "metric",
    experience_level: (row.experience_level as Profile["experience_level"]) ?? "beginner",
    activity_level: (row.activity_level as Profile["activity_level"]) ?? "moderate",
    goal: (row.goal as Profile["goal"]) ?? "maintain",
    guardian_consent_at: (row.guardian_consent_at as string | null) ?? null,
    onboarding_completed_at: (row.onboarding_completed_at as string | null) ?? null,
  };
}

export function useProfile(userId: string | null): ProfileState {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (err) setError(err.message);
    else if (data) setProfile(toProfile(data as Record<string, unknown>));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Patch the profile. Returns false (and surfaces the message) on failure. */
  const update = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return false;
      setSaving(true);
      setError(null);

      // user_id is the PK and is never client-writable. An explicit delete
      // rather than a destructure so `noUnusedLocals` cannot mask it.
      const safe: Partial<Profile> = { ...patch };
      delete safe.user_id;
      const { data, error: err } = await supabase
        .from("profiles")
        .update(safe)
        .eq("user_id", userId)
        .select("*")
        .single();

      setSaving(false);
      if (err) {
        setError(err.message);
        return false;
      }
      if (data) setProfile(toProfile(data as Record<string, unknown>));
      return true;
    },
    [userId],
  );

  // Recomputed whenever the profile changes so the UI never shows a stale target.
  const energy = useMemo(
    () => (profile ? computeEnergyTargets(profile) : null),
    [profile],
  );

  return { profile, energy, loading, saving, error, refresh, update };
}

export interface BodyMetricsState {
  weights: BodyweightEntry[];
  latestWeight: number | null;
  changeLast30Days: number | null;
  measurements: BodyMeasurement[];
  checkins: SessionCheckin[];
  loading: boolean;
  error: string | null;
  logWeight: (weightKg: number, measuredOn?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Bodyweight history, measurements and check-ins.
 *
 * Weigh-ins upsert on (user_id, measured_on), so re-weighing on the same day
 * overwrites rather than adding a second row for that date.
 */
export function useBodyMetrics(userId: string | null): BodyMetricsState {
  const [weights, setWeights] = useState<BodyweightEntry[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [checkins, setCheckins] = useState<SessionCheckin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWeights([]);
      setMeasurements([]);
      setCheckins([]);
      return;
    }
    setLoading(true);
    setError(null);

    const [w, m, c] = await Promise.all([
      supabase
        .from("bodyweight_entries")
        .select("*")
        .eq("user_id", userId)
        .order("measured_on", { ascending: false })
        .limit(WEIGHT_WINDOW),
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_on", { ascending: false })
        .limit(12),
      supabase
        .from("session_checkins")
        .select("*")
        .eq("user_id", userId)
        .order("checked_on", { ascending: false })
        .limit(30),
    ]);

    if (w.error) setError(w.error.message);
    if (m.error) setError(m.error.message);
    if (c.error) setError(c.error.message);

    setWeights((w.data ?? []) as BodyweightEntry[]);
    setMeasurements((m.data ?? []) as BodyMeasurement[]);
    setCheckins((c.data ?? []) as SessionCheckin[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logWeight = useCallback(
    async (weightKg: number, measuredOn?: string) => {
      if (!userId) return false;
      setError(null);
      const { error: err } = await supabase.from("bodyweight_entries").upsert(
        {
          user_id: userId,
          measured_on: measuredOn ?? new Date().toISOString().slice(0, 10),
          weight_kg: weightKg,
        },
        { onConflict: "user_id,measured_on" },
      );
      if (err) {
        setError(err.message);
        return false;
      }
      await refresh();
      return true;
    },
    [userId, refresh],
  );

  const latestWeight = weights[0]?.weight_kg ?? null;

  /**
   * Net change over the trailing 30 days.
   *
   * Compares against the newest entry at or before the cutoff rather than
   * "30 days ago", so a user who skipped a week still gets a real delta.
   */
  const changeLast30Days = useMemo(() => {
    if (weights.length < 2) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffKey = cutoff.toISOString().slice(0, 10);

    const baseline =
      weights.find((w) => w.measured_on <= cutoffKey) ?? weights[weights.length - 1];
    const latest = weights[0];
    if (!baseline || !latest || baseline.id === latest.id) return null;

    return Math.round((latest.weight_kg - baseline.weight_kg) * 10) / 10;
  }, [weights]);

  return {
    weights,
    latestWeight,
    changeLast30Days,
    measurements,
    checkins,
    loading,
    error,
    logWeight,
    refresh,
  };
}