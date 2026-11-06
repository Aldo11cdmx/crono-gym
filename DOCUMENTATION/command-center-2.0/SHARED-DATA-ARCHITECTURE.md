# Shared Data Architecture

## Fuentes de verdad
- Supabase: workout_logs, completed_sets, routines, routine_exercises, exercises, profiles, coaches, announcements.
- IndexedDB: SessionDraft, catálogo cacheado.
- Estado local: UI, filtros, tips.

## Flujos
- Train finaliza → finalize_session RPC → historial/métricas/Today.
- Train registra PR → Progress/Today reflejan (cuando se rendericen).
- Plan modifica rutina → Today muestra nuevo entrenamiento.
- ActiveSessionContext cambia → Today y navegación reflejan.
- Coach asigna rutina → Plan/Today del atleta (sujeto a RLS).

## Sin store global nuevo
Contextos y hooks actuales resuelven. No duplicar.

## Offline
- Drafts en IndexedDB.
- Cola drena en online/visibilitychange/60s.
- Catálogo y medios en IndexedDB.