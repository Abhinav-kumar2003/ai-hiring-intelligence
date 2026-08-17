/**
 * GET /api  - API info
 */
import { ok } from "@/lib/api";

export async function GET() {
  return ok({
    name: "AI Hiring Prediction System API",
    version: "1.0.0",
    endpoints: [
      "POST /api/auth/register",
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET  /api/auth/me",
      "GET/POST /api/candidates",
      "GET/PUT/DELETE /api/candidates/[id]",
      "POST /api/predict",
      "GET  /api/predictions",
      "GET  /api/predictions/[id]",
      "GET  /api/dashboard/stats",
      "GET  /api/analytics",
      "GET  /api/model/metrics",
      "GET  /api/model/features",
      "GET  /api/model/info",
      "POST /api/resumes/upload",
      "GET/POST /api/notifications",
      "GET  /api/health",
    ],
  });
}
