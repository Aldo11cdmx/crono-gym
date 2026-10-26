import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { ActiveWorkoutView } from "./components/workout/ActiveWorkoutView";
import { AuthModal } from "./components/AuthModal";
import { BrandLockup } from "./components/shell/BrandLockup";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { Onboarding } from "./components/Onboarding";
import { ProgressCharts } from "./components/progress/ProgressCharts";
import { ConsistencyTracker } from "./components/progress/ConsistencyTracker";
import { WorkoutHistory } from "./components/progress/WorkoutHistory";
import { AnatomicalRanksPage } from "./components/ranks/AnatomicalRanksPage";
import { CoachHub } from "./components/coach/CoachHub";
import { RoutinesPage } from "./components/dashboard/RoutinesPage";
import { useActiveSession } from "./context/ActiveSessionContext";
import { HOME_PATH, NAV_DESTINATIONS } from "./components/shell/navItems";
import { MUSCLE_PARAM } from "./lib/muscleFilter";
import {
  useProgress,
  useRoutines,
} from "./hooks/useGymData";
import { useProfile } from "./hooks/useProfile";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { AuthModalProvider } from "./context/AuthModalContext";
import { TYPE, TEXT } from "@/design/tokens";
import { PROGRESS_LABELS } from "@/lib/i18n";

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
 *
 * Fase 7 removed the header tab row that used to live here (`APP_TABS`,
 * `isTabActive` and `TabButton`, all gone). It advertised four routes *on top of*
 * the navigation bar, so two of them appeared twice under two different names and
 * two existed nowhere else. What is left of the header is the mobile brand, which
 * `SideRail` renders from 768px up -- one bar, five destinations, one name each.
 */
export function AuthGate() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { ready, userId, email } = useAuthSession();
  const { rehydrate, isActive } = useActiveSession();
  const {
    profile,
    loading: profileLoading,
    update: updateProfile,
  } = useProfile(userId);
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Look for a session that never finished, before anything decides there is
   * no session.
   *
   * The lookup lives in the session provider, one level above the router, and
   * this is where it is triggered: the gate is the one place that knows who
   * is signed in. A reload used to land on the dashboard with a session still
   * running on the device, because the lookup happened inside the workout --
   * a component that only mounts once the app has already decided.
   */
  useEffect(() => {
    if (!userId) return;
    rehydrate(userId);
  }, [userId, rehydrate]);

  // Mounted app-wide, not just inside a workout: a session finished offline has
  // to reach the server on reconnect even if the user never starts another one.
  const sync = useOfflineSync(Boolean(userId));

  // A signed-in user without a completed onboarding goes straight into the
  // wizard; every other view stays unreachable until then.
  const needsOnboarding =
    Boolean(userId) && profile !== null && profile.onboarding_completed_at === null;

  
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);
  // Stable identity, so the provider's memoised value does not change every render.
  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);

  /*
   * Which destination the athlete was refused, so `Welcome` can name it: "inicia
   * sesión para ver Rutinas" beats "inicia sesión", which is what a signed-out user
   * tapping the navigation used to get.
   *
   * Read from `NAV_DESTINATIONS` rather than the list this file used to own, so the
   * name can never again be one the navigation does not show. `HOME_PATH` is
   * excluded because the dashboard is the one destination a signed-out visitor may
   * see, and saying "inicia sesión para ver Inicio" while showing them Inicio would
   * be nonsense.
   */
  const requestedDestination = NAV_DESTINATIONS.find(
    (destination) => destination.path !== HOME_PATH && destination.path === location.pathname,
  );

  return (
    <AuthModalProvider open={openAuthModal}>
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/*
        Brand-only since Fase 7 removed the header tab row. The destinations live
        in `BottomNav` and `SideRail`, so this bar exists to put the mark on screen
        below 768px -- where the rail is `display: none` -- and nothing else.
      */}
      {!isActive && (
        <header
          className="sticky top-0 z-40 border-b border-white/10 bg-neutral-900/60 backdrop-blur-md"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
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
          </div>
        </header>
      )}

      <main className={`mx-auto max-w-6xl px-6 ${isActive ? "py-0" : "py-8"}`}>
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
            requestedLabel={requestedDestination?.label ?? null}
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
    </AuthModalProvider>
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

