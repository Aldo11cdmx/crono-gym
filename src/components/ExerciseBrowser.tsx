import { useEffect, useMemo, useState } from "react";
import { supabase } from "@lib/supabase";
import type { Exercise } from "../types/supabase";
import { Search, Dumbbell, Target, Activity, X } from "lucide-react";

const BODY_PARTS = ["all","chest","back","upper arms","lower arms","shoulders","upper legs","lower legs","waist","cardio","neck"];

export function ExerciseBrowser({ onSelect, onClose }: { onSelect: (ex: Exercise) => void; onClose: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase.from("exercises").select("*").order("id", { ascending: true }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) { setError(err.message); setExercises([]); } else { setExercises((data as Exercise[]) ?? []); }
      setLoading(false);
    });
    return () => { alive = false; };
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
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 border-b border-white/10 bg-neutral-950/40 px-5 py-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busqueda por nombre..." className="w-full rounded-lg border border-white/10 bg-neutral-950/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" /></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FilterSelect label="Parte del cuerpo" icon={<Activity className="h-3.5 w-3.5" />} value={bodyPart} options={BODY_PARTS} onChange={setBodyPart} />
            <FilterSelect label="Equipamiento" icon={<Dumbbell className="h-3.5 w-3.5" />} value={equipment} options={["all", ...equipmentOptions]} onChange={setEquipment} />
            <FilterSelect label="Objetivo" icon={<Target className="h-3.5 w-3.5" />} value={target} options={["all", ...targetOptions]} onChange={setTarget} />
          </div>
          <div className="flex items-center justify-between"><span className="text-xs text-neutral-500">{filtered.length} de {exercises.length} ejercicios</span><button type="button" onClick={clearFilters} className="text-xs text-neutral-400 underline-offset-2 hover:underline">Limpiar filtros</button></div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (<div className="text-center text-neutral-500">Cargando catalogo...</div>) : error ? (<div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Error al cargar ejercicios: {error}</div>) : filtered.length === 0 ? (<div className="text-center text-neutral-500">Sin resultados para esta busqueda.</div>) : (
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
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950/40 transition hover:border-accent/50">
      <div className="relative aspect-video bg-neutral-900">{!imgError ? (<img src={exercise.gif_url} alt={exercise.name} loading="lazy" onError={() => setImgError(true)} className="h-full w-full object-contain" />) : (<div className="flex h-full w-full items-center justify-center text-neutral-600"><Dumbbell className="h-8 w-8" /></div>)}</div>
      <div className="p-3"><h3 className="truncate text-sm font-medium">{exercise.name}</h3><div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-neutral-400"><span className="rounded-md bg-white/5 px-1.5 py-0.5">{exercise.body_part}</span><span className="rounded-md bg-white/5 px-1.5 py-0.5">{exercise.target}</span><span className="rounded-md bg-white/5 px-1.5 py-0.5">{exercise.equipment}</span></div><button type="button" onClick={() => onSelect(exercise)} className="mt-2 w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-neutral-950 transition hover:brightness-110"> Agregar al entrenamiento</button></div>
    </div>
  );
}