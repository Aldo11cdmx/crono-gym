import { supabase } from "@lib/supabase";
import { ROUTINE_TEMPLATES } from "@/lib/routines/routineTemplates";
import { resolveExercise } from "@/lib/routines/routineTemplates";

export type CoachOffer = {
  coachId: string;
  coachName?: string;
  priceMxn: number;
  specialty: string;
  shift: string;
  billingCycle: "mensual" | "por_rutina" | "trimestral";
  benefits: string[];
};

export type EcosystemRequest = {
  id: string;
  athleteId: string;
  coachId: string;
  status: string;
  athleteName: string;
  createdAt: string;
  priceMxn?: number;
};

export type EcosystemTemplate = {
  id: string;
  title: string;
  description: string | null;
  level: "beginner" | "intermediate" | "advanced";
  goal: string | null;
  category: string | null;
  isPublished: boolean;
  days: number;
  exercises: number;
};

export type ExerciseRequest = {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  notes: string;
  status: "pending" | "approved";
  createdAt: string;
};

const SYNC_EVENT = "cronos:ecosystem-sync";
const cacheKey = (key: string) => `cronos:ecosystem:${key}`;
const breakerKey = (key: string) => `cronos:ecosystem:breaker:${key}`;
// The remote instance may not have this optional table yet. Official templates
// and the local cache are the supported source until that schema is deployed.
const disabledRemotes = new Set<string>(["routine_templates"]);

function remoteDisabled(key: string): boolean {
  if (disabledRemotes.has(key)) return true;
  try {
    if (sessionStorage.getItem(breakerKey(key)) === "disabled") {
      disabledRemotes.add(key);
      return true;
    }
  } catch {
    // Continue with the in-memory breaker.
  }
  return false;
}

function disableRemote(key: string): void {
  disabledRemotes.add(key);
  try {
    sessionStorage.setItem(breakerKey(key), "disabled");
  } catch {
    // The in-memory breaker still prevents repeated requests in this tab.
  }
}

function emitSync(detail: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail }));
  }
}

function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify(value));
  } catch {
    // Supabase remains the source of truth when browser storage is unavailable.
  }
}

