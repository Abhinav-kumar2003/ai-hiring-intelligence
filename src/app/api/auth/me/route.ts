/**
 * GET /api/auth/me
 */
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, apiHandler } from "@/lib/api";

async function handler() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
  });
}

export const GET = apiHandler(handler, { requireAuth: false });
