import { describe, expect, it } from "vitest";
import {
  resolveAvailability,
  resolveAvailabilityFromScopes,
  toLegacyBoolean,
  type EquipmentAvailability,
  type EquipmentScope,
} from "./availability";

describe("availability", () => {
  it("tag presente en fuente completa → available", () => {
    const scope: EquipmentScope = { tags: new Set(["cable"]), complete: true };
    expect(resolveAvailability("cable", scope)).toBe("available");
  });

  it("tag ausente en fuente completa → unavailable", () => {
    const scope: EquipmentScope = { tags: new Set(["cable"]), complete: true };
    expect(resolveAvailability("band", scope)).toBe("unavailable");
  });

  it("tag presente en fuente parcial → available", () => {
    const scope: EquipmentScope = { tags: new Set(["cable"]), complete: false };
    expect(resolveAvailability("cable", scope)).toBe("available");
  });

  it("tag ausente en fuente parcial → unknown", () => {
    const scope: EquipmentScope = { tags: new Set(["cable"]), complete: false };
    expect(resolveAvailability("band", scope)).toBe("unknown");
  });

  it("conjunto vacío completo → unavailable", () => {
    const scope: EquipmentScope = { tags: new Set(), complete: true };
    expect(resolveAvailability("band", scope)).toBe("unavailable");
  });

  it("conjunto vacío parcial → unknown", () => {
    const scope: EquipmentScope = { tags: new Set(), complete: false };
    expect(resolveAvailability("band", scope)).toBe("unknown");
  });

  it("tag desconocido en fuente completa → unavailable", () => {
    const scope: EquipmentScope = { tags: new Set(["cable"]), complete: true };
    expect(resolveAvailability("unknown-tag", scope)).toBe("unavailable");
  });

  it("tag desconocido en fuente parcial → unknown", () => {
    const scope: EquipmentScope = { tags: new Set(["cable"]), complete: false };
    expect(resolveAvailability("unknown-tag", scope)).toBe("unknown");
  });

  it("fuentes contradictorias → unknown", () => {
    const availableScope: EquipmentScope = { tags: new Set(["cable"]), complete: true };
    const unavailableScope: EquipmentScope = { tags: new Set(), complete: true };
    expect(resolveAvailabilityFromScopes("cable", [availableScope, unavailableScope])).toBe("unknown");
  });

  it("fuentes vacías → unknown", () => {
    expect(resolveAvailabilityFromScopes("cable", [])).toBe("unknown");
  });

  it("adaptador available → true", () => {
    const value: EquipmentAvailability = "available";
    expect(toLegacyBoolean(value)).toBe(true);
  });

  it("adaptador unavailable → false", () => {
    expect(toLegacyBoolean("unavailable")).toBe(false);
  });

  it("adaptador unknown → false", () => {
    expect(toLegacyBoolean("unknown")).toBe(false);
  });

  it("no muta los conjuntos recibidos", () => {
    const tags = new Set(["cable"]);
    const scope: EquipmentScope = { tags, complete: true };
    resolveAvailability("band", scope);
    resolveAvailabilityFromScopes("band", [scope]);
    expect(tags.size).toBe(1);
    expect(tags.has("cable")).toBe(true);
  });
});
