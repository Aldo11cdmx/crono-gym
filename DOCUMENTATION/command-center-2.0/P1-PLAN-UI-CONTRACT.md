# P1 — Contrato mínimo de datos para Plan (UI Wiring)

## Dictamen: APROBADO CON LIMITACIONES

Los datos necesarios existen en `useDashboardSessions`, `ActiveSessionContext` y `useOfflineSync`. El contrato propuesto no requiere consultas nuevas ni cambios en persistencia. Limitación: la distinción "confirmado en servidor vs pendiente de sync" depende de exponer el estado de la cola offline (`useOfflineSync`) a `RoutinesPage`; hoy esa integración no está cableada en Plan.

## 1. Contrato TypeScript propuesto

```ts
// src/components/routines/WeeklyPlanner.tsx (futuro, no implementado aún)
export interface DaySessionStatus {
  /** Rutina programada para este día (null si no hay). */
  routineId: string | null;
  /** Confirmado en Supabase para esta rutina y fecha. */
  confirmed: boolean;
  /** Finalizado localmente pero pendiente de sync. */
  syncPending: boolean;
}

export interface WeeklyPlannerProps {
  routines: DayAssignment[];
  initialAssignments: WeeklyAssignment[];
  onChange: (assignments: WeeklyAssignment[]) => void;
  todayIndex?: number;
  trainedDays?: Set<string>;
  deloadActive?: boolean;
  activeRoutineId?: string | null;
  onStartDay?: (dayIndex: number) => void;
  onStartToday?: (dayIndex: number) => void;

  // --- NUEVO CONTRATO MÍNIMO (P1.2) ---
  /** Mapa dayIndex -> estado de sesión para esa rutina/fecha. */
  daySessionStatus?: Record<number, DaySessionStatus>;
  /** Id de la sesión activa (si corresponde a una rutina programada). */
  activeSessionRoutineId?: string | null;
  /** Id de la rutina del borrador recuperable, si aplica. */
  recoverableDraftRoutineId?: string | null;
}
```

## 2. Propietario de cada dato

| Dato | Propietario | Fuente |
|---|---|---|
| Rutinas programadas (dayIndex/dayLabel) | useRoutines | Supabase `routines`/`routine_exercises` |
| Sesiones confirmadas (routineId, startedAt, completedAt) | useDashboardSessions | Supabase `workout_logs` |
| Sesión activa (routineId) | ActiveSessionContext | memoria + draft |
| Borrador recuperable (routineId) | ActiveSessionContext | IndexedDB |
| Sync pendiente | useOfflineSync | cola offline |
| Fecha local / todayIndex | WeeklyPlanner (prop) | `new Date()` |

## 3. Flujo de datos

1. `RoutinesPage` compone: `useRoutines` + `useDashboardSessions` (reusado, no duplicado) + `useActiveSession` + `useOfflineSync`.
2. Deriva `daySessionStatus[dayIndex]` a partir de sesiones confirmadas (routineId + fecha local) y sync pendiente.
3. Pasa el mapa a `WeeklyPlanner` como prop.
4. `WeeklyPlanner` llama a `deriveDayPlanStatus` por día (una sola función, sin duplicar lógica) y renderiza el estado.

## 4. Justificación de propiedades

- `daySessionStatus`: contrato mínimo y explícito; separa confirmado de sync pendiente.
- `activeSessionRoutineId`: permite estado "en curso" sin exponer `ActiveSessionContext` completo.
- `recoverableDraftRoutineId`: permite estado "interrumpido" sin exponer el draft.

## 5. Ejemplos de estados

- Rutina programada + sesión confirmada misma rutina/fecha → `completed`.
- Rutina programada + ninguna sesión → `pending` (hoy) / `not_done` (día pasado).
- Sesión de otra rutina → no completa la programada → `not_done`/`pending`.
- Sesión activa de la rutina programada → `in_progress`.
- Borrador recuperable → `in_progress`.
- Sesión finalizada pendiente de sync → `sync_pending`.
- Día futuro → `pending`.
- Día sin rutina → `no_routine`.
- Cambio de usuario → datos provienen de hooks ya filtrados por userId; sin mezcla.

## 6. Riesgos y casos límite

- Si `useOfflineSync` no está montado en Plan, `syncPending` siempre false → limitación documentada (no inventar).
- `trainedDays` (Set de nombres) es legado; el nuevo contrato lo complementa, no lo reemplaza.
- Zona horaria: usar `localDateKey` ya existente en dashboardMetrics.

