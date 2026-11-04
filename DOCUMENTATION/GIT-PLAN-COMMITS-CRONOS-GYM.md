# PLAN DE VERSIONADO Y PREPARACIÓN DE COMMITS — CRONOS GYM (REVISADO)

## 1. Estado inicial de Git

- Rama: `fix/p0-timer-and-session-draft` (up to date con origin).
- Sin modificaciones en archivos rastreados.
- Untracked: `.tmp/`, `DOCUMENTATION/biomechanical-exercise-mapping-master.md`, `DOCUMENTATION/exercise-catalog-batches/` (64 archivos), `DOCUMENTATION/taxonomy-audit/` (74 archivos), 61 scripts `.py` en raíz, `exercises.json`, `DOCUMENTATION/GIT-PLAN-COMMITS-CRONOS-GYM.md`.
- Últimos commits: `8075c86`, `b168cbd`, `69f86c7`, `fa601c8`, `7067e73`.

## 2. Inventario completo — `DOCUMENTATION/exercise-catalog-batches/` (64 archivos)

### Bloque 01 (posiciones 1–90)
- `01-bloque-posiciones-1-90.json` (1.97 MB) — JSON principal del bloque. Permanente. Commit 2.
- `01-PLANTILLA-MAPEO-BIOMECANICO.csv` (43 KB) — plantilla CSV del bloque. Permanente. Commit 2.

### Bloque 02 (91–180)
- `02-bloque-posiciones-91-180.json` (2.11 MB) — JSON principal. Permanente. Commit 2.
- `02-PLANTILLA-MAPEO-BIOMECANICO.csv` (24.8 KB) — plantilla. Permanente. Commit 2.

### Bloque 03 (181–270)
- `03-bloque-posiciones-181-270.json` (1.99 MB) — JSON principal. Permanente. Commit 2.
- `03-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.1 KB) — plantilla. Permanente. Commit 2.

### Bloque 04 (271–360)
- `04-bloque-posiciones-271-360.json` (2.22 MB) — JSON principal. Permanente. Commit 2.
- `04-PLANTILLA-MAPEO-BIOMECANICO.csv` (9.9 KB) — plantilla. Permanente. Commit 2.

### Bloque 05 (361–450)
- `05-bloque-posiciones-361-450.json` (2.10 MB) — JSON principal. Permanente. Commit 2.
- `05-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.0 KB) — plantilla. Permanente. Commit 2.

### Bloque 06 (451–540)
- `06-bloque-posiciones-451-540.json` (2.14 MB) — JSON principal. Permanente. Commit 3.
- `06-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.2 KB) — plantilla. Permanente. Commit 3.

### Bloque 07 (541–630)
- `07-bloque-posiciones-541-630.json` (2.01 MB) — JSON principal. Permanente. Commit 3.
- `07-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.7 KB) — plantilla. Permanente. Commit 3.

### Bloque 08 (631–720)
- `08-bloque-posiciones-631-720.json` (2.03 MB) — JSON principal. Permanente. Commit 3.
- `08-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.7 KB) — plantilla. Permanente. Commit 3.

### Bloque 09 (721–810)
- `09-bloque-posiciones-721-810.json` (2.04 MB) — JSON principal. Permanente. Commit 3.
- `09-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.5 KB) — plantilla. Permanente. Commit 3.

### Bloque 10 (811–900)
- `10-bloque-posiciones-811-900.json` (2.07 MB) — JSON principal. Permanente. Commit 3.
- `10-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.0 KB) — plantilla. Permanente. Commit 3.

### Bloque 11 (901–990)
- `11-bloque-posiciones-901-990.json` (2.10 MB) — JSON principal. Permanente. Commit 4.
- `11-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.3 KB) — plantilla. Permanente. Commit 4.

### Bloque 12 (991–1080)
- `12-bloque-posiciones-991-1080.json` (1.95 MB) — JSON principal. Permanente. Commit 4.
- `12-PLANTILLA-MAPEO-BIOMECANICO.csv` (9.9 KB) — plantilla. Permanente. Commit 4.

