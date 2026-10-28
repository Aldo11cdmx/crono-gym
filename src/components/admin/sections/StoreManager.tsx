import { useCallback, useEffect, useState } from 'react';
import { GlassButton, GlassCard, Skeleton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from '@/design/tokens';

export function StoreManager() {
  const [loading,setLoading]=useState(true);
  const [products,setProducts]=useState<any[]>([]);
  const [tickets,setTickets]=useState<any[]>([]);
  const [name,setName]=useState('');
  const [price,setPrice]=useState('');
  const [stock,setStock]=useState('0');
  const [status,setStatus]=useState<string | null>(null);
  const [err,setErr]=useState<string | null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setErr(null);
    try{
      const [pRes,tRes]=await Promise.all([(supabase as any).from('products').select('*').order('created_at',{ascending:false}),(supabase as any).from('purchase_tickets').select('*').order('created_at',{ascending:false})]);
      if(pRes.error) throw pRes.error; if(tRes.error) throw tRes.error;
      setProducts(pRes.data??[]);setTickets(tRes.data??[]);
    }catch(e){setErr(e instanceof Error?e.message:'Error al cargar');}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const create=useCallback(async()=>{
    if(!name.trim()) return; setErr(null);setStatus(null);
    try{
      const priceCents=Math.max(0,Math.round(parseFloat(price||'0')*100));
      const {error}=await (supabase as any).from('products').insert({name:name.trim(),price_cents:priceCents,stock:parseInt(stock||'0',10)||0});
      if(error) throw error; setName('');setPrice('');setStock('0');setStatus('Producto creado');load();
    }catch(e){setErr(e instanceof Error?e.message:'Error al crear');}
  },[name,price,stock,load]);

  const updateTicket=useCallback(async(id: string,statusVal: string)=>{
    setErr(null);setStatus(null);
    try{
      const {error}=await (supabase as any).from('purchase_tickets').update({status:statusVal}).eq('id',id);
      if(error) throw error; setStatus('Ticket actualizado');load();
    }catch(e){setErr(e instanceof Error?e.message:'Error al actualizar');}
  },[load]);

  if(loading) return <Skeleton variant='block' height='160px' />;

  return (<div style={{display:'flex',flexDirection:'column',gap:SPACE.lg}}><GlassCard style={{padding:SPACE.lg}}><h3 style={{fontSize:TYPE.subhead.size,fontWeight:TYPE.subhead.weight,color:TEXT.primary,margin:'0 0 '+SPACE.md+' 0'}}>Gestor de Tienda/Productos</h3><div style={{display:'flex',gap:SPACE.sm,flexWrap:'wrap'}}><input value={name} onChange={(e)=>setName(e.target.value)} placeholder='Nombre del producto' style={{flex:1,minWidth:200,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><input value={price} onChange={(e)=>setPrice(e.target.value)} placeholder='Precio' style={{width:140,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><input value={stock} onChange={(e)=>setStock(e.target.value)} placeholder='Stock' style={{width:100,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><GlassButton variant='primary' onClick={create}>Añadir producto</GlassButton></div>{status&&<p style={{color:TEXT.secondary,margin:SPACE.sm+' 0 0 0'}}>{status}</p>}{err&&<p style={{color:TEXT.tertiary,margin:SPACE.sm+' 0 0 0'}}>{err}</p>}<div style={{marginTop:SPACE.md,display:'flex',flexDirection:'column',gap:SPACE.sm}}>{products.map((p)=>(<div key={p.id} style={{padding:SPACE.sm+' '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,display:'flex',justifyContent:'space-between'}}><div><strong style={{color:TEXT.primary}}>{p.name}</strong><div style={{color:TEXT.tertiary}}>{(p.price_cents/100).toFixed(2)} · Stock: {p.stock}</div></div><span style={{color:TEXT.tertiary}}>{p.is_active?'Activo':'Inactivo'}</span></div>))}</div></GlassCard><GlassCard style={{padding:SPACE.lg}}><h3 style={{fontSize:TYPE.subhead.size,fontWeight:TYPE.subhead.weight,color:TEXT.primary,margin:'0 0 '+SPACE.md+' 0'}}>Tickets de compra recibidos</h3><div style={{display:'flex',flexDirection:'column',gap:SPACE.sm}}>{tickets.map((t)=>(<div key={t.id} style={{padding:SPACE.sm+' '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:SPACE.sm}}><div><strong style={{color:TEXT.primary}}>{t.ticket_number}</strong><div style={{color:TEXT.tertiary}}>{t.total_cents/100} · Cantidad: {t.quantity} · Estado: {t.status}</div></div><div style={{display:'flex',gap:SPACE.xs}}><GlassButton variant='ghost' onClick={()=>updateTicket(t.id,'paid')}>Pagado</GlassButton><GlassButton variant='primary' onClick={()=>updateTicket(t.id,'delivered')}>Entregado</GlassButton></div></div>))}</div></GlassCard></div>);}

