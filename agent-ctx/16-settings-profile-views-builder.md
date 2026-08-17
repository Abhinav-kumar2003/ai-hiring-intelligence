# Task ID: 16 — Settings + Profile Views

**Agent:** settings-profile-views-builder
**Task:** Build SettingsView and ProfileView for the AI Hiring Prediction System

## Context Reviewed
- `/home/z/my-project/worklog.md` — prior agents built dashboard, candidates, screening, predictions, analytics, and model-performance views
- `/home/z/my-project/src/types/index.ts` — `User` type (id, name, email, role, avatarUrl?, createdAt?)
- `/home/z/my-project/src/services/api.ts` — `profileApi.update({ name })`, `profileApi.changePassword(current, new)`, `authApi.logout()`, `dashboardApi.stats()`
- `/home/z/my-project/src/store/app-store.ts` — Zustand store with `user`, `setUser`, `logout`, `navigate`
- `/home/z/my-project/src/components/shared/states.tsx` — `LoadingState`, `ErrorState`, `EmptyState`
- `/home/z/my-project/src/components/views/dashboard-view.tsx` — reference for styling patterns (emerald/teal, rounded-xl, responsive grid)
- shadcn/ui components: button, input, label, card, badge, separator, switch, tabs, avatar, dialog, alert-dialog, tooltip, skeleton

## Files Created/Replaced
1. `/home/z/my-project/src/components/views/settings-view.tsx` (~722 lines)
2. `/home/z/my-project/src/components/views/profile-view.tsx` (~342 lines)

Both export named functions: `SettingsView`, `ProfileView` (already wired in `src/app/page.tsx` ViewRouter).

## SettingsView Implementation

**Header:** "Settings" + "Manage your account preferences." + member-since footer

**Tabs (4):**

### Tab 1 — Profile
- Name input (pre-filled from `user.name`, validates ≥ 2 chars)
- Email input (disabled, note "Email cannot be changed")
- Role input (disabled, shows "Recruiter", note "assigned by administrator")
- "Save Changes" button → `profileApi.update({ name })` → `setUser(updatedUser)` → `toast.success("Profile updated successfully")`
- Disabled while saving or when name unchanged; shows `Loader2` spinner during save
- Inline validation error shown when name < 2 chars

### Tab 2 — Appearance
- 3 theme cards (Light/Dark/System) in `sm:grid-cols-3`
- Each card: preview swatch (white/dark/gradient bg + themed icon), label, description, `Check` icon when active
- Active card: `border-primary bg-primary/5 shadow-sm`; inactive: `border-border hover:border-primary/40`
- Clicking calls `setTheme(value)` from `next-themes`
- Uses `currentTheme = theme || "system"` to avoid hydration mismatch (next-themes returns undefined on server + first client render)
- Note: "Your theme preference is saved automatically."

### Tab 3 — Notifications
- 4 `NotifRow` components with `Switch` toggles:
  - Email notifications (default on)
  - Prediction notifications (default on)
  - Weekly analytics report (default off)
  - Resume processing alerts (default on)
- Each row: icon tile + title + description + Switch
- Separators between rows
- Stored in localStorage key `ai-hiring-notification-prefs` via `useNotificationPrefs` hook (lazy `useState` initializer — no effect, no set-state-in-effect lint issue)
- `updatePref` writes to localStorage and shows `toast.success("Preferences saved")`
- Note: "Notification preferences are saved to your account. Some notifications (like prediction completed) are always sent for audit purposes."

### Tab 4 — Security
**Change Password card:**
- Current Password (with Eye/EyeOff show-hide toggle button)
- New Password (with Eye/EyeOff show-hide toggle button)
- Confirm New Password (plain password input)
- Password requirements hint (min 6 chars, mix of letters/numbers/symbols)
- Inline "Passwords do not match" error when confirm ≠ new
- "Change Password" button validates: current not empty, new ≥ 6 chars, new === confirm, new ≠ current → `profileApi.changePassword(current, new)` → toast success + clear fields

**Active Sessions card:**
- "Current session" row with `MonitorSmartphone` icon, "Active" badge (emerald), device info from `navigator.userAgent` (browser + OS via `getDeviceInfo()`), last active timestamp
- Note about 7-day inactivity auto-logout
- "Log out all other sessions" button (disabled) wrapped in `Tooltip` → "Coming soon"