## 7. Consultas reutilizadas

- `useDashboardSessions` (ya existente, no duplicar).
- `useRoutines` (ya existente).
- `ActiveSessionContext` (ya disponible en shell).
- `useOfflineSync` (reusar si está disponible).

## 8. Archivos a modificar en futura integración

- `src/components/routines/WeeklyPlanner.tsx` (props + render de estado).
- `src/components/dashboard/RoutinesPage.tsx` (composición de datos).
- Tests de WeeklyPlanner y RoutinesPage.

## 9. Tests necesarios

- Estados por día con datos confirmados/sync pending/activos/borrador.
- Rutina alternativa no completa la programada.
- Cambio de usuario no mezcla.
- Zona horaria local.

## 11. Ajuste final del modelo temporal (P1.2)

### 11.1 Clave de estado: dateKey + routineId

Se **descarta** `Record<number, DaySessionStatus>` indexado solo por `dayIndex`. El `dayIndex` (0–6) es posición en la semana, no fecha única; reutilizarlo entre semanas causa colisiones.

Contrato corregido:

```ts
export interface DaySessionKey {
  /** Fecha local YYYY-MM-DD (localDateKey). */
  dateKey: string;
  /** Rutina programada para ese día (null si no hay). */
  routineId: string | null;
}

export interface DaySessionStatus {
  key: DaySessionKey;
  confirmed: boolean;       // confirmado en Supabase
  syncPending: boolean;      // finalizado local, pendiente de sync
}

/** Mapa clave serializada "dateKey|routineId" -> estado. */
export type DaySessionStatusMap = Record<string, DaySessionStatus>;
```

La serialización `dateKey|routineId` evita colisiones entre semanas y entre rutinas.

### 11.2 Fecha local

- Usar `localDateKey(new Date())` (ya existente en `dashboardMetrics`) para el día actual.
- Para cada día del plan, calcular `dateKey` con `localDateKey(day)` (ya usado en `getWeeklyPlan`).
- Nunca usar `toISOString().slice(0,10)` (UTC) ni `Date.parse` sin zona.

### 11.3 Identidad temporal de sesión activa y borrador

- Sesión activa: se considera "en curso" para la rutina `activeRoutineId` **solo si** su `startedAt` local cae en el `dateKey` actual. Si la sesión activa corresponde a un día anterior (sesión olvidada), no se marca ese día pasado como "en curso"; se trata como `not_done` salvo que haya sesión confirmada.
- Borrador recuperable: se considera "interrumpido" para `recoverableDraftRoutineId` **solo si** su `startedAt` local cae en el `dateKey` actual. Un borrador de un día anterior no revive ese día.

Esto evita que una sesión olvidada marque días pasados como "en curso".

### 11.4 Sesión alternativa

- Una sesión completada de una rutina distinta a la programada **no** se asocia a la rutina programada: el mapa se indexa por `routineId` de la sesión real, no por el día.
- Por tanto, si el día tiene rutina R1 programada y el usuario completa R2, el estado de R1 sigue siendo `pending`/`not_done` según fecha; R2 aparece en historial pero no altera el plan.
- No se modifica ni elimina la asignación original.

### 11.5 Comportamiento sin useOfflineSync

- Si `useOfflineSync` no está disponible en `RoutinesPage`, `syncPending` se asume `false` para todos los días.
- En ese caso no se puede distinguir "finalizado local pendiente" de "no realizado"; el estado `sync_pending` queda inalcanzable y se documenta como limitación, no se inventa.
- Cuando `useOfflineSync` se conecte, el estado se actualiza automáticamente sin cambiar el contrato.

### 11.6 Ejemplo multi-semana

Semana A (lun 1 dic): rutina R1 programada lun/mié. Sesión confirmada de R1 el lun 1 dic → lun `completed`, mié `pending` (hoy mié sin sesión), vie `no_routine`.
Semana B (lun 8 dic): misma rutina R1 programada lun/mié. Sin sesiones → ambos `pending` (lun ya pasado → `not_done` si dayEnded).

La clave `dateKey|routineId` distingue "2025-12-01|R1" de "2025-12-08|R1".

### 11.7 Dictamen actualizado

El contrato, con la clave `dateKey|routineId` y las reglas temporales anteriores, **permite implementar la integración sin ambigüedades** respecto a fechas y sesiones alternativas. La única limitación restante es la disponibilidad de `useOfflineSync` en Plan (documentada). Espera autorización expresa para modificar código.

