/**
 * UiCatalogPage.tsx — every primitive in every variant, on one screen.
 *
 * A development tool, not a screen: the route is registered only when
 * `import.meta.env.DEV` is true (see `router.tsx`), so this file never reaches a
 * production bundle.
 *
 * Its job is to make a design decision reviewable without navigating the app.
 * A glass recipe that reads well in isolation tends to fall apart at four
 * different opacities, which is exactly what a page like this is for. That is
 * also why it renders the variants *together* rather than as isolated swatches:
 * the question is never "is this button right" but "are these four right next to
 * each other".
 */

import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { SURFACE, TEXT } from "@/design/tokens";

const BUTTON_VARIANTS = [
  { variant: "primary", label: "Primario" },
  { variant: "secondary", label: "Secundario" },
  { variant: "ghost", label: "Fantasma" },
  { variant: "destructive", label: "Destructivo" },
] as const;

export function UiCatalogPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: SURFACE.base,
        padding: "48px 24px",
        color: TEXT.primary,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 32 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>
            Catálogo de componentes
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: "14px", color: TEXT.secondary }}>
            Cada primitivo, en todas sus variantes, sobre la misma superficie.
          </p>
        </header>

        <section>
          <SectionTitle>GlassCard</SectionTitle>
          <GlassCard>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>
              Tarjeta de cristal
            </h3>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: TEXT.secondary }}>
              Relleno translúcido, borde de un píxel y sombra difusa. El contenido
              de ejemplo sirve para comprobar el contraste sobre el relleno real, no
              sobre blanco de papel.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <GlassButton variant="primary">Continuar</GlassButton>
              <GlassButton variant="ghost">Ahora no</GlassButton>
            </div>
          </GlassCard>
        </section>

        <section>
          <SectionTitle>GlassButton</SectionTitle>
          <GlassCard style={{ display: "grid", gap: 20 }}>
            {BUTTON_VARIANTS.map(({ variant, label }) => (
              <div key={variant}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: TEXT.tertiary,
                  }}
                >
                  {variant} · {label}
                </p>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <GlassButton variant={variant}>Habilitado</GlassButton>
                  <GlassButton variant={variant} disabled>
                    Deshabilitado
                  </GlassButton>
                </div>
              </div>
            ))}
          </GlassCard>
        </section>

        <section>
          <SectionTitle>Skeleton</SectionTitle>
          <GlassCard style={{ display: "grid", gap: 16 }}>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "13px", color: TEXT.tertiary }}>
                Línea
              </p>
              <Skeleton />
            </div>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "13px", color: TEXT.tertiary }}>
                Bloque
              </p>
              <Skeleton variant="block" />
            </div>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "13px", color: TEXT.tertiary }}>
                Círculo
              </p>
              <Skeleton width="40px" height="40px" style={{ borderRadius: "9999px" }} />
            </div>
          </GlassCard>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: string }) {
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