import { useCallback, useEffect, useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { ActiveWorkout } from "./components/ActiveWorkout";
import { AuthModal } from "./components/AuthModal";
import { CronosLogo } from "./components/CronosLogo";
import { BrandLockup } from "./components/shell/BrandLockup";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { Onboarding } from "./components/Onboarding";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { AnatomicalRanksView } from "./components/AnatomicalRanksView";
import { CoachHub } from "./components/coach/CoachHub";
import { RoutineBuilder } from "./components/RoutineBuilder";
import { useActiveSession } from "./context/ActiveSessionContext";
import { HOME_PATH, NAV_DESTINATIONS, TRAIN_PATH } from "./components/shell/navItems";
import { MUSCLE_PARAM } from "./lib/muscleFilter";
import {
  useProgress,
  useRoutines,
} from "./hooks/useGymData";
import { useProfile } from "./hooks/useProfile";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { clearRankData } from "./lib/ranks/rankHistory";
import { clearAllChats } from "./lib/ai/chatStorage";
import { AuthModalProvider } from "./context/AuthModalContext";
import { computeEnergyTargets } from "./lib/profile";

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