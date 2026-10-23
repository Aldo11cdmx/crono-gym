// scripts/optimize-images.cjs
// Uso: node scripts/optimize-images.cjs
// Lee originals/gym-equipment y escribe versiones ligeras en public/images/gym-equipment
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'originals', 'gym-equipment');
const OUT = path.join(ROOT, 'public', 'images', 'gym-equipment');
const THUMBS = path.join(OUT, 'thumbs');
const PATTERN = /^(CG-EQP-\d{4}_.+_vista-\d{2})\.(jpe?g|png|webp)$/i;
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('No existe ' + path.relative(ROOT, SRC));
    process.exit(1);
  }
  fs.mkdirSync(THUMBS, { recursive: true });

  const files = fs.readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name.normalize('NFC'))
    .sort();

  let before = 0, after = 0, done = 0;
  const skipped = [];

  for (const file of files) {
    const m = file.match(PATTERN);
    if (!m) { skipped.push(file); continue; }

    const input = path.join(SRC, file);
    const out = path.join(OUT, m[1] + '.jpg');
    const thumb = path.join(THUMBS, m[1] + '.jpg');

    // .rotate() respeta la orientacion EXIF del celular
    await sharp(input).rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(out);

    await sharp(input).rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, mozjpeg: true })
      .toFile(thumb);

    before += fs.statSync(input).size;
    after += fs.statSync(out).size;
    done++;
  }

  console.log('OK: ' + done + ' imagenes: ' + mb(before) + ' -> ' + mb(after) + ' (miniaturas en thumbs/)');
  if (skipped.length) {
    console.warn('Ignorados (no cumplen el patron o no son jpg/png/webp): ' + skipped.length);
    skipped.forEach((f) => console.warn('  - ' + f));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });