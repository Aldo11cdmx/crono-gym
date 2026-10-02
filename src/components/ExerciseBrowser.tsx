import { useEffect, useMemo, useState } from "react";
import { supabase } from "@lib/supabase";
import { loadExercises } from "@services/seedExercises";
import type { Exercise } from "../types/supabase";
import { Search, Dumbbell, Target, Activity, X, AlertCircle, CloudDownload } from "lucide-react";

const BODY_PARTS = ["all","chest","back","upper arms","lower arms","shoulders","upper legs","lower legs","waist","cardio","neck"];

/** Where the currently displayed catalog came from. */
type Source = "supabase" | "fallback";

export function ExerciseBrowser({ onSelect, onClose }: { onSelect: (ex: Exercise) => void; onClose: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("supabase");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      // Preferred path: the seeded table.
      const { data, error: dbError } = await supabase
        .from("exercises")
        .select("*")
        .order("id", { ascending: true });

      const rows = (data ?? []) as Exercise[];
      if (!alive) return;

      if (!dbError && rows.length > 0) {
        setExercises(rows);
        setSource("supabase");
        setLoading(false);
        return;
      }

      // Empty table or an RLS/network failure: fall back to the dataset so the
      // catalog is usable regardless of seeding state.
      const reason = dbError ? dbError.message : "La tabla exercises está vacía";
      try {
        const fallback = await loadExercises();
        if (!alive) return;
        setExercises(fallback);
        setSource("fallback");
        setError(
          `Mostrando el catálogo en caché (${fallback.length}). ${reason}.`,
        );
      } catch (fallbackError) {
        if (!alive) return;
        setExercises([]);
        setError(
          `No se pudo cargar el catálogo: ${
            fallbackError instanceof Error ? fallbackError.message : reason
          }`,
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const equipmentOptions = useMemo(() => { const s = new Set<string>(); exercises.forEach((e) => s.add(e.equipment)); return [...s].sort(); }, [exercises]);
  const targetOptions = useMemo(() => { const s = new Set<string>(); exercises.forEach((e) => s.add(e.target)); return [...s].sort(); }, [exercises]);

  const filtered = useMemo(() => exercises.filter((e) => {
    const q = query.trim().toLowerCase();
    return (!q || e.name.toLowerCase().includes(q))
      && (bodyPart === "all" || e.body_part === bodyPart)
      && (equipment === "all" || e.equipment === equipment)
      && (target === "all" || e.target === target);
  }), [exercises, query, bodyPart, equipment, target]);

  function clearFilters() { setQuery(""); setBodyPart("all"); setEquipment("all"); setTarget("all"); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/70 shadow-glass backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Biblioteca de Ejercicios</h2>
            <p className="text-xs text-neutral-400">Busca y filtra para agregar a tu entrenamiento.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 border-b border-white/10 bg-neutral-950/40 px-5 py-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busqueda por nombre..." className="w-full rounded-lg border border-white/10 bg-neutral-950/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" /></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FilterSelect label="Parte del cuerpo" icon={<Activity className="h-3.5 w-3.5" />} value={bodyPart} options={BODY_PARTS} onChange={setBodyPart} />
            <FilterSelect label="Equipamiento" icon={<Dumbbell className="h-3.5 w-3.5" />} value={equipment} options={["all", ...equipmentOptions]} onChange={setEquipment} />
            <FilterSelect label="Objetivo" icon={<Target className="h-3.5 w-3.5" />} value={target} options={["all", ...targetOptions]} onChange={setTarget} />
          </div>
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-neutral-500">{filtered.length} de {exercises.length} ejercicios{source === "fallback" ? " (caché local)" : ""}</span><button type="button" onClick={clearFilters} className="text-xs text-neutral-400 underline-offset-2 hover:underline">Limpiar filtros</button></div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {error && (<div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${source === "fallback" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-red-500/30 bg-red-500/10 text-red-300"}`}><span className="mt-0.5 shrink-0">{source === "fallback" ? <CloudDownload className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</span><span>{error}</span></div>)}
          {loading ? (<div className="text-center text-neutral-500">Cargando catalogo...</div>) : filtered.length === 0 ? (<div className="text-center text-neutral-500">Sin resultados para esta busqueda.</div>) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ex) => (<ExerciseCard key={ex.id} exercise={ex} onSelect={onSelect} />))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, icon, value, options, onChange }: { label: string; icon: React.ReactNode; value: string; options: string[]; onChange: (v: string) => void; }) {
  return (
    <label className="block"><span className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">{icon}{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm outline-none focus:border-accent">{options.map((o) => (<option key={o} value={o}>{o === "all" ? "Todos" : o}</option>))}</select></label>
  );
}

function ExerciseCard({ exercise, onSelect }: { exercise: Exercise; onSelect: (ex: Exercise) => void; }) {
  const [imgError, setImgError] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const steps = exercise.instructions ?? [];
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950/40 transition hover:border-accent/50">
      <div className="relative aspect-video bg-neutral-900">{!imgError ? (<img src={exercise.gif_url} alt={`Animación de ${exercise.name}`} loading="lazy" onError={() => setImgError(true)} className="h-full w-full object-contain" />) : (<div className="flex h-full w-full items-center justify-center text-neutral-600"><Dumbbell className="h-8 w-8" /></div>)}</div>
      <div className="p-3"><h3 className="truncate text-sm font-medium">{exercise.name}</h3><div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-neutral-400"><span className="rounded-md bg-white/5 px-1.5 py-0.5">{exercise.body_part}</span><span className="rounded-md bg-white/5 px-1.5 py-0.5">{exercise.target}</span><span className="rounded-md bg-white/5 px-1.5 py-0.5">{exercise.equipment}</span></div>{steps.length > 0 && (<div className="mt-2"><button type="button" onClick={() => setShowSteps((v) => !v)} aria-expanded={showSteps} className="text-[11px] text-neutral-500 underline-offset-2 transition hover:text-neutral-300 hover:underline">{showSteps ? "Ocultar instrucciones" : `Instrucciones (${steps.length})`}</button>{showSteps && (<ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-neutral-400">{steps.map((step, i) => (<li key={i}>{step}</li>))}</ol>)}</div>)}<button type="button" onClick={() => onSelect(exercise)} className="mt-2 w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-neutral-950 transition hover:brightness-110"> Agregar al entrenamiento</button></div>
    </div>
  );
}