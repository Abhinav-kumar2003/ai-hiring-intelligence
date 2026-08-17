/**
 * GET  /api/candidates  - list candidates with search/filters/pagination
 * POST /api/candidates  - create a new candidate
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, apiHandler, getQuery, getIntQuery } from "@/lib/api";
import { z } from "zod";

const CandidateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  skills: z.string().default(""),
  experience: z.number().min(0).max(50),
  education: z.string(),
  certifications: z.string().default(""),
  jobRole: z.string(),
  salaryExpectation: z.number().min(0),
  projectsCount: z.number().int().min(0),
  source: z.enum(["manual", "resume"]).default("manual"),
});

async function listCandidates(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const search = getQuery(req, "search")?.toLowerCase() || "";
  const prediction = getQuery(req, "prediction") || "all";
  const jobRole = getQuery(req, "jobRole") || "all";
  const experienceFilter = getQuery(req, "experience") || "all";
  const probFilter = getQuery(req, "probability") || "any";
  const page = getIntQuery(req, "page", 1);
  const pageSize = getIntQuery(req, "pageSize", 12);
  const sortBy = getQuery(req, "sortBy") || "createdAt";
  const sortDir = getQuery(req, "sortDir") === "asc" ? "asc" : "desc";

  // Build where clause
  const where: any = { userId: user.id };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { jobRole: { contains: search } },
      { skills: { contains: search } },
    ];
  }
  if (jobRole !== "all") where.jobRole = jobRole;

  if (experienceFilter !== "all") {
    switch (experienceFilter) {
      case "0-2": where.experience = { gte: 0, lte: 2 }; break;
      case "3-5": where.experience = { gte: 3, lte: 5 }; break;
      case "6-10": where.experience = { gte: 6, lte: 10 }; break;
      case "10+": where.experience = { gt: 10 }; break;
    }
  }

  // Get candidates with their latest prediction
  let candidates = await db.candidate.findMany({
    where,
    include: {
      predictions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { [sortBy]: sortDir },
  });

  // Apply prediction + probability filters in JS (would need raw SQL in postgres)
  if (prediction !== "all") {
    candidates = candidates.filter((c) => {
      const p = c.predictions[0];
      if (!p) return prediction === "pending";
      return p.prediction.toLowerCase() === prediction.toLowerCase();
    });
  }
  if (probFilter !== "any") {
    const threshold = parseFloat(probFilter.replace(">", "")) / 100;
    candidates = candidates.filter((c) => {
      const p = c.predictions[0];
      if (!p) return false;
      const prob = p.prediction === "Hired" ? p.hireProbability : p.rejectProbability;
      return prob >= threshold;
    });
  }

  // Pagination
  const total = candidates.length;
  const start = (page - 1) * pageSize;
  const paged = candidates.slice(start, start + pageSize);

  return ok({
    candidates: paged.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      skills: c.skills,
      experience: c.experience,
      education: c.education,
      certifications: c.certifications,
      jobRole: c.jobRole,
      salaryExpectation: c.salaryExpectation,
      projectsCount: c.projectsCount,
      source: c.source,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      latestPrediction: c.predictions[0]
        ? {
            id: c.predictions[0].id,
            prediction: c.predictions[0].prediction,
            hireProbability: c.predictions[0].hireProbability,
            rejectProbability: c.predictions[0].rejectProbability,
            confidence: c.predictions[0].confidence,
            modelName: c.predictions[0].modelName,
            modelVersion: c.predictions[0].modelVersion,
            createdAt: c.predictions[0].createdAt,
          }
        : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

async function createCandidate(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json();
  const parsed = CandidateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
  const data = parsed.data;

  const candidate = await db.candidate.create({
    data: {
      userId: user.id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      skills: data.skills,
      experience: data.experience,
      education: data.education,
      certifications: data.certifications,
      jobRole: data.jobRole,
      salaryExpectation: data.salaryExpectation,
      projectsCount: data.projectsCount,
      source: data.source,
    },
  });

  await db.notification.create({
    data: {
      userId: user.id,
      type: "candidate_created",
      title: "Candidate created",
      message: `${candidate.name} has been added to your candidate list.`,
    },
  });

  return ok({ candidate });
}

export const GET = apiHandler(listCandidates, { requireAuth: false });
export const POST = apiHandler(createCandidate, { requireAuth: false });
