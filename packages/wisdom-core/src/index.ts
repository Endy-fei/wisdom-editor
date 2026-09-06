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

export {
  mergeWisdom,
  previewMerge,
  validateMergeSchemes,
  schemeMismatchWarnings,
  defaultMergeGroups,
  listMeterRefs,
  listGroupItemOptions,
  suggestedMergedFileName,
  isSameFilePath,
  assertNewMergePath,
  schemeIdOf,
  schemePointIdentity,
  SCHEME_POINT_IDENTITY_KEYS,
  pointKeyOf,
} from "./mergeWisdom";
export type {
  ConflictPolicy,
  MergeSource,
  MergeInclude,
  MergeGroup,
  MergeFileInput,
  ConflictOverride,
  MergeRequest,
  MeterRef,
  MergeConflictCandidate,
  MergeConflict,
  MergeItemOption,
  MergeOk,
  MergeFail,
  MergeOutcome,
} from "./mergeWisdom";
