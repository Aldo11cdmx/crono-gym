import { useState } from "react";
import { Shield } from "lucide-react";
import { AnnouncementsManager } from "./sections/AnnouncementsManager";
import { StoreManager } from "./sections/StoreManager";
import { ClassesManager } from "./sections/ClassesManager";
import { UsersRolesManager } from "./sections/UsersRolesManager";
import { ExerciseRequestsManager } from "./sections/ExerciseRequestsManager";

const TABS = [["avisos", "Avisos"], ["tienda", "Tienda"], ["clases", "Clases"], ["usuarios", "Usuarios"], ["ejercicios", "Catálogo"]] as const;
type AdminTab = (typeof TABS)[number][0];

export function AdminHub() {
  const [tab, setTab] = useState<AdminTab>("avisos");
  return (
    <main className="min-h-screen bg-black px-4 pb-36 pt-4 text-white">
      <div className="mx-auto grid max-w-5xl gap-4">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF3B30]/15 text-[#FF3B30]"><Shield size={22} /></div>
        <div><h1 className="text-lg font-bold">Command Center · Admin</h1><p className="text-xs text-zinc-400">Gestión del ecosistema Cronos</p></div>
      </header>
      <nav className="grid grid-cols-5 gap-1 rounded-xl border border-white/10 bg-[#1C1C1E] p-1" aria-label="Secciones de administración">
        {TABS.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`h-11 min-w-0 truncate rounded-lg px-1 text-[11px] font-semibold ${tab === value ? "bg-[#FF3B30] text-white" : "text-zinc-400"}`}>{label}</button>
        ))}
      </nav>
      <section>
        {tab === "avisos" && <AnnouncementsManager />}
        {tab === "tienda" && <StoreManager />}
        {tab === "clases" && <ClassesManager />}
        {tab === "usuarios" && <UsersRolesManager />}
        {tab === "ejercicios" && <ExerciseRequestsManager />}
      </section>
      </div>
    </main>
  );
}
