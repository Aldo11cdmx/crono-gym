import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const light = "#FF8A80";
const base = "#FF3B30";
const deep = "#D63028";

const svgTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="SIZE" height="SIZE" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cronos-logo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="${light}" />
      <stop offset="55%" stopColor="${base}" />
      <stop offset="100%" stopColor="${deep}" />
    </linearGradient>
  </defs>
  <circle cx="24" cy="24" r="21" stroke="url(#cronos-logo)" strokeWidth="1.75" opacity="0.55" />
  <g stroke="url(#cronos-logo)" strokeWidth="2.25" strokeLinecap="round">
    <line x1="11" y1="24" x2="37" y2="24" />
  </g>
  <g fill="url(#cronos-logo)">
    <rect x="9.5" y="17.5" width="3.6" height="13" rx="1.8" />
    <rect x="34.9" y="17.5" width="3.6" height="13" rx="1.8" />
  </g>
  <g stroke="url(#cronos-logo)" strokeWidth="2" strokeLinecap="round">
    <line x1="17" y1="12.5" x2="31" y2="12.5" />
    <line x1="17" y1="35.5" x2="31" y2="35.5" />
  </g>
  <g stroke="url(#cronos-logo)" strokeWidth="2" strokeLinejoin="round">
    <path d="M17.8 13.5 L24 23.4 L30.2 13.5" />
    <path d="M17.8 34.5 L24 24.6 L30.2 34.5" />
  </g>
  <circle cx="24" cy="22.4" r="1.5" fill="url(#cronos-logo)" />
</svg>`;

async function generatePng(size, outputPath) {
  const svg = Buffer.from(svgTemplate.replace(/SIZE/g, size.toString()));
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(outputPath, png);
  console.log("Generated " + outputPath + " (" + size + "x" + size + ") - " + png.length + " bytes");
  return png;
}

async function main() {
  mkdirSync(join(rootDir, "public"), { recursive: true });
  await generatePng(512, join(rootDir, "public", "logo.png"));
  await generatePng(32, join(rootDir, "public", "favicon.png"));
  await generatePng(192, join(rootDir, "public", "icon-192.png"));
  await generatePng(512, join(rootDir, "public", "icon-512.png"));
  console.log("\nAll PNGs generated successfully!");
}

main().catch(err => { console.error("Error:", err); process.exit(1); });
