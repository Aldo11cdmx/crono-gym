import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image/compressImage";
import {
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

export function AnnouncementsManager() {
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("info");
  const [imageUrl, setImageUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("announcements").select("*").order("created_at", { ascending: false });
    const remoteItems = (data ?? []).map((item: AnnouncementRow) => {
      const meta = findAnnouncementMeta(item.id, item.title);
      const banner = item.banner_path || meta?.imageUrl || item.image_url;
      return {
        ...item,
        ...meta,
        imageUrl: banner,
        image_url: banner,
      };
    });
    const localItems = readLocalAnnouncements<AnnouncementRow>();
    setItems([...remoteItems, ...localItems.filter((item) => !remoteItems.some((remote: AnnouncementRow) => remote.id === item.id))]);
  }, []);
  useEffect(() => { void load(); }, [load]);

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
        <h2 className="text-base font-bold text-white">Avisos del Gym</h2>
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
        {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
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
