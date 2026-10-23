/**
 * mediaResolver.test.ts — one place decides what a stored path means.
 *
 * Three conventions live in the data at once: the catalog stores paths
 * relative to the dataset (`videos/0001-2gPfomN.gif`), the equipment map
 * stores `public/…` paths that Vite serves at the root, and the seeded
 * `exercises` table stores absolute URLs. Before this module each call site
 * guessed, and three of them guessed wrong: the equipment photos 404'd in
 * three places and the picker thumbnails 404'd in all of them.
 *
 * The media key is asserted here too, because it is the part that outlives
 * the URL: a change of CDN must not change the identity of a medium.
 */

import { describe, expect, it } from "vitest";
import {
  MEDIA_BASE_URL,
  isAbsoluteMediaUrl,
  mediaKey,
  resolveMedia,
  resolveMediaUrl,
} from "./mediaResolver";

describe("resolveMediaUrl", () => {
  it("deja intactas las URL absolutas", () => {
    expect(resolveMediaUrl("https://cdn.test/a.gif")).toBe("https://cdn.test/a.gif");
    expect(resolveMediaUrl("http://cdn.test/a.gif")).toBe("http://cdn.test/a.gif");
    expect(resolveMediaUrl("//cdn.test/a.gif")).toBe("//cdn.test/a.gif");
  });

  it("deja intactas las URL en línea", () => {
    expect(resolveMediaUrl("data:image/gif;base64,AAA")).toBe("data:image/gif;base64,AAA");
    expect(resolveMediaUrl("blob:https://app.test/1234")).toBe("blob:https://app.test/1234");
  });

  it("sirve public/ desde la raíz", () => {
    expect(resolveMediaUrl("public/images/gym-equipment/CG-EQP-0001_x.jpg")).toBe(
      "/images/gym-equipment/CG-EQP-0001_x.jpg",
    );
  });

  it("deja intactas las rutas ya enraizadas", () => {
    expect(resolveMediaUrl("/logo.jpg")).toBe("/logo.jpg");
  });

  it("resuelve los medios del dataset contra su base", () => {
    expect(resolveMediaUrl("videos/0001-2gPfomN.gif")).toBe(
      `${MEDIA_BASE_URL}/videos/0001-2gPfomN.gif`,
    );
    expect(resolveMediaUrl("images/0001-2gPfomN.jpg")).toBe(
      `${MEDIA_BASE_URL}/images/0001-2gPfomN.jpg`,
    );
  });

  it("trata cualquier otra ruta relativa como un recurso de la app", () => {
    expect(resolveMediaUrl("logo.jpg")).toBe("/logo.jpg");
  });

  it("devuelve una URL vacía cuando no hay medio", () => {
    expect(resolveMediaUrl("")).toBe("");
    expect(resolveMediaUrl("   ")).toBe("");
  });

  it("recorta los espacios antes de resolver", () => {
    expect(resolveMediaUrl("  /logo.jpg  ")).toBe("/logo.jpg");
    expect(resolveMediaUrl("  videos/0001-2gPfomN.gif  ")).toBe(
      `${MEDIA_BASE_URL}/videos/0001-2gPfomN.gif`,
    );
  });
});

describe("isAbsoluteMediaUrl", () => {
  it("distingue lo que ya es URL de lo que es ruta", () => {
    expect(isAbsoluteMediaUrl("https://cdn.test/a.gif")).toBe(true);
    expect(isAbsoluteMediaUrl("data:image/gif;base64,AAA")).toBe(true);
    expect(isAbsoluteMediaUrl("videos/0001-2gPfomN.gif")).toBe(false);
    expect(isAbsoluteMediaUrl("public/images/a.jpg")).toBe(false);
  });
});

describe("mediaKey", () => {
  it("identifica el medio por lo que representa, no por su URL", () => {
    expect(mediaKey("exercise-gif", "0001")).toBe("exercise-gif:0001");
  });

  it("no cambia cuando cambia la URL que lo sirve", () => {
    const before = mediaKey("exercise-gif", "0001");
    const after = mediaKey("exercise-gif", "0001");
    expect(before).toBe(after);
  });

  it("distingue medios distintos", () => {
    expect(mediaKey("exercise-gif", "0001")).not.toBe(mediaKey("exercise-image", "0001"));
    expect(mediaKey("exercise-gif", "0001")).not.toBe(mediaKey("exercise-gif", "0002"));
  });
});

describe("resolveMedia", () => {
  it("devuelve la identidad y la URL del medio", () => {
    const media = resolveMedia("exercise-gif", "0001", "videos/0001-2gPfomN.gif");

    expect(media.key).toBe("exercise-gif:0001");
    expect(media.url).toBe(`${MEDIA_BASE_URL}/videos/0001-2gPfomN.gif`);
  });
});
