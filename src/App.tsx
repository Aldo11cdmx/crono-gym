import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Dumbbell, LogOut, Play, TrendingUp, type LucideIcon } from "lucide-react";
import { supabase } from "@lib/supabase";
import { ActiveWorkout } from "./components/ActiveWorkout";
import { AuthModal } from "./components/AuthModal";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { RoutineBuilder } from "./components/RoutineBuilder";
import {
  useProgress,
  useRoutines,
  type RoutineWithExercises,
} from "./hooks/useGymData";

type View = "hoy" | "rutinas" | "progreso";

const TABS: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "hoy", label: "Diario de Hoy", icon: CalendarDays },
  { id: "rutinas", label: "Rutinas", icon: Dumbbell },
  { id: "progreso", label: "Progreso", icon: TrendingUp },
];

interface ActiveSession {
  routineId: string | null;
  title: string;
}

export function App() {
  const [view, setView] = useState<View>("hoy");
  const [session, setSession] = useState<ActiveSession | null>(null);

  const startSession = useCallback((routine: RoutineWithExercises | null) => {
    setSession(
      routine
        ? { routineId: routine.id, title: routine.title }
        : { routineId: null, title: "Sesión libre" },
    );
    setView("hoy");
  }, []);

  const endSession = useCallback(() => {
    setSession(null);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Cronos</h1>
          <nav className="flex items-center gap-1 text-sm text-neutral-400">
            {TABS.map((tab) => (
              <TabButton key={tab.id} tab={tab} active={view === tab.id} onSelect={setView} />
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <SessionGate
          view={view}
          session={session}
          onStartSession={startSession}
          onEndSession={endSession}
        />
      </main>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onSelect,
}: {
  tab: { id: View; label: string; icon: LucideIcon };
  active: boolean;
  onSelect: (view: View) => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
        active ? "bg-accent/15 text-accent" : "hover:bg-white/5 hover:text-neutral-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{tab.label}</span>
    </button>
  );
}

function SessionGate({
  view,
  session,
  onStartSession,
  onEndSession,
}: {
  view: View;
  session: ActiveSession | null;
  onStartSession: (routine: RoutineWithExercises | null) => void;
  onEndSession: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? "");
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setUserId(next?.user.id ?? null);
      setEmail(next?.user.email ?? "");
      setReady(true);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!ready) return <p className="text-neutral-500">Cargando…</p>;
  if (!userId) return <Welcome onOpenAuth={() => setAuthOpen(true)} />;

  return (
    <>
      <WorkspaceHeader email={email} onSignOut={() => supabase.auth.signOut()} />
      {view === "hoy" && (
        <TodayView
          userId={userId}
          session={session}
          onStartSession={onStartSession}
          onEndSession={onEndSession}
        />
      )}
      {view === "rutinas" && <RoutinesView userId={userId} onStartSession={onStartSession} />}
      {view === "progreso" && <ProgressView userId={userId} />}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => setAuthOpen(false)}
      />
    </>
  );
}

function WorkspaceHeader({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-neutral-500">Sesión de {email || "invitado"}</p>
      <button
        type="button"
        onClick={onSignOut}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5"
      >
        <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
      </button>
    </div>
  );
}

function Welcome({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-neutral-900/60 p-8 text-center shadow-glass">
      <h2 className="text-xl font-semibold">Bienvenido a Cronos</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Gestiona tus rutinas y registra cada serie para ver tu progreso.
      </p>
      <button
        type="button"
        onClick={onOpenAuth}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
      >
        Iniciar sesión
      </button>
    </div>
  );
}

function TodayView({
  userId,
  session,
  onStartSession,
  onEndSession,
}: {
  userId: string;
  session: ActiveSession | null;
  onStartSession: (routine: RoutineWithExercises | null) => void;
  onEndSession: () => void;
}) {
  const { routines } = useRoutines(userId);

  if (session) {
    const source = routines.find((r) => r.id === session.routineId);
    return (
      <ActiveWorkout
        userId={userId}
        routineId={session.routineId}
        routineTitle={session.title}
        planned={source?.exercises ?? []}
        onFinished={onEndSession}
      />
    );
  }

  return <StartPicker routines={routines} onStartSession={onStartSession} />;
}

function StartPicker({
  routines,
  onStartSession,
}: {
  routines: RoutineWithExercises[];
  onStartSession: (routine: RoutineWithExercises | null) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass">
      <h2 className="text-xl font-semibold tracking-tight">Entrenamiento de hoy</h2>
      <p className="mt-1 text-xs text-neutral-500">Elige una rutina o empieza desde cero.</p>

      <button
        type="button"
        onClick={() => onStartSession(null)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
      >
        <Play className="h-4 w-4" /> Sesión libre
      </button>

      {routines.length === 0 ? (
        <p className="mt-4 text-xs text-neutral-500">
          Aún no tienes rutinas. Créala desde la pestaña Rutinas.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {routines.map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                onClick={() => onStartSession(routine)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2.5 text-left transition hover:border-accent/50"
              >
                <span className="truncate text-sm">{routine.title}</span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {routine.exercises.length} ejercicios
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoutinesView({
  userId,
  onStartSession,
}: {
  userId: string;
  onStartSession: (routine: RoutineWithExercises) => void;
}) {
  const { routines, loading, refresh } = useRoutines(userId);
  return (
    <RoutineBuilder
      userId={userId}
      routines={routines}
      loading={loading}
      onChanged={() => void refresh()}
      onStart={onStartSession}
    />
  );
}

function ProgressView({ userId }: { userId: string }) {
  const { stats, loading, error } = useProgress(userId);
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <ProgressDashboard stats={stats} loading={loading} />
    </div>
  );
}