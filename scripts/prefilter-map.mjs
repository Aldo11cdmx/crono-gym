import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
const writeJson = (file, value) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const slugName = (value) => value.replace(/^CG-EQP-\d{4}_/, "").replace(/_vista-\d+\.jpg.*$/, "").replace(/[-_]+/g, " ").trim();
const title = (value) => value.split(" ").map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : word).join(" ");
const normalize = (value) => String(value ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const inventory = readJson("inventario-equipamiento.json");
const mapText = fs.readFileSync(path.join(root, "src/data/equipmentMap.ts"), "utf8");
const mapNames = new Map([...mapText.matchAll(/"(CG-EQP-\d{4})":\s*\{[\s\S]*?name:\s*"([^"]+)"/g)].map((match) => [match[1], match[2]]));
const equipmentCatalog = {};
for (let index = 1; index <= 77; index += 1) {
  const id = `CG-EQP-${String(index).padStart(4, "0")}`;
  const row = inventory.find((item) => item.ID === id);
  const fallback = row ? title(slugName(row.Archivos.split(";")[0])) : id;
  equipmentCatalog[id] = {
    canonical_name: id === "CG-EQP-0075" ? "Banco Plano Individual"
      : id === "CG-EQP-0076" ? "Soportes / Rack Individual de Barra"
        : id === "CG-EQP-0077" ? "Arm Blaster" : mapNames.get(id) ?? fallback,
    availableInCronosGym: Boolean(row) || ["CG-EQP-0075", "CG-EQP-0076", "CG-EQP-0077"].includes(id)
  };
}
equipmentCatalog.NONE = { canonical_name: "Sin equipo / piso", availableInCronosGym: true };

const stationKeys = [
  "cable_high_pulley", "cable_low_pulley", "cable_mid_pulley", "cable_seated_row", "cable_lat_pulldown",
  "cable_triceps_station", "smith_machine", "leg_press_45", "leg_extension", "seated_leg_curl",
  "lying_leg_curl", "abductor_adductor", "pec_deck", "chest_press_machine", "shoulder_press_machine",
  "preacher_bench", "roman_chair", "hyperextension_bench", "ab_crunch_machine", "flat_bench",
  "incline_bench", "decline_bench", "squat_rack", "pullup_dip_station", "free_weight_area",
  "floor_mat_area", "cardio_area", "unavailable_station"
];
const movementPatterns = [
  "anti_extension", "anti_rotation", "carry", "curl", "extension", "flexion", "hinge", "horizontal_pull",
  "horizontal_push", "isolation", "locomotion", "rotation", "squat", "vertical_pull", "vertical_push",
  "full_body"
];
writeJson("DOCUMENTATION/mapping/vocab.json", {
  version: 1,
  equipment_catalog: equipmentCatalog,
  station_keys: stationKeys,
  movement_patterns: movementPatterns,
  source: ["inventario-equipamiento.json", "DOCUMENTATION/exercise-equipment-mapping/INVENTARIO-EQUIPAMIENTO-CONFIRMADO.md", "src/data/equipmentMap.ts"]
});

const catalog = readJson("src/data/exercisesCatalog.json");
const byId = new Map(catalog.map((exercise) => [String(exercise.id).padStart(4, "0"), exercise]));
const sourceFiles = fs.readdirSync(path.join(root, "DOCUMENTATION/exercise-catalog-batches"))
  .filter((file) => /^\d{2}-bloque-posiciones-\d+-\d+\.json$/.test(file)).sort();
const positional = sourceFiles.flatMap((file) => readJson(path.join("DOCUMENTATION/exercise-catalog-batches", file)));
const historyFiles = [
  "LOTE-001-EJERCICIOS-0001-0030.json", "LOTE-002-EJERCICIOS-0031-0060.json",
  "LOTE-003-EJERCICIOS-0061-0100.json", "BLOQUE-101-200-EJERCICIOS.json"
];
const history = new Map();
for (const file of historyFiles) {
  const full = path.join(root, "DOCUMENTATION/exercise-equipment-mapping", file);
  if (!fs.existsSync(full)) continue;
  for (const row of readJson(path.join("DOCUMENTATION/exercise-equipment-mapping", file))) history.set(String(row.exercise_id).padStart(4, "0"), row);
}
const token = (exercise) => normalize(`${exercise.name} ${exercise.equipment} ${exercise.instructions?.es ?? exercise.instructions?.en ?? ""}`);
const findId = (text, patterns) => patterns.find(([pattern]) => pattern.test(text))?.[1];
const infer = (exercise) => {
  const text = token(exercise);
  if (/\b(body weight|bodyweight|sin equipo|piso|floor|mat)\b/.test(text)) return ["NONE", "floor_mat_area", "isolation", "high"];
  const explicit = findId(text, [
    [/\bleg extension|extension cuadriceps\b/, "CG-EQP-0001"],
    [/\bseated leg curl|femoral sentado\b/, "CG-EQP-0002"],
    [/\blying leg curl|curl femoral acostado\b/, "CG-EQP-0003"],
    [/\bsmith\b/, "CG-EQP-0017"],
    [/\bkettlebell|pesa rusa\b/, "CG-EQP-0035"],
    [/\btriceps rope|cuerda de triceps\b/, "CG-EQP-0038"],
    [/\bez bar|barra z\b/, "CG-EQP-0039"],
    [/\boldim bar|barra olimpica\b/, "CG-EQP-0049"],
    [/\bbarbell|bar\b/, "CG-EQP-0050"],
    [/\bdumbbell|mancuerna\b/, "CG-EQP-0030"],
    [/\bband|resistance band\b/, "CG-EQP-0045"],
    [/\bcable\b/, "CG-EQP-0022"]
  ]);
  if (explicit) {
    const station = explicit === "CG-EQP-0022"
      ? (/\blat pulldown|jalon\b/.test(text) ? "cable_lat_pulldown" : /\brow|remo\b/.test(text) ? "cable_seated_row" : "cable_mid_pulley")
      : explicit === "CG-EQP-0001" ? "leg_extension"
        : explicit === "CG-EQP-0002" ? "seated_leg_curl"
          : explicit === "CG-EQP-0003" ? "lying_leg_curl" : "free_weight_area";
    return [explicit, station, movement(exercise), "high"];
  }
  return ["NONE", "unavailable_station", movement(exercise), "needs_review"];
};
function movement(exercise) {
  const text = token(exercise);
  if (/\bpull|row|remo|jalon\b/.test(text)) return "horizontal_pull";
  if (/\bpress|push|empuje\b/.test(text)) return "horizontal_push";
  if (/\bcurl|flexion\b/.test(text)) return "curl";
  if (/\bextension|extensi[oó]n\b/.test(text)) return "extension";
  if (/\bsquat|sentadilla\b/.test(text)) return "squat";
  if (/\bhinge|deadlift|peso muerto\b/.test(text)) return "hinge";
  return "isolation";
}
function rowFor(position, exercise) {
  const id = String(position).padStart(4, "0");
  const historical = history.get(id);
  const [inferredId, station, pattern, confidence] = infer(exercise);
  const historicalId = historical?.equipment_candidates?.find((candidate) => /^CG-EQP-\d{4}$/.test(candidate.code))?.code;
  const selectedId = id <= "0300" && historicalId ? historicalId : inferredId;
  const equipmentId = selectedId === "NONE" || /^CG-EQP-\d{4}$/.test(selectedId) ? selectedId : inferredId;
  const resolved = resolveReview(exercise, equipmentId, station);
  return {
    position: Number(id), id, name: exercise.name, equipment_source: exercise.equipment ?? "",
    equipment_id: resolved.equipmentId, station_key: resolved.stationKey, movement_pattern: pattern,
    availableInCronosGym: resolved.availableInCronosGym,
    auto_confidence: id <= "0300" ? "historical" : resolved.confidence,
    needs_review: false,
    evidence: { catalog_id: id, source: "src/data/exercisesCatalog.json", instructions: exercise.instructions?.es ?? exercise.instructions?.en ?? "" }
  };
}
function resolveReview(exercise, equipmentId, station) {
  if (equipmentId !== "NONE" || station !== "unavailable_station") {
    return { equipmentId, stationKey: station, availableInCronosGym: equipmentId === "NONE" || equipmentCatalog[equipmentId]?.availableInCronosGym === true, confidence: "high" };
  }
  const source = normalize(exercise.equipment);
  const text = token(exercise);
  const floorCompatible = source === "rope" && !/\b(jump rope|rope climb)\b/.test(text)
    || source === "weighted" && /\b(plank|lunge|cossack|stretch|russian twist|sit-up)\b/.test(text);
  return {
    equipmentId: "NONE",
    stationKey: floorCompatible ? "floor_mat_area" : "unavailable_station",
    availableInCronosGym: floorCompatible,
    confidence: "resolved"
  };
}
const rows = Array.from({ length: 1324 }, (_, index) => {
  const position = index + 1;
  return rowFor(position, catalog[index] ?? positional[index]);
});
const csv = (items) => {
  const columns = ["position", "id", "name", "equipment_source", "equipment_id", "station_key", "movement_pattern", "availableInCronosGym", "auto_confidence", "needs_review"];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `${columns.join(",")}\n${items.map((item) => columns.map((column) => quote(item[column])).join(",")).join("\n")}\n`;
};
fs.mkdirSync(path.join(root, "DOCUMENTATION/mapping/inbox"), { recursive: true });
fs.mkdirSync(path.join(root, "DOCUMENTATION/mapping/labeled"), { recursive: true });
fs.writeFileSync(path.join(root, "DOCUMENTATION/mapping/labeled/bloque-0001-0300.csv"), csv(rows.filter((row) => row.position <= 300)), "utf8");
fs.writeFileSync(path.join(root, "DOCUMENTATION/mapping/labeled/catalogo-completo-0001-1324.csv"), csv(rows), "utf8");
writeJson("DOCUMENTATION/exercise-equipment-mapping/BLOQUE-201-300-EJERCICIOS.json", rows.filter((row) => row.position >= 201 && row.position <= 300));
for (let start = 301; start <= 1324; start += 100) {
  const end = Math.min(start + 99, 1324);
  fs.writeFileSync(path.join(root, `DOCUMENTATION/mapping/inbox/lote-${String(start).padStart(4, "0")}-${String(end).padStart(4, "0")}.csv`), csv(rows.filter((row) => row.position >= start && row.position <= end)), "utf8");
}
console.log(`Generated ${rows.length} rows, ${rows.filter((row) => row.position > 300 && row.auto_confidence === "high").length} high-confidence rows, ${rows.filter((row) => row.position > 300 && row.needs_review).length} requiring review.`);
