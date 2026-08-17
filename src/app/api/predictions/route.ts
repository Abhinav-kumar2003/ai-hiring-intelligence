/**
 * GET /api/predictions  - list prediction history with filters
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, apiHandler, getQuery, getIntQuery } from "@/lib/api";

async function handler(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const prediction = getQuery(req, "prediction") || "all";
  const modelName = getQuery(req, "model") || "all";
  const page = getIntQuery(req, "page", 1);
  const pageSize = getIntQuery(req, "pageSize", 15);
  const sortBy = getQuery(req, "sortBy") || "createdAt";
  const sortDir = getQuery(req, "sortDir") === "asc" ? "asc" : "desc";

  const where: any = { userId: user.id };
  if (prediction !== "all") where.prediction = prediction;
  if (modelName !== "all") where.modelName = modelName;

  const [total, predictions] = await Promise.all([
    db.prediction.count({ where }),
    db.prediction.findMany({
      where,
      include: {
        candidate: { select: { id: true, name: true, jobRole: true, email: true } },
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    predictions: predictions.map((p) => ({
      id: p.id,
      candidateId: p.candidateId,
      candidate: p.candidate,
      modelName: p.modelName,
      modelVersion: p.modelVersion,
      prediction: p.prediction,
      hireProbability: p.hireProbability,
      rejectProbability: p.rejectProbability,
      confidence: p.confidence,
      createdAt: p.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export const GET = apiHandler(handler, { requireAuth: false });
