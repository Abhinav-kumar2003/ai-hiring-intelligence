/**
 * GET /api/predictions/[id]  - get a single prediction with explanations
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, notFound, apiHandler } from "@/lib/api";

async function handler(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const prediction = await db.prediction.findFirst({
    where: { id, userId: user.id },
    include: {
      explanations: true,
      candidate: { select: { id: true, name: true, jobRole: true, email: true, experience: true, education: true, skills: true, certifications: true, salaryExpectation: true, projectsCount: true } },
    },
  });
  if (!prediction) return notFound("Prediction not found");

  return ok({
    prediction: {
      id: prediction.id,
      candidateId: prediction.candidateId,
      candidate: prediction.candidate,
      modelName: prediction.modelName,
      modelVersion: prediction.modelVersion,
      prediction: prediction.prediction,
      hireProbability: prediction.hireProbability,
      rejectProbability: prediction.rejectProbability,
      confidence: prediction.confidence,
      inputData: prediction.inputData,
      createdAt: prediction.createdAt,
      explanations: prediction.explanations.map((e) => ({
        feature: e.feature,
        value: e.value,
        contribution: e.contribution,
        direction: e.direction,
        strength: e.strength,
      })),
    },
  });
}

export const GET = apiHandler(handler, { requireAuth: false });
