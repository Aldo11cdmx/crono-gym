import { useState } from "react";
import { supabase } from "@lib/supabase";
import { X, Mail, Lock, User, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { CronosLogo } from "./CronosLogo";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  if (!open) return null;

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
    setMessage(null);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onAuthenticated();
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: displayName.trim() ? { data: { display_name: displayName.trim() } } : undefined,
        });
        if (authError) throw authError;
        setMessage("Cuenta creada. Inicia sesión.");
        setMode("login");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    onAuthenticated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenido a Cronos"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-neutral-900/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 max-w-sm w-full mx-auto shadow-2xl text-center">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100">
          <X className="h-5 w-5" />
        </button>
        <CronosLogo size={64} className="h-16 w-auto mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white">Bienvenido a Cronos</h2>
        <p className="text-neutral-400 text-sm mb-6">Entrena, progresa y supera tus límites.</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-neutral-900 font-semibold py-3 mb-3 hover:bg-neutral-100 transition disabled:opacity-50"
        >
          <span className="text-sm font-bold text-neutral-900">G</span>
          Continuar con Google
        </button>

        <button
          type="button"
          onClick={() => setShowEmailForm((v) => !v)}
          className="w-full rounded-xl border border-white/15 py-3 text-sm text-neutral-200 hover:bg-white/5 transition mb-4"
        >
          Iniciar con correo electrónico
        </button>

        {showEmailForm && (
          <form className="space-y-3 mb-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2">
                <User className="h-4 w-4 text-neutral-500" />
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600" />
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2">
              <Mail className="h-4 w-4 text-neutral-500" />
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2">
              <Lock className="h-4 w-4 text-neutral-500" />
              <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="........" className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600" />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className="flex items-start gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50">
              {loading ? "Cargando..." : mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
            </button>
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-xs text-neutral-400 hover:text-white">
              {mode === "login" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Iniciar sesión"}
            </button>
          </form>
        )}

        <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }} className="text-neutral-400 hover:text-white text-xs">
          Explorar como invitado
        </a>

        <div className="mt-4 flex items-center justify-center">
          <button type="button" onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300">
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
