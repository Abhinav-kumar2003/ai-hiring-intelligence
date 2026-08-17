/**
 * GET /api/model/metrics  - all model metrics, confusion matrix, ROC curve
 */
import { ok, apiHandler } from "@/lib/api";
import { getModelMetrics } from "@/lib/prediction-engine";

async function handler() {
  const metrics = getModelMetrics();
  return ok(metrics);
}

export const GET = apiHandler(handler, { requireAuth: false });
