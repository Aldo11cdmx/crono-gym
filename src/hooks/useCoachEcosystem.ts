import { useCallback, useEffect, useState } from "react";
import {
  coachEcosystemService,
  type CoachOffer,
  type EcosystemRequest,
  type EcosystemTemplate,
  type ExerciseRequest,
} from "@/lib/coach/coachEcosystemService";

export function useCoachEcosystem(coachId: string | null) {
  const [offer, setOffer] = useState<CoachOffer | null>(null);
  const [requests, setRequests] = useState<EcosystemRequest[]>([]);
  const [templates, setTemplates] = useState<EcosystemTemplate[]>([]);
  const [exerciseRequests, setExerciseRequests] = useState<ExerciseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!coachId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [nextOffer, nextRequests, nextTemplates, nextExerciseRequests] = await Promise.all([
      coachEcosystemService.loadOffer(coachId),
      coachEcosystemService.loadRequests(coachId),
      coachEcosystemService.loadTemplates(),
      coachEcosystemService.loadExerciseRequests(coachId),
    ]);
    setOffer(nextOffer);
    setRequests(nextRequests);
    setTemplates(nextTemplates);
    setExerciseRequests(nextExerciseRequests);
    setLoading(false);
  }, [coachId]);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    window.addEventListener(coachEcosystemService.syncEvent, listener);
    return () => window.removeEventListener(coachEcosystemService.syncEvent, listener);
  }, [refresh]);

  return {
    offer,
    requests,
    templates,
    exerciseRequests,
    loading,
    refresh,
    saveOffer: coachEcosystemService.saveOffer,
    activateAthleteVipCash: coachEcosystemService.activateAthleteVipCash,
    cloneTemplate: coachEcosystemService.cloneTemplateForUser,
    requestExercise: coachEcosystemService.requestExercise,
  };
}
