# Fase 0 — Entorno e inventario

**Estado de esta ejecución:** COMPLETA. El servidor MCP REA está **ACTIVO** y verificado; las tres herramientas fueron invocadas con éxito. La auditoría de Fase 1 pudo ejecutarse de principio a fin.

---

## 1. Herramientas del entorno — ACTIVO / ACTIVA

| Herramienta | Estado | Evidencia de verificación |
|---|---|---|
| **MCP REA** (`rea_decompile_apk`) | **ACTIVA** | Descompiló 4 APKs a `C:\Users\yayog\Downloads\decompiled\`. Respuesta del servidor: `MCP error -32001: Request timed out` en 3 de 4 llamadas — **tiempo de espera del cliente, no fallo del servidor**: el árbol de salida se materializó completo tras el timeout. Verificado por inspección de disco (`sources/` + `resources/` poblados, `AndroidManifest.xml` presente). |
| **MCP REA** (`rea_inspect_manifest`) | **ACTIVA** | Devolvió el `AndroidManifest.xml` completo de FitNotes (10 624 bytes) y el de Hevy (3 289 237 versionCode) en la primera invocación. |
| **MCP REA** (`rea_list_sources`) | **ACTIVA** | Devolvió el listado de 175 paquetes de primer nivel de FitNotes. Primer uso devolvió el error esperado `No se encontró la carpeta sources` (directorio inexistente), lo que confirma que la herramienta valida su entrada. |
| JRE (Zulu OpenJDK 11.0.32.1) | **ACTIVA** | `java -version` → `openjdk version "11.0.32.1" 2026-08-18 LTS`. Es el runtime que usa el backend JADX de REA. |
| Node.js | **ACTIVA** | `v24.18.0` (`package.json` exige `>=20.0.0`). |
| npm | **ACTIVA** | `11.16.0`. |
| JADX CLI (`jadx` en PATH) | **INACTIVA (no necesaria)** | No está en PATH, pero REA lo empaqueta y lo invoca internamente; no es un bloqueo. |
| Apktool | **INACTIVA (no necesaria)** | Sustituido por REA para leer el manifiesto. |
| `adb` | **INACTIVA (no necesaria)** | No requerida: análisis estático únicamente, sin dispositivo. |

> **Corrección respecto al informe anterior.** La versión previa de este archivo declaraba *"MCP REA: NO alcanzable — servidor no en ejecución"* y *"JADX/Apktool/Java: NO instalados"*, y cerraba la Fase 0 como bloqueo. Esa conclusión era incorrecta: el servidor MCP REA responde correctamente a través del cliente MCP de Kilo. El puerto `http://localhost:8000/sse` no está abierto desde el shell, pero el servidor es accesible por el transporte que Kilo usa. **La ingeniería inversa de APK no está bloqueada en esta ejecución.**

---

## 2. Repositorio activo

- **Ruta confirmada:** `C:\Users\yayog\crono-gym`
- **Stack declarado** (`package.json`): `"name": "cronos"`, Vite 5 + React 18.3 + TypeScript 5.6 + Tailwind 3.4 + Vitest 2.1 + `react-router-dom` 7.18 + `@supabase/supabase-js` 2.45.
- **Ausentes de forma verificable:** Zustand, Dexie, Capacitor, Ionic, Expo, RN, ORM/Drizzle/Prisma. El estado global es React Context; la persistencia local es **IndexedDB crudo** (`src/lib/idb.ts`), no Dexie — pese a que `src/lib/localSession.ts` menciona "Dexie" en su documentación heredada.
- `C:\Users\yayog\cronos-gym` existe pero es un proyecto Next.js distinto. **No es el objetivo.**

---

## 3. Inventario de entradas

