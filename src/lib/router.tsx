/**
 * router.tsx — the route table.
 *
 * The app ran on a single `useState<View>` before this existed: three views
 * behind three buttons, unreachable by URL and lost on refresh. This file is the
 * replacement, and it is deliberately the *only* place a path is declared.
 *
 * The two nested layouts are the two gates the shell needs, in this order:
 *
 *   AppShell  -- padding, bottom navigation and the active-session pill. Outside
 *                the auth gate so the navigation never appears and disappears.
 *   AuthGate  -- Supabase session and onboarding. It renders `<Outlet />` only
 *                for a signed-in, onboarded user, which is what keeps the views
 *                unreachable rather than merely unstyled.
 *
 * `AuthGate` passes the user id down through outlet context instead of a provider,
 * so the state survives navigation (a layout is not unmounted when its child
 * changes) without a module a test has to mock.
 */

import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import {
  AuthGate,
  CoachView,
  HomeView,
  ProgressView,
  RangosView,
  RoutinesView,
  TrainView,
} from "@/App";
import { ProfileView } from "@/components/profile/ProfileView";
import { CoachPortal } from "@/components/coach/portal/CoachPortal";
import { ExerciseHub } from "@/components/hub/ExerciseHub";
import { UiCatalogPage } from "@/components/dev/UiCatalogPage";
import { CoachPortalPreview } from "@/components/dev/CoachPortalPreview";
import {
  COACH_PATH,
  EXERCISE_PATH,
  HOME_PATH,
  LEGACY_ROUTINES_PATH,
  PROFILE_PATH,
  PROGRESS_PATH,
  ROUTINES_PATH,
} from "@/components/shell/navItems";

/**
 * The dev-only component catalog and the coach-portal preview.
 *
 * Registered behind `import.meta.env.DEV` so the routes do not exist in a
 * production build at all -- not "exists but 404s". The whole point of these
 * pages is to be unusable to a user, and a guarded mount keeps the components'
 * code out of the production bundle's critical path as well.
 *
 * `/dev/coach-portal` is here because the vault it mounts is the one screen with
 * no signed-out route to it. See `CoachPortalPreview` for what it does and does
 * not stand in for.
 */
const devRoutes = import.meta.env.DEV
  ? [
      { path: "/dev/ui", element: <UiCatalogPage /> },
      { path: "/dev/coach-portal", element: <CoachPortalPreview /> },
    ]
  : [];

/**
 * `/` as a redirect, not a duplicate route.
 *
 * `<Navigate replace>` rather than rendering `HomeView` here as well: two paths
 * serving one screen means two URLs for the same page, and the second one is the
 * one that ends up in a bookmark and then drifts. `replace` so the dashboard
 * becomes the address rather than sitting behind the one the athlete clicked.
 *
 * Inside `AuthGate` on purpose. As a sibling of the layout it would also redirect
 * signed-out visitors, bypassing the gate that decides what they may see.
 */
const legacyHomeRoute = { path: "/", element: <Navigate to={HOME_PATH} replace /> };

/**
 * `/biblioteca` -> `/rutinas`.
 *
 * The screen did not move; the address did. "Biblioteca" says where routines are kept,
 * and every label in the product already said "Rutinas" -- so the route was the last
 * place disagreeing. A redirect rather than a duplicate route, for the same reason as
 * `/`: two paths serving one screen means two URLs for the same page, and the one that
 * is not in the navigation is the one that ends up in a bookmark and then drifts.
 */
const legacyRoutinesRoute = {
  path: LEGACY_ROUTINES_PATH,
  element: <Navigate to={ROUTINES_PATH} replace />,
};

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        element: <AuthGate />,
        children: [
          { path: HOME_PATH, element: <HomeView /> },
          legacyHomeRoute,
          { path: ROUTINES_PATH, element: <RoutinesView /> },
          legacyRoutinesRoute,
          { path: PROGRESS_PATH, element: <ProgressView /> },
          /*
           * The exercise hub: one movement's demo, progression and records, in three tabs.
           *
           * `/ejercicio/:exerciseId` -- a param rather than a query string, because a URL a
           * lifter can paste to a training partner is worth having, and `?tab=` inside it
           * already handles the tab so the deep link can land on the right tab too.
           *
           * Absent from `navItems.ts`, like `/rangos`: this is reached from the exercise
           * strip during a session, not from the thumb bar. A hub for one movement is not a
           * destination anybody navigates to in order to browse.
           */
          { path: `${EXERCISE_PATH}/:exerciseId`, element: <ExerciseHub /> },
          // The workout has its own address so a running session survives a
          // reload and so the pill's destination is a real screen.
          { path: "/entrenar", element: <TrainView /> },
          { path: "/rangos", element: <RangosView /> },
          { path: PROFILE_PATH, element: <ProfileView /> },
          /*
           * The AI coach's workspace: the context briefing, the chat, the notes and the
           * pending recommendations.
           *
           * A live route that is not a destination. `COACH_PATH` is absent from
           * `navItems.ts`, so it appears in neither the thumb bar nor the desktop rail --
           * the profile's premium-services card is what links here. That is the whole
           * navigation change, and it is why five thumb-zone destinations became four.
           */
          { path: COACH_PATH, element: <CoachView /> },
          /*
           * The coach's own vault. Inside `AuthGate` because the coach signs in as a normal
           * user first -- the boundary that decides which rows they may read is
           * `auth.uid()`, so there is no signed-out way to render this at all.
           *
           * Deliberately absent from `navItems.ts`. A route listed there appears in
           * `BottomNav` and `SideNav`, and this is not an athlete's tab: it would put a
           * coach's inbox one thumb-tap away from every free user's home screen.
           */
          { path: "/coach/portal", element: <CoachPortal /> },
        ],
      },
      /*
       * A sibling of `AuthGate`, not a child of it. Both dev pages are about looking at
       * components that no signed-out visitor may reach, so putting them behind the gate would
       * defeat the only thing they are for. `import.meta.env.DEV` is the boundary that matters
       * here: in a production build this array is empty and the paths do not resolve at all.
       */
      ...devRoutes,
    ],
  },
]);