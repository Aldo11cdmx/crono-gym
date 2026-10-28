import { useCallback, useEffect, useState } from 'react';
import { GlassButton, GlassCard, Skeleton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from '@/design/tokens';

export function UsersRolesManager() {
  const [loading,setLoading]=useState(true);
  const [users,setUsers]=useState<any[]>([]);
  const [email,setEmail]=useState('');
  const [role,setRole]=useState('coach');
  const [status,setStatus]=useState<string | null>(null);
  const [err,setErr]=useState<string | null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setErr(null);
    try{
      const {data,error}=await (supabase as any).from('user_roles').select('*').order('granted_at',{ascending:false});
      if(error) throw error; setUsers(data??[]);
    }catch(e){setErr(e instanceof Error?e.message:'Error al cargar');}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const grant=useCallback(async()=>{
    if(!email.trim()) return; setErr(null);setStatus(null);
    try{
      const {error}=await (supabase as any).rpc('grant_user_role',{target_email:email.trim(),new_role:role});
      if(error) throw error; setEmail('');setStatus('Rol asignado');load();
    }catch(e){setErr(e instanceof Error?e.message:'Error al asignar');}
  },[email,role,load]);

  if(loading) return <Skeleton variant='block' height='160px' />;

  return (<GlassCard style={{padding:SPACE.lg}}><h3 style={{fontSize:TYPE.subhead.size,fontWeight:TYPE.subhead.weight,color:TEXT.primary,margin:'0 0 '+SPACE.md+' 0'}}>Gestor de Usuarios & Roles (Privado)</h3><div style={{display:'flex',gap:SPACE.sm,flexWrap:'wrap',marginBottom:SPACE.md}}><input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder='Email del usuario' style={{flex:1,minWidth:240,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><select value={role} onChange={(e)=>setRole(e.target.value)} style={{padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}}><option value='athlete'>Atleta</option><option value='coach'>Entrenador</option><option value='admin'>Administrador</option></select><GlassButton variant='primary' onClick={grant}>Asignar rol</GlassButton></div>{status&&<p style={{color:TEXT.secondary,margin:'0 0 '+SPACE.sm+' 0'}}>{status}</p>}{err&&<p style={{color:TEXT.tertiary,margin:'0 0 '+SPACE.sm+' 0'}}>{err}</p>}<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{textAlign:'left',color:TEXT.tertiary}}><th style={{padding:SPACE.xs+' 0'}}>Usuario</th><th style={{padding:SPACE.xs+' 0'}}>Rol</th><th style={{padding:SPACE.xs+' 0'}}>Otorgado</th></tr></thead><tbody>{users.map((u)=>(<tr key={u.user_id+u.role} style={{borderTop:'1px solid '+GLASS.border}}><td style={{color:TEXT.primary,padding:SPACE.xs+' 0'}}>{u.user_id}</td><td style={{color:TEXT.secondary}}>{u.role}</td><td style={{color:TEXT.tertiary}}>{new Date(u.granted_at).toLocaleDateString()}</td></tr>))}</tbody></table></div></GlassCard>);}

