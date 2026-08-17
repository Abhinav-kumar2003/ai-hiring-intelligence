/**
 * GET /api/model/info  - model metadata (name, version, training date, features, etc.)
 */
import { ok, apiHandler } from "@/lib/api";
import { getModelMetadata, getModelArtifactSummary } from "@/lib/prediction-engine";

async function handler() {
  const meta = getModelMetadata();
  const summary = getModelArtifactSummary();
  return ok({ ...meta, ...summary });
}

export const GET = apiHandler(handler, { requireAuth: false });
