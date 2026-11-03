# Catalog Spanish Quality Audit

## Coverage
- Total: 1324
- Translated (derived): 918
- Kept original (no match): 406

## Rules implemented (from diff)
- Pattern-based replacements for common terms/equipment/movements
- Generic fallbacks: Press/Extension/Raise/Row/Curl/Fly
- Cleanup: collapse whitespace

## Examples (first 40 translated)
1. [3293] archer pull up -> archer Dominadas
2. [0011] assisted hanging knee raise -> assisted hanging knee Elevación
3. [0010] assisted hanging knee raise with throw down -> assisted hanging knee Elevación with throw down
4. [0012] assisted lying leg raise with lateral throw down -> assisted lying leg Elevación with lateral throw down
5. [0013] assisted lying leg raise with throw down -> assisted lying leg Elevación with throw down
6. [0018] assisted standing triceps extension (with towel) -> assisted standing triceps Extensión (with towel)
7. [1314] back extension on exercise ball -> back Extensión on exercise ball
8. [0968] band alternating biceps curl -> band alternating biceps Curl de bíceps
9. [1254] band bench press -> band Press de banca
10. [0980] band bent-over hip extension -> band bent-over hip Extensión
11. [0972] band bicycle crunch -> band bicycle Crunch abdominal
12. [0976] band concentration curl -> band concentration Curl de bíceps
13. [0977] band front lateral raise -> band front Elevación lateral
14. [0978] band front raise -> band Elevación frontal
15. [0979] band horizontal pallof press -> band horizontal pallof Press
16. [0985] band kneeling twisting crunch -> band kneeling twisting Crunch abdominal
17. [1002] band lying straight leg raise -> band lying straight leg Elevación
18. [0986] band one arm overhead biceps curl -> band one arm overhead biceps Curl de bíceps
19. [0987] band one arm single leg split squat -> band one arm single leg split Sentadilla
20. [0988] band one arm standing low row -> band one arm standing low Remo
21. [0989] band one arm twisting chest press -> band one arm twisting chest Press
22. [0990] band one arm twisting seated row -> band one arm twisting seated Remo
23. [0993] band reverse fly -> band reverse Aperturas
24. [0994] band reverse wrist curl -> band reverse wrist Curl de bíceps
25. [0997] band shoulder press -> band Press de hombros
26. [0998] band side triceps extension -> band side triceps Extensión
27. [0999] band single leg calf raise -> band single leg Elevación de talones
28. [1000] band single leg reverse calf raise -> band single leg reverse Elevación de talones
29. [1001] band single leg split squat -> band single leg split Sentadilla
30. [1004] band squat -> band Sentadilla
31. [1003] band squat row -> band Sentadilla Remo
32. [1005] band standing crunch -> band standing Crunch abdominal
33. [1022] band standing rear delt row -> band standing rear delt Remo
34. [1007] band standing twisting crunch -> band standing twisting Crunch abdominal
35. [1009] band stiff leg deadlift -> band stiff leg Peso muerto
36. [1023] band straight back stiff leg deadlift -> band straight back stiff leg Peso muerto
37. [1010] band straight leg deadlift -> band straight leg Peso muerto
38. [1012] band twisting overhead press -> band twisting overhead Press
39. [1369] band two legs calf raise - (band under both legs) v. 2 -> band two legs Elevación de talones - (band under both legs) v. 2
40. [1015] band vertical pallof press -> band vertical pallof Press

## Observations
- Deterministic, only string replacement based on regexes, no mutation of source objects.
- Cast (row as any).name_es added for forward compatibility.
- Generic rules broad and may be ambiguous.

## Risks
- Typing: CatalogExercise type lacks name_es - using as any.
- Semantic: translations may be awkward; biomechanical meaning preserved by structure.
- No tests updated for new behavior.

## Recommendations (prioritized)
1. Extend CatalogExercise type with optional name_es and remove as any.
2. Make rules more specific where ambiguous; add tests.
3. Consider preserving original if translation looks unnatural.
4. Build curated mapping later if needed.

## Tests executed
- npx tsc --noEmit: OK
- npx vitest run src/lib/catalog/exerciseAdapter.test.ts: 5 passed
- npx vitest run src/components/dashboard/DashboardPage.test.tsx: 14 passed
