import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Dumbbell, Lock, LogOut, Play, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { ActiveWorkout } from "./components/ActiveWorkout";
import { AuthModal } from "./components/AuthModal";
import { CronosLogo } from "./components/CronosLogo";
import { BrandLockup } from "./components/shell/BrandLockup";
import { Onboarding } from "./components/Onboarding";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { AnatomicalRanksView } from "./components/AnatomicalRanksView";
import { CoachHub } from "./components/coach/CoachHub";
import { RoutineBuilder } from "./components/RoutineBuilder";
import { useActiveSession } from "./context/ActiveSessionContext";
import { TRAIN_PATH } from "./components/shell/navItems";
import { MUSCLE_PARAM } from "./lib/muscleFilter";
import {
  useProgress,
  useRoutines,
  type RoutineWithExercises,
} from "./hooks/useGymData";
import { useProfile } from "./hooks/useProfile";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { clearRankData } from "./lib/ranks/rankHistory";
import { clearAllChats } from "./lib/ai/chatStorage";
import { computeEnergyTargets } from "./lib/profile";

/**
 * The header tabs, which are the routes this app shipped before it had a router.
 *
 * `/biblioteca` carries the routine builder and `/progreso` the progress view;
 * both are reachable from the bottom navigation too. Kept here rather than in
 * `router.tsx` so the router declares routes and this module owns their labels.
 *
 * Not every destination belongs here, and the two lists answer different questions.
 * `NAV_DESTINATIONS` is the thumb zone: what you reach for mid-set with one hand,
 * which is why it stays at five and why the raised centre item has to stay the
 * middle one. These are the surfaces you visit on purpose -- progress, and now the
 * coach -- so they get a header tab and a real address without spending a slot in
 * the bar. The labels are `hidden sm:inline`, so on a phone this row is icons.
 */
export const APP_TABS: ReadonlyArray<{ path: string; label: string; icon: LucideIcon }> = [
  { path: "/", label: "Diario de Hoy", icon: CalendarDays },
  { path: "/biblioteca", label: "Rutinas", icon: Dumbbell },
  { path: "/progreso", label: "Progreso", icon: TrendingUp },
  { path: "/coach", label: "Coach", icon: Sparkles },
];

/**
 * Exact-path comparison, so `/` does not claim to be active on every route.
 *
 * The header routes are literals with no parameters, so a prefix match would be
 * more machinery than the problem deserves.
 */
export function isTabActive(path: string, pathname: string): boolean {
  return pathname === path;
}

/**
 * The authenticated workspace.
 *
 * A layout route element rather than a component: it renders the chrome and the
 * gate, and the router decides which view lands in its `<Outlet />`. This is what
 * replaced the `useState<View>` switch, and it is why the session state below
 * survives navigating between views -- a layout is not unmounted by its children
 * changing.
 */
