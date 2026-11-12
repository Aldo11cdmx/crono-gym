/**
 * compressImage.ts — shrink an uploaded image to a light data URL.
 *
 * Announcement banners and store photos are persisted directly in a text column
 * (`announcements.banner_path`, `products.image_path`) so every device reads the
 * same picture from Supabase. A raw camera photo is 3–8 MB as a data URL, which
 * is too heavy for a text column and slow on mobile data, so it is drawn to a
 * `<canvas>` at a bounded size and re-encoded as JPEG. The result stays well
 * under the ~120 KB budget for the vast majority of photos.
 *
 * Never throws: a browser without canvas (or a decode failure) resolves to the
 * original data URL, so publishing an announcement or product still works.
 */

const MAX_EDGE = 1280;
const QUALITY = 0.72;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
    img.src = src;
  });
}

/**
 * Returns a JPEG data URL for `file`, downscaled so its longest edge is at most
 * `MAX_EDGE` and roughly under 120 KB. Falls back to the original data URL when
 * the environment cannot process it.
 */
export async function compressImage(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  if (typeof document === "undefined") return original;
  try {
    const img = await loadImage(original);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, width, height);
    const compressed = canvas.toDataURL("image/jpeg", QUALITY);
    // If the re-encode somehow grew (tiny source, PNG with few colors), keep the
    // smaller of the two so the column never gets heavier than it needs to be.
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}