### Bloque 13 (1081–1170)
- `13-bloque-posiciones-1081-1170.json` (1.95 MB) — JSON principal. Permanente. Commit 4.
- `13-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.0 KB) — plantilla. Permanente. Commit 4.

### Bloque 14 (1171–1260)
- `14-bloque-posiciones-1171-1260.json` (2.18 MB) — JSON principal. Permanente. Commit 4.
- `14-PLANTILLA-MAPEO-BIOMECANICO.csv` (10.0 KB) — plantilla. Permanente. Commit 4.

### Bloque 15 (1261–1324)
- `15-bloque-posiciones-1261-1324.json` (1.39 MB) — JSON principal. Permanente. Commit 4.
- `15-PLANTILLA-MAPEO-BIOMECANICO.csv` (7.2 KB) — plantilla. Permanente. Commit 4.

### Informes y auxiliares (asignación por bloque/alcance)
- `ANALISIS-LOTE-04-POSICIONES-161-180.md` (32.8 KB) — análisis lote 4. Permanente. Commit 2.
- `AUDITORIA-BLOQUE-01-POSICIONES-1-90.md` (1.46 KB) — auditoría bloque 1. Permanente. Commit 2.
- `AUDITORIA-FINAL-BLOQUE-01.md` (1.63 KB) — cierre bloque 1. Permanente. Commit 2.
- `AUDITORIA-FINAL-CIERRE-BLOQUE-02-POSICIONES-91-180.md` (1.04 KB) — cierre bloque 2. Permanente. Commit 2.
- `AUDITORIA-INTEGRAL-MAPEO-BIOMECANICO.txt` (0.96 KB) — auditoría integral. Permanente. Commit 1 (metodología).
- `CATEGORIAS-INCONSISTENCIAS.txt` (0.28 KB) — inconsistencias. Permanente. Commit 1.
- `COMPARACION-PRIMEROS-10-ANTERIOR-CORREGIDA.md` (12.1 KB) — comparación. Permanente. Commit 2.
- `COMPARACION-PRIMEROS-20-ANTERIOR-CORREGIDA.md` (25.7 KB) — comparación. Permanente. Commit 2.
- `CONTROL-AVANCE-MAPEO.csv` (0.23 KB) — control de avance. Permanente. Commit 1.
- `CORRECCION-FINAL-LOTE3-146-160.md` (0.70 KB) — corrección lote 3. Permanente. Commit 3.
- `CORRECCION-LOTE-04-POSICIONES-161-180.md` (0.75 KB) — corrección lote 4. Permanente. Commit 2.
- `CORRECCION-LOTE3-131-145.md` (2.60 KB) — corrección lote 3. Permanente. Commit 3.
- `CORRECCION-LOTE3-146-160.md` (1.05 KB) — corrección lote 3. Permanente. Commit 3.
- `CORRECCION-PUNTUAL-LOTE3-0051-0052-1410.md` (1.20 KB) — corrección puntual. Permanente. Commit 3.
- `CRITERIOS-CRUCE-CG-EQP.txt` (0.56 KB) — criterios de cruce. Permanente. Commit 1.
- `DICCIONARIO-BIOMECANICO-ES.txt` (1.02 KB) — diccionario. Permanente. Commit 1.
- `INDICE-CATALOG0.json` (2.36 KB) — índice del catálogo. Permanente. Commit 1.
- `INDICE-CATALOG0.txt` (2.05 KB) — índice. Permanente. Commit 1.
- `INDICE-GENERAL.json` (9.84 KB) — índice general. Permanente. Commit 1.
- `INDICE-GENERAL.md` (3.43 KB) — índice general. Permanente. Commit 1.
- `INDICE-PLANTILLAS-MAPEO.md` (1.50 KB) — índice de plantillas. Permanente. Commit 1.
- `INFORME-LOTE2-111-130.md` (1.93 KB) — informe lote 2. Permanente. Commit 2.
- `INFORME-LOTE3-131-160.md` (1.60 KB) — informe lote 3. Permanente. Commit 3.
- `LOTE-11-20-EVIDENCIA.txt` (10.4 KB) — evidencia primeros 20. Permanente. Commit 2.
- `LOTE-11-20-FILAS-CORREGIDAS.txt` (10.3 KB) — filas corregidas. Permanente. Commit 2.
- `LOTE-11-20-LISTA.md` (10.0 KB) — lista. Permanente. Commit 2.
- `PROPUESTA-CIERRE-BIOMECANICO-BLOQUE-01.md` (51.4 KB) — propuesta de cierre bloque 1. Permanente. Commit 2.
- `REGISTRO-DUDAS-BIOMECANICAS.md` (0.13 KB) — registro de dudas. Permanente. Commit 1.
- `REPORTE-CORRECCION-LOTE2-111-130.md` (3.92 KB) — reporte corrección lote 2. Permanente. Commit 2.
- `REVISION-COMPLEMENTARIA-BLOQUE-01.md` (7.53 KB) — revisión complementaria. Permanente. Commit 2.
- `SEGUNDA-AUDITORIA-PRIMEROS-10.txt` (11.0 KB) — segunda auditoría. Permanente. Commit 2.
- `VALIDACION-FINAL-INTEGRIDAD-PRIMEROS-10.txt` (1.75 KB) — validación final. Permanente. Commit 2.
- `VALIDACION-LOTE3-131-160.md` (0.40 KB) — validación lote 3. Permanente. Commit 3.
- `.tmp_header.txt` (0.45 KB) — temporal. Excluir (conservar local).

## 3. Inventario — `DOCUMENTATION/taxonomy-audit/` (74 archivos)

Todos los archivos `00-` a `69-` son documentos secuenciales de la auditoría taxonómica; cada uno es permanente (decisiones, gates, matrices, vocabularios). Los 3 CSV (`09-pilot-matrix.csv`, `64-exercise-classification-matrix.csv`, `68-leg-exercise-batches.csv`) y `audit-manifest.json`, `findings.csv`, `vocabulary-distribution.csv` son datos permanentes del proceso. Ninguno es temporal.

Exclusiones dentro de esta carpeta: ninguna. (Si el propietario considera que algún gate intermedio es redundante, puede excluirse, pero todos aportan trazabilidad.)

## 4. Inventario — scripts Python raíz (61)

Todos los `.py` ad-hoc se excluyen de los commits de esta fase (conservar localmente). No se eliminan. Si se decide versionar herramientas, mover a `scripts/` en commit posterior.

## 5. Manifiestos de commits

### Commit 1 — Documentación maestra del mapeo biomecánico
Archivos:
- `DOCUMENTATION/biomechanical-exercise-mapping-master.md`
- `DOCUMENTATION/exercise-catalog-batches/AUDITORIA-INTEGRAL-MAPEO-BIOMECANICO.txt`
- `DOCUMENTATION/exercise-catalog-batches/CATEGORIAS-INCONSISTENCIAS.txt`
- `DOCUMENTATION/exercise-catalog-batches/CONTROL-AVANCE-MAPEO.csv`
- `DOCUMENTATION/exercise-catalog-batches/CRITERIOS-CRUCE-CG-EQP.txt`
- `DOCUMENTATION/exercise-catalog-batches/DICCIONARIO-BIOMECANICO-ES.txt`
- `DOCUMENTATION/exercise-catalog-batches/INDICE-CATALOG0.json`
- `DOCUMENTATION/exercise-catalog-batches/INDICE-CATALOG0.txt`
- `DOCUMENTATION/exercise-catalog-batches/INDICE-GENERAL.json`
- `DOCUMENTATION/exercise-catalog-batches/INDICE-GENERAL.md`
- `DOCUMENTATION/exercise-catalog-batches/INDICE-PLANTILLAS-MAPEO.md`
- `DOCUMENTATION/exercise-catalog-batches/REGISTRO-DUDAS-BIOMECANICAS.md`
- `DOCUMENTATION/GIT-PLAN-COMMITS-CRONOS-GYM.md`

### Commit 2 — Catálogo bloques 01–05
Archivos (JSON+CSV de bloques 01–05 + informes/auxiliares de esos bloques):
- `01-bloque-posiciones-1-90.json`, `01-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `02-bloque-posiciones-91-180.json`, `02-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `03-bloque-posiciones-181-270.json`, `03-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `04-bloque-posiciones-271-360.json`, `04-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `05-bloque-posiciones-361-450.json`, `05-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `ANALISIS-LOTE-04-POSICIONES-161-180.md`
- `AUDITORIA-BLOQUE-01-POSICIONES-1-90.md`
- `AUDITORIA-FINAL-BLOQUE-01.md`
- `AUDITORIA-FINAL-CIERRE-BLOQUE-02-POSICIONES-91-180.md`
- `COMPARACION-PRIMEROS-10-ANTERIOR-CORREGIDA.md`
- `COMPARACION-PRIMEROS-20-ANTERIOR-CORREGIDA.md`
- `CORRECCION-LOTE-04-POSICIONES-161-180.md`
- `INFORME-LOTE2-111-130.md`
- `LOTE-11-20-EVIDENCIA.txt`
- `LOTE-11-20-FILAS-CORREGIDAS.txt`
- `LOTE-11-20-LISTA.md`
- `PROPUESTA-CIERRE-BIOMECANICO-BLOQUE-01.md`
- `REPORTE-CORRECCION-LOTE2-111-130.md`
- `REVISION-COMPLEMENTARIA-BLOQUE-01.md`
- `SEGUNDA-AUDITORIA-PRIMEROS-10.txt`
- `VALIDACION-FINAL-INTEGRIDAD-PRIMEROS-10.txt`

