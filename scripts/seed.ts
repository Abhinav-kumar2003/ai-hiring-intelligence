/**
 * Seed script - creates demo user and loads sample candidates from the CSV dataset.
 * Run with: bun run scripts/seed.ts
 */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import * as fs from "fs";
import * as path from "path";

interface CsvRow {
  Resume_ID: string;
  Name: string;
  Skills: string;
  Experience_Years: string;
  Education: string;
  Certifications: string;
  Job_Role: string;
  Recruiter_Decision: string;
  Salary_Expectation: string;
  Projects_Count: string;
  AI_Score: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines[0].split(",");
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        values.push(cur);
        cur = "";
      } else cur += ch;
    }
    values.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push({
      Resume_ID: row["Resume_ID"],
      Name: row["Name"],
      Skills: row["Skills"],
      Experience_Years: row["Experience (Years)"],
      Education: row["Education"],
      Certifications: row["Certifications"],
      Job_Role: row["Job Role"],
      Recruiter_Decision: row["Recruiter Decision"],
      Salary_Expectation: row["Salary Expectation ($)"],
      Projects_Count: row["Projects Count"],
      AI_Score: row["AI Score (0-100)"],
    });
  }
  return rows;
}

async function main() {
  console.log("Seeding database...");

  const passwordHash = await hashPassword("demo1234");
  const user = await db.user.upsert({
    where: { email: "recruiter@aihiring.com" },
    update: {},
    create: {
      email: "recruiter@aihiring.com",
      name: "Alex Morgan",
      passwordHash,
      role: "recruiter",
    },
  });
  console.log(`User created: ${user.email}`);

  // Clear existing data
  await db.predictionExplanation.deleteMany({});
  await db.prediction.deleteMany({ where: { userId: user.id } });
  await db.resumeFile.deleteMany({ where: { userId: user.id } });
  await db.candidate.deleteMany({ where: { userId: user.id } });
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.session.deleteMany({ where: { userId: user.id } });

  // Load CSV
  const csvPath = path.resolve(process.cwd(), "ml/dataset/hiring_dataset.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(csvText);
  console.log(`Loaded ${rows.length} rows from CSV`);

  // Pick 48 candidates spread across 90 days with a mix of hire/reject
  // Take rows at intervals to get variety
  const subset: CsvRow[] = [];
  const hireRows = rows.filter((r) => r.Recruiter_Decision === "Hire");
  const rejectRows = rows.filter((r) => r.Recruiter_Decision === "Reject");
  // ~75% hire, 25% reject to match the dataset distribution
  for (let i = 0; i < 36 && i < hireRows.length; i++) subset.push(hireRows[i * 3]);
  for (let i = 0; i < 12 && i < rejectRows.length; i++) subset.push(rejectRows[i * 2]);

  const now = new Date();
  for (let i = 0; i < subset.length; i++) {
    const row = subset[i];
    const daysAgo = Math.floor(((subset.length - i) / subset.length) * 90);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const certs = row.Certifications && row.Certifications !== "None" ? row.Certifications : "";
    await db.candidate.create({
      data: {
        userId: user.id,
        name: row.Name,
        email: `${row.Name.toLowerCase().replace(/[^a-z]/g, ".")}@example.com`,
        phone: `+1-555-${String(1000 + i).padStart(4, "0")}`,
        skills: row.Skills || "",
        experience: parseFloat(row.Experience_Years) || 0,
        education: row.Education || "",
        certifications: certs,
        jobRole: row.Job_Role || "",
        salaryExpectation: parseFloat(row.Salary_Expectation) || 0,
        projectsCount: parseInt(row.Projects_Count) || 0,
        source: "resume",
        createdAt,
        updatedAt: createdAt,
      },
    });
  }
  console.log(`Created ${subset.length} candidates`);

  // Notifications
  await db.notification.create({
    data: {
      userId: user.id,
      type: "analytics_ready",
      title: "Weekly analytics ready",
      message: "Your weekly hiring analytics report is now available.",
    },
  });
  await db.notification.create({
    data: {
      userId: user.id,
      type: "prediction_completed",
      title: "Prediction completed",
      message: "A new candidate prediction has been generated.",
    },
  });

  console.log("Seed complete.");
  console.log("Demo credentials: recruiter@aihiring.com / demo1234");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
