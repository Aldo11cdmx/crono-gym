/**
 * CoachPortalPreview.tsx — the coach vault, mounted without a coach account.
 *
 * A development tool, not a screen: the route is registered only when `import.meta.env.DEV`
 * is true (see `router.tsx`), so none of this reaches a production bundle.
 *
 * The portal is the one screen in the app with no signed-out way to reach it — `/coach/portal`
 * sits behind `AuthGate`, and every read inside it resolves against `auth.uid()`. That is the
 * right default and it is also the reason a layout review needed an account nobody had. This
 * page mounts the real components at both widths a review needs, so the grid can be looked at
 * without one.
 *
 * What it does and does not show, stated plainly so nobody mistakes it for the real thing:
 *
 *   - The PIN sheet is the real `CoachPinGate` in its locked state, with the real countdown.
 *     Typing a PIN cannot unlock it: `coach-auth` verifies against `auth.uid()`, and there is
 *     no session here. The countdown is the part worth watching at 390px.
 *   - The panel is the real `PortalPanel` with a literal `userId`. Its panels read Supabase
 *     through the real client, so each one settles into its no-session state -- which is a real
 *     state, but not the populated one. Spacing, wrapping, column order and the narrow-width
 *     stacking are reviewable here; the data shapes are not.
 *   - Populated panels need a real account. That is not faked here on purpose: a preview full of
 *     invented rows would read as a passing review of something that has never been rendered.
 */

import { SURFACE, TEXT } from "@/design/tokens";
import { CoachPinGate } from "@/lib/coach/CoachAccessGate";
import { PortalPanel } from "@/components/coach/portal/CoachPortal";

/** Not a real athlete. Nothing reads it except the panel's own Supabase queries. */
const PREVIEW_USER_ID = "00000000-0000-0000-0000-000000000000";

export function CoachPortalPreview() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: SURFACE.base,
        color: TEXT.primary,
        display: "grid",
        gap: 48,
        padding: "32px 16px 64px",
      }}
    >
      <header style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
          Vista previa del portal del coach
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: "13px", color: TEXT.secondary, lineHeight: 1.6 }}>
          Monta los componentes reales sin sesión. La hoja del PIN es auténtica y muestra la
          cuenta atrás en vivo, pero el PIN no se puede validar. El panel usa un{" "}
          <code>userId</code> literal, así que cada bloque cae en su estado sin sesión: sirve
          para revisar rejilla, separación y apilado, no los datos.
        </p>
      </header>

      <section style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <PreviewLabel>Hoja del PIN · estado bloqueado</PreviewLabel>
        {/*
         * No surrounding `AuthProvider` on purpose: without it the gate falls back to locked,
         * which is the state whose countdown has to survive a 390px viewport.
         */}
        <CoachPinGate>
          <p style={{ color: TEXT.secondary }}>No debe ser alcanzable sin desbloquear.</p>
        </CoachPinGate>
      </section>

      {/*
       * No `maxWidth` here, unlike the prose above. The panel's own grid switches to two
       * columns at `lg`, and a wrapper narrower than that would keep it stacked at every
       * desktop width -- the preview would then report the narrow layout as the desktop one.
       */}
      <section style={{ width: "100%" }}>
        <PreviewLabel>Panel desbloqueado · estado sin sesión</PreviewLabel>
        {/*
         * No router of its own. `PortalPanel` takes `userId` as a prop -- `CoachPortal` is the
         * one that reads it from the outlet context -- so there is nothing to provide, and
         * this page already renders inside the app's own router, which is what supplies context
         * to any `useNavigate` the panels below make.
         */}
        <PortalPanel userId={PREVIEW_USER_ID} />
      </section>
    </main>
  );
}

function PreviewLabel({ children }: { children: string }) {
  return (
    <h2
      style={{
        margin: "0 0 12px",
        fontSize: "11px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: TEXT.tertiary,
      }}
    >
      {children}
    </h2>
  );
}
