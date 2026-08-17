/**
 * GET /api/model/features  - feature importance data
 */
import { ok, apiHandler } from "@/lib/api";
import { getFeatureImportance } from "@/lib/prediction-engine";

async function handler() {
  const fi = getFeatureImportance();
  return ok(fi);
}

export const GET = apiHandler(handler, { requireAuth: false });
