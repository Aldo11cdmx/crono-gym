import { useCallback, useEffect, useState } from 'react';
import { GlassButton, GlassCard, Skeleton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from '@/design/tokens';

const DAYS=['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];

export function ClassesManager() {
  const [loading,setLoading]=useState(true);
  const [classes,setClasses]=useState<any[]>([]);
  const [schedules,setSchedules]=useState<any[]>([]);
  const [name,setName]=useState('');
  const [instructor,setInstructor]=useState('');
  const [capacity,setCapacity]=useState('20');
  const [classId,setClassId]=useState('');
  const [day,setDay]=useState('1');
  const [time,setTime]=useState('18:00');
  const [status,setStatus]=useState<string | null>(null);
  const [err,setErr]=useState<string | null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setErr(null);
    try{
      const [cRes,sRes]=await Promise.all([(supabase as any).from('gym_classes').select('*').order('created_at',{ascending:false}),(supabase as any).from('gym_schedules').select('*').order('day_of_week')]);
      if(cRes.error) throw cRes.error; if(sRes.error) throw sRes.error;
      setClasses(cRes.data??[]);setSchedules(sRes.data??[]);
      if(!classId && cRes.data?.[0]?.id) setClassId(cRes.data[0].id);
    }catch(e){setErr(e instanceof Error?e.message:'Error al cargar');}finally{setLoading(false);}
  },[classId]);

  useEffect(()=>{load();},[load]);

  const createClass=useCallback(async()=>{
    if(!name.trim()) return; setErr(null);setStatus(null);
    try{
      const {error}=await (supabase as any).from('gym_classes').insert({name:name.trim(),instructor:instructor.trim()||null,capacity:parseInt(capacity||'20',10)||20});
      if(error) throw error; setName('');setInstructor('');setCapacity('20');setStatus('Clase creada');load();
    }catch(e){setErr(e instanceof Error?e.message:'Error al crear');}
  },[name,instructor,capacity,load]);

  const createSchedule=useCallback(async()=>{
    if(!classId) return; setErr(null);setStatus(null);
    try{
      const {error}=await (supabase as any).from('gym_schedules').insert({class_id:classId,day_of_week:parseInt(day,10),start_time:time+':00'});
      if(error) throw error; setStatus('Horario añadido');load();
    }catch(e){setErr(e instanceof Error?e.message:'Error al añadir');}
  },[classId,day,time,load]);

  if(loading) return <Skeleton variant='block' height='160px' />;

  return (<GlassCard style={{padding:SPACE.lg}}><h3 style={{fontSize:TYPE.subhead.size,fontWeight:TYPE.subhead.weight,color:TEXT.primary,margin:'0 0 '+SPACE.md+' 0'}}>Gestor de Clases & Horarios</h3><div style={{display:'flex',flexDirection:'column',gap:SPACE.sm}}><div style={{display:'flex',gap:SPACE.sm,flexWrap:'wrap'}}><input value={name} onChange={(e)=>setName(e.target.value)} placeholder='Nombre de la clase' style={{flex:1,minWidth:200,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><input value={instructor} onChange={(e)=>setInstructor(e.target.value)} placeholder='Instructor' style={{width:160,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><input value={capacity} onChange={(e)=>setCapacity(e.target.value)} placeholder='Cupo' style={{width:80,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><GlassButton variant='primary' onClick={createClass}>Crear clase</GlassButton></div><div style={{display:'flex',gap:SPACE.sm,flexWrap:'wrap',alignItems:'center'}}><select value={classId} onChange={(e)=>setClassId(e.target.value)} style={{minWidth:200,padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}}>{classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select value={day} onChange={(e)=>setDay(e.target.value)} style={{padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}}>{[1,2,3,4,5,6,0].map((d)=><option key={d} value={d}>{DAYS[d]}</option>)}</select><input type='time' value={time} onChange={(e)=>setTime(e.target.value)} style={{padding:'8px '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill,color:TEXT.primary}} /><GlassButton variant='ghost' onClick={createSchedule}>Añadir horario</GlassButton></div>{status&&<p style={{color:TEXT.secondary,margin:0}}>{status}</p>}{err&&<p style={{color:TEXT.tertiary,margin:0}}>{err}</p>}</div><div style={{marginTop:SPACE.md,display:'flex',flexDirection:'column',gap:SPACE.sm}}>{classes.map((c)=>(<div key={c.id} style={{padding:SPACE.sm+' '+SPACE.md,borderRadius:RADIUS.control,border:'1px solid '+GLASS.border,background:GLASS.fill}}><strong style={{color:TEXT.primary}}>{c.name}</strong> {c.instructor&&<span style={{color:TEXT.secondary}}> · {c.instructor}</span>}<div style={{color:TEXT.tertiary,fontSize:TYPE.caption.size}}>Cupo: {c.capacity}</div></div>))}</div><div style={{marginTop:SPACE.md}}><div style={{color:TEXT.secondary,marginBottom:SPACE.sm}}>Horarios</div><div style={{display:'flex',flexDirection:'column',gap:SPACE.xs}}>{schedules.map((s)=>{const cls=classes.find((x)=>x.id===s.class_id);return <div key={s.id} style={{color:TEXT.tertiary}}>{DAYS[s.day_of_week]} {String(s.start_time).slice(0,5)} · {cls?.name||s.class_id}</div>;})}</div></div></GlassCard>);}

