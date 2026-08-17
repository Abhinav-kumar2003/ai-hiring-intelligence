"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { profileApi } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  User as UserIcon,
  Mail,
  Palette,
  Bell,
  Shield,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  LogOut,
  Check,
  Info,
  Clock,
  KeyRound,
  MonitorSmartphone,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";

// ---------------------------------------------------------------------
// Notification preferences (client-side localStorage store)
// ---------------------------------------------------------------------
const NOTIF_PREFS_KEY = "ai-hiring-notification-prefs";

interface NotificationPrefs {
  email: boolean;
  predictions: boolean;
  weeklyReport: boolean;
  resumeAlerts: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  email: true,
  predictions: true,
  weeklyReport: false,
  resumeAlerts: true,
};

function useNotificationPrefs() {
  // Lazy initializer reads localStorage on first mount (client-side only).
  // Safe from hydration mismatches because the Notifications tab content
  // (which renders these prefs) is unmounted by Radix Tabs during SSR/initial render.
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_NOTIF_PREFS;
    try {
      const stored = localStorage.getItem(NOTIF_PREFS_KEY);
      if (stored) {
        return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_NOTIF_PREFS;
  });

  const updatePref = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));
        toast.success("Preferences saved");
      } catch {
        toast.error("Failed to save preferences");
      }
      return next;
    });
  };

  return { prefs, updatePref };
}

