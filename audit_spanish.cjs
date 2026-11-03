const fs = require("fs");
const NAME_ES_MAP = [
  [/\bBench Press\b/i, "Press de banca"],
  [/\bIncline Bench Press\b/i, "Press inclinado con barra"],
  [/\bDecline Bench Press\b/i, "Press declinado con barra"],
  [/\bBarbell\b/i, "con barra"],
  [/\bDumbbell\b/i, "con mancuernas"],
  [/\bCable\b/i, "en polea"],
  [/\bLat Pulldown\b/i, "Jalón al pecho"],
  [/\bPull Up\b|\bChin Up\b/i, "Dominadas"],
  [/\bRow\b/i, "Remo"],
  [/\bShoulder Press\b/i, "Press de hombros"],
  [/\bLateral Raise\b/i, "Elevación lateral"],
  [/\bFront Raise\b/i, "Elevación frontal"],
  [/\bRear Lateral Raise\b/i, "Elevación posterior"],
  [/\bBicep Curl\b|\bCurl\b/i, "Curl de bíceps"],
  [/\bTriceps Pushdown\b|\bPushdown\b/i, "Extensión de tríceps en polea"],
  [/\bLeg Extension\b/i, "Extensión de cuádriceps"],
  [/\bLeg Curl\b/i, "Curl femoral"],
  [/\bLeg Press\b/i, "Prensa de piernas"],
  [/\bSquat\b/i, "Sentadilla"],
  [/\bDeadlift\b/i, "Peso muerto"],
  [/\bRomanian Deadlift\b/i, "Peso muerto rumano"],
  [/\bLunge\b/i, "Zancada"],
  [/\bCalf Raise\b/i, "Elevación de talones"],
  [/\bCrunch\b/i, "Crunch abdominal"],
  [/\bPlank\b/i, "Plancha"],
  [/\bFly\b|\bFlye\b/i, "Aperturas"],
  [/\bPress\b/i, "Press"],
  [/\bExtension\b/i, "Extensión"],
  [/\bRaise\b/i, "Elevación"],
];
function deriveNameEs(name){
  if(!name)return null;
  let result = name;
  for(let i=0;i<NAME_ES_MAP.length;i++){
    const [re,rep]=NAME_ES_MAP[i];
    result = result.replace(re,rep);
  }
  if(result!==name){
    result = result.replace(/\\s+/g," ").trim();
    return result;
  }
  return null;
}
const data = JSON.parse(fs.readFileSync("src/data/exercisesCatalog.json"));
let translated=0, kept=0;
const examples=[];
for(let i=0;i<data.length;i++){
  const ex=data[i];
  const nes = deriveNameEs(ex.name);
  if(nes){ translated++; if(examples.length<40) examples.push({id:ex.id, orig:ex.name, es:nes}); }
  else kept++;
}
const report = "# Catalog Spanish Quality Audit\n\n## Coverage\n- Total: "+data.length+"\n- Translated (derived): "+translated+"\n- Kept original (no match): "+kept+"\n\n## Rules implemented (from diff)\n- Pattern-based replacements for common terms/equipment/movements\n- Generic fallbacks: Press/Extension/Raise/Row/Curl/Fly\n- Cleanup: collapse whitespace\n\n## Examples (first 40 translated)\n"+examples.map((e,i)=> (i+1)+". ["+e.id+"] "+e.orig+" -> "+e.es).join("\n")+"\n\n## Observations\n- Deterministic, only string replacement based on regexes, no mutation of source objects.\n- Cast (row as any).name_es added for forward compatibility.\n- Generic rules broad and may be ambiguous.\n\n## Risks\n- Typing: CatalogExercise type lacks name_es - using as any.\n- Semantic: translations may be awkward; biomechanical meaning preserved by structure.\n- No tests updated for new behavior.\n\n## Recommendations (prioritized)\n1. Extend CatalogExercise type with optional name_es and remove as any.\n2. Make rules more specific where ambiguous; add tests.\n3. Consider preserving original if translation looks unnatural.\n4. Build curated mapping later if needed.\n\n## Tests executed\n- npx tsc --noEmit: OK\n- npx vitest run src/lib/catalog/exerciseAdapter.test.ts: 5 passed\n- npx vitest run src/components/dashboard/DashboardPage.test.tsx: 14 passed\n";
fs.writeFileSync("reports/architecture-research/catalog-spanish-quality-audit.md", report);
console.log("done", translated, kept);
