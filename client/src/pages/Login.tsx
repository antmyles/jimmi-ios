import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google Sign-In was cancelled.",
  missing_code: "Google Sign-In failed. Please try again.",
  token_exchange_failed: "Google Sign-In failed. Please try again.",
  userinfo_failed: "Could not retrieve your Google account info. Please try again.",
  no_email: "Your Google account does not have an email address. Please use email and password.",
  user_creation_failed: "Account creation failed. Please try again.",
  not_configured: "Google Sign-In is not available yet. Please use email and password.",
  server_error: "An unexpected error occurred. Please try again.",
};

export default function Login() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Show Google OAuth errors from redirect query params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const errorCode = params.get("error");
    if (errorCode) {
      setServerError(GOOGLE_ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Please try again.");
    }
  }, [search]);

  // Redirect already-authenticated users
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/chat", { replace: true });
    }
  }, [isAuthenticated, loading, setLocation]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Reload to pick up the new session cookie, then navigate
      window.location.href = data.returnPath;
    },
    onError: (err) => {
      setServerError(err.message || "Incorrect email or password.");
    },
  });

  const googleAuthUrlQuery = trpc.auth.googleAuthUrl.useQuery(
    { origin: typeof window !== "undefined" ? window.location.origin : "" },
    { enabled: false, retry: false }
  );

  const handleGoogleSignIn = async () => {
    const result = await googleAuthUrlQuery.refetch();
    if (result.data?.url) {
      window.location.href = result.data.url;
    } else {
      setServerError("Google Sign-In is not available yet. Please use email and password.");
    }
  };

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
      {/* Subtle background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.04),transparent)]" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-10 flex justify-center">
          <a href="/" aria-label="Back to home">
            <JimmiWordmark variant="onboarding" className="jimmi-wordmark text-2xl" />
          </a>
        </div>

        {/* Card */}
        <div className="rounded-[1.5rem] border border-white/10 bg-card px-7 py-8 shadow-2xl">
          <h1 className="mb-1 font-display text-2xl font-light tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Log in to continue your coaching session.
          </p>

          {/* Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            className="mb-4 w-full gap-2 border-white/15 bg-transparent text-foreground hover:border-white/30 hover:bg-white/5"
            onClick={handleGoogleSignIn}
            disabled={googleAuthUrlQuery.isFetching}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                className={`border-white/15 bg-white/5 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-white/30 ${fieldErrors.email ? "border-destructive" : ""}`}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Password
                </Label>
                <span className="text-xs text-muted-foreground/60">
                  {/* Forgot password — placeholder for future implementation */}
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  className={`border-white/15 bg-white/5 pr-10 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-white/30 ${fieldErrors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="mt-2 w-full gap-2 bg-white text-black hover:bg-white/90"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
              ) : (
                <>
                  Log in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-foreground underline underline-offset-2 hover:text-white">
            Start for free
          </a>
        </p>
      </div>
    </main>
  );
}