export function AuthGate() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { ready, userId, email } = useAuthSession();
  const {
    profile,
    energy,
    loading: profileLoading,
    update: updateProfile,
  } = useProfile(userId);
  const location = useLocation();
  const navigate = useNavigate();

  // Mounted app-wide, not just inside a workout: a session finished offline has
  // to reach the server on reconnect even if the user never starts another one.
  const sync = useOfflineSync(Boolean(userId));

  // A signed-in user without a completed onboarding goes straight into the
  // wizard; every other view stays unreachable until then.
  const needsOnboarding =
    Boolean(userId) && profile !== null && profile.onboarding_completed_at === null;

  /**
   * Signs out and drops the cached rank data.
   *
   * IndexedDB is device-wide, not user-scoped. Without this the next account to
   * sign in on this device would inherit the previous user's timeline, and -- more
   * damagingly -- their `lastRanks`, which is the hysteresis input: they would
   * start holding a rank they never earned and the demotion buffer would defend
   * it. Cleared before the sign-out resolves so a failed sign-out does not leave
   * signed-in state with no cached ranks.
   *
   * `clearAllChats` for the same reason: the assistant's transcript is the most
   * revealing thing this app stores on the device. It is not on the server, so a
   * sign-out that left it behind would be the one way it outlived the account.
   */
  const signOut = useCallback(async () => {
    await clearRankData();
    await clearAllChats();
    await supabase.auth.signOut();
  }, []);

  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  // Navigation itself belongs to NavLink. What the gate adds is the prompt: a
  // locked tab still has to be reachable so the modal can name it, exactly as
  // selecting a locked tab used to move the view before the modal appeared.
  const isLocked = (path: string): boolean =>
    (ready && !userId && path !== "/") || needsOnboarding;

  const requestedTab = APP_TABS.find(
    (tab) => tab.path !== "/" && isTabActive(tab.path, location.pathname),
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="flex items-center gap-2.5">
            {/*
              Mobile only, because `SideRail` renders the mark from 768px up.

              `hidden` before `max-md:flex` is load-bearing, not decoration:
              Tailwind emits `display` utilities with `hidden` last, so `hidden`
              wins over the component's own `flex` at desktop width regardless of
              the order they appear in the class attribute. CSS decides which one
              is on screen, not a media query hook -- a hook would re-render on
              every rotation and flash the wrong brand on a cold load.
            */}
            <BrandLockup className="hidden max-md:flex" size={30} />
          </h1>
          <nav className="flex items-center gap-1 text-sm text-neutral-400">
            {APP_TABS.map((tab) => (
              <TabButton
                key={tab.path}
                tab={tab}
                locked={isLocked(tab.path)}
                onLockedSelect={() => setIsAuthModalOpen(true)}
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
          <Welcome
            requestedLabel={requestedTab?.label ?? null}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        ) : needsOnboarding ? (
          profileLoading || profile === null ? (
            <p className="text-neutral-500">Cargando tu perfil…</p>
          ) : (
            <Onboarding
              profile={profile}
              onSave={updateProfile}
              // Finishing the wizard drops the user on the daily log, which is
              // the one view that is never locked.
              onFinish={() => navigate("/")}
            />
          )
        ) : (
          <>
            <WorkspaceHeader
              email={email}
              energy={energy}
              onSignOut={() => void signOut()}
            />
            {/* Only the user id and email travel through outlet context now: the
                session lives in `ActiveSessionContext` because `AppShell` has to
                read it too. */}
            <Outlet context={{ userId, email }} />
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

/**
 * The slice of workspace state the routed views need.
 *
 * Read through `useOutletContext` rather than a global, so a view that does not
 * train has no way to reach the session and no test has to mock a module.
 *
 * `userId` is here rather than passed to each route element because the router
 * cannot know it: it comes from the Supabase session, which `AuthGate` resolves.
 * Passing it down as a prop would mean the route table had to be built per user,
 * and the table is created once at module scope.
 *
 * `email` rides along for the same reason and the same reason it is *not* re-read
 * from Supabase downstream: a second `getSession()` is a second source of truth
 * that can disagree with the gate's, and the profile is the screen where that
 * disagreement would be visible.
 */
export interface WorkspaceOutletContext {
  userId: string;
  email: string;
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
  locked,
  onLockedSelect,
}: {
  tab: { path: string; label: string; icon: LucideIcon };
  locked: boolean;
  onLockedSelect: () => void;
}) {
  const Icon = tab.icon;
  return (
    <NavLink
      to={tab.path}
      // NavLink owns `aria-current="page"`; adding it here would just be a second
      // source of truth for the same fact.
      onClick={() => {
        if (locked) onLockedSelect();
      }}
      className={({ isActive }) =>
        `flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
          isActive ? "bg-accent/15 text-accent" : "hover:bg-white/5 hover:text-neutral-100"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{tab.label}</span>
      {locked && <Lock className="h-3 w-3 text-neutral-600" aria-hidden="true" />}
    </NavLink>
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

function Welcome({
  requestedLabel,
  onOpenAuth,
}: {
  requestedLabel: string | null;
  onOpenAuth: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-neutral-900/60 p-8 text-center shadow-glass">
      <div className="mb-5 flex justify-center">
        <CronosLogo size={64} showWordmark />
      </div>
      {requestedLabel ? (
        <>
          <Lock className="mx-auto mb-3 h-7 w-7 text-accent" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-neutral-50">Inicia sesión para ver {requestedLabel}</h2>
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

/**
 * The home screen: pick something to train.
 *
 * Always the picker, never the workout itself. Training lives at `/entrenar` so
 * that the session has one address: the pill, the deep link and the routine
 * builder all arrive at the same screen, and reloading mid-session returns to the
 * workout rather than to a menu with a session silently running behind it.
 */
export function HomeView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { start } = useActiveSession();
  const { routines } = useRoutines(userId);
  const navigate = useNavigate();

  return (
    <StartPicker
      routines={routines}
      onStartSession={(routine) => {
        start(routine);
        navigate(TRAIN_PATH);
      }}
    />
  );
}

/**
 * The workout itself.
 *
 * Falls back to the picker when no session is running, so a deep link, a
 * bookmark or the pill arriving after the session already ended all land on
 * something usable instead of an empty route.
 */
export function TrainView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { session, end } = useActiveSession();
  const { routines } = useRoutines(userId);

  if (!session) return <HomeView />;

  const source = routines.find((r) => r.id === session.routineId);
  return (
    <ActiveWorkout
      userId={userId}
      routineId={session.routineId}
      routineTitle={session.title}
      planned={source?.exercises ?? []}
      onFinished={end}
    />
  );
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

export function RoutinesView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { start } = useActiveSession();
  const navigate = useNavigate();
  const { routines, loading, refresh } = useRoutines(userId);
  return (
    <RoutineBuilder
      userId={userId}
      routines={routines}
      loading={loading}
      onChanged={() => void refresh()}
      // Starting from the library has to reach the same screen as starting from
      // home, or the session runs behind a route the user never navigated to.
      onStart={(routine) => {
        start(routine);
        navigate(TRAIN_PATH);
      }}
    />
  );
}

export function ProgressView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { stats, loading, error } = useProgress(userId);

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <ProgressDashboard stats={stats} loading={loading} />
    </>
  );
}

/**
 * The anatomical ranks, on their own route.
 *
 * Split out of `ProgressView` rather than kept as a tab inside it. A tab was fine
 * while the tab was the only way in; now that the bottom navigation has its own
 * Rangos destination, the ranks view needs an address, so that a deep link, the
 * pill and the navigation item all land on the same screen.
 */
export function RangosView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Hands the muscle filter to the exercise catalog.
   *
   * Written through the router rather than `window.history.replaceState`, because
   * `ExerciseBrowser` -- the thing that reads it -- also writes it. Two writers
   * that bypass each other leave the router's copy of the URL disagreeing with
   * `window.location`, and the symptom is a filter that silently stops applying
   * on the next navigation.
   *
   * `replace` rather than `push`: applying a filter is not a place the user wants
   * a Back button to undo.
   */
  const browseMuscle = useCallback(
    (slug: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set(MUSCLE_PARAM, slug);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <>
      {searchParams.get(MUSCLE_PARAM) && (
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
  );
}

/**
 * The coach hub, on its own route.
 *
 * Thin on purpose, exactly like `RangosView`: the route's whole job is to read the
 * user id out of the auth gate and hand it to the screen. Anything the coach knows
 * is derived inside the hub, so there is no state for a route wrapper to own and
 * nothing here that a refresh could lose.
 */
export function CoachView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  return <CoachHub userId={userId} />;
}