export const coachEcosystemService = {
  syncEvent: SYNC_EVENT,

  async loadOffer(coachId: string): Promise<CoachOffer> {
    const fallback = readCache<CoachOffer>(`offer:${coachId}`, {
      coachId,
      priceMxn: 450,
      billingCycle: "mensual",
      specialty: "Hipertrofia y fuerza",
      shift: "14:00 a 22:00",
      benefits: [
        "Rutina 1-a-1 adaptada a tu antropometría",
        "Revisión biomecánica en piso",
        "Ajuste de cargas quincenal",
      ],
    });
    if (remoteDisabled("coach_offers")) return fallback;
    let data: any = null;
    try {
      const response = await (supabase as any)
        .from("coach_offers")
        .select("coach_id,price_mxn,specialty,shift,billing_cycle,benefits")
        .eq("coach_id", coachId)
        .maybeSingle();
      if (response.error) {
        disableRemote("coach_offers");
        return fallback;
      }
      data = response.data;
    } catch {
      disableRemote("coach_offers");
      return fallback;
    }
    if (!data) return fallback;
    const offer = {
      coachId,
      priceMxn: Number(data.price_mxn) || fallback.priceMxn,
      specialty: data.specialty || fallback.specialty,
      shift: data.shift || fallback.shift,
      billingCycle: data.billing_cycle || fallback.billingCycle,
      benefits: Array.isArray(data.benefits) ? data.benefits : fallback.benefits,
    };
    writeCache(`offer:${coachId}`, offer);
    return offer;
  },

  async saveOffer(offer: CoachOffer): Promise<CoachOffer> {
    if (remoteDisabled("coach_offers")) {
      writeCache(`offer:${offer.coachId}`, offer);
      emitSync("offer");
      return offer;
    }
    const { error } = await (supabase as any).from("coach_offers").upsert({
      coach_id: offer.coachId,
      price_mxn: offer.priceMxn,
      specialty: offer.specialty,
      shift: offer.shift,
      billing_cycle: offer.billingCycle,
      benefits: offer.benefits,
    });
    if (error) {
      disableRemote("coach_offers");
      writeCache(`offer:${offer.coachId}`, offer);
    } else {
      writeCache(`offer:${offer.coachId}`, offer);
    }
    emitSync("offer");
    return offer;
  },

  async loadRequests(coachId: string): Promise<EcosystemRequest[]> {
    if (remoteDisabled("coach_session_requests")) {
      return readCache<EcosystemRequest[]>(`requests:${coachId}`, []);
    }
    const { data, error } = await (supabase as any)
      .from("coach_session_requests")
      .select("*")
      .eq("coach_id", coachId)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false });
    if (error) {
      disableRemote("coach_session_requests");
      return readCache<EcosystemRequest[]>(`requests:${coachId}`, []);
    }
    if (!data) return readCache<EcosystemRequest[]>(`requests:${coachId}`, []);
    const localRequests = readCache<EcosystemRequest[]>(`requests:${coachId}`, []);
    const requests = data.map((row: any) => ({
      id: row.id,
      athleteId: row.athlete_id,
      coachId: row.coach_id,
      status: row.status === "pending" ? "pending_cash_payment" : row.status,
      athleteName: localRequests.find((local) => local.athleteId === row.athlete_id)?.athleteName || "Atleta",
      createdAt: row.created_at,
    }));
    const merged = [...localRequests.filter((local) => !requests.some((remote: EcosystemRequest) => remote.id === local.id)), ...requests];
    writeCache(`requests:${coachId}`, merged);
    return merged;
  },

  async createCashRequest(athleteId: string, coachId: string, athleteName = "Atleta"): Promise<void> {
    const localRequest: EcosystemRequest = {
      id: `local-request-${Date.now()}`,
      athleteId,
      coachId,
      status: "pending_cash_payment",
      athleteName,
      createdAt: new Date().toISOString(),
    };
    const cached = readCache<EcosystemRequest[]>(`requests:${coachId}`, []);
    writeCache(`requests:${coachId}`, [localRequest, ...cached]);
    if (!remoteDisabled("coach_session_requests")) {
      const { error } = await (supabase as any).from("coach_session_requests").insert({
        athlete_id: athleteId,
        coach_id: coachId,
        status: "pending",
        athlete_notes: "Solicitud de Rutina Personalizada (Pago en Efectivo)",
      });
      if (error) disableRemote("coach_session_requests");
    }
    emitSync("coach-request");
  },

  async activateAthleteVipCash(athleteId: string, priceMxn: number): Promise<void> {
    writeCache(`vip-price:${athleteId}`, priceMxn);
    const { error } = await (supabase as any)
      .from("coach_session_requests")
      .update({ status: "active" })
      .eq("athlete_id", athleteId)
      .eq("status", "pending");
    if (error) throw error;
    emitSync("vip");
  },

  async loadTemplates(): Promise<EcosystemTemplate[]> {
    if (remoteDisabled("routine_templates")) {
      const cached = readCache<EcosystemTemplate[]>("templates", []);
      return cached.length > 0 ? cached : ROUTINE_TEMPLATES.map((template, index) => ({
        id: template.id,
        title: template.title,
        description: null,
        level: index === 0 ? "beginner" : index === 1 ? "intermediate" : "advanced",
        goal: "Hipertrofia",
        category: "Oficial",
        isPublished: true,
        days: template.days.length,
        exercises: template.days.reduce((total, day) => total + day.exercises.length, 0),
      }));
    }
    const { data, error } = await (supabase as any)
      .from("routine_templates")
      .select("id,title,description,level,goal,category,is_published,routine_template_exercises(day_index)")
      .order("created_at", { ascending: false });
    if (error) {
      disableRemote("routine_templates");
      const cached = readCache<EcosystemTemplate[]>("templates", []);
      return cached.length > 0 ? cached : ROUTINE_TEMPLATES.map((template, index) => ({
        id: template.id,
        title: template.title,
        description: null,
        level: index === 0 ? "beginner" : index === 1 ? "intermediate" : "advanced",
        goal: "Hipertrofia",
        category: "Oficial",
        isPublished: true,
        days: template.days.length,
        exercises: template.days.reduce((total, day) => total + day.exercises.length, 0),
      }));
    }
    if (!data || data.length === 0) {
      const cached = readCache<EcosystemTemplate[]>("templates", []);
      if (cached.length > 0) return cached;
      return ROUTINE_TEMPLATES.map((template, index) => ({
        id: template.id,
        title: template.title,
        description: null,
        level: index === 0 ? "beginner" : index === 1 ? "intermediate" : "advanced",
        goal: "Hipertrofia",
        category: "Oficial",
        isPublished: true,
        days: template.days.length,
        exercises: template.days.reduce((total, day) => total + day.exercises.length, 0),
      }));
    }
    const templates = data.map((row: any) => {
      const links = Array.isArray(row.routine_template_exercises) ? row.routine_template_exercises : [];
      return {
        id: row.id,
        title: row.title,
        description: row.description ?? null,
        level: row.level,
        goal: row.goal ?? null,
        category: row.category ?? null,
        isPublished: Boolean(row.is_published),
        days: new Set(links.map((link: any) => link.day_index)).size,
        exercises: links.length,
      } as EcosystemTemplate;
    });
    writeCache("templates", templates);
    return templates;
  },

  async cloneTemplateForUser(templateId: string, userId: string): Promise<string> {
    if (remoteDisabled("routine_templates")) {
      const localTemplate = ROUTINE_TEMPLATES.find((template) => template.id === templateId);
      if (!localTemplate) throw new Error("La plantilla no está disponible");
      const { data: exercises, error: exercisesError } = await (supabase as any)
        .from("exercises")
        .select("id,name,name_es");
      if (exercisesError) throw exercisesError;
      const { data: routine, error: routineError } = await (supabase as any)
        .from("routines")
        .insert({ user_id: userId, title: localTemplate.title, source: "user" })
        .select("id")
        .single();
      if (routineError || !routine) throw routineError ?? new Error("No se pudo crear la rutina");
      const links = localTemplate.days.flatMap((day, dayIndex) =>
        day.exercises.map((exercise, orderIndex) => {
          const match = resolveExercise(exercise.name, exercises ?? []);
          return match ? {
            routine_id: routine.id,
            exercise_id: match.id,
            target_sets: exercise.sets,
            rest_seconds: exercise.restSeconds,
            order_index: orderIndex,
            day_index: dayIndex,
            day_label: day.label,
            target_reps_min: exercise.repsMin,
            target_reps_max: exercise.repsMax,
          } : null;
        }).filter(Boolean),
      );
      if (links.length === 0) throw new Error("La plantilla no tiene ejercicios disponibles");
      const { error: linksError } = await (supabase as any).from("routine_exercises").insert(links);
      if (linksError) throw linksError;
      emitSync("template-cloned");
      return routine.id as string;
    }
    const { data: template, error: templateError } = await (supabase as any)
      .from("routine_templates")
      .select("id,title,description,routine_template_exercises(*)")
      .eq("id", templateId)
      .maybeSingle();
    if (templateError || !template) {
      disableRemote("routine_templates");
      throw templateError ?? new Error("Plantilla no encontrada");
    }
    const { data: routine, error: routineError } = await (supabase as any)
      .from("routines")
      .insert({ user_id: userId, title: template.title, description: template.description, source: "user" })
      .select("id")
      .single();
    if (routineError || !routine) throw routineError ?? new Error("No se pudo crear la rutina");
    const links = (template.routine_template_exercises ?? []).map((row: any) => ({
      routine_id: routine.id,
      exercise_id: row.exercise_id,
      target_sets: row.target_sets,
      rest_seconds: row.rest_seconds,
      order_index: row.order_index,
      day_index: row.day_index,
      day_label: row.day_label,
      target_reps_min: row.target_reps_min,
      target_reps_max: row.target_reps_max,
    }));
    const { error: linksError } = await (supabase as any).from("routine_exercises").insert(links);
    if (linksError) {
      await (supabase as any).from("routines").delete().eq("id", routine.id);
      throw linksError;
    }
    emitSync("template-cloned");
    return routine.id as string;
  },

  async loadExerciseRequests(coachId: string): Promise<ExerciseRequest[]> {
    if (remoteDisabled("coach_exercise_requests")) {
      return readCache<ExerciseRequest[]>(`exercise-requests:${coachId}`, []);
    }
    const { data, error } = await (supabase as any)
      .from("coach_exercise_requests")
      .select("id,name,body_part,equipment,notes,status,created_at")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: false });
    if (error) {
      disableRemote("coach_exercise_requests");
      return readCache<ExerciseRequest[]>(`exercise-requests:${coachId}`, []);
    }
    return (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      bodyPart: row.body_part,
      equipment: row.equipment,
      notes: row.notes ?? "",
      status: row.status,
      createdAt: row.created_at,
    }));
  },

  async loadAllExerciseRequests(): Promise<ExerciseRequest[]> {
    if (remoteDisabled("coach_exercise_requests")) {
      return readCache<ExerciseRequest[]>("exercise-requests:all", []);
    }
    const { data, error } = await (supabase as any)
      .from("coach_exercise_requests")
      .select("id,name,body_part,equipment,notes,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      disableRemote("coach_exercise_requests");
      return readCache<ExerciseRequest[]>("exercise-requests:all", []);
    }
    const rows = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      bodyPart: row.body_part,
      equipment: row.equipment,
      notes: row.notes ?? "",
      status: row.status,
      createdAt: row.created_at,
    }));
    writeCache("exercise-requests:all", rows);
    return rows;
  },

  async requestExercise(coachId: string, input: Omit<ExerciseRequest, "id" | "status" | "createdAt">): Promise<void> {
    if (remoteDisabled("coach_exercise_requests")) {
      const current = readCache<ExerciseRequest[]>(`exercise-requests:${coachId}`, []);
      writeCache(`exercise-requests:${coachId}`, [...current, {
        ...input, id: `local-${Date.now()}`, status: "pending", createdAt: new Date().toISOString(),
      }]);
      emitSync("exercise-request");
      return;
    }
    const { error } = await (supabase as any).from("coach_exercise_requests").insert({
      coach_id: coachId,
      name: input.name,
      body_part: input.bodyPart,
      equipment: input.equipment,
      notes: input.notes,
    });
    if (error) {
      disableRemote("coach_exercise_requests");
      const current = readCache<ExerciseRequest[]>(`exercise-requests:${coachId}`, []);
      writeCache(`exercise-requests:${coachId}`, [...current, {
        ...input,
        id: `local-${Date.now()}`,
        status: "pending",
        createdAt: new Date().toISOString(),
      }]);
    }
    emitSync("exercise-request");
  },

  async renameExerciseGlobal(exerciseId: string, newSpanishName: string): Promise<void> {
    const name = newSpanishName.trim();
    if (!name) throw new Error("El nombre no puede estar vacío");
    const { error } = await (supabase as any).from("exercises").update({ name_es: name }).eq("id", exerciseId);
    const names = readCache<Record<string, string>>("exercise-renames", {});
    writeCache("exercise-renames", { ...names, [exerciseId]: name });
    if (error) emitSync("exercise-rename-offline");
    else emitSync("exercise-rename");
  },

  resolveExerciseName(exerciseId: string, fallbackName: string): string {
    return readCache<Record<string, string>>("exercise-renames", {})[exerciseId] ?? fallbackName;
  },
};
