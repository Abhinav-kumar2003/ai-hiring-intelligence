"use client";
import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck, BarChart3, Zap, Key } from "lucide-react";
import { ApiError } from "@/services/api";
import { toast } from "sonner";
import { SignIn, SignUp } from "@clerk/nextjs";

export function LoginView() {
  const { login, register, authLoading } = useAppStore();
  const [authProvider, setAuthProvider] = useState<"clerk" | "direct">("clerk");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("recruiter@aihiring.com");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Welcome back!");
      } else {
        if (name.trim().length < 2) {
          setError("Name must be at least 2 characters");
          return;
        }
        await register(name, email, password);
        toast.success("Account created successfully!");
      }
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || "Authentication failed");
    }
  };

  const handleQuickDemo = async () => {
    setEmail("recruiter@aihiring.com");
    setPassword("demo1234");
    try {
      await login("recruiter@aihiring.com", "demo1234");
      toast.success("Logged in with demo account!");
    } catch (e: any) {
      setError(e.message || "Demo login failed");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left - Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-12 text-white lg:flex">
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">Hiring Intelligence</span>
            <span className="text-xs text-white/70">AI Recruitment Platform</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Predict smarter.<br />
            Hire better.
          </h1>
          <p className="max-w-md text-lg text-white/80">
            AI-powered hiring analytics platform that screens resumes, predicts candidate outcomes, and explains every decision.
          </p>

          <div className="space-y-3 pt-4">
            {[
              { icon: Zap, text: "Instant ML predictions with 96.5% accuracy" },
              { icon: ShieldCheck, text: "Explainable AI with per-feature reasoning" },
              { icon: BarChart3, text: "Real-time hiring analytics & insights" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-white/90">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Decision-support tool. Human oversight required.</span>
        </div>
      </div>

      {/* Right - Form panel */}
      <div className="flex items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center gap-2 lg:justify-start lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">Hiring Intelligence</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Sign in to your recruiter dashboard to continue."
                : "Start making data-driven hiring decisions today."}
            </p>
          </div>

          {/* Auth Switcher */}
          <div className="flex rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setAuthProvider("direct")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                authProvider === "direct" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => setAuthProvider("clerk")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                authProvider === "clerk" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Clerk Auth
            </button>
          </div>

          {authProvider === "clerk" ? (
            <div className="flex flex-col items-center justify-center">
              {mode === "login" ? (
                <SignIn routing="hash" />
              ) : (
                <SignUp routing="hash" />
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-9"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button type="button" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "login" && (
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Remember me for 7 days
                  </Label>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {mode === "login" ? "Signing in..." : "Creating account..."}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === "login" ? "Sign In" : "Create Account"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          )}

          <div className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => { setMode("register"); setError(""); }}
                  className="font-medium text-primary hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("login"); setError(""); }}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          {mode === "login" && authProvider === "direct" && (
            <Card className="bg-muted/40 border-dashed">
              <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">Demo credentials</p>
                  <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5" onClick={handleQuickDemo}>
                    <Key className="h-3 w-3" /> Quick Demo Login
                  </Button>
                </div>
                <p>Email: <code className="rounded bg-background px-1.5 py-0.5">recruiter@aihiring.com</code></p>
                <p>Password: <code className="rounded bg-background px-1.5 py-0.5">demo1234</code></p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
