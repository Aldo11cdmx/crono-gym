import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Dumbbell, Lock, LogOut, Play, TrendingUp, type LucideIcon } from "lucide-react";
import { supabase } from "@lib/supabase";
import { ActiveWorkout } from "./components/ActiveWorkout";
import { AuthModal } from "./components/AuthModal";
import { CronosLogo } from "./components/CronosLogo";
import { Onboarding } from "./components/Onboarding";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { AnatomicalRanksView } from "./components/AnatomicalRanksView";
import { RoutineBuilder } from "./components/RoutineBuilder";
import {
  useProgress,
  useRoutines,
  type RoutineWithExercises,
} from "./hooks/useGymData";
import { useProfile } from "./hooks/useProfile";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { clearRankData } from "./lib/ranks/rankHistory";
import { computeEnergyTargets } from "./lib/profile";

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { ready, userId, email } = useAuthSession();
  const {
    profile,
    energy,
    loading: profileLoading,
    update: updateProfile,
  } = useProfile(userId);

  // Mounted app-wide, not just inside a workout: a session finished offline has
  // to reach the server on reconnect even if the user never starts another one.
  const sync = useOfflineSync(Boolean(userId));

  // A signed-in user without a completed onboarding goes straight into the
  // wizard; every other view stays unreachable until then.
  const needsOnboarding =
    Boolean(userId) && profile !== null && profile.onboarding_completed_at === null;

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

  /**
   * Signs out and drops the cached rank data.
   *
   * IndexedDB is device-wide, not user-scoped. Without this the next account to
   * sign in on this device would inherit the previous user's timeline, and -- more
   * damagingly -- their `lastRanks`, which is the hysteresis input: they would
   * start holding a rank they never earned and the demotion buffer would defend
   * it. Cleared before the sign-out resolves so a failed sign-out does not leave
   * signed-in state with no cached ranks.
   */
  const signOut = useCallback(async () => {
    await clearRankData();
    await supabase.auth.signOut();
  }, []);

  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  // Tabs other than the welcome view need a session. Selecting one while logged
  // out still moves the view (so the prompt can name it) and pops the modal.
  const requestView = useCallback(
    (next: View) => {
      setView(next);
      if (!ready || userId || next === "hoy") return;
      setIsAuthModalOpen(true);
    },
    [ready, userId],
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="flex items-center gap-2.5">
            <CronosLogo size={30} />
            <span className="hidden text-lg font-semibold tracking-[0.18em] text-neutral-50 sm:inline">
              CRONOS
            </span>
          </h1>
          <nav className="flex items-center gap-1 text-sm text-neutral-400">
            {TABS.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                active={view === tab.id}
                locked={
                  (ready && !userId && tab.id !== "hoy") || needsOnboarding
                }
                onSelect={requestView}
              />
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {sync.pending > 0 && !sync.online && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
            <p className="text-xs text-amber-200">
              Sin conexión: {sync.pending === 1 ? "1 sesión" : `${sync.pending} sesiones`}{" "}
              esperando sincronizar. Están guardadas en este dispositivo y se
              enviarán solas al recuperar la red.
            </p>
            <button
              type="button"
              onClick={() => void sync.syncNow()}
              className="rounded-lg border border-amber-500/40 px-3 py-1 text-[11px] text-amber-200 transition hover:bg-amber-500/10"
            >
              Reintentar
            </button>
          </div>
        )}
        {!ready ? (
          <p className="text-neutral-500">Cargando…</p>
        ) : !userId ? (
          <Welcome view={view} onOpenAuth={() => setIsAuthModalOpen(true)} />
        ) : needsOnboarding ? (
          profileLoading || profile === null ? (
            <p className="text-neutral-500">Cargando tu perfil…</p>
          ) : (
            <Onboarding
              profile={profile}
              onSave={updateProfile}
              onFinish={() => setView("hoy")}
            />
          )
        ) : (
          <>
            <WorkspaceHeader
              email={email}
              energy={energy}
              onSignOut={() => void signOut()}
            />
            {view === "hoy" && (
              <TodayView
                userId={userId}
                session={session}
                onStartSession={startSession}
                onEndSession={endSession}
              />
            )}
            {view === "rutinas" && (
              <RoutinesView userId={userId} onStartSession={startSession} />
            )}
            {view === "progreso" && <ProgressView userId={userId} />}
          </>
        )}
      </main>

      {/* Rendered outside the gate so it stays reachable in both auth states. */}
      <AuthModal
        open={isAuthModalOpen}
        onClose={closeAuthModal}
        onAuthenticated={closeAuthModal}
      />
    </div>
  );
}

