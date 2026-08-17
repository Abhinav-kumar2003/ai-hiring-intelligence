/**
 * POST /api/auth/logout
 */
import { destroySession } from "@/lib/auth";
import { ok, apiHandler } from "@/lib/api";

async function handler() {
  await destroySession();
  return ok({ success: true });
}

export const POST = apiHandler(handler);