### Commit 3 — Catálogo bloques 06–10
- `06-bloque-posiciones-451-540.json`, `06-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `07-bloque-posiciones-541-630.json`, `07-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `08-bloque-posiciones-631-720.json`, `08-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `09-bloque-posiciones-721-810.json`, `09-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `10-bloque-posiciones-811-900.json`, `10-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `CORRECCION-FINAL-LOTE3-146-160.md`
- `CORRECCION-LOTE3-131-145.md`
- `CORRECCION-LOTE3-146-160.md`
- `CORRECCION-PUNTUAL-LOTE3-0051-0052-1410.md`
- `INFORME-LOTE3-131-160.md`
- `VALIDACION-LOTE3-131-160.md`

### Commit 4 — Catálogo bloques 11–15
- `11-bloque-posiciones-901-990.json`, `11-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `12-bloque-posiciones-991-1080.json`, `12-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `13-bloque-posiciones-1081-1170.json`, `13-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `14-bloque-posiciones-1171-1260.json`, `14-PLANTILLA-MAPEO-BIOMECANICO.csv`
- `15-bloque-posiciones-1261-1324.json`, `15-PLANTILLA-MAPEO-BIOMECANICO.csv`

### Commit 5 — Auditorías de taxonomía
Todos los 74 archivos de `DOCUMENTATION/taxonomy-audit/` (69 MD + 3 CSV + `audit-manifest.json` + `findings.csv` + `vocabulary-distribution.csv`).

