/**
 * GET /api/dashboard/stats
 * Returns aggregated statistics for the recruiter dashboard.
 * All values come from the actual database - no hardcoding.
 */
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, apiHandler } from "@/lib/api";

async function handler() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const [totalCandidates, predictions, recentCandidates] = await Promise.all([
    db.candidate.count({ where: { userId: user.id } }),
    db.prediction.findMany({
      where: { userId: user.id },
      select: { prediction: true, hireProbability: true, createdAt: true, candidateId: true, candidate: { select: { jobRole: true, experience: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.candidate.findMany({
      where: { userId: user.id },
      include: { predictions: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const hiredCount = predictions.filter((p) => p.prediction === "Hired").length;
  const rejectedCount = predictions.filter((p) => p.prediction === "Rejected").length;
  const avgHireProb = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + p.hireProbability, 0) / predictions.length
    : 0;

  // Hiring trend (last 30 days, grouped by day)
  const trendDays = 30;
  const now = new Date();
  const trendData: { date: string; total: number; hired: number; rejected: number }[] = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = day.toISOString().slice(0, 10);
    const dayPredictions = predictions.filter((p) => p.createdAt.toISOString().slice(0, 10) === dayStr);
    trendData.push({
      date: dayStr,
      total: dayPredictions.length,
      hired: dayPredictions.filter((p) => p.prediction === "Hired").length,
      rejected: dayPredictions.filter((p) => p.prediction === "Rejected").length,
    });
  }

  // Hiring by job role (last 90 days)
  const roleMap: Record<string, { total: number; hired: number; rejected: number }> = {};
  for (const p of predictions) {
    const role = p.candidate?.jobRole || "Unknown";
    if (!roleMap[role]) roleMap[role] = { total: 0, hired: 0, rejected: 0 };
    roleMap[role].total++;
    if (p.prediction === "Hired") roleMap[role].hired++;
    else roleMap[role].rejected++;
  }
  const hiringByRole = Object.entries(roleMap).map(([role, v]) => ({ role, ...v }));

  // Experience distribution
  const expBuckets = [
    { range: "0-2", min: 0, max: 2 },
    { range: "3-5", min: 3, max: 5 },
    { range: "6-8", min: 6, max: 8 },
    { range: "9-10", min: 9, max: 10 },
    { range: "10+", min: 11, max: 100 },
  ];
  const allCandidates = await db.candidate.findMany({
    where: { userId: user.id },
    select: { experience: true },
  });
  const experienceDistribution = expBuckets.map((b) => ({
    range: b.range,
    count: allCandidates.filter((c) => c.experience >= b.min && c.experience <= b.max).length,
  }));

  // Recent candidates formatted
  const recent = recentCandidates.map((c) => ({
    id: c.id,
    name: c.name,
    jobRole: c.jobRole,
    experience: c.experience,
    education: c.education,
    skills: c.skills,
    prediction: c.predictions[0]?.prediction || null,
    hireProbability: c.predictions[0]?.hireProbability || null,
    createdAt: c.createdAt,
  }));

  return ok({
    stats: {
      totalCandidates,
      totalPredictions: predictions.length,
      hired: hiredCount,
      rejected: rejectedCount,
      pending: totalCandidates - predictions.length,
      avgHireProbability: avgHireProb,
      hireRate: predictions.length > 0 ? hiredCount / predictions.length : 0,
    },
    trend: trendData,
    hiringByRole,
    experienceDistribution,
    recentCandidates: recent,
  });
}

export const GET = apiHandler(handler, { requireAuth: false });
