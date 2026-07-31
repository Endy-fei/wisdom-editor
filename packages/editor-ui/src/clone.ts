import { newId, type JsonObject } from "@wisdom/core";

export function cloneWithNewId(
  template: JsonObject,
  overrides: JsonObject = {}
): JsonObject {
  return {
    ...structuredClone(template),
    ...overrides,
    ID: newId(),
  };
}
