import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const catalogFile = path.join(root, "src/data/exercisesCatalog.json");
const mapFile = path.join(root, "src/data/equipmentMap.ts");
const manifestFile = path.join(root, "DOCUMENTATION/mapping/.apply-manifest.json");
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest = { createdAt: new Date().toISOString(), catalogHash: digest(catalogFile), equipmentMapHash: digest(mapFile) };
if (process.argv.includes("--rollback")) {
  if (!fs.existsSync(manifestFile)) throw new Error("No apply manifest exists.");
  const previous = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  for (const [file, backup] of Object.entries(previous.backups)) fs.copyFileSync(path.join(root, backup), path.join(root, file));
  fs.unlinkSync(manifestFile);
  console.log("Rollback completed.");
  process.exit(0);
}
if (!process.argv.includes("--commit")) {
  console.log(JSON.stringify({ dryRun: true, files: [catalogFile, mapFile], catalogHash: manifest.catalogHash, equipmentMapHash: manifest.equipmentMapHash }, null, 2));
  process.exit(0);
}
const backupDir = path.join(root, "DOCUMENTATION/mapping/.backups", Date.now().toString());
fs.mkdirSync(backupDir, { recursive: true });
const backups = {};
for (const file of [catalogFile, mapFile]) {
  const relative = path.relative(root, file); const backup = path.join("DOCUMENTATION/mapping/.backups", path.basename(backupDir), path.basename(file));
  fs.copyFileSync(file, path.join(root, backup)); backups[relative] = backup;
}
const rows = JSON.parse(fs.readFileSync(catalogFile, "utf8").replace(/^\uFEFF/, ""));
const mappingText = fs.readFileSync(path.join(root, "DOCUMENTATION/mapping/labeled/catalogo-completo-0001-1324.csv"), "utf8");
const [header, ...mappingLines] = mappingText.trim().split(/\r?\n/);
const mapping = mappingLines.map((line) => {
  const values = []; let value = ""; let quoted = false;
  for (const char of line) { if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { values.push(value); value = ""; } else value += char; }
  values.push(value);
  return Object.fromEntries(header.split(",").map((key, index) => [key, values[index]?.replace(/^"|"$/g, "").replaceAll('""', '"') ?? ""]));
});
for (const [index, row] of rows.entries()) {
  const mapped = mapping[index];
  if (mapped) Object.assign(row, {
    equipment_id: mapped.equipment_id,
    station_key: mapped.station_key,
    movement_pattern: mapped.movement_pattern,
    availableInCronosGym: mapped.availableInCronosGym === "true" || mapped.availableInCronosGym === true
  });
}
fs.writeFileSync(catalogFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
let equipmentMap = fs.readFileSync(mapFile, "utf8");
const additions = [
  ["CG-EQP-0058", "Equipo no documentado", "CG-EQP-0058_equipo-no-documentado_vista-01.jpg"],
  ["CG-EQP-0075", "Banco Plano Individual", "CG-EQP-0075_banco-plano_vista-01.jpg"],
  ["CG-EQP-0076", "Soportes / Rack Individual de Barra", "CG-EQP-0076_rack-barras-individuales_vista-01.jpg"],
  ["CG-EQP-0077", "Arm Blaster", "CG-EQP-0077_arm-blaster_vista-01.jpg"]
].filter(([id]) => !equipmentMap.includes(`"${id}"`)).map(([id, name, image]) => `    "${id}": {\n        id: "${id}",\n        name: "${name}",\n        views: [{ id: 1, src: "public/images/gym-equipment/${image}" }]\n    },`).join("\n");
if (additions) {
  const closingIndex = equipmentMap.lastIndexOf("\n};");
  if (closingIndex < 0) throw new Error("Unable to locate equipmentMap closing brace.");
  equipmentMap = `${equipmentMap.slice(0, closingIndex)}\n${additions}${equipmentMap.slice(closingIndex)}`;
}
fs.writeFileSync(mapFile, equipmentMap, "utf8");
fs.writeFileSync(manifestFile, `${JSON.stringify({ ...manifest, backups }, null, 2)}\n`, "utf8");
console.log("Applied mapping atomically. Use --rollback to restore the backups.");
