/**
 * Resume Parser (TypeScript)
 * --------------------------
 * Extracts structured information from plain-text resume content.
 * Supports text extracted from PDF/DOCX (extraction done by the API route).
 *
 * This is a heuristic parser - it uses regex and keyword matching to pull
 * Name, Email, Phone, Skills, Education, Experience, Certifications, etc.
 *
 * For production use, a more robust NLP/LLM-based parser would be preferred,
 * but this provides a fully functional baseline that requires no external APIs.
 */

const SKILL_LIBRARY = [
  // Languages
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "SQL", "NoSQL",
  // Frontend
  "React", "Angular", "Vue", "Next.js", "Redux", "HTML", "CSS", "Tailwind", "Sass", "Bootstrap",
  // Backend
  "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring", "Rails", "Laravel", "GraphQL", "REST",
  // Data / ML
  "Machine Learning", "Deep Learning", "TensorFlow", "Pytorch", "PyTorch", "Keras", "scikit-learn", "Pandas", "NumPy", "NLP", "Computer Vision", "Data Science", "Data Analysis", "Tableau", "Power BI", "Spark", "Hadoop",
  // Cloud / DevOps
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Jenkins", "Terraform", "Ansible", "Linux", "Bash",
  // Database
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra",
  // Cybersecurity
  "Cybersecurity", "Ethical Hacking", "Penetration Testing", "Network Security", "SIEM",
  // Other
  "Git", "Agile", "Scrum", "JIRA", "Confluence",
];

const CERT_LIBRARY = [
  "AWS Certified", "Google ML", "Deep Learning Specialization", "Microsoft Certified",
  "Certified Kubernetes Administrator", "CKA", "CCNA", "CISSP", "CEH", "PMP",
  "TensorFlow Developer Certificate", "CompTIA Security+",
];

const EDUCATION_KEYWORDS = ["PhD", "Ph.D", "M.Tech", "M.Tech.", "MBA", "M.Sc", "M.S", "B.Tech", "B.Tech.", "B.Sc", "B.S", "B.E", "M.E", "Master", "Bachelor"];

const JOB_ROLE_KEYWORDS: { role: string; keywords: string[] }[] = [
  { role: "AI Researcher", keywords: ["ai research", "machine learning research", "deep learning research", "research scientist"] },
  { role: "Data Scientist", keywords: ["data scientist", "data science", "data analyst"] },
  { role: "Cybersecurity Analyst", keywords: ["cybersecurity", "security analyst", "information security", "penetration test", "ethical hacking"] },
  { role: "Software Engineer", keywords: ["software engineer", "software developer", "full stack", "fullstack", "backend", "frontend", "front-end", "back-end"] },
  { role: "ML Engineer", keywords: ["ml engineer", "machine learning engineer"] },
  { role: "DevOps Engineer", keywords: ["devops", "site reliability", "sre", "platform engineer"] },
  { role: "Frontend Developer", keywords: ["frontend developer", "front-end developer", "ui developer"] },
  { role: "Backend Developer", keywords: ["backend developer", "back-end developer", "api developer"] },
];

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  certifications: string[];
  education: string;
  experienceYears: number;
  jobRole: string;
  projectsCount: number;
  salaryExpectation: number;
  rawText: string;
}

/**
 * Parse plain-text resume content into structured fields.
 */
