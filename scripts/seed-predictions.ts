/**
 * Seed predictions script - runs ML predictions for every seeded candidate so
 * the dashboard, analytics, and predictions history views have real data.
 *
 * Run with: bun run scripts/seed-predictions.ts
 */
import { db } from "../src/lib/db";
import { predict } from "../src/lib/prediction-engine";

async function main() {
  console.log("Seeding predictions...");

  const user = await db.user.findUnique({ where: { email: "recruiter@aihiring.com" } });
  if (!user) throw new Error("Demo user not found");

  const candidates = await db.candidate.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Found ${candidates.length} candidates`);

  // Clear existing predictions (explanations cascade via onDelete: Cascade,
  // but we delete them explicitly to be safe across schema versions).
  await db.predictionExplanation.deleteMany({});
  await db.prediction.deleteMany({ where: { userId: user.id } });
  console.log("Cleared existing predictions");

  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  let hired = 0;
  let rejected = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];

    const result = predict({
      skills: c.skills,
      experience: c.experience,
      education: c.education,
      certifications: c.certifications,
      jobRole: c.jobRole,
      salaryExpectation: c.salaryExpectation,
      projectsCount: c.projectsCount,
    });

    if (result.prediction === "Hired") hired++;
    else rejected++;

    // Spread across the last 30 days so the hiring-trend chart shows activity.
    const daysAgo = Math.floor(((candidates.length - i) / candidates.length) * 30);
    const createdAt = new Date(now.getTime() - daysAgo * DAY_MS);

    await db.prediction.create({
      data: {
        userId: user.id,
        candidateId: c.id,
        modelName: result.modelName,
        modelVersion: result.modelVersion,
        prediction: result.prediction,
        hireProbability: result.hireProbability,
        rejectProbability: result.rejectProbability,
        confidence: result.confidence,
        inputData: JSON.stringify({
          skills: c.skills,
          experience: c.experience,
          education: c.education,
          certifications: c.certifications,
          jobRole: c.jobRole,
          salaryExpectation: c.salaryExpectation,
          projectsCount: c.projectsCount,
        }),
        createdAt,
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
    });

    if ((i + 1) % 10 === 0 || i === candidates.length - 1) {
      console.log(`Processed ${i + 1}/${candidates.length}`);
    }
  }

  // Final counts straight from the database for verification.
  const total = await db.prediction.count({ where: { userId: user.id } });
  const hiredCount = await db.prediction.count({
    where: { userId: user.id, prediction: "Hired" },
  });
  const rejectedCount = await db.prediction.count({
    where: { userId: user.id, prediction: "Rejected" },
  });
  const explanations = await db.predictionExplanation.count({});

  console.log(`Done! Total: ${total}, Hired: ${hiredCount}, Rejected: ${rejectedCount}`);
  console.log(`Explanations: ${explanations}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
