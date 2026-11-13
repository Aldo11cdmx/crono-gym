import { describe, expect, it } from "vitest";
import { hasMojibake, repairMojibake } from "./mojibake";

describe("mojibake", () => {
  it("spots a UTF-8 string read as Latin-1", () => {
    expect(hasMojibake("FlexiÃ³n")).toBe(true);
    expect(hasMojibake("Press de bancaÂ°")).toBe(true);
  });

  it("leaves clean Spanish alone", () => {
    expect(hasMojibake("Press de banca")).toBe(false);
    expect(hasMojibake("Elevación lateral")).toBe(false);
    expect(hasMojibake("")).toBe(false);
  });

  it("repairs the accents the shipped dataset ships broken", () => {
    expect(repairMojibake("FlexiÃ³n")).toBe("Flexión");
    expect(repairMojibake("ExtensiÃ³n de pierna")).toBe("Extensión de pierna");
  });

  it("leaves a lone A-tilde alone: the marker needs its second byte", () => {
    expect(repairMojibake("Ã solo")).toBe("Ã solo");
  });

  it("returns clean text unchanged", () => {
    expect(repairMojibake("Press militar")).toBe("Press militar");
    expect(repairMojibake("Remo con barra")).toBe("Remo con barra");
  });

  it("returns empty for nothing, so callers never get undefined", () => {
    expect(repairMojibake(undefined)).toBe("");
    expect(repairMojibake(null)).toBe("");
    expect(repairMojibake("")).toBe("");
  });
});