## 6. Exclusiones (conservar localmente, no versionar)

- `.tmp/` (todo).
- `exercises.json` (17.4 MB, regenerable).
- `DOCUMENTATION/exercise-catalog-batches/.tmp_header.txt`.
- 61 scripts `.py` ad-hoc en raíz (versiones iterativas no consolidadas).
- `.tmp/phase3a8`, `.tmp/phase3a9`, `.tmp/taxonomy-audit`.

No se modifica `.gitignore` en esta fase.

## 7. Comandos PowerShell exactos

### Verificación previa
```powershell
git -C "C:\Users\yayog\crono-gym" status --short
git -C "C:\Users\yayog\crono-gym" status --branch
```

### Commit 1 — Master
```powershell
git -C "C:\Users\yayog\crono-gym" add "DOCUMENTATION/biomechanical-exercise-mapping-master.md" "DOCUMENTATION/exercise-catalog-batches/AUDITORIA-INTEGRAL-MAPEO-BIOMECANICO.txt" "DOCUMENTATION/exercise-catalog-batches/CATEGORIAS-INCONSISTENCIAS.txt" "DOCUMENTATION/exercise-catalog-batches/CONTROL-AVANCE-MAPEO.csv" "DOCUMENTATION/exercise-catalog-batches/CRITERIOS-CRUCE-CG-EQP.txt" "DOCUMENTATION/exercise-catalog-batches/DICCIONARIO-BIOMECANICO-ES.txt" "DOCUMENTATION/exercise-catalog-batches/INDICE-CATALOG0.json" "DOCUMENTATION/exercise-catalog-batches/INDICE-CATALOG0.txt" "DOCUMENTATION/exercise-catalog-batches/INDICE-GENERAL.json" "DOCUMENTATION/exercise-catalog-batches/INDICE-GENERAL.md" "DOCUMENTATION/exercise-catalog-batches/INDICE-PLANTILLAS-MAPEO.md" "DOCUMENTATION/exercise-catalog-batches/REGISTRO-DUDAS-BIOMECANICAS.md" "DOCUMENTATION/GIT-PLAN-COMMITS-CRONOS-GYM.md"
git -C "C:\Users\yayog\crono-gym" diff --cached --stat
git -C "C:\Users\yayog\crono-gym" commit -m "docs(catalog): add biomechanical exercise mapping master, indices and methodology"
git -C "C:\Users\yayog\crono-gym" log -1 --oneline
git -C "C:\Users\yayog\crono-gym" show --stat --oneline HEAD
git -C "C:\Users\yayog\crono-gym" status --short
```

