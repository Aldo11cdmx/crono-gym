import { useCallback, useEffect, useMemo, useState } from "react";
import { Dumbbell, LogOut, Pencil, Plus, Search, Sparkles } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { usePermissions } from "@/hooks/usePermissions";
import { CoachPinGate } from "@/lib/coach/CoachAccessGate";
import { useCoachAuth } from "@/lib/coach/useCoachAuth";
import { useCoachEcosystem } from "@/hooks/useCoachEcosystem";
import { coachEcosystemService } from "@/lib/coach/coachEcosystemService";
import { supabase } from "@lib/supabase";
import { GlassButton } from "@/components/ui";
import { CoachAthleteSearch, type CoachAthlete } from "./CoachAthleteSearch";
import { AthleteCRM } from "./AthleteCRM";
import { VipRoutineBuilder } from "./VipRoutineBuilder";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { translateBodyPart, translateEquipment } from "@/lib/i18n";
import { addCustomExercise } from "@/lib/catalog/customExercises";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import { loadCatalogOverrides, saveCatalogOverride } from "@/lib/catalog/customExercises";
import { equipmentMap } from "@/data/equipmentMap";

type CoachTab = "clients" | "expediente" | "templates" | "exercises";
type ExerciseRow = {
  id: string;
  name: string;
  name_es: string | null;
  body_part: string;
  target: string;
  equipment: string;
  gif_url?: string | null;
  equipment_id?: string;
  customNameEs?: string;
};

const card = "rounded-2xl border border-white/10 bg-[#1C1C1E] p-4";
const control = "rounded-xl border border-white/10 bg-[#2C2C2E]";

export function CoachPortal() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { loading, hasRole } = usePermissions();
  const auth = useCoachAuth();
  if (loading) return <div className="min-h-60 animate-pulse rounded-2xl bg-[#1C1C1E]" />;
  const content = <PortalPanel userId={userId} onExit={auth.lock} />;
  return hasRole(["coach", "admin", "developer"]) ? content : <CoachPinGate>{content}</CoachPinGate>;
}

