/**
 * GET  /api/notifications  - list notifications for current user
 * POST /api/notifications  - mark notifications as read (body: { ids?: string[], all?: boolean })
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, apiHandler } from "@/lib/api";
import { z } from "zod";

const MarkReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().default(false),
});

async function listHandler() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const unreadCount = await db.notification.count({ where: { userId: user.id, read: false } });
  return ok({ notifications, unreadCount });
}

async function markReadHandler(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json();
  const parsed = MarkReadSchema.safeParse(body);
  if (!parsed.success) return ok({ success: false });
  if (parsed.data.all) {
    await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  } else if (parsed.data.ids && parsed.data.ids.length > 0) {
    await db.notification.updateMany({ where: { userId: user.id, id: { in: parsed.data.ids } }, data: { read: true } });
  }
  return ok({ success: true });
}

export const GET = apiHandler(listHandler, { requireAuth: false });
export const POST = apiHandler(markReadHandler, { requireAuth: false });
