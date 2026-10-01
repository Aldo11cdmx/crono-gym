import { useEffect, useState } from "react";
import { supabase } from "@lib/supabase";

export function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Cronos</h1>
          <nav className="flex items-center gap-2 text-sm text-neutral-400">
            <a href="#hoy" className="rounded-md px-3 py-1.5 transition hover:bg-white/5 hover:text-neutral-100">
              Diario de Hoy
            </a>
            <a href="#rutinas" className="rounded-md px-3 py-1.5 transition hover:bg-white/5 hover:text-neutral-100">
              Rutinas
            </a>
            <a href="#progreso" className="rounded-md px-3 py-1.5 transition hover:bg-white/5 hover:text-neutral-100">
              Progreso
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <SessionGate />
      </main>
    </div>
  );
}

function SessionGate() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setAuthenticated(Boolean(data.session));
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    return <div className="text-neutral-500">Cargando…</div>;
  }
  return authenticated ? <DashboardStub /> : <AuthStub />;
}

function AuthStub() {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-8 shadow-glass">
        <h2 className="mb-1 text-xl font-semibold">Bienvenido a Cronos</h2>
        <p className="mb-6 text-sm text-neutral-400">
          Inicia sesi\u00f3n para gestionar tus rutinas y registrar tus entrenamientos.
        </p>
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="Correo electr\u00f3nico"
            className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            type="password"
            placeholder="Contrase\u00f1a"
            className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
          >
            Iniciar Sesi\u00f3n
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-neutral-500">
          \u00bfNo tienes cuenta? Crea una en segundos.
        </p>
      </div>
    </div>
  );
}

function DashboardStub() {
  const metrics = [
    { label: "Entrenamientos este mes", value: "0", hint: "Comienza hoy" },
    { label: "Serie m\u00e1xima", value: "0 kg", hint: "Sin datos a\u00f1n" },
    { label: "Rutinas activas", value: "0", hint: "Crea tu primera" },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 shadow-glass backdrop-blur-md"
        >
          <p className="text-xs uppercase tracking-wide text-neutral-500">{m.label}</p>
          <p className="mt-2 text-3xl font-semibold">{m.value}</p>
          <p className="mt-1 text-xs text-neutral-500">{m.hint}</p>
        </div>
      ))}
    </div>
  );
}