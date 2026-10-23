import { Component, type ErrorInfo, type ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { SURFACE, TEXT, TYPE } from "@/design/tokens";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) return;
    void import("@/lib/observability/reportError").then((m) =>
      m.reportError(error, { componentStack: info.componentStack ?? "" }),
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: SURFACE.base, color: TEXT.primary, minHeight: "100vh" }}>
          <GlassCard style={{ padding: 24 }}>
            <h1 style={{ fontSize: TYPE.title.size, color: TEXT.primary }}>Algo falló</h1>
            <p style={{ color: TEXT.secondary }}>Tu sesión está guardada.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <GlassButton variant="primary" onClick={() => this.setState({ hasError: false })}>
                Reintentar
              </GlassButton>
              <GlassButton variant="ghost" onClick={() => (window.location.href = "/")}>
                Volver al inicio
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      );
    }
    return this.props.children;
  }
}