### Commit 2 — Bloques 01–05
```powershell
git -C "C:\Users\yayog\crono-gym" add "DOCUMENTATION/exercise-catalog-batches/01-bloque-posiciones-1-90.json" "DOCUMENTATION/exercise-catalog-batches/01-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/02-bloque-posiciones-91-180.json" "DOCUMENTATION/exercise-catalog-batches/02-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/03-bloque-posiciones-181-270.json" "DOCUMENTATION/exercise-catalog-batches/03-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/04-bloque-posiciones-271-360.json" "DOCUMENTATION/exercise-catalog-batches/04-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/05-bloque-posiciones-361-450.json" "DOCUMENTATION/exercise-catalog-batches/05-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/ANALISIS-LOTE-04-POSICIONES-161-180.md" "DOCUMENTATION/exercise-catalog-batches/AUDITORIA-BLOQUE-01-POSICIONES-1-90.md" "DOCUMENTATION/exercise-catalog-batches/AUDITORIA-FINAL-BLOQUE-01.md" "DOCUMENTATION/exercise-catalog-batches/AUDITORIA-FINAL-CIERRE-BLOQUE-02-POSICIONES-91-180.md" "DOCUMENTATION/exercise-catalog-batches/COMPARACION-PRIMEROS-10-ANTERIOR-CORREGIDA.md" "DOCUMENTATION/exercise-catalog-batches/COMPARACION-PRIMEROS-20-ANTERIOR-CORREGIDA.md" "DOCUMENTATION/exercise-catalog-batches/CORRECCION-LOTE-04-POSICIONES-161-180.md" "DOCUMENTATION/exercise-catalog-batches/INFORME-LOTE2-111-130.md" "DOCUMENTATION/exercise-catalog-batches/LOTE-11-20-EVIDENCIA.txt" "DOCUMENTATION/exercise-catalog-batches/LOTE-11-20-FILAS-CORREGIDAS.txt" "DOCUMENTATION/exercise-catalog-batches/LOTE-11-20-LISTA.md" "DOCUMENTATION/exercise-catalog-batches/PROPUESTA-CIERRE-BIOMECANICO-BLOQUE-01.md" "DOCUMENTATION/exercise-catalog-batches/REPORTE-CORRECCION-LOTE2-111-130.md" "DOCUMENTATION/exercise-catalog-batches/REVISION-COMPLEMENTARIA-BLOQUE-01.md" "DOCUMENTATION/exercise-catalog-batches/SEGUNDA-AUDITORIA-PRIMEROS-10.txt" "DOCUMENTATION/exercise-catalog-batches/VALIDACION-FINAL-INTEGRIDAD-PRIMEROS-10.txt"
git -C "C:\Users\yayog\crono-gym" diff --cached --stat
git -C "C:\Users\yayog\crono-gym" commit -m "docs(catalog): add biomechanical exercise catalog batches 01-05 and reports"
git -C "C:\Users\yayog\crono-gym" log -1 --oneline
git -C "C:\Users\yayog\crono-gym" show --stat --oneline HEAD
git -C "C:\Users\yayog\crono-gym" status --short
```

