export type {
  JsonObject,
  MeterInfo,
  MeterOtherInfo,
  WisdomRoot,
  WisdomTemplates,
} from "./types";

export {
  newId,
  emptyMeter,
  emptyOtherInfo,
  emptySchemeGroup,
  emptyTestItem,
  emptyResultDetail,
} from "./defaults";

export {
  ensureWisdomShape,
  createEmptyMeter,
  removeMeter,
  applyJsonText,
} from "./wisdomModel";
export type { ApplyJsonResult } from "./wisdomModel";
