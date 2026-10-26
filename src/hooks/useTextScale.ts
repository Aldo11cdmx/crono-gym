/**
 * useTextScale.ts — compute and apply text scaling preference.
 * Auto-enables large text when age >= 45, or if manually enabled.
 * Stores manual preference in local state.
 */
import { useEffect, useState } from "react";
import { loadLocalState, saveLocalState } from "@/lib/profile/localState";
import { useProfile } from "./useProfile";
import { ageFrom } from "@/lib/profile";

export function useTextScale(userId?: string | null) {
  const { profile } = useProfile(userId ?? null);
  const [largeText, setLargeTextState] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadLocalState().then((row) => {
      if (!mounted) return;
      const age = profile ? ageFrom(profile.birth_date) : null;
      const auto = age !== null && age >= 45;
      const manual = row?.accessibility?.largeTextManual === true;
      const enabled = manual || auto;
      setLargeTextState(enabled);
      if (enabled) {
        document.documentElement.setAttribute("data-text-scale", "large");
      } else {
        document.documentElement.removeAttribute("data-text-scale");
      }
    });
    return () => {
      mounted = false;
    };
  }, [profile?.birth_date, userId]);

  const setLargeText = async (enabled: boolean) => {
    setLargeTextState(enabled);
    if (enabled) {
      document.documentElement.setAttribute("data-text-scale", "large");
    } else {
      document.documentElement.removeAttribute("data-text-scale");
    }
    await saveLocalState({
      accessibility: {
        largeText: enabled,
        largeTextManual: enabled,
      },
    });
  };

  return { largeText, setLargeText };
}
