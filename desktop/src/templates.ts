import {
  createEmptyMeter,
  emptyResultDetail,
  emptySchemeGroup,
  emptyTestItem,
  type WisdomTemplates,
} from "@wisdom/core";

export function buildTemplates(): WisdomTemplates {
  const { meter, other } = createEmptyMeter(0);
  return {
    meter,
    other,
    schemeGroup: emptySchemeGroup(),
    testItem: emptyTestItem(),
    result: emptyResultDetail(),
  };
}