// ---------------------------------------------------------------------
// Device info from navigator.userAgent (client-side only)
// ---------------------------------------------------------------------
function getDeviceInfo() {
  if (typeof navigator === "undefined") {
    return { browser: "Unknown Browser", os: "Unknown OS" };
  }
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Google Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

// ---------------------------------------------------------------------
// Theme option cards
// ---------------------------------------------------------------------
const THEME_OPTIONS = [
  {
    value: "light" as const,
    label: "Light",
    icon: Sun,
    description: "Bright and clean",
  },
  {
    value: "dark" as const,
    label: "Dark",
    icon: Moon,
    description: "Easy on the eyes",
  },
  {
    value: "system" as const,
    label: "System",
    icon: Monitor,
    description: "Match your device",
  },
];

// =====================================================================
// SettingsView
// =====================================================================
export function SettingsView() {
  const { user, setUser } = useAppStore();
  const { theme, setTheme } = useTheme();

  // ---- Profile form state ----
  const [name, setName] = useState(user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // ---- Password form state ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // ---- Device info (lazy initializer; Security tab is unmounted during SSR) ----
  const [device] = useState(() => getDeviceInfo());

  // ---- Notification prefs ----
  const { prefs, updatePref } = useNotificationPrefs();

  // ---- Delete account dialog ----
  const [deleteOpen, setDeleteOpen] = useState(false);

  // next-themes returns undefined on both server and first client render,
  // then resolves to the actual theme after hydration. Defaulting to "system"
  // avoids hydration mismatches on the theme card highlight.
  const currentTheme = theme || "system";

  // ---- Handlers ----
  const handleSaveProfile = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    setSavingProfile(true);
    try {
      const { user: updatedUser } = await profileApi.update({ name: trimmed });
      setUser(updatedUser);
      toast.success("Profile updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from current password");
      return;
    }
    setChangingPassword(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteOpen(false);
    toast.info("Account deletion is not available in the demo");
  };

  const memberSinceDate = user?.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—";
  const lastActiveLabel = format(new Date(), "MMM d, yyyy 'at' h:mm a");

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4 sm:w-fit">
          <TabsTrigger value="profile" className="gap-1.5">
            <UserIcon className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Palette className="h-4 w-4" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* ============================================== */}
        {/* Tab 1: Profile                                  */}
        {/* ============================================== */}
        <TabsContent value="profile">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Profile Information</CardTitle>
              <CardDescription>Update your account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="settings-name">Name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={savingProfile}
                />
                {name.trim().length > 0 && name.trim().length < 2 && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Name must be at least 2 characters.
                  </p>
                )}
              </div>

              {/* Email (disabled) */}
              <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input
                  id="settings-email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted/50"
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" /> Email cannot be changed.
                </p>
              </div>

              {/* Role (disabled) */}
              <div className="space-y-2">
                <Label htmlFor="settings-role">Role</Label>
                <Input
                  id="settings-role"
                  value="Recruiter"
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">
                  Your role is assigned by an administrator.
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button onClick={handleSaveProfile} disabled={savingProfile || name.trim() === user?.name}>
                {savingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ============================================== */}
        {/* Tab 2: Appearance                               */}
        {/* ============================================== */}
        <TabsContent value="appearance">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base">Theme Preference</CardTitle>
              <CardDescription>
                Choose how the application looks to you. Your selection is applied instantly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {THEME_OPTIONS.map((option) => {
                  const isActive = currentTheme === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        "group relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all hover:shadow-sm",
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/30"
                      )}
                      aria-pressed={isActive}
                    >
                      {/* Preview swatch */}
                      <div
                        className={cn(
                          "flex h-20 w-full items-center justify-center rounded-lg border",
                          option.value === "light" && "bg-white border-gray-200",
                          option.value === "dark" && "bg-gray-900 border-gray-700",
                          option.value === "system" &&
                            "bg-gradient-to-r from-white to-gray-900 border-gray-300"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-8 w-8",
                            option.value === "light" && "text-amber-500",
                            option.value === "dark" && "text-blue-300",
                            option.value === "system" && "text-emerald-500"
                          )}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{option.label}</span>
                        {isActive && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Your theme preference is saved automatically.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================== */}
        {/* Tab 3: Notifications                            */}
        {/* ============================================== */}
        <TabsContent value="notifications">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription>
                Choose which notifications you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* Email notifications */}
              <NotifRow
                icon={Mail}
                title="Email notifications"
                description="Receive important account and activity updates via email."
                checked={prefs.email}
                onCheckedChange={(v) => updatePref("email", v)}
              />
              <Separator />
              {/* Prediction notifications */}
              <NotifRow
                icon={Check}
                title="Prediction notifications"
                description="Get notified when a hiring prediction is completed."
                checked={prefs.predictions}
                onCheckedChange={(v) => updatePref("predictions", v)}
              />
              <Separator />
              {/* Weekly analytics report */}
              <NotifRow
                icon={Clock}
                title="Weekly analytics report"
                description="A weekly summary of your hiring activity and trends."
                checked={prefs.weeklyReport}
                onCheckedChange={(v) => updatePref("weeklyReport", v)}
              />
              <Separator />
              {/* Resume processing alerts */}
              <NotifRow
                icon={Info}
                title="Resume processing alerts"
                description="Get notified when a resume is processed or fails to parse."
                checked={prefs.resumeAlerts}
                onCheckedChange={(v) => updatePref("resumeAlerts", v)}
              />

              <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Notification preferences are saved to your account. Some notifications
                  (like prediction completed) are always sent for audit purposes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================== */}
        {/* Tab 4: Security                                 */}
        {/* ============================================== */}
        <TabsContent value="security" className="space-y-6">
          {/* Change Password */}
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current password */}
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    disabled={changingPassword}
                    className="pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    disabled={changingPassword}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  disabled={changingPassword}
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400">Passwords do not match.</p>
                )}
              </div>

              {/* Password hint */}
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Password must be at least 6 characters long. Use a mix of letters, numbers, and symbols for better security.</p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button
                onClick={handleChangePassword}
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword
                }
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Changing...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" /> Change Password
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Active Sessions */}
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Active Sessions</CardTitle>
              <CardDescription>Manage your logged-in devices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <MonitorSmartphone className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Current session</span>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {device.browser} on {device.os}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Last active {lastActiveLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  This is your active session. Other devices will be logged out automatically
                  after 7 days of inactivity.
                </p>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" disabled className="w-full sm:w-auto">
                    <LogOut className="mr-2 h-4 w-4" /> Log out all other sessions
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="max-w-2xl border-red-200 dark:border-red-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" /> Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 rounded-lg border border-red-200 p-4 dark:border-red-900/50 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your account and all associated data.
                  </p>
                </div>
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure? This action cannot be undone. All your data, candidates,
                        and predictions will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={handleDeleteAccount}
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Member since footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Member since {memberSinceDate}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Notification row helper component
// ---------------------------------------------------------------------
interface NotifRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function NotifRow({ icon: Icon, title, description, checked, onCheckedChange }: NotifRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-none">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-1" />
    </div>
  );
}
