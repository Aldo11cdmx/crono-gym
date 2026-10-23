// generate-map.cjs
// Uso:
//   node generate-map.cjs            -> genera src/data/equipmentMap.ts
//   node generate-map.cjs --check    -> no escribe; sale con código 1 si el archivo está desactualizado
//   node generate-map.cjs --strict   -> sale con código 1 (sin escribir) si hay ignorados o advertencias
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'gym-equipment');
const OUTPUT_FILE = path.join(ROOT, 'src', 'data', 'equipmentMap.ts');
const PUBLIC_BASE = '/images/gym-equipment';

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const STRICT = args.has('--strict');

// CG-EQP-####_[nombre]_vista-##.jpg (insensible a mayúsculas/minúsculas, acepta .JPG, acentos y ñ)
const FILE_PATTERN = /^(CG-EQP-\d{4})_([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)_vista-(\d{2})\.jpg$/iu;

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const normalizeEol = (s) => s.replace(/\r\n/g, '\n');

function toTitleCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('es') + w.slice(1).toLocaleLowerCase('es'))
    .join(' ');
}

function buildOutput(map) {
  return `// ⚠️ Archivo generado automáticamente por generate-map.cjs — no editar manualmente.

export interface EquipmentView {
  view: number;
  filename: string;
  path: string;
}

export interface EquipmentData {
  id: string;
  name: string;
  views: EquipmentView[];
}

export const equipmentMap: Record<string, EquipmentData> = ${JSON.stringify(map, null, 2)};

export function getEquipmentViews(id: string): EquipmentData | undefined {
  return equipmentMap[id.trim().toUpperCase()];
}
`;
}

function main() {
  if (!fs.existsSync(IMAGES_DIR) || !fs.statSync(IMAGES_DIR).isDirectory()) {
    console.error(`❌ No existe la carpeta: ${rel(IMAGES_DIR)}`);
    process.exit(1);
  }

  // Orden alfabético determinista (el orden de readdir depende del sistema operativo)
  const files = fs
    .readdirSync(IMAGES_DIR, { withFileTypes: true, encoding: 'utf-8' })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => ({ raw: e.name, nfc: e.name.normalize('NFC') }))
    .sort((a, b) => (a.nfc < b.nfc ? -1 : a.nfc > b.nfc ? 1 : 0));

  const map = {};
  const warnings = [];
  const skipped = [];
  let matched = 0;

  for (const { raw, nfc: file } of files) {
    const m = file.match(FILE_PATTERN);
    if (!m) {
      skipped.push(raw);
      continue;
    }

    const [, rawId, rawName, rawView] = m;
    const id = rawId.toUpperCase();
    const name = toTitleCase(rawName);
    const view = parseInt(rawView, 10);

    if (!map[id]) {
      map[id] = { id, name, views: [] };
    } else if (map[id].name !== name) {
      warnings.push(`${id}: nombre distinto en "${file}" ("${name}" vs "${map[id].name}"). Se conserva "${map[id].name}".`);
    }

    if (map[id].views.some((v) => v.view === view)) {
      warnings.push(`${id}: vista ${rawView} duplicada en "${file}". Se omite.`);
      continue;
    }

    map[id].views.push({
      view,
      filename: file,
      path: encodeURI(`${PUBLIC_BASE}/${file}`),
    });
    matched++;
  }

  // Equipos por ID y vistas ascendentes
  const sortedMap = {};
  for (const id of Object.keys(map).sort()) {
    map[id].views.sort((a, b) => a.view - b.view);
    sortedMap[id] = map[id];
  }

  const output = buildOutput(sortedMap);
  const equipCount = Object.keys(sortedMap).length;

  const printIssues = () => {
    if (warnings.length) {
      console.warn(`\n⚠️  Advertencias (${warnings.length}):`);
      warnings.forEach((w) => console.warn(`   - ${w}`));
    }
    if (skipped.length) {
      console.warn(`\n⚠️  Ignorados por no cumplir el patrón CG-EQP-####_[nombre]_vista-##.jpg (${skipped.length}):`);
      skipped.forEach((f) => console.warn(`   - ${f}`));
    }
  };

  // --strict: no escribe si hay problemas
  if (STRICT && (warnings.length || skipped.length)) {
    printIssues();
    console.error('\n❌ Modo --strict: hay advertencias o archivos ignorados. No se escribió nada.');
    process.exit(1);
  }

  // --check: compara con el archivo existente
  if (CHECK) {
    let current = null;
    try {
      current = fs.readFileSync(OUTPUT_FILE, { encoding: 'utf-8' });
    } catch {
      /* no existe */
    }
    if (current === null || normalizeEol(current) !== normalizeEol(output)) {
      console.error(`❌ ${rel(OUTPUT_FILE)} está desactualizado. Ejecuta: node generate-map.cjs`);
      process.exit(1);
    }
    console.log(`✅ ${rel(OUTPUT_FILE)} está al día (Equipos: ${equipCount} | Imágenes: ${matched}).`);
    printIssues();
    return;
  }

  try {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, output, { encoding: 'utf-8' });
  } catch (err) {
    console.error(`❌ No se pudo escribir ${rel(OUTPUT_FILE)}: ${err.message}`);
    process.exit(1);
  }

  console.log(`✅ Generado: ${rel(OUTPUT_FILE)}`);
  console.log(`   Equipos: ${equipCount} | Imágenes mapeadas: ${matched}`);
  printIssues();
}

main();
