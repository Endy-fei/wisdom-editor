import type { JsonObject } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`;
}

export function cloneWithNewId(template: JsonObject, overrides: JsonObject = {}): JsonObject {
  return {
    ...structuredClone(template),
    ...overrides,
    ID: newId(),
  };
}
