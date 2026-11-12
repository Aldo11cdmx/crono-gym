import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { supabase } from "@lib/supabase";

export interface CoachAthlete {
  user_id: string;
  display_name: string | null;
  email_masked_or_contact?: string | null;
  avatar_url?: string | null;
  goal?: string | null;
  experience_level?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  current_phase?: string | null;
  active_routines?: number | null;
}

interface CoachAthleteSearchProps {
  onSelect: (athlete: CoachAthlete) => void;
}

export function CoachAthleteSearch({ onSelect }: CoachAthleteSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoachAthlete[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rpc = await (supabase as any).rpc("search_coach_athletes", {
          search_text: query.trim(),
        });
        if (!rpc.error && Array.isArray(rpc.data)) {
          if (active) setResults(rpc.data as CoachAthlete[]);
          return;
        }

        const fallback = await (supabase as any)
          .from("profiles")
          .select("user_id,display_name,avatar_url,goal,experience_level,weight_kg,height_cm")
          .ilike("display_name", `%${query.trim()}%`)
          .limit(20);
        if (fallback.error) throw fallback.error;
        if (active) setResults((fallback.data ?? []) as CoachAthlete[]);
      } catch (reason) {
        if (active) {
          setResults([]);
          setError(reason instanceof Error ? reason.message : "No se pudo buscar atletas");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <GlassCard style={{ padding: 16 }}>
      <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#2C2C2E] px-3">
        <Search size={16} className="text-zinc-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar atleta por nombre o correo"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
          aria-label="Buscar atleta"
        />
      </label>
      {loading && <p className="mt-3 text-xs text-zinc-400">Buscando...</p>}
      {error && <p className="mt-3 text-xs text-red-300" role="alert">{error}</p>}
      <div className="mt-3 flex flex-col gap-2">
        {results.map((athlete) => (
          <button
            key={athlete.user_id}
            type="button"
            className="flex min-h-11 items-center gap-3 rounded-xl bg-[#2C2C2E] px-3 text-left text-white active:scale-[0.98] transition-transform"
            onClick={() => onSelect(athlete)}
          >
            {athlete.avatar_url ? (
              <img src={athlete.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="h-8 w-8 rounded-full bg-white/10" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{athlete.display_name || "Atleta sin nombre"}</strong>
              <span className="block truncate text-xs text-zinc-400">
                {athlete.email_masked_or_contact || athlete.goal || "Abrir ficha contextual"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