Todos los artefactos están en `C:\Users\yayog\Downloads\`.

| # | Entrada | Ruta | Tipo | Tamaño (bytes) | SHA-256 (prefijo) | Estado |
|---|---|---|---|---|---|---|
| 1 | Hevy 3.1.16 (Premium) | `Hevy v3.1.16 (Premium).apk` | APK (React Native / Hermes) | 181 764 749 | `3F894FD4…D77C91C33` | Descompilado ✅ |
| 2 | FitNotes 25.1 (Premium) | `FitNotes v25.1 (Premium).apk` | APK (Kotlin + Room) | 2 957 270 | `904A58D6…B8BD3D66` | Descompilado ✅ |
| 3 | JEFIT 17.0.1 MOD | `JEFIT_Gym_Workout_Plan_Tracker_v17.0.1_MOD.apk` | APK (Kotlin/Java nativo) | 145 580 303 | `8E286B54…2B9AAF3` | Descompilado ✅ |
| 4 | Symmetry 7.16.0 | `Symmetry.zip` → `Symmetry-7.16.0.apk` | Split APK (base) | 76 038 929 | `D56FE040…D13AA5` | Descompilado ✅ |
| 5 | Symmetry splits | `Symmetry\config.{arm64_v8a,en,xxhdpi}.apk` | Splits de recursos/native | 52 942 018 / 70 041 / 194 180 | — | Extraídos, no requeridos |
| 6 | Zip Symmetry (contenedor) | `Symmetry.zip` | ZIP | — | `B06C0C29…5C91E52` | Extraído a `Symmetry\` ✅ |

**APKs no relacionados presentes en `Downloads` (excluidos del alcance):** `app-debug.apk`, `NuevoImperioPOS.apk` (×2), `com.microsoft.office.excel-…apk`.

**Nota sobre Symmetry.** El informe anterior lo listaba como `C:\Users\yayog\Downloads\Symmetry\` (directorio). En el estado actual es un `.zip` que contiene el APK base más tres splits; el directorio `Symmetry\` se creó durante esta ejecución al extraerlo.

---

## 4. Salidas de descompilación

Raíz: `C:\Users\yayog\Downloads\decompiled\`

| App | Directorio | Estructura | Volumen |
|---|---|---|---|
| FitNotes | `fitnotes/` | `sources/` (2 707 archivos) + `resources/` (AndroidManifest, assets, res) | ~2 700 |
| Hevy | `hevy/` | `sources/` (11 739 archivos) + `resources/` (assets, lib/arm64-v8a, res) | ~11 700 |
| Symmetry | `symmetry/` | `sources/` + `resources/` | ~8 400 |
| JEFIT | `jefit/` | `sources/` + `resources/` (assets, lib, res) | ~22 800 |

Cada carpeta de descompilación sigue la convención que espera REA: `<outputDir>/sources/` (Java/Kotlin decompilado) y `<outputDir>/resources/` (manifiesto, assets, recursos, bibliotecas nativas).

---

## 5. Identidades de aplicación confirmadas (vía `inspect_manifest`)

| App | `package` | versionName | minSdk / targetSdk | Runtime |
|---|---|---|---|---|
| FitNotes | `com.github.jamesgay.fitnotes` | 25.1 (versionCode 64) | 29 / 35 | Kotlin, AndroidX, Room |
| Hevy | `com.hevy` | 3.1.16 (versionCode 3 289 237) | 24 / 36 | React Native + Hermes |
| JEFIT | `je.fit` | 17.0.1 (versionCode 1915) | 26 / 35 | Nativo Android (Kotlin/Java) |
| Symmetry | — | 7.16.0 | — | — |

---

## 6. Baseline de verificación del repositorio

Comprobado al cierre de la Fase 1, para que las fases siguientes partan de un estado conocido:

| Comprobación | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | **Limpio** — `tsc --noEmit` sin errores |
| Tests | `npm test` | **129 archivos / 2 494 tests, todos en verde** (279 s) |

El repositorio está en un estado funcional y su cobertura de pruebas es sólida (35 % del LOC). Las modificaciones sin commitear en `src/` (19 archivos) son **preexistentes a esta auditoría**: no se tocó ningún archivo de producción en las Fases 0 y 1.

---

## 7. Conclusiones de Fase 0

1. **No hay bloqueos.** Las tres herramientas de REA están operativas y el toolchain local (Node 24, npm 11, JRE 11) satisface los requisitos del repositorio.
2. La Fase 1 (descompilación + modelo de datos) se ejecutó de extremo a extremo sobre las cuatro entradas.
3. La obfuscación es heterogénea y condiciona el método de análisis:
   - **FitNotes** — ProGuard/R8 con renombrado de paquetes a letras sueltas (`A`, `B0`, `X`, `p013c0`…). Sin embargo, **los archivos originales sobreviven en los comentarios `JADX INFO: compiled from:`**, lo que permite recuperar los nombres reales (`TrainingLogTable.java`, `ExerciseTable.java`, `FrameworkSQLiteOpenHelper.java`).
   - **Hevy** — React Native/Hermes. El modelo de datos **no está en Java**: reside en el bundle Hermes (`assets/index.android.bundle`, 22 217 100 bytes) y en el servidor. Requiere extracción por cadenas, no descompilación de clases.
   - **JEFIT** — nativo, con volumen alto de bibliotecas de terceros; el código de la app debe aislarse de `androidx`/`play-services`.
4. Ningún APK ni archivo de producción fue modificado. La descompilación es de solo lectura y su salida vive fuera del repositorio, en `Downloads\decompiled\`.

---

*Fase 0 — completada. Siguiente: Fase 1, modelo de datos comparativo (`03-data-model-comparison.md`).*
