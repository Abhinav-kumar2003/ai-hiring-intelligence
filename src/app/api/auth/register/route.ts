/**
 * POST /api/auth/register
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { ok, badRequest, apiHandler } from "@/lib/api";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

async function handler(req: NextRequest) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return badRequest("An account with this email already exists");

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { email: email.toLowerCase(), name, passwordHash, role: "recruiter" },
  });
  await createSession(user.id);
  return ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
  });
}

export const POST = apiHandler(handler, { requireAuth: false });
