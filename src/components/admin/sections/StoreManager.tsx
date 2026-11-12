import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image/compressImage";
import {
  findStoreMeta,
  readLocalProducts,
  saveLocalProduct,
  saveStoreMeta,
  type LocalProduct,
} from "@/lib/gymClubMetadata";

type Product = { id: string; name: string; description?: string; category?: string; price_cents: number; stock: number; image_path?: string; is_active?: boolean };
type Ticket = { id: string; ticket_number: string; total_cents: number; quantity: number; status: string; product_id: string };
const field = "h-11 rounded-xl border border-white/10 bg-[#2C2C2E] px-3 text-sm text-white";

export function StoreManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [name, setName] = useState(""); const [category, setCategory] = useState("supplements"); const [price, setPrice] = useState(""); const [stock, setStock] = useState("0"); const [image, setImage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const load = useCallback(async () => { const [p, t] = await Promise.all([(supabase as any).from("products").select("*").order("created_at", { ascending: false }), (supabase as any).from("purchase_tickets").select("*").order("created_at", { ascending: false })]); const remote = (p.data ?? []).map((item: Product) => { const meta = findStoreMeta(item.id, item.name); return { ...item, ...meta, image_path: item.image_path ?? meta?.imageUrl }; }); const local = readLocalProducts(); setProducts([...remote, ...local.filter((item) => !remote.some((current: Product) => current.id === item.id))]); setTickets(t.data ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { if (!name.trim()) { setStatus("Escribe un nombre para el producto."); return; } const priceCents = Math.max(0, Math.round(Number(price || 0) * 100)); const payload = { name: name.trim(), category, price_cents: priceCents, stock: Math.max(0, Number(stock) || 0), image_path: image || null }; const { data, error } = await (supabase as any).from("products").insert(payload).select("id").single(); const product: LocalProduct = { id: String(data?.id ?? `local-product-${Date.now()}`), name: name.trim(), category, price_cents: priceCents, stock: payload.stock, image_path: image || undefined, is_active: true, created_at: new Date().toISOString() }; if (error) { saveLocalProduct(product); saveStoreMeta([product.id, product.name], { imageUrl: image || undefined, category }); setProducts((current) => [product, ...current]); setStatus("Producto guardado localmente y publicado en la tienda."); } else { saveStoreMeta([product.id, product.name], { imageUrl: image || undefined, category }); saveLocalProduct(product); setProducts((current) => [product, ...current]); setStatus("Producto añadido a la tienda."); } setName(""); setPrice(""); setStock("0"); setImage(""); if (!error) await load(); };
  const ticket = async (id: string, value: string) => { await (supabase as any).from("purchase_tickets").update({ status: value }).eq("id", id); await load(); };
  return <section className="grid gap-4">
    <div className="grid gap-3"><h2 className="text-base font-bold text-white">Tienda del Gym</h2><div className="grid gap-2 sm:grid-cols-2"><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del producto" /><select className={field} value={category} onChange={(e) => setCategory(e.target.value)}><option value="supplements">Suplementos</option><option value="accessories">Accesorios</option><option value="clothing">Ropa</option><option value="other">Otros</option></select><input className={field} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio en MXN" inputMode="decimal" /><input className={field} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock disponible" inputMode="numeric" /></div><input className={field} value={image} onChange={(e) => setImage(e.target.value)} placeholder="URL de foto del producto (opcional)" /><input className={field} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void compressImage(file).then(setImage); }} />{image ? <img src={image} alt="Vista previa del producto" className="h-20 w-20 rounded-xl object-cover" /> : null}<button type="button" onClick={() => void create()} className="h-11 rounded-xl bg-[#FF3B30] text-sm font-bold text-white">Añadir producto a la tienda</button>{status ? <p className="text-sm text-zinc-300">{status}</p> : null}</div>
    <div className="grid gap-2 sm:grid-cols-2">{products.map((product) => <article key={product.id} className="flex gap-3 rounded-xl bg-[#2C2C2E] p-3">{product.image_path ? <img src={product.image_path} alt="" className="h-16 w-16 rounded-xl object-cover" /> : null}<div className="min-w-0"><strong className="block truncate text-white">{product.name}</strong><span className="font-mono text-xs text-zinc-400">${(product.price_cents / 100).toFixed(2)} MXN · Stock {product.stock}</span></div></article>)}</div>
    <div className="grid gap-2"><h3 className="text-sm font-bold text-white">Tickets de compra recibidos</h3>{tickets.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#2C2C2E] p-3"><span className="font-mono text-xs text-zinc-300">{item.ticket_number} · ${(item.total_cents / 100).toFixed(2)} · {item.status}</span><div className="flex gap-2"><button type="button" className="h-11 rounded-xl bg-[#2C2C2E] px-3 text-xs text-white" onClick={() => void ticket(item.id, "cancelled")}>Cancelar</button><button type="button" className="h-11 rounded-xl bg-[#30D158] px-3 text-xs font-bold text-black" onClick={() => void ticket(item.id, "delivered")}>Confirmar pago y entregar</button></div></div>)}</div>
  </section>;
}
