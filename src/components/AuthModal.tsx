import { useState } from "react";
import { supabase } from "@lib/supabase";
import { X, Mail, Lock, User, LogOut, CheckCircle2, AlertCircle } from "lucide-react";

type Mode = "login" | "signup";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!open) return null;

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
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        setMessage("Cuenta creada. Inicia sesion.");
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100">
          <X className="h-5 w-5" />
        </button>
        <div className="rounded-2xl border border-white/10 bg-neutral-900/70 p-6 shadow-glass backdrop-blur-md">
          <h2 className="mb-1 text-xl font-semibold">{mode === "login" ? "Iniciar Sesion" : "Creacion de Cuenta"}</h2>
          <p className="mb-5 text-sm text-neutral-400">{mode === "login" ? "Bienvenido de nuevo. Accede a tus rutinas y progreso." : "Crea tu cuenta para guardar entrenamientos y rutas."}</p>
          <div className="mb-4 flex rounded-lg border border-white/10 bg-neutral-950/40 p-1">
            <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === "login" ? "bg-accent text-neutral-950" : "text-neutral-400 hover:text-neutral-100"}`}>Iniciar Sesion</button>
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === "signup" ? "bg-accent text-neutral-950" : "text-neutral-400 hover:text-neutral-100"}`}>Creacion de Cuenta</button>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="block"><span className="mb-1 text-xs text-neutral-400">Nombre</span><div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2"><User className="h-4 w-4 text-neutral-500" /><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-600" /></div></label>
            )}
            <label className="block"><span className="mb-1 text-xs text-neutral-400">Correo electronico</span><div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2"><Mail className="h-4 w-4 text-neutral-500" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-600" /></div></label>
            <label className="block"><span className="mb-1 text-xs text-neutral-400">Contrasena</span><div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2"><Lock className="h-4 w-4 text-neutral-500" /><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="........" className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-600" /></div></label>
            {error && (<div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>)}
            {message && (<div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>)}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-110 disabled:opacity-50">{loading ? "Cargando..." : mode === "login" ? "Iniciar Sesion" : "Creacion de Cuenta"}</button>
          </form>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4"><span className="text-xs text-neutral-500">Sesi\u00f3n actual</span><button type="button" onClick={handleLogout} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5"><LogOut className="h-3.5 w-3.5" /> Cerrar Sesi\u00f3n</button></div>
        </div>
      </div>
    </div>
  );
}