export function PortalPanel({ userId, onExit }: { userId: string; onExit?: () => void }) {
  const [tab, setTab] = useState<CoachTab>("clients");
  const [selectedAthlete, setSelectedAthlete] = useState<CoachAthlete | null>(null);
  const [expedienteTab, setExpedienteTab] = useState<"ficha" | "builder" | "chat">("ficha");
  const [offerEditing, setOfferEditing] = useState(false);
  const ecosystem = useCoachEcosystem(userId);
  const [offerDraft, setOfferDraft] = useState(ecosystem.offer);
  const [filter, setFilter] = useState<"all" | "cash" | "vip">("all");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setOfferDraft(ecosystem.offer), [ecosystem.offer]);
  const activeCount = ecosystem.requests.filter((request) => request.status === "active").length;
  const visibleRequests = ecosystem.requests.filter((request) =>
    filter === "all" ? true : filter === "cash" ? request.status === "pending_cash_payment" : request.status === "active",
  );

  const activate = useCallback(async (athleteId: string) => {
    if (!ecosystem.offer) return;
    try {
      await ecosystem.activateAthleteVipCash(athleteId, ecosystem.offer.priceMxn);
      setMessage("VIP activo · efectivo");
      await ecosystem.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo activar el VIP");
    }
  }, [ecosystem]);

  const selectAthlete = useCallback((athlete: CoachAthlete) => {
    setSelectedAthlete(athlete);
    setTab("expediente");
    setExpedienteTab("ficha");
  }, []);

  return (
    <main className="w-full max-w-full overflow-x-hidden bg-black px-4 pt-3 pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className={`${card} flex min-w-0 flex-wrap items-center justify-between gap-3`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF3B30]/15 text-[#FF3B30]">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-white">Panel Coach</p>
              <p className="truncate text-xs text-zinc-400">Coach · COACH PRO</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-[#30D158]/30 bg-[#30D158]/15 px-3 py-2 text-xs font-semibold text-[#30D158]">
              {activeCount} atletas activos
            </span>
            <span className="rounded-full bg-[#2C2C2E] px-3 py-2 text-xs text-zinc-300">14:00 a 22:00</span>
            <button type="button" onClick={onExit} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2C2C2E] px-3 text-sm text-white active:scale-[0.98]">
              <LogOut size={16} aria-hidden="true" /> Salir
            </button>
          </div>
        </header>

        <nav aria-label="Secciones del portal" className={`${card} grid grid-cols-4 gap-1 p-1`}>
          {([
            ["clients", "Clientes"],
            ["expediente", "Expediente"],
            ["templates", "Plantillas"],
            ["exercises", "Ejercicios"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`min-w-0 rounded-lg px-1 py-3 text-xs font-semibold transition-colors ${tab === value ? "bg-[#FF3B30] text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <span className="block truncate">{label}</span>
            </button>
          ))}
        </nav>

        {message && <p role="status" className={`${card} text-sm text-zinc-200`}>{message}</p>}

        {tab === "clients" && (
          <ClientsPanel
            offer={offerDraft}
            editing={offerEditing}
            setEditing={setOfferEditing}
            setOffer={setOfferDraft}
            saveOffer={async () => {
              if (!offerDraft) return;
              await ecosystem.saveOffer(offerDraft);
              setOfferEditing(false);
              setMessage("Oferta guardada");
            }}
            requests={visibleRequests}
            filter={filter}
            setFilter={setFilter}
            activate={activate}
            openAthlete={(request: any) => selectAthlete({ user_id: request.athleteId, display_name: request.athleteName })}
          />
        )}

        {tab === "expediente" && (
          <section className="flex min-w-0 flex-col gap-4">
            <CoachAthleteSearch onSelect={selectAthlete} />
            {selectedAthlete ? (
              <>
                <div className={`${card} flex min-w-0 flex-wrap items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-white">{selectedAthlete.display_name || "Atleta"}</p>
                    <p className="truncate text-xs text-zinc-400">{selectedAthlete.goal || "Ficha 360°"} · {selectedAthlete.weight_kg ?? "—"} kg</p>
                  </div>
                  <button type="button" className="h-11 rounded-xl bg-[#2C2C2E] px-4 text-sm text-white" onClick={() => setSelectedAthlete(null)}>Cambiar atleta</button>
                </div>
                <div className={`${card} grid grid-cols-3 gap-1 p-1`}>
                  {(["ficha", "builder", "chat"] as const).map((value) => (
                    <button key={value} type="button" onClick={() => setExpedienteTab(value)} className={`min-h-11 rounded-lg text-xs font-semibold ${expedienteTab === value ? "bg-[#2C2C2E] text-white" : "text-zinc-400"}`}>
                      {value === "ficha" ? "Ficha 360°" : value === "builder" ? "Constructor 1:1" : "Chat"}
                    </button>
                  ))}
                </div>
                {expedienteTab === "ficha" && <AthleteCRM athleteId={selectedAthlete.user_id} />}
                {expedienteTab === "builder" && <VipRoutineBuilder athleteId={selectedAthlete.user_id} onSaved={setMessage} />}
                {expedienteTab === "chat" && <div className={card}>Chat disponible desde la ficha del atleta.</div>}
              </>
            ) : <div className={`${card} text-sm text-zinc-400`}>Selecciona un atleta para abrir su ficha 360°.</div>}
          </section>
        )}

        {tab === "templates" && <TemplatesPanel templates={ecosystem.templates} onClone={(templateId) => ecosystem.cloneTemplate(templateId, userId)} onRefresh={ecosystem.refresh} />}
        {tab === "exercises" && <ExercisesPanel coachId={userId} requests={ecosystem.exerciseRequests} />}
      </div>
    </main>
  );
}

