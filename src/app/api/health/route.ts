/**
 * GET /api/health  - health check
 */
import { ok } from "@/lib/api";
import { getModelMetadata } from "@/lib/prediction-engine";

export async function GET() {
  const meta = getModelMetadata();
  return ok({
    status: "ok",
    service: "AI Hiring Prediction System",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    model: {
      name: meta.model_name,
      version: meta.model_version,
      productionModel: meta.production_model,
    },
  });
}
