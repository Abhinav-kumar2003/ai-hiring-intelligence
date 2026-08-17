/**
 * GET /api/analytics
 * Returns all analytics data in one response (cards + chart data).
 * Supports filtering by dateRange, jobRole, education, experience, prediction.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, apiHandler, getQuery } from "@/lib/api";
import { getEDA } from "@/lib/prediction-engine";

async function handler(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  // Filters (applied to predictions / candidates)
  const jobRole = getQuery(req, "jobRole") || "all";
  const education = getQuery(req, "education") || "all";
  const experience = getQuery(req, "experience") || "all";
  const prediction = getQuery(req, "prediction") || "all";
  const days = parseInt(getQuery(req, "days") || "90", 10);

  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Base candidate query
  const candWhere: any = { userId: user.id };
  if (jobRole !== "all") candWhere.jobRole = jobRole;
  if (education !== "all") candWhere.education = education;
  if (experience !== "all") {
    switch (experience) {
      case "0-2": candWhere.experience = { gte: 0, lte: 2 }; break;
      case "3-5": candWhere.experience = { gte: 3, lte: 5 }; break;
      case "6-10": candWhere.experience = { gte: 6, lte: 10 }; break;
      case "10+": candWhere.experience = { gt: 10 }; break;
    }
  }

  const candidates = await db.candidate.findMany({
    where: candWhere,
    include: {
      predictions: {
        where: { createdAt: { gte: sinceDate } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Filter by prediction
  let filtered = candidates;
  if (prediction !== "all") {
    filtered = candidates.filter((c) => {
      const p = c.predictions[0];
      if (!p) return prediction === "pending";
      return p.prediction.toLowerCase() === prediction.toLowerCase();
    });
  }

  // Compute cards
  const totalCandidates = filtered.length;
  let totalExperience = 0;
  let totalProjects = 0;
  let totalSalary = 0;
  let totalHireProb = 0;
  let hiredCount = 0;
  let predictedCount = 0;
  for (const c of filtered) {
    totalExperience += c.experience;
    totalProjects += c.projectsCount;
    totalSalary += c.salaryExpectation;
    if (c.predictions[0]) {
      predictedCount++;
      totalHireProb += c.predictions[0].hireProbability;
      if (c.predictions[0].prediction === "Hired") hiredCount++;
    }
  }

  const cards = {
    totalCandidates,
    hiringRate: predictedCount > 0 ? hiredCount / predictedCount : 0,
    averageExperience: totalCandidates > 0 ? totalExperience / totalCandidates : 0,
    averageProjects: totalCandidates > 0 ? totalProjects / totalCandidates : 0,
    averageSalary: totalCandidates > 0 ? totalSalary / totalCandidates : 0,
    averageHireProbability: predictedCount > 0 ? totalHireProb / predictedCount : 0,
  };

  // Hiring distribution
  const hiringDistribution = [
    { name: "Hired", value: hiredCount, color: "#10b981" },
    { name: "Rejected", value: predictedCount - hiredCount, color: "#ef4444" },
  ];

  // Hiring by job role
  const roleMap: Record<string, { total: number; hired: number; rejected: number }> = {};
  for (const c of filtered) {
    const role = c.jobRole || "Unknown";
    if (!roleMap[role]) roleMap[role] = { total: 0, hired: 0, rejected: 0 };
    roleMap[role].total++;
    if (c.predictions[0]) {
      if (c.predictions[0].prediction === "Hired") roleMap[role].hired++;
      else roleMap[role].rejected++;
    }
  }
  const hiringByRole = Object.entries(roleMap).map(([role, v]) => ({ role, ...v }));

  // Hiring by education
  const eduMap: Record<string, { total: number; hired: number; rejected: number }> = {};
  for (const c of filtered) {
    const edu = c.education || "Unknown";
    if (!eduMap[edu]) eduMap[edu] = { total: 0, hired: 0, rejected: 0 };
    eduMap[edu].total++;
    if (c.predictions[0]) {
      if (c.predictions[0].prediction === "Hired") eduMap[edu].hired++;
      else eduMap[edu].rejected++;
    }
  }
  const hiringByEducation = Object.entries(eduMap).map(([education, v]) => ({ education, ...v }));

  // Experience vs hiring
  const expBuckets = [
    { range: "0-2", min: 0, max: 2 },
    { range: "3-5", min: 3, max: 5 },
    { range: "6-8", min: 6, max: 8 },
    { range: "9-10", min: 9, max: 10 },
    { range: "10+", min: 11, max: 100 },
  ];
  const experienceVsHiring = expBuckets.map((b) => {
    const inBucket = filtered.filter((c) => c.experience >= b.min && c.experience <= b.max);
    const predicted = inBucket.filter((c) => c.predictions[0]);
    const hired = inBucket.filter((c) => c.predictions[0]?.prediction === "Hired");
    return {
      range: b.range,
      total: inBucket.length,
      hired: hired.length,
      rejected: predicted.length - hired.length,
      hireRate: predicted.length > 0 ? hired.length / predicted.length : 0,
    };
  });

  // Certifications vs hiring
  const certVsHiring = [
    { name: "With Certification", total: filtered.filter((c) => c.certifications && c.certifications.trim() !== "").length, hired: filtered.filter((c) => c.certifications && c.certifications.trim() !== "" && c.predictions[0]?.prediction === "Hired").length },
    { name: "No Certification", total: filtered.filter((c) => !c.certifications || c.certifications.trim() === "").length, hired: filtered.filter((c) => (!c.certifications || c.certifications.trim() === "") && c.predictions[0]?.prediction === "Hired").length },
  ];

  // Projects vs hiring
  const projBuckets = [
    { range: "0-2", min: 0, max: 2 },
    { range: "3-5", min: 3, max: 5 },
    { range: "6-8", min: 6, max: 8 },
    { range: "9+", min: 9, max: 1000 },
  ];
  const projectsVsHiring = projBuckets.map((b) => {
    const inBucket = filtered.filter((c) => c.projectsCount >= b.min && c.projectsCount <= b.max);
    const predicted = inBucket.filter((c) => c.predictions[0]);
    const hired = inBucket.filter((c) => c.predictions[0]?.prediction === "Hired");
    return {
      range: b.range,
      total: inBucket.length,
      hired: hired.length,
      rejected: predicted.length - hired.length,
      hireRate: predicted.length > 0 ? hired.length / predicted.length : 0,
    };
  });

  // Salary vs hiring (distribution by hire/reject)
  const salaryBuckets = [
    { range: "0-50k", min: 0, max: 50000 },
    { range: "50k-80k", min: 50000, max: 80000 },
    { range: "80k-110k", min: 80000, max: 110000 },
    { range: "110k+", min: 110000, max: 1000000 },
  ];
  const salaryVsHiring = salaryBuckets.map((b) => {
    const inBucket = filtered.filter((c) => c.salaryExpectation >= b.min && c.salaryExpectation < b.max);
    const predicted = inBucket.filter((c) => c.predictions[0]);
    const hired = inBucket.filter((c) => c.predictions[0]?.prediction === "Hired");
    return {
      range: b.range,
      total: inBucket.length,
      hired: hired.length,
      rejected: predicted.length - hired.length,
      hireRate: predicted.length > 0 ? hired.length / predicted.length : 0,
    };
  });

  // Top skills (frequency across all candidates)
  const skillFreq: Record<string, number> = {};
  for (const c of filtered) {
    const skills = (c.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const s of skills) {
      skillFreq[s] = (skillFreq[s] || 0) + 1;
    }
  }
  const topSkills = Object.entries(skillFreq)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // EDA reference data (from training dataset)
  const eda = getEDA();

  return ok({
    cards,
    hiringDistribution,
    hiringByRole,
    hiringByEducation,
    experienceVsHiring,
    certVsHiring,
    projectsVsHiring,
    salaryVsHiring,
    topSkills,
    eda,
    filters: { jobRole, education, experience, prediction, days },
  });
}

export const GET = apiHandler(handler, { requireAuth: false });
