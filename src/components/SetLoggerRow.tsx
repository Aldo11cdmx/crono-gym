export interface SetEntry {
  set_number: number;
  weight: string;
  reps: string;
  rpe: string;
  is_warmup: boolean;
  completed: boolean;
}

interface SetLoggerRowProps {
  entry: SetEntry;
  index: number;
  onChange: (entry: SetEntry) => void;
  onRemove: () => void;
}

export function SetLoggerRow({ entry, index, onChange, onRemove }: SetLoggerRowProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-accent">Serie {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-neutral-500 hover:text-red-400">
          Eliminar
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Peso (kg)" value={entry.weight} onChange={(v) => onChange({ ...entry, weight: v })} />
        <Field label="Repeticiones" value={entry.reps} onChange={(v) => onChange({ ...entry, reps: v })} />
        <Field label="RPE" value={entry.rpe} onChange={(v) => onChange({ ...entry, rpe: v })} />
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={entry.is_warmup}
            onChange={(e) => onChange({ ...entry, is_warmup: e.target.checked })}
            className="accent-accent"
          />
          Calentamiento
        </label>
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...entry, completed: !entry.completed })}
        className={`mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          entry.completed ? "bg-emerald-500/20 text-emerald-300" : "bg-accent text-neutral-950"
        } hover:brightness-110`}
      >
        {entry.completed ? "Serie completada" : "Marcar completada"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 text-[11px] text-neutral-400">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}