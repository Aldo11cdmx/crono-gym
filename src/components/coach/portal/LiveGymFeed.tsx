/**
 * LiveGymFeed.tsx — atletas entrenando ahora mismo.
 *
 * Lee `workout_logs` de hoy sin `completed_at` (sesiones abiertas) y las
 * muestra en una tarjeta Glass lateral. Usa Supabase Realtime para que el
 * feed se actualice al instante cuando un atleta inicia o termina una sesión,
 * con un poll de 60 s como red de seguridad detrás del canal.
 *
 * **RLS ya acota el resultado:** la política "coaches can read assigned
 * athletes' logs" devuelve solo los logs de atletas con una solicitud activa
 * hacia este coach. El cliente no añade `coach_id` -- eso sería un filtro
 * sobre filas que la base de datos ya negó, y obligaría a una segunda ida a
 * aprender el propio id antes de poder leer.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { TEXT, TYPE } from "@/design/tokens";
import { GlassCard, Skeleton } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { supabase } from "@lib/supabase";
import type { WorkoutLog } from "@/types/supabase";

/** Un log abierto con el nombre del atleta resuelto. */
interface OpenSession {
  logId: string;
  athleteId: string;
  athleteName: string;
  startedAt: string;
}

export function LiveGymFeed() {
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Los dos límites de hoy en ISO, para acotar `started_at` al día actual. */
  const todayBounds = (): { from: string; to: string } => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  };

  const load = useCallback(async () => {
    const { from, to } = todayBounds();

    const { data, error: readError } = await supabase
      .from("workout_logs")
      .select("id,user_id,started_at,completed_at")
      .is("completed_at", null)
      .gte("started_at", from)
      .lt("started_at", to)
      .order("started_at", { ascending: false });

    if (!mounted.current) return;

    if (readError) {
      setError(T.queueLoadError);
      setLoading(false);
      return;
    }

    const logs = (data ?? []) as WorkoutLog[];
    if (logs.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    // Nombres de atleta en una segunda lectura, igual que RequestQueue.
    const athleteIds = [...new Set(logs.map((l) => l.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", athleteIds);

    if (!mounted.current) return;

    const names = new Map<string, string>();
    for (const profile of profiles ?? []) {
      if (profile.display_name) names.set(profile.user_id, profile.display_name);
    }

    setSessions(
      logs.map((log) => ({
        logId: log.id,
        athleteId: log.user_id,
        athleteName: names.get(log.user_id) ?? T.athleteUnnamed,
        startedAt: log.started_at,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Realtime: refresca el feed al instante cuando un log cambia.
   *
   * El canal escucha insert/update/delete en `workout_logs`; RLS filtra los
   * cambios a los atletas asignados a este coach, así que nunca llega un
   * entrenamiento ajeno.
   */
  useEffect(() => {
    if (typeof supabase.channel !== "function") return;

    const channel = supabase
      .channel("live-gym-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workout_logs",
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (loading) {
    return (
      <GlassCard>
        <Skeleton />
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {error}
        </p>
      </GlassCard>
    );
  }

  if (sessions.length === 0) {
    return (
      <GlassCard>
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {T.liveFeedEmpty}
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <section aria-label={T.liveFeedTitle} className="flex flex-col gap-2">
        <p style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}>
          {T.liveFeedTitle}
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {sessions.map((session) => (
            <li key={session.logId} className="flex items-baseline justify-between gap-2">
              <span style={{ fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                {session.athleteName}
              </span>
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.tertiary,
                  whiteSpace: "nowrap",
                }}
              >
                {T.liveFeedStarted(new Date(session.startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </GlassCard>
  );
}