/** Tracks the Supabase session; onAuthStateChange keeps the UI in sync after login. */
function useAuthSession() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

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

  return { ready, userId, email };
}

function TabButton({
  tab,
  active,
  locked,
  onSelect,
}: {
  tab: { id: View; label: string; icon: LucideIcon };
  active: boolean;
  locked: boolean;
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
      {locked && <Lock className="h-3 w-3 text-neutral-600" aria-hidden="true" />}
    </button>
  );
}

function WorkspaceHeader({
  email,
  energy,
  onSignOut,
}: {
  email: string;
  energy: ReturnType<typeof computeEnergyTargets> | null;
  onSignOut: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-neutral-500">Sesión de {email || "invitado"}</p>
        {energy && energy.maintenance > 0 && (
          <span
            className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-neutral-400"
            title="Objetivo diario de energía (Mifflin-St Jeor)"
          >
            Objetivo:{" "}
            <span className="font-semibold text-accent">{energy.target} kcal</span>
            {energy.clampedByFloor && (
              <span className="ml-1 text-amber-400/80">
                (mínimo legal {energy.floor})
              </span>
            )}
          </span>
        )}
      </div>
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

function Welcome({ view, onOpenAuth }: { view: View; onOpenAuth: () => void }) {
  // When a locked tab was selected, name the section so the prompt is specific.
  const requested = TABS.find((t) => t.id === view && t.id !== "hoy");

  return (
<div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-neutral-900/60 p-8 text-center shadow-glass">
          <div className="mb-5 flex justify-center">
            <CronosLogo size={64} showWordmark />
          </div>
          {requested ? (
        <>
          <Lock className="mx-auto mb-3 h-7 w-7 text-accent" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-neutral-50">Inicia sesión para ver {requested.label}</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Esta sección necesita una cuenta para guardar tus datos y mostrar tu progreso.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-neutral-50">Bienvenido a Cronos</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Gestiona tus rutinas y registra cada serie para ver tu progreso.
          </p>
        </>
      )}
      <button
        type="button"
        onClick={onOpenAuth}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
      >
        Iniciar sesión
      </button>
      <p className="mt-3 text-xs text-neutral-500">
        También puedes explorar <span className="text-neutral-400">Diario de Hoy</span> sin
        conectar, aunque las sesiones no se guardarán.
      </p>
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

  /**
   * Segment inside the progress tab.
   *
   * A tab, not a route: the app has no router and the two views answer the same
   * question ("how am I doing") from different angles. The ranks are the deeper
   * answer, so the sessions summary stays first.
   */
  const [section, setSection] = useState<ProgressSection>("resumen");
  const [pendingFilter, setPendingFilter] = useState<string | null>(null);

  const browseMuscle = useCallback((slug: string) => {
    // There is no catalog route in this app: `ExerciseBrowser` lives inside the
    // routine builder and the active workout, and it reads its muscle filter from
    // the query string. So the handoff writes that param and explains where the
    // filter took effect, rather than pretending to navigate somewhere.
    const params = new URLSearchParams(window.location.search);
    params.set("musculos", slug);
    window.history.replaceState(null, "", `?${params.toString()}`);
    setPendingFilter(slug);
  }, []);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Secciones de progreso"
        className="flex rounded-lg border border-white/10 bg-neutral-900/60 p-0.5"
      >
        {(
          [
            ["resumen", "Resumen"],
            ["rangos", "Rangos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs transition ${
              section === id ? "bg-accent/15 text-accent" : "text-neutral-400 hover:text-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "resumen" ? (
        <>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <ProgressDashboard stats={stats} loading={loading} />
        </>
      ) : (
        <>
          {pendingFilter && (
            <p
              role="status"
              className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs text-accent"
            >
              Filtro aplicado. Abre el catálogo desde Rutinas para ver los
              ejercicios de este músculo.
            </p>
          )}
          <AnatomicalRanksView userId={userId} onBrowseMuscle={browseMuscle} />
        </>
      )}
    </div>
  );
}

type ProgressSection = "resumen" | "rangos";