### Commit 3 — Bloques 06–10
```powershell
git -C "C:\Users\yayog\crono-gym" add "DOCUMENTATION/exercise-catalog-batches/06-bloque-posiciones-451-540.json" "DOCUMENTATION/exercise-catalog-batches/06-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/07-bloque-posiciones-541-630.json" "DOCUMENTATION/exercise-catalog-batches/07-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/08-bloque-posiciones-631-720.json" "DOCUMENTATION/exercise-catalog-batches/08-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/09-bloque-posiciones-721-810.json" "DOCUMENTATION/exercise-catalog-batches/09-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/10-bloque-posiciones-811-900.json" "DOCUMENTATION/exercise-catalog-batches/10-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/CORRECCION-FINAL-LOTE3-146-160.md" "DOCUMENTATION/exercise-catalog-batches/CORRECCION-LOTE3-131-145.md" "DOCUMENTATION/exercise-catalog-batches/CORRECCION-LOTE3-146-160.md" "DOCUMENTATION/exercise-catalog-batches/CORRECCION-PUNTUAL-LOTE3-0051-0052-1410.md" "DOCUMENTATION/exercise-catalog-batches/INFORME-LOTE3-131-160.md" "DOCUMENTATION/exercise-catalog-batches/VALIDACION-LOTE3-131-160.md"
git -C "C:\Users\yayog\crono-gym" diff --cached --stat
git -C "C:\Users\yayog\crono-gym" commit -m "docs(catalog): add biomechanical exercise catalog batches 06-10 and reports"
git -C "C:\Users\yayog\crono-gym" log -1 --oneline
git -C "C:\Users\yayog\crono-gym" show --stat --oneline HEAD
git -C "C:\Users\yayog\crono-gym" status --short
```

### Commit 4 — Bloques 11–15
```powershell
git -C "C:\Users\yayog\crono-gym" add "DOCUMENTATION/exercise-catalog-batches/11-bloque-posiciones-901-990.json" "DOCUMENTATION/exercise-catalog-batches/11-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/12-bloque-posiciones-991-1080.json" "DOCUMENTATION/exercise-catalog-batches/12-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/13-bloque-posiciones-1081-1170.json" "DOCUMENTATION/exercise-catalog-batches/13-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/14-bloque-posiciones-1171-1260.json" "DOCUMENTATION/exercise-catalog-batches/14-PLANTILLA-MAPEO-BIOMECANICO.csv" "DOCUMENTATION/exercise-catalog-batches/15-bloque-posiciones-1261-1324.json" "DOCUMENTATION/exercise-catalog-batches/15-PLANTILLA-MAPEO-BIOMECANICO.csv"
git -C "C:\Users\yayog\crono-gym" diff --cached --stat
git -C "C:\Users\yayog\crono-gym" commit -m "docs(catalog): add biomechanical exercise catalog batches 11-15"
git -C "C:\Users\yayog\crono-gym" log -1 --oneline
git -C "C:\Users\yayog\crono-gym" show --stat --oneline HEAD
git -C "C:\Users\yayog\crono-gym" status --short
```

### Commit 5 — Auditorías de taxonomía
```powershell
git -C "C:\Users\yayog\crono-gym" add "DOCUMENTATION/taxonomy-audit/"
git -C "C:\Users\yayog\crono-gym" diff --cached --stat
git -C "C:\Users\yayog\crono-gym" commit -m "docs(taxonomy): add taxonomy audit reports"
git -C "C:\Users\yayog\crono-gym" log -1 --oneline
git -C "C:\Users\yayog\crono-gym" show --stat --oneline HEAD
git -C "C:\Users\yayog\crono-gym" status --short
```

## 8. Verificaciones antes/después de cada commit

Antes: `git diff --cached --stat` + `git status --short`.
Después: `git log -1 --oneline`, `git show --stat --oneline HEAD`, `git status --short`.
Confirmar que no se incluyan exclusiones (`.tmp/`, `exercises.json`, `.tmp_header.txt`, scripts `.py`).

## 9. Mensajes de commit definitivos

- `docs(catalog): add biomechanical exercise mapping master, indices and methodology`
- `docs(catalog): add biomechanical exercise catalog batches 01-05 and reports`
- `docs(catalog): add biomechanical exercise catalog batches 06-10 and reports`
- `docs(catalog): add biomechanical exercise catalog batches 11-15`
- `docs(taxonomy): add taxonomy audit reports`

## Resumen de cambios al plan

Se completó el inventario de los 64 archivos del catálogo y los 74 de taxonomía. Se generaron manifiestos exactos por commit, incluyendo todos los informes/auxiliares permanentes. `.tmp_header.txt`, `.tmp/`, `exercises.json` y scripts `.py` ad-hoc permanecen excluidos (conservar localmente). `GIT-PLAN-COMMITS-CRONOS-GYM.md` se incorpora al commit 1. A la espera de autorización humana explícita.
", filePath: "C:\Users\yayog\crono-gym\DOCUMENTATION\GIT-PLAN-COMMITS-CRONOS-GYM.md"}