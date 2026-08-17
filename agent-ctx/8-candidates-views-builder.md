# Task 8 — Candidates + Candidate Details + Comparison Views

**Agent**: candidates-views-builder
**Status**: ✅ Complete
**Files modified**:
- `src/components/views/candidates-view.tsx` (full implementation)
- `src/components/views/candidate-details-view.tsx` (full implementation)
- `src/components/views/comparison-view.tsx` (full implementation)

## What was built

### CandidatesView
- Header with Add Candidate dialog button + Upload Resume (navigates to screening)
- Debounced search (350ms) hitting `candidateApi.list({ search })`
- 5 filter dropdowns (Prediction, Job Role, Experience, Probability, Clear Filters)
- Desktop table + mobile card layouts, responsive at all breakpoints
- Per-row Actions dropdown (View/Edit/Predict/Delete)
- Add/Edit dialog with zod validation + inline TagInput for skills/certifications
- Delete confirmation via AlertDialog
- Pagination with ellipsis (max 7 visible page numbers)
- Compare checkboxes (max 5, enforced) + floating "Compare N candidates" bar at bottom
- Loading skeleton, error state, empty state (with conditional copy based on filter state)
- All mutations show sonner toasts

### CandidateDetailsView
- Back button + avatar + name + role + meta
- Run Prediction button calls `predictionApi.predict()` and navigates to prediction-result view
- Left col (2/3): Profile Summary, Prediction History table (clickable rows), Activity Timeline (derived vertical timeline)
- Right col (1/3): Latest Prediction card with `CircularProgress` gauge (emerald for Hired, red for Rejected), Quick Actions card (Run/Compare/Download-disabled/Delete), Metadata card
- Edit dialog reuses same TagInput + zod schema
- Empty state when no `selectedCandidateId`

### ComparisonView
- Empty state when `compareCandidateIds` empty (Browse Candidates button)
- Selected candidates chips with avatars + Popover add dropdown (fetches full list, max 5)
- Comparison table with sticky first column, horizontal scroll on mobile
- Rows: Name, Job Role, Experience, Education, Skills count, Certs count, Projects, Salary, Prediction badge, Hire Probability (with Progress bar), Confidence, Added date
- Best value per row highlighted with amber background + Crown icon
- Summary footer card (Most Experienced, Most Likely to Hire, Most Projects, Most Skills)
- Remove button per candidate column

## Design decisions

- Used **emerald/teal** as the primary palette (NO indigo/blue per project guidelines)
- Hired badge: `bg-emerald-100 text-emerald-700`; Rejected: `bg-red-100 text-red-700`; Pending: outline
- Inline `TagInput` component in candidates-view and candidate-details-view (no new shared files created to comply with the "3 files" task scope)
- Sticky first column in comparison table for readability on mobile horizontal scroll
- Select-all checkbox on candidates table respects the 5-candidate compare cap and warns the user via toast

## Verification

- `npx eslint src/components/views/{candidates,candidate-details,comparison}-view.tsx` → 0 errors, 0 warnings
- `npx tsc --noEmit --skipLibCheck` → no errors in view files (only pre-existing errors in examples/, skills/, and a pre-existing api route issue)
- Dev server (Next.js 16.1.3 Turbopack) log is clean

## API surface used

- `candidateApi.list({ search, prediction, jobRole, experience, probability, page, pageSize, sortBy, sortDir })`
- `candidateApi.get(id)` (returns candidate with predictions[] and resumeFile)
- `candidateApi.create(data)` / `candidateApi.update(id, data)` / `candidateApi.delete(id)`
- `predictionApi.predict(input, candidateId, save)` for Run Prediction button

## Store integration

- Reads `selectedCandidateId`, `compareCandidateIds`
- Calls `navigate("candidate-details" | "screening" | "prediction-result" | "candidates" | "comparison", opts?)`
- Calls `toggleCompareCandidate(id)`, `clearCompare()`, `setLastPrediction(result)`

## Notes for next agent

- Screening view is still a placeholder — Run Prediction in CandidatesView routes there with `candidateId` in nav opts, so the screening view should accept that pre-fill
- Prediction-result view is still a placeholder — CandidateDetailsView navigates there with `predictionId`
- Predictions list view is still a placeholder — CandidateDetailsView "View All Predictions" button navigates there
- All 3 of my views are already wired in `src/app/page.tsx` ViewRouter — no registration needed