**Danger Zone card** (red-bordered):
- "Delete Account" red-outline button → `AlertDialog` confirmation ("Are you sure? This action cannot be undone…") → on confirm: `toast.info("Account deletion is not available in the demo")`

## ProfileView Implementation

**Header:** "Profile" + "View and manage your profile information."

**Profile header card:**
- Emerald-to-teal gradient banner (`h-24`/`h-28`)
- Large `Avatar` (h-24/w-24 sm:h-28/w-28) with `ring-4 ring-background`, `AvatarFallback` with `bg-gradient-to-br from-emerald-500 to-teal-600` + initials
- Name (xl/2xl bold), role badge (emerald, capitalized), email with `Mail` icon, "Member since {formatted full date}" with `Calendar` icon
- "Edit Profile" button → `navigate("settings")` (Profile tab is default)

**Main grid (lg:grid-cols-3):**
- Left col (lg:col-span-2): Stats card + Details card (stacked)
- Right col (lg:col-span-1): Quick Actions card

**Profile Stats card:**
- Fetches `dashboardApi.stats()` on mount
- Loading: 3 skeleton tiles; Error: inline amber warning + Retry button; Success: 3 `StatTile` components
  - Candidates Managed (`Users`, emerald) — `stats.stats.totalCandidates`
  - Predictions Run (`Brain`, teal) — `stats.stats.totalPredictions`
  - Member Since (`Calendar`, amber) — formatted `user.createdAt`

**Profile Details card:**
- 2-col grid (sm:grid-cols-2) of 6 detail rows, each with icon tile + label + value:
  - Full Name, Email Address, Role (badge), Account Created, Last Updated ("Not available" — User type has no updatedAt), User ID (truncated mono with title tooltip)

**Quick Actions card:**
- 4 clickable rows with icon tiles + title + description + `ArrowRight` (translates on hover):
  - Edit Settings (emerald) → `navigate("settings")`
  - View Dashboard (teal) → `navigate("dashboard")`
  - View Analytics (amber) → `navigate("analytics")`
  - Logout (red) → `logout()`
- Separators between rows

## Design
- Professional SaaS: `rounded-xl` cards, subtle borders, consistent `p-4`/`p-6`, `gap-6`
- Emerald/teal primary palette (NO indigo/blue); red for danger/destructive; amber for warnings
- Avatar gradient: `bg-gradient-to-br from-emerald-500 to-teal-600`
- Role badges: `bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400`
- Responsive: 390px (stacked, 2-col tab list) → 768px (sm: grid-cols) → 1024px (lg: 3-col main grid) → 1440px (max-w cards)
- `date-fns` `format()` for all dates: "MMM d, yyyy" and "MMMM d, yyyy"
- `toast` from sonner for all notifications
- Loading spinners (`Loader2 animate-spin`) on all async buttons; skeletons for stats
- All buttons functional; all forms validated

## Lint & Type-Safety Notes
- Avoided `react-hooks/set-state-in-effect` lint error by using lazy `useState` initializers (for localStorage prefs + navigator device info) instead of `useEffect` + `setState`
- For `next-themes`, used `theme || "system"` instead of a `mounted` flag (next-themes returns undefined on both server and first client render, so no hydration mismatch)
- Used `type LucideIcon` from lucide-react for icon prop types (consistent with `states.tsx` pattern) instead of `React.ElementType`
- `bun run lint`: 0 errors in both view files (only pre-existing `navbar.tsx` error remains project-wide)
- `npx tsc --noEmit --skipLibCheck`: 0 errors in either view file (only pre-existing errors in examples/skills/api route files)

## Verification
- `bun run lint`: ✅ (only pre-existing navbar.tsx set-state-in-effect error)
- `npx tsc --noEmit --skipLibCheck`: ✅ (no errors in settings-view.tsx or profile-view.tsx)
- Dev server log clean (Next.js 16.1.3 Turbopack running on port 3000)
- All buttons functional, all forms validated, all API calls wired (profileApi.update, profileApi.changePassword, dashboardApi.stats, authApi.logout via store)