export function parseResume(text: string): ParsedResume {
  const raw = text || "";
  const lower = raw.toLowerCase();

  // ---- Email ----
  const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";

  // ---- Phone ----
  const phoneMatch = raw.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  // ---- Name ----
  // Heuristic: first non-empty line that doesn't look like contact info
  let name = "";
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (/^[A-Z][a-zA-Z'\-]+(\s+[A-Z][a-zA-Z'\-]+){1,3}$/.test(line) && !line.includes("@")) {
      name = line;
      break;
    }
  }
  if (!name && lines.length > 0) name = lines[0].split(/[|•\-—]/)[0].trim().slice(0, 60);

  // ---- Skills ----
  const skills: string[] = [];
  for (const skill of SKILL_LIBRARY) {
    const re = new RegExp(`\\b${skill.replace(/[.+*?^$()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(raw) && !skills.includes(skill)) skills.push(skill);
  }
  // Also check the "Skills:" section if present
  const skillsSection = raw.match(/skills?\s*[:\-]?\s*([^\n]+)/i);
  if (skillsSection) {
    const sectionSkills = skillsSection[1].split(/[,;|•]/).map((s) => s.trim()).filter(Boolean);
    for (const s of sectionSkills) {
      // Normalize casing using library
      const lib = SKILL_LIBRARY.find((sk) => sk.toLowerCase() === s.toLowerCase());
      const normalized = lib ?? s;
      if (!skills.includes(normalized) && s.length < 40) skills.push(normalized);
    }
  }

  // ---- Certifications ----
  const certifications: string[] = [];
  for (const cert of CERT_LIBRARY) {
    const re = new RegExp(cert.replace(/[.+*?^$()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "i");
    if (re.test(raw) && !certifications.includes(cert)) certifications.push(cert);
  }
  const certSection = raw.match(/certifications?\s*[:\-]?\s*([^\n]+)/i);
  if (certSection) {
    const sectionCerts = certSection[1].split(/[,;|•]/).map((c) => c.trim()).filter(Boolean);
    for (const c of sectionCerts) {
      if (!certifications.includes(c) && c.length < 60 && c.toLowerCase() !== "none") certifications.push(c);
    }
  }

  // ---- Education ----
  let education = "";
  for (const edu of EDUCATION_KEYWORDS) {
    const re = new RegExp(`\\b${edu.replace(/[.+*?^$()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(raw)) {
      // Map to canonical form
      if (/ph\.?d/i.test(edu)) education = "PhD";
      else if (/m\.?tech/i.test(edu)) education = "M.Tech";
      else if (/mba/i.test(edu)) education = "MBA";
      else if (/m\.?sc/i.test(edu) || /m\.?s/i.test(edu)) education = "M.Sc";
      else if (/b\.?tech/i.test(edu)) education = "B.Tech";
      else if (/b\.?sc/i.test(edu) || /b\.?s/i.test(edu)) education = "B.Sc";
      else if (/b\.?e/i.test(edu)) education = "B.E";
      else if (/m\.?e/i.test(edu)) education = "M.E";
      else if (/master/i.test(edu)) education = "MBA";
      else if (/bachelor/i.test(edu)) education = "B.Sc";
      if (education) break;
    }
  }

  // ---- Experience ----
  let experienceYears = 0;
  // Try "X years of experience"
  const expMatch1 = raw.match(/(\d+)\+?\s*(?:years|yrs)\s*(?:of\s*)?experience/i);
  if (expMatch1) experienceYears = parseInt(expMatch1[1]);
  // Try "Experience: X years"
  if (!experienceYears) {
    const expMatch2 = raw.match(/experience\s*[:\-]?\s*(\d+)/i);
    if (expMatch2) experienceYears = parseInt(expMatch2[1]);
  }
  // Try to sum up year ranges (e.g. "2018 - 2021")
  if (!experienceYears) {
    const yearRanges = [...raw.matchAll(/(20\d{2})\s*[-–—]\s*(20\d{2}|present|current|now)/gi)];
    let totalYears = 0;
    for (const m of yearRanges) {
      const start = parseInt(m[1]);
      const end = /present|current|now/i.test(m[2]) ? new Date().getFullYear() : parseInt(m[2]);
      if (end >= start) totalYears += end - start;
    }
    if (totalYears > 0) experienceYears = totalYears;
  }

  // ---- Job Role ----
  let jobRole = "";
  for (const { role, keywords } of JOB_ROLE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) {
      jobRole = role;
      break;
    }
  }

  // ---- Projects count ----
  let projectsCount = 0;
  const projMatch = raw.match(/(\d+)\+?\s*(?:projects|project)/i);
  if (projMatch) projectsCount = parseInt(projMatch[1]);
  if (!projectsCount) {
    // Count "Project:" headers
    const projHeaders = raw.match(/^\s*project\s*\d*\s*[:\-]/gim);
    if (projHeaders) projectsCount = projHeaders.length;
  }
  if (!projectsCount) {
    // Count "•" bullets under "Projects" section
    const projSection = raw.match(/projects?\s*[:\-]?\s*([\s\S]*?)(?=\n\s*\n|\n\s*[A-Z][a-z]+:|$)/i);
    if (projSection) {
      const bullets = projSection[1].match(/[•\-\*]\s/g);
      if (bullets) projectsCount = bullets.length;
    }
  }

  // ---- Salary expectation ----
  let salaryExpectation = 0;
  const salMatch = raw.match(/\$\s*(\d{2,3}(?:,\d{3})*|\d{4,6})\s*(?:k|000)?/i);
  if (salMatch) {
    const num = parseInt(salMatch[1].replace(/,/g, ""));
    if (num < 1000) salaryExpectation = num * 1000; // e.g. "$95k"
    else salaryExpectation = num;
  }

  return {
    name: name || "Unknown Candidate",
    email,
    phone,
    skills: skills.slice(0, 12),
    certifications,
    education: education || "B.Sc",
    experienceYears,
    jobRole: jobRole || "Software Engineer",
    projectsCount,
    salaryExpectation,
    rawText: raw,
  };
}

/**
 * Generate a sample resume text (used for the demo "sample resume" upload button).
 */
export function generateSampleResumeText(strong: boolean = true): string {
  if (strong) {
    return `Jane Smith
jane.smith@email.com | +1-555-0142 | San Francisco, CA

PROFESSIONAL SUMMARY
Senior Machine Learning Engineer with 7 years of experience building production ML systems.

SKILLS
Python, TensorFlow, Pytorch, Machine Learning, Deep Learning, SQL, Docker, AWS, Kubernetes, NLP

EXPERIENCE
Senior ML Engineer, TechCorp (2019 - Present)
- Built recommendation system serving 10M+ users
- Deployed 5 production ML models

ML Engineer, DataStart (2017 - 2019)
- Developed NLP pipeline for sentiment analysis

EDUCATION
M.Tech in Computer Science, Stanford University

CERTIFICATIONS
AWS Certified, Google ML, Deep Learning Specialization

PROJECTS
1. Real-time fraud detection system
2. Image classification API (Pytorch)
3. Conversational AI chatbot
4. Recommendation engine
5. Document summarization tool
6. Time series forecasting dashboard

SALARY EXPECTATION
$120,000`;
  } else {
    return `Bob Johnson
bob.j@email.com | +1-555-0199

SUMMARY
Junior developer looking for opportunities.

SKILLS
HTML, CSS, JavaScript

EXPERIENCE
Intern, SmallCo (2023 - 2024)
- Basic frontend tasks

EDUCATION
B.Sc in Information Technology

PROJECTS
1. Personal blog website

SALARY EXPECTATION
$45,000`;
  }
}
