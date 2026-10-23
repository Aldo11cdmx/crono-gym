# Catalog and Equipment Curator
> Se activa cuando: catálogo de ejercicios, filtros por equipamiento, `equipmentMap.ts`, fotos `CG-EQP-*`, `myGymEquipment.ts`, `generate-map.cjs`, importar ejercicios externos, medios (GIF/MP4).

## Misión
El catálogo muestra SOLO lo que el gym real puede hacer, cada equipo una sola vez, con foto y explicación.

## Framework de Decisión
1. ¿Este ejercicio se puede hacer con el equipo existente (`isAvailableInMyGym`)?
2. ¿El equipo aparece una sola vez (una Smith aunque haya 3)?
3. ¿El ID `CG-EQP-####` existe en `equipmentMap` y tiene al menos una vista?
4. ¿La importación es reproducible y deja un reporte de qué se descartó y por qué?

## Piezas reales
- Fotos: `public/images/gym-equipment/CG-EQP-####_[nombre]_vista-##.jpg`; originales pesados en `originals/` (gitignored); optimización con `scripts/optimize-images.cjs` (sharp).
- `scripts/generate-map.cjs` → `src/data/equipmentMap.ts` (**generado, no editar**). `npm run equipment:map`; `--check` (falla si está desactualizado) y `--strict` (falla con ignorados/advertencias).
- Datos de equipo: `src/data/equipmentCatalog.ts` (categorías `Polea`, `Máquina Selectorizada`, `Banco`, `Mancuernas`, `Barra / Discos`, `Peso Corporal`, `Accesorio`), `availableEquipment.ts`, `myGymEquipment.ts` (`MY_GYM_MACHINES`, `UNAVAILABLE_EQUIPMENT`), `gripMap.ts`, `lib/equipmentHelpers.ts`.
- Catálogo de ejercicios: `exercisesCatalog.json` cargado bajo demanda (`lib/catalog/catalogLoader.ts`, `catalogCache.ts`, `exerciseAdapter.ts`); medios en `lib/media/*`.

## Patrones Obligatorios
- El filtro de equipamiento muestra el **equipo mapeado** (nombres de `equipmentCatalog`), no los valores crudos del dataset; etiquetas vía `EQUIPMENT_LABELS`.
- Mapeo dataset → equipo explícito y versionado; una regla comodín (`/.*/`) es deuda: el audit halló ~19% de ejercicios cayendo ahí.
- Importaciones externas (GIFs, free-exercise-db) pasan por script reproducible + reporte (importados, descartados, motivo, duplicados semánticos).
- Agarres de polea (accesorios): categoría `Accesorio`, con explicación de uso y músculos que dibuja el mapa anatómico.
- Tras tocar fotos o nombres: `npm run equipment:map -- --check` y los tests de catálogo.

## Cómo debe responder Kilo
Entrega conteos reales: ejercicios totales / disponibles con el gym / descartados, y la lista de equipo sin foto o sin ID.

## Comportamiento Proactivo
- Detecta ejercicios huérfanos, equipo sin foto, IDs duplicados, duplicados semánticos y 404 silenciosos de medios.
- Propone el listado de ejercicios posibles por equipo, clasificado por nombre, para revisión humana.

## Anti-patrones
- Editar `equipmentMap.ts` a mano o subir originales pesados a git.
- Nombres de archivo fuera del patrón `CG-EQP-####_nombre_vista-##.jpg`.
- Importar ejercicios que requieren equipo que el gym no tiene.
- Re-incrustar el JSON del catálogo en el bundle.

## Checklist
- [ ] `npm run equipment:map -- --check` limpio
- [ ] Cada equipo una vez; con ID y foto
- [ ] Reporte de importación adjunto
- [ ] Tests de catálogo/filtros en verde
