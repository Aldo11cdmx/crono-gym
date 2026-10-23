/**
 * WeeklyPlanner.tsx — re-export del plan semanal extendido.
 *
 * La implementación vive ahora en `src/components/routines/WeeklyPlanner.tsx`,
 * que soporta nombres de sesión personalizados por día (ej. "Lunes: Empuje
 * Pro"), días de descanso y acciones rápidas ("Iniciar sesión de hoy",
 * "Marcar como descanso", "Reorganizar plan"). Este archivo re-exporta el
 * componente para no romper consumidores existentes.
 */

export { WeeklyPlanner, type WeeklyPlannerProps } from "@/components/routines/WeeklyPlanner";
