/**
 * POST /api/auth/login
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { ok, badRequest, apiHandler } from "@/lib/api";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

async function handler(req: NextRequest) {
  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) return badRequest("Invalid email or password");
  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) return badRequest("Invalid email or password");

  await createSession(user.id);
  return ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
  });
}

export const POST = apiHandler(handler, { requireAuth: false });
