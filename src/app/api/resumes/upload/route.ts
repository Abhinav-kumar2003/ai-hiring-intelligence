/**
 * POST /api/resumes/upload
 * Accepts a plain-text resume (extracted client-side from PDF/DOCX),
 * parses it, and returns the structured candidate information.
 *
 * For the demo, also accepts a "sample" mode that returns a pre-built
 * strong or weak resume for testing without an actual file.
 *
 * Body: { mode?: "text" | "sample", text?: string, sampleType?: "strong" | "weak" }
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, apiHandler } from "@/lib/api";
import { parseResume, generateSampleResumeText } from "@/lib/resume-parser";
import { z } from "zod";

const UploadSchema = z.object({
  mode: z.enum(["text", "sample"]).default("text"),
  text: z.string().optional(),
  sampleType: z.enum(["strong", "weak"]).default("strong"),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
});

async function handler(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
  const { mode, text, sampleType, fileName, fileSize, mimeType } = parsed.data;

  let rawText = "";
  if (mode === "sample") {
    rawText = generateSampleResumeText(sampleType === "strong");
  } else {
    if (!text || text.trim().length < 20) {
      return badRequest("Resume text is too short or empty");
    }
    rawText = text;
  }

  // Parse the resume
  const parsed2 = parseResume(rawText);

  // Save the resume file record
  const resumeFile = await db.resumeFile.create({
    data: {
      userId: user.id,
      originalName: fileName || (mode === "sample" ? `sample-${sampleType}-resume.txt` : "uploaded-resume.txt"),
      mimeType: mimeType || "text/plain",
      size: fileSize || rawText.length,
      content: rawText,
      extracted: JSON.stringify(parsed2),
    },
  });

  return ok({
    resumeId: resumeFile.id,
    parsed: parsed2,
  });
}

export const POST = apiHandler(handler, { requireAuth: false });
