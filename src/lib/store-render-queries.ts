import { cache } from "react";
import {
  getCategoriesByGender,
  getGenderBySlug,
  getGenders,
  getStoreSettings,
} from "@/lib/store-queries";

// React shares these reads only within a server render. Route handlers and
// transactions keep using the uncached queries, so writes never reuse stale data.
export const getRenderStoreSettings = cache(() => getStoreSettings());
export const getRenderGenders = cache(getGenders);
export const getRenderGenderBySlug = cache(getGenderBySlug);
export const getRenderCategoriesByGender = cache(getCategoriesByGender);
