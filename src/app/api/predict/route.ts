/**
 * POST /api/predict
 * Runs the ML model on the provided candidate data and saves the prediction
 * (with explanations) to the database.
 *
 * Body: { candidateId?: string, input: CandidateInput, save?: boolean }
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, apiHandler } from "@/lib/api";
import { predict, getModelMetadata, CandidateInput } from "@/lib/prediction-engine";
import { z } from "zod";

const InputSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  skills: z.string().default(""),
  experience: z.number().min(0).max(50),
  education: z.string(),
  certifications: z.string().default(""),
  jobRole: z.string(),
  salaryExpectation: z.number().min(0),
  projectsCount: z.number().int().min(0),
});

const PredictSchema = z.object({
  candidateId: z.string().optional(),
  input: InputSchema,
  save: z.boolean().default(true),
});

async function handler(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = PredictSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const { candidateId, input, save } = parsed.data;
  const candidateInput: CandidateInput = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    skills: input.skills,
    experience: input.experience,
    education: input.education,
    certifications: input.certifications,
    jobRole: input.jobRole,
    salaryExpectation: input.salaryExpectation,
    projectsCount: input.projectsCount,
  };

  // Run inference
  const result = predict(candidateInput);
  const meta = getModelMetadata();

  let savedPredictionId: string | undefined;

  if (save) {
    // Verify candidate ownership if candidateId provided
    let verifiedCandidateId: string | null = candidateId ?? null;
    if (candidateId) {
      const cand = await db.candidate.findFirst({ where: { id: candidateId, userId: user.id } });
      if (!cand) verifiedCandidateId = null;
    }

    const prediction = await db.prediction.create({
      data: {
        userId: user.id,
        candidateId: verifiedCandidateId,
        modelName: result.modelName,
        modelVersion: result.modelVersion,
        prediction: result.prediction,
        hireProbability: result.hireProbability,
        rejectProbability: result.rejectProbability,
        confidence: result.confidence,
        inputData: JSON.stringify(candidateInput),
        explanations: {
          create: result.explanations.map((e) => ({
            feature: e.feature,
            value: typeof e.rawValue === "number" ? e.rawValue : 0,
            contribution: e.contribution,
            direction: e.direction,
            strength: e.strength,
          })),
        },
      },
      include: { explanations: true },
    });
    savedPredictionId = prediction.id;

    await db.notification.create({
      data: {
        userId: user.id,
        type: "prediction_completed",
        title: "Prediction completed",
        message: `Prediction for ${candidateInput.name || "candidate"}: ${result.prediction} (${(result.hireProbability * 100).toFixed(1)}% hire probability).`,
      },
    });
  }

  return ok({
    predictionId: savedPredictionId,
    prediction: result.prediction,
    hireProbability: result.hireProbability,
    rejectProbability: result.rejectProbability,
    confidence: result.confidence,
    confidenceScore: result.confidenceScore,
    modelName: result.modelName,
    modelVersion: result.modelVersion,
    explanations: result.explanations,
    warning: result.warning,
    metadata: {
      modelType: meta.model_type,
      trainingDate: meta.training_date,
      trainingSamples: meta.training_samples,
      features: meta.features.length,
    },
  });
}

export const POST = apiHandler(handler, { requireAuth: false });
