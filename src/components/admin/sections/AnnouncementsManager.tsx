import { useCallback, useEffect, useState } from 'react';
import { GlassButton, GlassCard, Skeleton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from '@/design/tokens';

export function AnnouncementsManager() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState('notice');
  const [expires, setExpires] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const { data, error } = await (supabase as any).from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error; setItems(data ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async () => {
    if (!title.trim() || !message.trim() || !expires) return;
    setErr(null); setStatus(null);
    try {
      const { error } = await (supabase as any).from('announcements').insert({ title: title.trim(), message: message.trim(), kind, starts_at: new Date().toISOString(), expires_at: new Date(expires).toISOString() });
      if (error) throw error;
      setTitle(''); setMessage(''); setExpires(''); setStatus('Anuncio creado'); load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al crear');
    }
  }, [title, message, kind, expires, load]);

  if (loading) return <Skeleton variant='block' height='120px' />;

  return (
    <GlassCard style={{ padding: SPACE.lg }}>
      <h3 style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight, color: TEXT.primary, margin: '0 0 ' + SPACE.md + ' 0' }}>Gestor de Avisos</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Título' style={{ flex: 1, minWidth: 200, padding: '8px ' + SPACE.md, borderRadius: RADIUS.control, border: '1px solid ' + GLASS.border, background: GLASS.fill, color: TEXT.primary }} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ padding: '8px ' + SPACE.md, borderRadius: RADIUS.control, border: '1px solid ' + GLASS.border, background: GLASS.fill, color: TEXT.primary }}><option value='notice'>Aviso</option><option value='promo'>Promoción</option><option value='event'>Evento</option></select>
          <input type='datetime-local' value={expires} onChange={(e) => setExpires(e.target.value)} style={{ padding: '8px ' + SPACE.md, borderRadius: RADIUS.control, border: '1px solid ' + GLASS.border, background: GLASS.fill, color: TEXT.primary }} />
          <GlassButton variant='primary' onClick={create}>Crear anuncio</GlassButton>
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder='Mensaje' rows={2} style={{ width: '100%', padding: SPACE.sm + ' ' + SPACE.md, borderRadius: RADIUS.control, border: '1px solid ' + GLASS.border, background: GLASS.fill, color: TEXT.primary, resize: 'vertical' }} />
        {status && <p style={{ color: TEXT.secondary, margin: 0 }}>{status}</p>}
        {err && <p style={{ color: TEXT.tertiary, margin: 0 }}>{err}</p>}
      </div>
      <div style={{ marginTop: SPACE.md, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {items.map((a) => (
          <div key={a.id} style={{ padding: SPACE.sm + ' ' + SPACE.md, borderRadius: RADIUS.control, border: '1px solid ' + GLASS.border, background: GLASS.fill }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: TEXT.primary }}>{a.title}</strong><span style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>{a.kind}</span></div>
            <p style={{ color: TEXT.secondary, margin: SPACE.xs + ' 0 0 0' }}>{a.message}</p>
            <p style={{ color: TEXT.tertiary, margin: SPACE.xs + ' 0 0 0', fontSize: TYPE.caption.size }}>Caduca: {new Date(a.expires_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

