/**
 * GET    /api/candidates/[id]  - get candidate by id with predictions
 * PUT    /api/candidates/[id]  - update candidate
 * DELETE /api/candidates/[id]  - delete candidate
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, notFound, apiHandler } from "@/lib/api";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  skills: z.string().optional(),
  experience: z.number().min(0).max(50).optional(),
  education: z.string().optional(),
  certifications: z.string().optional(),
  jobRole: z.string().optional(),
  salaryExpectation: z.number().min(0).optional(),
  projectsCount: z.number().int().min(0).optional(),
});

async function getCandidate(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const candidate = await db.candidate.findFirst({
    where: { id, userId: user.id },
    include: {
      predictions: {
        include: { explanations: true },
        orderBy: { createdAt: "desc" },
      },
      resumeFile: true,
    },
  });
  if (!candidate) return notFound("Candidate not found");

  return ok({ candidate });
}

async function updateCandidate(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const existing = await db.candidate.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound("Candidate not found");

  const data = { ...parsed.data };
  if (data.email === "") data.email = null;

  const candidate = await db.candidate.update({
    where: { id },
    data,
  });

  await db.notification.create({
    data: {
      userId: user.id,
      type: "candidate_updated",
      title: "Candidate updated",
      message: `${candidate.name}'s profile has been updated.`,
    },
  });

  return ok({ candidate });
}

async function deleteCandidate(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const existing = await db.candidate.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound("Candidate not found");

  await db.candidate.delete({ where: { id } });
  return ok({ success: true });
}

export const GET = apiHandler(getCandidate, { requireAuth: false });
export const PUT = apiHandler(updateCandidate, { requireAuth: false });
export const DELETE = apiHandler(deleteCandidate, { requireAuth: false });
