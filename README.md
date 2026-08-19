# AI Hiring Intelligence — Predict Smarter, Hire Better

An AI-powered recruitment intelligence and applicant tracking platform. It leverages explainable Machine Learning to screen resumes, predict candidate outcomes, and deliver visual hiring analytics.

---

## 🚀 Key Features

*   **Explainable Machine Learning**: Runs a transpiled Random Forest classifier natively in TypeScript to predict hiring outcomes ("Hired" vs "Rejected") along with calibrated confidence scores.
*   **Feature Contribution (Explainable AI)**: Breaks down the statistical influence (positive, negative, neutral) and strength (strong, moderate, low) of each feature (e.g., Salary Expectation, Experience, projects count) on the prediction.
*   **Live Candidate Comparison**: Select and compare up to 5 candidates side-by-side, with key metrics and automatic highlights for the top candidates in each category.
*   **Recruitment Analytics Dashboard**: Interactive charts showing hiring rates, experience distribution, top skills, salary bands, and trend analytics over time.
*   **Resume Screening Engine**: Paste resume text or upload files to extract candidate name, email, skills, experience, and certifications automatically.
*   **Enterprise-Grade Auth**: Integrated with **Clerk** (`@clerk/nextjs`) for secure signup, sign-in, and session management.

---

## 🛠️ Technology Stack

*   **Frontend**: Next.js 16 (App Router, Turbopack), React 19, TailwindCSS, Shadcn UI, Lucide Icons, Recharts, Framer Motion
*   **Backend**: Next.js Route Handlers, Clerk Middleware
*   **Database**: SQLite via Prisma ORM
*   **ML Engine**: Random Forest Classifier (Python pipeline transpiled to native TypeScript browser/Node inference)

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 18+ or npm/bun installed.

### 2. Clone the Repository
```bash
git clone https://github.com/Abhinav-kumar2003/ai-hiring-intelligence.git
cd ai-hiring-intelligence
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="file:./db/custom.db"

# Clerk Configuration (Get keys from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

### 5. Setup Database & Seed Data
Initialize the SQLite database and seed it with mock candidate profiles from the machine learning training dataset:
```bash
# Sync Prisma schema and generate types
npm run db:push

# Seed database
npm run db:seed
```

### 6. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
├── prisma/             # Prisma schema and SQLite migrations
├── public/             # Static assets (custom matching SVG logos)
├── ml/                 # Machine Learning model training pipelines & exports
│   ├── dataset/        # Hiring training dataset CSV
│   └── model/          # Transpiled Random Forest JSON artifacts
├── src/
│   ├── app/            # Next.js App Router endpoints and pages
│   ├── components/     # UI views, Layout modules, and Shadcn primitives
│   ├── hooks/          # React custom hooks
│   ├── lib/            # Auth, Prisma DB, and TypeScript ML Prediction Engine
│   ├── services/       # Frontend centralized API handlers
│   ├── store/          # Zustand global state management
│   └── types/          # TypeScript interface definitions
└── scripts/            # Database seeding and population scripts
```

---

## 🤖 Machine Learning Details

The platform's prediction model is a **Tuned Random Forest Classifier** trained on a dataset of 1,000 candidate profiles. The model achieves **96.5% accuracy** on the test set.

- **Inference Speed**: Native TypeScript execution runs inference under **2ms**, eliminating Python runtime requirements at request time.
- **Explainability**: Custom permutation-based contribution algorithm computes the exact probability delta contributed by each candidate metric (experience, skills, salary, job role, certifications) relative to baseline averages.
