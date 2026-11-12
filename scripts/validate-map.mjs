import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
const vocab = readJson("DOCUMENTATION/mapping/vocab.json");
const catalog = new Map(readJson("src/data/exercisesCatalog.json").map((row) => [String(row.id).padStart(4, "0"), row]));
const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const files = args.length ? args : ["DOCUMENTATION/mapping/labeled/bloque-0001-0300.csv"];
const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/); const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = []; let value = ""; let quoted = false;
    for (const char of line) { if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { values.push(value); value = ""; } else value += char; }
    values.push(value); return Object.fromEntries(headers.map((header, index) => [header, values[index]?.replace(/^"|"$/g, "").replaceAll('""', '"') ?? ""]));
  });
};
const readRows = (file) => {
  const full = path.join(root, file);
  if (fs.statSync(full).isDirectory()) return fs.readdirSync(full).filter((entry) => entry.endsWith(".csv")).flatMap((entry) => parseCsv(fs.readFileSync(path.join(full, entry), "utf8")));
  return file.endsWith(".csv") ? parseCsv(fs.readFileSync(full, "utf8")) : readJson(file);
};
const rows = files.flatMap(readRows);
const check = (row) => {
  const id = String(row.id ?? row.exercise_id).padStart(4, "0");
  const text = JSON.stringify(row);
  const equipment = row.equipment_id;
  const gate = [
    true,
    equipment === "NONE" || /^CG-EQP-\d{4}$/.test(equipment) && Boolean(vocab.equipment_catalog[equipment]),
    vocab.station_keys.includes(row.station_key) && vocab.movement_patterns.includes(row.movement_pattern),
    !(equipment === "CG-EQP-0005" && row.station_key === "free_weight_area") && !(equipment === "CG-EQP-0002" && row.station_key === "smith_machine"),
    Boolean(id && Number(id) >= 1 && Number(id) <= 1324 && row.name),
    Boolean(row.evidence?.source || row.name),
    !(equipment === "CG-EQP-0001" && /body weight/i.test(row.equipment_source ?? "")),
    !/[ÃÂ�]/.test(text),
    row.availableInCronosGym === true || row.availableInCronosGym === false || row.availableInCronosGym === "true" || row.availableInCronosGym === "false"
  ];
  return { id, gate, valid: gate.every(Boolean) };
};
const results = rows.map(check);
const passed = results.filter((result) => result.valid).length;
const failed = results.length - passed;
console.log(JSON.stringify({
  files, total: rows.length, passed, failed,
  gate_failures: Array.from({ length: 9 }, (_, index) => results.filter((result) => !result.gate[index]).length),
  gate_2_samples: results.filter((result) => !result.gate[1]).slice(0, 5).map((result) => result.id)
}, null, 2));
if (failed) process.exitCode = 1;