function ClientsPanel({ offer, editing, setEditing, setOffer, saveOffer, requests, filter, setFilter, activate, openAthlete }: any) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><h2 className="truncate text-base font-bold text-white">Mi Oferta Comercial VIP</h2><p className="text-xs text-zinc-400">Visible para tus atletas.</p></div>
          <button type="button" className="h-11 rounded-xl bg-[#2C2C2E] px-4 text-sm text-white" onClick={() => setEditing(!editing)}>{editing ? "Cerrar" : "Editar"}</button>
        </div>
        {offer && (editing ? (
          <div className="mt-4 grid gap-3">
            <input className={`${control} h-11 px-3 text-white`} value={offer.coachName ?? ""} onChange={(e) => setOffer({ ...offer, coachName: e.target.value })} aria-label="Nombre público del Coach" placeholder="Nombre público del Coach (ej. Coach Mich)" />
            <input className={`${control} h-11 px-3 text-white`} type="number" value={offer.priceMxn} onChange={(e) => setOffer({ ...offer, priceMxn: Number(e.target.value) })} aria-label="Precio MXN" />
            <input className={`${control} h-11 px-3 text-white`} value={offer.specialty} onChange={(e) => setOffer({ ...offer, specialty: e.target.value })} aria-label="Especialidad" />
            <input className={`${control} h-11 px-3 text-white`} value={offer.shift} onChange={(e) => setOffer({ ...offer, shift: e.target.value })} aria-label="Turno" />
            <select className={`${control} h-11 px-3 text-white`} value={offer.billingCycle} onChange={(e) => setOffer({ ...offer, billingCycle: e.target.value as "mensual" | "por_rutina" | "trimestral" })} aria-label="Modalidad">
              <option value="mensual">Mensual</option>
              <option value="por_rutina">Por rutina</option>
              <option value="trimestral">Trimestral</option>
            </select>
            <textarea className={`${control} min-h-24 p-3 text-sm text-white`} value={offer.benefits.join("\n")} onChange={(e) => setOffer({ ...offer, benefits: e.target.value.split("\n").filter(Boolean) })} aria-label="Beneficios" />
            <GlassButton variant="primary" onClick={() => void saveOffer()}>Guardar oferta</GlassButton>
          </div>
        ) : <div className="mt-4 grid gap-2 text-sm text-zinc-300"><strong className="text-white">{offer.coachName || "Coach Mich"}</strong><strong className="font-mono text-white">${offer.priceMxn} MXN / {offer.billingCycle}</strong><span>{offer.specialty} · {offer.shift}</span>{offer.benefits.map((benefit: string) => <span key={benefit}>· {benefit}</span>)}</div>)}
      </div>
      <div className={card}>
        <div className="flex flex-wrap gap-2">
          {(["all", "cash", "vip"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`h-11 rounded-full px-4 text-xs font-semibold ${filter === value ? "bg-[#FF3B30] text-white" : "bg-[#2C2C2E] text-zinc-400"}`}>{value === "all" ? "Todos" : value === "cash" ? "Por cobrar en efectivo" : "VIP Activos"}</button>)}
        </div>
        <div className="mt-4 grid gap-2">
          {requests.length === 0 && <p className="text-sm text-zinc-400">No hay solicitudes en este filtro.</p>}
          {requests.map((request: any) => <div key={request.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-[#2C2C2E] p-3"><div className="min-w-0"><strong className="block truncate text-white">{request.athleteName}</strong><span className="text-xs text-zinc-400">{request.status === "active" ? "VIP ACTIVO · EFECTIVO" : "Por cobrar en efectivo"}</span></div><div className="flex flex-wrap gap-2">{request.status !== "active" && <button type="button" onClick={() => void activate(request.athleteId)} className="min-h-11 rounded-xl bg-[#30D158] px-3 text-xs font-bold text-black">Confirmar Pago en Efectivo</button>}<button type="button" onClick={() => openAthlete(request)} className="min-h-11 rounded-xl bg-[#1C1C1E] px-3 text-xs text-white">Ir al Expediente</button></div></div>)}
        </div>
      </div>
    </section>
  );
}

function TemplatesPanel({ templates, onClone, onRefresh }: { templates: any[]; onClone: (id: string) => Promise<string>; onRefresh: () => Promise<void> }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return <section className="grid min-w-0 gap-4">
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">Rutinas Base Oficiales</h2>
          <p className="text-xs text-zinc-400">Plantillas base que puedes asignar a tus atletas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setBuilderOpen(true)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[#FF3B30] px-4 text-xs font-bold text-white active:scale-[0.98]"><Plus size={14} aria-hidden="true" /> Crear Rutina Base</button>
          <button type="button" onClick={() => void onRefresh()} className="h-11 rounded-xl bg-[#2C2C2E] px-3 text-xs text-white">Actualizar</button>
        </div>
      </div>
      {note && <p role="status" className="mt-3 text-sm text-[#30D158]">{note}</p>}
      <div className="mt-4 grid gap-2">
        {templates.length === 0 && <p className="text-sm text-zinc-400">No hay plantillas publicadas todavía.</p>}
        {templates.map((template) => (
          <div key={template.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-[#2C2C2E] p-3">
            <div className="min-w-0">
              <strong className="block truncate text-white">{template.title}</strong>
              <span className="font-mono text-xs text-zinc-400">{template.days} días · {template.exercises} ejercicios · {template.level}{template.category ? ` · ${template.category}` : ""}</span>
            </div>
            <button type="button" onClick={() => void onClone(template.id)} className="min-h-11 rounded-xl bg-[#FF3B30] px-3 text-xs font-bold text-white">Asignar a mi cuenta</button>
          </div>
        ))}
      </div>
    </div>
    {builderOpen && (
      <div role="presentation" onClick={() => setBuilderOpen(false)} className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-black p-4 sm:rounded-3xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white">Crear Rutina Base</h3>
            <button type="button" onClick={() => setBuilderOpen(false)} className="h-11 rounded-xl bg-[#2C2C2E] px-4 text-sm text-white">Cerrar</button>
          </div>
          <VipRoutineBuilder
            athleteId={null}
            isTemplate
            onSaved={(title) => {
              setBuilderOpen(false);
              setNote(`«${title}» creada. Aparece en tu lista y en el catálogo del atleta.`);
              void onRefresh();
            }}
          />
        </div>
      </div>
    )}
  </section>;
}

function ExercisesPanel({ coachId, requests }: { coachId: string; requests: any[] }) {
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [query, setQuery] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [request, setRequest] = useState({ name: "", bodyPart: "", equipment: "", notes: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState({ name: "", muscle: "", equipment: "", notes: "" });
  const [equipmentOverrides, setEquipmentOverrides] = useState<Record<string, string>>({});
  const createExercise = async () => {
    const name = newExercise.name.trim();
    if (!name) { setCreateStatus("Escribe el nombre del ejercicio."); return; }
    const muscle = newExercise.muscle.trim();
    const exercise = {
      id: `custom-${Date.now()}`,
      name,
      name_es: name,
      body_part: muscle || "other",
      target: muscle || "other",
      equipment: newExercise.equipment.trim() || "other",
      gif_url: "",
      instructions: [] as string[],
      is_active: true,
      is_hidden: false,
    };
    try {
      await (supabase as any).from("exercises").insert(exercise);
      setCreateStatus("Ejercicio creado y disponible en el catálogo.");
    } catch {
      setCreateStatus("Ejercicio guardado localmente (sin conexión).");
    }
    addCustomExercise(exercise);
    setRows((current) => [exercise as ExerciseRow, ...current]);
    setNewExercise({ name: "", muscle: "", equipment: "", notes: "" });
    setCreateOpen(false);
  };
  useEffect(() => {
    setEquipmentOverrides(Object.fromEntries(Object.entries(loadCatalogOverrides()).map(([id, value]) => [id, value.equipment_id ?? ""])));
    void loadCatalog().then((catalog) => setRows(catalog.map((row) => ({
      id: row.id,
      name: row.name,
      name_es: row.customNameEs ?? row.name_es ?? null,
      body_part: row.body_part,
      target: row.target,
      equipment: row.equipment,
      gif_url: row.image || row.gif_url,
      equipment_id: row.equipment_id,
      customNameEs: row.customNameEs,
    })))).catch(() => {
      void (supabase as any).from("exercises").select("id,name,name_es,body_part,target,equipment,gif_url").eq("is_active", true).order("name")
        .then(({ data }: any) => setRows(data ?? []));
    });
  }, []);
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.name_es ?? ""}`.toLowerCase().includes(query.toLowerCase())), [query, rows]);
  const renameExercise = async (id: string) => {
    const nextName = rename.trim();
    if (!nextName) return;
    await coachEcosystemService.renameExerciseGlobal(id, nextName);
    saveCatalogOverride(id, { customNameEs: nextName });
    setRows((current) => current.map((row) => row.id === id ? { ...row, name_es: nextName, customNameEs: nextName } : row));
    setRenameId(null);
  };
  const saveEquipment = (id: string, equipmentId: string) => {
    saveCatalogOverride(id, {
      equipment_id: equipmentId || undefined,
      availableInCronosGym: Boolean(equipmentId),
    });
    setEquipmentOverrides((current) => ({ ...current, [id]: equipmentId }));
    setRows((current) => current.map((row) => row.id === id ? { ...row, equipment_id: equipmentId } : row));
  };
  return <section className="grid min-w-0 gap-4"><div className={card}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-bold text-white">Gobernanza de ejercicios</h2><button type="button" onClick={() => setRequestOpen(!requestOpen)} className="min-h-11 rounded-xl bg-[#FF3B30] px-3 text-xs font-bold text-white"><Plus size={14} className="mr-1 inline" />Solicitar ejercicio</button><button type="button" onClick={() => setCreateOpen(!createOpen)} className="min-h-11 rounded-xl bg-[#30D158] px-3 text-xs font-bold text-black"><Plus size={14} className="mr-1 inline" />Crear ejercicio</button></div>{requestOpen && <div className="mt-3 grid gap-2"><input className={`${control} h-11 px-3 text-white`} placeholder="Nombre del ejercicio" value={request.name} onChange={(e) => setRequest({ ...request, name: e.target.value })} /><input className={`${control} h-11 px-3 text-white`} placeholder="Músculo principal" value={request.bodyPart} onChange={(e) => setRequest({ ...request, bodyPart: e.target.value })} /><input className={`${control} h-11 px-3 text-white`} placeholder="Equipo" value={request.equipment} onChange={(e) => setRequest({ ...request, equipment: e.target.value })} /><textarea className={`${control} min-h-20 p-3 text-white`} placeholder="Notas biomecánicas" value={request.notes} onChange={(e) => setRequest({ ...request, notes: e.target.value })} /><button type="button" className="h-11 rounded-xl bg-[#30D158] font-semibold text-black" onClick={async () => { await coachEcosystemService.requestExercise(coachId, request); setRequest({ name: "", bodyPart: "", equipment: "", notes: "" }); setRequestOpen(false); }}>Enviar solicitud</button></div>}{createOpen && (
      <div className="mt-3 grid gap-2">
        <input className={`${control} h-11 px-3 text-white`} placeholder="Nombre del ejercicio (español)" value={newExercise.name} onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })} aria-label="Nombre del ejercicio" />
        <input className={`${control} h-11 px-3 text-white`} placeholder="Músculo principal" value={newExercise.muscle} onChange={(e) => setNewExercise({ ...newExercise, muscle: e.target.value })} aria-label="Músculo principal" />
        <input className={`${control} h-11 px-3 text-white`} placeholder="Equipo" value={newExercise.equipment} onChange={(e) => setNewExercise({ ...newExercise, equipment: e.target.value })} aria-label="Equipo" />
        <textarea className={`${control} min-h-20 p-3 text-white`} placeholder="Notas (opcional)" value={newExercise.notes} onChange={(e) => setNewExercise({ ...newExercise, notes: e.target.value })} aria-label="Notas" />
        <button type="button" className="h-11 rounded-xl bg-[#30D158] font-semibold text-black" onClick={() => void createExercise()}>Crear ejercicio</button>
      </div>
    )}{createStatus && <p role="status" className="mt-2 text-sm text-zinc-300">{createStatus}</p>}<label className={`${control} mt-4 flex h-11 items-center gap-2 px-3`}><Search size={16} className="text-zinc-400" /><input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" placeholder="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} /></label>  <div className="mt-3 grid gap-2">{filtered.slice(0, 40).map((row) => <div key={row.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-[#2C2C2E] p-2">        <ExerciseThumb src={row.gif_url} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{getExerciseDisplayName({ name: row.name, name_es: row.name_es })}</strong><span className="block truncate text-xs text-zinc-400">{translateBodyPart(row.body_part)} · {translateEquipment(row.equipment)}</span></div><select aria-label={`Máquina para ${row.name}`} className={`${control} h-11 max-w-40 px-2 text-xs text-white`} value={equipmentOverrides[row.id] ?? row.equipment_id ?? ""} onChange={(event) => saveEquipment(row.id, event.target.value)}><option value="">Sin máquina / piso</option>{Object.entries(equipmentMap).map(([id, equipment]) => <option key={id} value={id}>{id} · {equipment.name}</option>)}</select>{equipmentOverrides[row.id] && <ExerciseThumb src={equipmentMap[equipmentOverrides[row.id]]?.views[0]?.src} />}{!row.gif_url && <span className="ml-2 rounded-full bg-[#FF9F0A]/15 px-2 py-0.5 text-[10px] font-semibold text-[#FF9F0A]">Sin GIF · Pendiente</span>}{renameId === row.id ? <input autoFocus className={`${control} h-11 w-32 px-2 text-sm text-white`} value={rename} onChange={(e) => setRename(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void renameExercise(row.id); }} /> : <button type="button" onClick={() => { setRenameId(row.id); setRename(row.name_es || row.name); }} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-[#1C1C1E] px-3 text-xs text-white"><Pencil size={14} /> Renombrar</button>}</div>)}</div><div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Mis solicitudes enviadas</p>{requests.map((item) => <p key={item.id} className="mt-2 text-sm text-zinc-300">{item.name} · {item.status === "approved" ? "Aprobado" : "Pendiente"}</p>)}</div></div></section>;
}

function ExerciseThumb({ src }: { src?: string | null }) {
  const [broken, setBroken] = useState(!src);
  if (broken) return <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#2C2C2E] text-zinc-400"><Dumbbell size={20} aria-hidden="true" /></span>;
  return <img src={src ?? undefined} alt="" onError={() => setBroken(true)} className="h-12 w-12 shrink-0 rounded-xl object-cover" />;
}
