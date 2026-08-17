/**
 * PUT /api/profile  - update current user's profile (name, avatarUrl)
 * PATCH /api/profile  - change password (body: { currentPassword, newPassword })
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { ok, badRequest, unauthorized, apiHandler } from "@/lib/api";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

async function updateProfile(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl || null } : {}),
    },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
  });
  return ok({ user: updated });
}

async function changePassword(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json();
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full) return unauthorized();
  if (!verifyPassword(parsed.data.currentPassword, full.passwordHash)) {
    return badRequest("Current password is incorrect");
  }
  const newHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
  return ok({ success: true });
}

export const PUT = apiHandler(updateProfile, { requireAuth: false });
export const PATCH = apiHandler(changePassword, { requireAuth: false });
