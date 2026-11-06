# Coach RLS Audit

## Estado: NO VERIFICADO

- No se auditó RLS de tablas coach (coaches, coach_session_requests, coach_messages, profiles) en esta fase.
- CoachFloatingButton y AthleteDetailView consumen datos de coach; aislamiento por usuario no confirmado.
- CoachBanner lee `coaches` (is_active=true, limit 1) sin filtro por user_id visible.

## Clasificación
- Verificado: ninguna política RLS de coach fue verificada.
- Riesgo: posible fuga de datos si RLS no está configurado correctamente.

## Acción requerida
- Auditar migraciones de coach antes de implementar funcionalidades de Coach en Command Center.