function Welcome({
  requestedLabel: _requestedLabel,
  onOpenAuth,
}: {
  requestedLabel: string | null;
  onOpenAuth: () => void;
}) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <img
          src="/logo.jpg"
          alt="Cronos Gym"
          className="mx-auto mb-4 h-16 w-auto rounded-lg object-contain shadow-[0_0_25px_rgba(239,68,68,0.2)]"
          style={{ filter: "invert(1)", mixBlendMode: "screen" }}
        />
        <h2 className="text-2xl font-bold text-white">CRONOS GYM</h2>
        <p className="mb-6 mt-1 text-sm text-neutral-400">Tu templo. Tus marcas. Tu progreso.</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mb-3 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white font-semibold text-black transition hover:bg-neutral-100 disabled:opacity-50"
        >
          Continuar con Google
        </button>

        <button
          type="button"
          onClick={() => setShowEmail((v) => !v)}
          className="mb-4 flex h-11 w-full items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/5"
        >
          Iniciar con correo electrónico
        </button>

        {showEmail && (
          <form className="mb-4 space-y-3" onSubmit={handleSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="........"
              className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Iniciar Sesión"}
            </button>
          </form>
        )}

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onOpenAuth();
          }}
          className="text-xs text-neutral-400 hover:text-white"
        >
          Explorar como invitado
        </a>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-neutral-400">
          <span>⚡ Mapeo de máquinas del gym</span>
          <span>📊 Registro de series y RPE</span>
          <span>🤖 Coach con IA integrada</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The home screen: the dashboard.
 *
 * Always the dashboard, never the workout itself. Training lives at `/entrenar`
 * so that the session has one address: the pill, the deep link and the routine
 * builder all arrive at the same screen, and reloading mid-session returns to the
 * workout rather than to a menu with a session silently running behind it.
 */
export function HomeView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();

  if (!userId) {
    return (
      <Welcome
        requestedLabel={null}
        onOpenAuth={() => {}}
      />
    );
  }

  return <DashboardPage userId={userId} />;
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
  const { session, end, rehydrating } = useActiveSession();
  const { routines, loading } = useRoutines(userId);
  /**
   * True once the routine library has finished a load. `loading` starts
   * false -- the first read happens in an effect, after the first paint --
   * so "not loading" on its own cannot tell a library that arrived from one
   * that has not been asked for yet. ActiveWorkout seeds its exercises from
   * the first render it mounts with and never re-seeds, so a session that
   * names a routine must not mount it until the library is in: mounting it
   * with an empty plan is a session with no exercises, and the library
   * landing a beat later does not fill it back in.
   */
const [libraryLoaded, setLibraryLoaded] = useState(false);
   /**
    * True once a load has completed at least once. `loading` starts false, so
    * gating on it alone would mark the library loaded on first render before
    * the first effect ever ran -- the exact bug this ref exists to prevent.
    * The effect below sets both together, so the two cannot disagree.
    */
   const loadedOnceRef = useRef(false);
   useEffect(() => {
     if (!loading && !loadedOnceRef.current) {
       loadedOnceRef.current = true;
       setLibraryLoaded(true);
     }
   }, [loading]);

  if (!session) {
    /*
     * The lookup has not answered yet. Answering "there is no session"
     * before the question has been asked is what sent the athlete home with
     * a session still running, so the screen waits for the answer instead.
     */
    if (rehydrating) {
      return <p className="text-neutral-500">Restaurando tu sesión…</p>;
    }
    return <HomeView />;
  }

  // A free session (no routine) is empty by design -- the picker is the
  // point -- so only a routine-backed session waits for the library. The
  // gate opens once and stays open: `loading` only rises again on a
  // re-fetch this screen does not trigger, so the workout is never
  // unmounted mid-session.
  if (session.routineId !== null && !(libraryLoaded && !loading)) {
    return <p className="text-neutral-500">Cargando…</p>;
  }

  const source = routines.find((r) => r.id === session.routineId);
  return (
    <ActiveWorkoutView
      userId={userId}
      routineId={session.routineId}
      routineTitle={session.title}
      planned={source?.exercises ?? []}
      onFinished={end}
    />
  );
}

export function RoutinesView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  return <RoutinesPage userId={userId} />;
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
      {loading ? (
        <p className="text-sm text-neutral-500">{PROGRESS_LABELS.loading}</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 style={pageTitleStyle}>{PROGRESS_LABELS.title}</h2>
            <p style={pageSubtitleStyle}>{PROGRESS_LABELS.subtitle(stats.recent.length)}</p>
          </div>
          <ProgressCharts stats={stats} />
          <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
            <ConsistencyTracker week={stats.week} />
            <WorkoutHistory recent={stats.recent} />
          </div>
        </div>
      )}
    </>
  );
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: TYPE.title2.size,
  lineHeight: TYPE.title2.lineHeight,
  fontWeight: TYPE.title2.weight,
  color: TEXT.primary,
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  fontWeight: TYPE.caption.weight,
  color: TEXT.secondary,
};

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
      <AnatomicalRanksPage userId={userId} onBrowseMuscle={browseMuscle} />
    </>
  );
}

/**
 * The coach workspace, on its own route.
 *
 * Thin on purpose, exactly like `RangosView`: the route's whole job is to read the
 * user id out of the auth gate and hand it to the screen. Anything the coach knows
 * is derived inside the hub, so there is no state for a route wrapper to own and
 * nothing here that a refresh could lose.
 *
 * Reachable, but not navigable: `COACH_PATH` is a route without a destination, and the
 * profile's premium-services card is the way in. See `navItems.ts` for why it left the
 * bar rather than redirecting.
 */
export function CoachView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  return <CoachHub userId={userId} />;
}