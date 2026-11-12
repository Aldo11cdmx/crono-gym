import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image/compressImage";
import {
  cleanAnnouncementMeta,
  clearAnnouncementCaches,
  dedupeLocalAnnouncements,
  findAnnouncementMeta,
  readLocalAnnouncements,
  saveAnnouncementMeta,
  saveLocalAnnouncement,
  type AnnouncementMeta,
} from "@/lib/gymClubMetadata";

type AnnouncementRow = {
  id: string;
  title: string;
  body?: string;
  message?: string;
  category?: string;
  banner_path?: string;
  image_url?: string;
  imageUrl?: string;
  active?: boolean;
  pinned?: boolean;
  created_at?: string;
};

const field = "h-11 rounded-xl border border-white/10 bg-[#2C2C2E] px-3 text-sm text-white";

function normalizedTitle(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Mirror rows worth listing next to the remote table.
 *
 * The mirror and the remote table both hold the same published rows, so a plain
 * concatenation listed every locally-created aviso twice once Supabase had
 * accepted it — the id changed in the hand-off (`local-announcement-…` became a
 * uuid), so only the title still ties the two copies together. Mirror rows are
 * collapsed by id and by normalized title, and any row the remote table already
 * returns is dropped, with remote winning.
 */
function dedupeAnnouncements(
  local: AnnouncementRow[],
  remote: AnnouncementRow[],
): AnnouncementRow[] {
  const remoteIds = new Set(remote.map((item) => String(item.id ?? "").trim()).filter(Boolean));
  const remoteTitles = new Set(remote.map((item) => normalizedTitle(item.title)).filter(Boolean));
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const kept: AnnouncementRow[] = [];

  for (const item of local) {
    const id = String(item.id ?? "").trim();
    const title = normalizedTitle(item.title);
    if (id && (seenIds.has(id) || remoteIds.has(id))) continue;
    if (title && (seenTitles.has(title) || remoteTitles.has(title))) continue;
    if (id) seenIds.add(id);
    if (title) seenTitles.add(title);
    kept.push(item);
  }

  return kept;
}

export function AnnouncementsManager() {
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("info");
  const [imageUrl, setImageUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Cleanup runs on every load: the mirror grows between visits, and doing it
    // silently is what let the count drift for so long.
    const meta = cleanAnnouncementMeta();
    const feed = dedupeLocalAnnouncements<AnnouncementRow>();
    const cleaned: string[] = [];
    if (feed.removed > 0) cleaned.push(`${feed.removed} aviso(s) duplicado(s) del espejo local`);
    if (meta.removed.length > 0) cleaned.push(`${meta.removed.length} clave(s) de metadatos huerfana(s)`);

    const { data } = await (supabase as any).from("announcements").select("*").order("created_at", { ascending: false });
    const remoteItems = (data ?? []).map((item: AnnouncementRow) => {
      const itemMeta = findAnnouncementMeta(item.id, item.title);
      const banner = item.banner_path || itemMeta?.imageUrl || item.image_url;
      return {
        ...item,
        ...itemMeta,
        imageUrl: banner,
        image_url: banner,
      };
    });
    const localItems = dedupeAnnouncements(readLocalAnnouncements<AnnouncementRow>(), remoteItems);
    setItems([...remoteItems, ...localItems]);
    // Only a real cleanup replaces the status: the message of a publish or of a
    // manual reset must survive the reload that follows it.
    if (cleaned.length > 0) setStatus(`Limpieza automatica: ${cleaned.join(" y ")} eliminados.`);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const resetCache = () => {
    // The mirror keys are dropped through the shared helper, so a rename of the
    // storage key cannot leave a stale copy behind.
    clearAnnouncementCaches();
    setStatus("Cache de avisos reseteado. Los avisos de Supabase se vuelven a leer al recargar.");
    void load();
    window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
  };

  const publish = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) {
      setStatus("Escribe un título para publicar el aviso.");
      return;
    }
    const localItem: AnnouncementRow = {
      id: `local-announcement-${Date.now()}`,
      title: trimmedTitle,
      message: trimmedBody,
      body: trimmedBody,
      category,
      imageUrl: imageUrl || undefined,
      image_url: imageUrl || undefined,
      pinned,
      active: true,
      created_at: new Date().toISOString(),
    };
    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any).from("announcements").insert({
      title: trimmedTitle,
      message: trimmedBody,
      kind: category === "event" ? "event" : "notice",
      banner_path: imageUrl || null,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      created_by: authData.user?.id,
    }).select("id").single();
    if (error) {
      saveLocalAnnouncement(localItem);
      saveAnnouncementMeta(
        [localItem.id, trimmedTitle],
        { imageUrl: imageUrl || undefined, category: category as AnnouncementMeta["category"], pinned, active: true },
      );
      setItems((current) => [localItem, ...current]);
      setTitle(""); setBody(""); setImageUrl(""); setPinned(false);
      setStatus("Aviso guardado localmente y publicado en /hoy.");
      window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
      return;
    }
    saveAnnouncementMeta(
      [String(data?.id ?? ""), trimmedTitle],
      { imageUrl: imageUrl || undefined, category: category as AnnouncementMeta["category"], pinned, active: true },
    );
    saveLocalAnnouncement({ ...localItem, id: String(data?.id ?? localItem.id) });
    setItems((current) => [{ ...localItem, id: String(data?.id ?? localItem.id) }, ...current]);
    setTitle(""); setBody(""); setImageUrl(""); setPinned(false); setStatus("Aviso publicado.");
    window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
    await load();
  };

  const update = async (id: string, values: Partial<AnnouncementRow>) => {
    const current = items.find((item) => item.id === id);
    const meta: AnnouncementMeta = {
      imageUrl: typeof values.image_url === "string" ? values.image_url : current?.imageUrl ?? current?.image_url,
      category: (values.category ?? current?.category) as AnnouncementMeta["category"],
      pinned: values.pinned ?? current?.pinned,
      active: values.active ?? current?.active,
    };
    if ("pinned" in values || "active" in values || "image_url" in values || "category" in values) {
      saveAnnouncementMeta([id, current?.title ?? ""], meta);
    }
    await load();
    window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
  };

  return (
    <section className="grid gap-4">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white">Avisos del Gym</h2>
          <button
            type="button"
            onClick={resetCache}
            className="h-11 rounded-xl bg-[#2C2C2E] px-3 text-xs font-semibold text-white"
          >
            Limpiar avisos duplicados / Resetear caché de avisos
          </button>
        </div>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del aviso" />
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="info">Aviso</option><option value="event">Evento</option><option value="urgent">Urgente</option>
          </select>
          <label className="flex h-11 items-center gap-2 rounded-xl bg-[#2C2C2E] px-3 text-sm text-zinc-300">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Fijar en /hoy
          </label>
        </div>
        <input className={field} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL de foto del aviso (opcional)" />
        <input className={field} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void compressImage(file).then(setImageUrl); }} />
        {imageUrl ? <img src={imageUrl} alt="Vista previa del aviso" className="aspect-[16/9] w-full rounded-xl object-cover" /> : null}
        <textarea className="min-h-24 rounded-xl border border-white/10 bg-[#2C2C2E] p-3 text-sm text-white" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mensaje del aviso" />
        <button type="button" className="h-11 rounded-xl bg-[#FF3B30] px-4 text-sm font-bold text-white" onClick={() => void publish()}>Publicar Aviso en el Gym</button>
        {status ? <p className="text-sm text-zinc-300" role="status">{status}</p> : null}
      </div>
      <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#1C1C1E]">
        {items.map((item) => <article key={item.id} className="grid gap-2 p-4">
          {item.imageUrl ?? item.image_url ? <img src={item.imageUrl ?? item.image_url} alt="" className="h-20 w-full rounded-xl object-cover" /> : null}
          <div className="flex items-center justify-between gap-2"><strong className="truncate text-white">{item.title}</strong><span className="text-xs text-zinc-400">{item.category ?? "info"}</span></div>
          <p className="text-sm text-zinc-300">{item.body ?? item.message}</p>
          <div className="flex gap-2"><button type="button" className="h-11 rounded-xl bg-[#2C2C2E] px-3 text-xs text-white" onClick={() => void update(item.id, { pinned: !item.pinned })}>{item.pinned ? "Desfijar" : "Fijar"}</button><button type="button" className="h-11 rounded-xl bg-[#2C2C2E] px-3 text-xs text-white" onClick={() => void update(item.id, { active: item.active === false })}>{item.active === false ? "Activar" : "Ocultar"}</button></div>
        </article>)}
      </div>
    </section>
  );
}
