import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { useRole } from "@/hooks/useRole";
import type { Announcement, AnnouncementCategory } from "@/hooks/useAnnouncements";

export interface Tip {
  id: string;
  text: string;
  icon: "lightbulb" | "zap";
  category: string;
}

export interface TipSectionProps {
  tip: Tip | string;
  tips?: Tip[] | string[];
  onNext: () => void;
  announcements?: Announcement[];
  onPublish?: (input: Pick<Announcement, "title" | "body" | "category">) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  embedded?: boolean;
}

const categoryLabel: Record<AnnouncementCategory, string> = {
  urgent: "🔴 URGENTE",
  event: "🏆 EVENTO",
  info: "📢 AVISO OFICIAL",
};

function text(value: Tip | string) { return typeof value === "string" ? value : value.text; }

export function TipSection({ tip, tips, onNext, announcements = [], onPublish, onDelete }: TipSectionProps) {
  const { role } = useRole();
  const [tab, setTab] = useState<"announcements" | "tips">(announcements.length > 0 ? "announcements" : "tips");
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("info");
  const tipItems = tips && tips.length ? tips : [tip];
  const currentAnnouncement = announcements[announcementIndex];
  useEffect(() => {
    if (announcements.length > 0) setTab("announcements");
    setAnnouncementIndex((current) => Math.min(current, Math.max(0, announcements.length - 1)));
  }, [announcements.length]);

  async function publish() {
    if (!title.trim() || !body.trim() || !onPublish) return;
    await onPublish({ title, body, category });
    setTitle(""); setBody(""); setComposerOpen(false);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4" aria-label="Avisos del Gym y Tips IA">
      <header className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl bg-[#2C2C2E] p-1" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "announcements"} onClick={() => setTab("announcements")}
            className="h-11 rounded-lg px-3 text-xs font-semibold text-white">
            📢 Avisos {announcements.length > 0 ? `(${announcements.length})` : ""}
          </button>
          <button type="button" role="tab" aria-selected={tab === "tips"} onClick={() => setTab("tips")}
            className="h-11 rounded-lg px-3 text-xs font-semibold text-zinc-400">⚡ Tips IA</button>
        </div>
        {(role === "admin" || role === "developer" || import.meta.env.DEV) && onPublish ? (
          <button type="button" onClick={() => setComposerOpen(true)} className="text-xs font-semibold text-[#FF3B30]">+ Nuevo aviso</button>
        ) : null}
      </header>

      {tab === "announcements" && currentAnnouncement ? (
        <article className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#FF3B30]">{categoryLabel[currentAnnouncement.category]}</span>
            <time className="font-mono text-[11px] text-zinc-400">{new Date(currentAnnouncement.createdAt).toLocaleDateString("es-MX")}</time>
          </div>
          <h3 className="mt-2 text-base font-bold text-white">{currentAnnouncement.title}</h3>
          <p className="mt-1 text-sm text-zinc-300">{currentAnnouncement.body}</p>
          {announcements.length > 1 ? <div className="mt-4 flex gap-2">
            <button type="button" className="h-11 rounded-xl bg-[#2C2C2E] px-3 text-xs text-white" onClick={() => setAnnouncementIndex((announcementIndex - 1 + announcements.length) % announcements.length)}><ChevronLeft size={14} /> Anterior</button>
            <button type="button" className="h-11 rounded-xl bg-[#2C2C2E] px-3 text-xs text-white" onClick={() => setAnnouncementIndex((announcementIndex + 1) % announcements.length)}>Siguiente <ChevronRight size={14} /></button>
          </div> : null}
          {(role === "admin" || role === "developer" || import.meta.env.DEV) && onDelete ? <button type="button" onClick={() => void onDelete(currentAnnouncement.id)} className="mt-3 text-xs text-zinc-500">Eliminar aviso</button> : null}
        </article>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-zinc-300" aria-live="polite">{text(tipItems[tipIndex] ?? tip)}</p>
          <GlassButton variant="secondary" icon={<RotateCcw size={16} />} onClick={() => { setTipIndex((tipIndex + 1) % tipItems.length); onNext(); }} className="mt-4 h-11">Siguiente tip</GlassButton>
        </div>
      )}

      {composerOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Nuevo aviso">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
          <h3 className="text-base font-bold text-white">Publicar aviso</h3>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="mt-4 h-11 w-full rounded-xl border border-white/10 bg-[#2C2C2E] px-3 text-white" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Mensaje" rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-[#2C2C2E] p-3 text-white" />
          <select value={category} onChange={(event) => setCategory(event.target.value as AnnouncementCategory)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#2C2C2E] px-3 text-white">
            <option value="info">Aviso</option><option value="event">Evento</option><option value="urgent">Urgente</option>
          </select>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setComposerOpen(false)} className="h-11 rounded-xl bg-[#2C2C2E] px-4 text-sm text-white">Cancelar</button><button type="button" onClick={() => void publish()} className="h-11 rounded-xl bg-[#FF3B30] px-4 text-sm font-semibold text-white">Publicar</button></div>
        </div>
      </div> : null}
    </section>
  );
}
