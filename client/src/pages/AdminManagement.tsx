import { useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Crown, KeyRound, Loader2, PlugZap, RefreshCcw, RotateCcw, ShieldCheck, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { TIER_LABELS, SubscriptionTier } from "../../../shared/tiers";

type ResetAction = "program" | "onboarding";
type AdminUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  createdAt: Date | string;
  lastSignedIn: Date | string;
  hasOnboarding: boolean;
  onboardingName: string | null;
  onboardingUpdatedAt: Date | string | null;
  hasProgram: boolean;
  programTitle: string | null;
  programUpdatedAt: Date | string | null;
  planTier: "free" | "core" | "pro" | "elite";
  subscriptionStatus: "active" | "paused";
  autoRenew: boolean;
  hasWearableConnection: boolean;
  wearableProvider: string | null;
  wearableStatus: string | null;
  wearableLastSyncedAt: Date | string | null;
};

type PendingReset = {
  user: AdminUser;
  action: ResetAction;
};

function formatDate(value: Date | string | null) {
  if (!value) return "Not started";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function userLabel(user: AdminUser, currentUserId?: number) {
  const name = user.onboardingName || user.name || user.email || `User #${user.id}`;
  return user.id === currentUserId ? `${name} (you)` : name;
}

export default function AdminManagement() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const hasAdminAccess = isAdmin || isUnlocked;
  const usersQuery = trpc.admin.users.useQuery(undefined, { enabled: Boolean(hasAdminAccess), retry: false });
  const unlockOwnerAdmin = trpc.auth.unlockOwnerAdmin.useMutation({
    onSuccess: (result) => {
      setIsUnlocked(true);
      utils.auth.me.setData(undefined, result.user);
      setStatusMessage("Admin access verified.");
      void utils.auth.me.invalidate();
    },
    onError: (error) => {
      setStatusMessage(error.message || "This signed-in account could not be verified as the owner admin.");
    },
  });

  const unlockAdminWithPassword = trpc.auth.unlockAdminWithPassword.useMutation({
    onSuccess: (result) => {
      setIsUnlocked(true);
      utils.auth.me.setData(undefined, result.user);
      setAdminPassword("");
      setStatusMessage("Admin password accepted.");
      void utils.auth.me.invalidate();
    },
    onError: (error) => {
      setStatusMessage(error.message || "That admin password could not be verified.");
    },
  });

  const resetProgram = trpc.admin.resetProgramGeneration.useMutation({
    onSuccess: async (result) => {
      const target = usersQuery.data?.users.find((candidate) => candidate.id === result.userId);
      setStatusMessage(`${target ? userLabel(target as AdminUser, user?.id) : "Selected user"}'s generated program was reset. They can generate a fresh program from their current onboarding profile.`);
      setPendingReset(null);
      await utils.invalidate();
    },
  });

  const resetOnboarding = trpc.admin.resetOnboarding.useMutation({
    onSuccess: async (result) => {
      const target = usersQuery.data?.users.find((candidate) => candidate.id === result.userId);
      setStatusMessage(`${target ? userLabel(target as AdminUser, user?.id) : "Selected user"}'s onboarding and generated program were reset. They can now complete onboarding again for a clean beta test.`);
      setPendingReset(null);
      await utils.invalidate();
    },
  });

  const setPlanTier = trpc.admin.setPlanTier.useMutation({
    onSuccess: async (result) => {
      const target = usersQuery.data?.users.find((candidate) => candidate.id === result.userId);
      setStatusMessage(`${target ? userLabel(target as AdminUser, user?.id) : "Selected user"} is now on the ${result.planTier} tier for beta testing.`);
      await utils.invalidate();
    },
  });

  const setBetaWearable = trpc.admin.setBetaWearableConnection.useMutation({
    onSuccess: async (result) => {
      const target = usersQuery.data?.users.find((candidate) => candidate.id === result.userId);
      setStatusMessage(`${target ? userLabel(target as AdminUser, user?.id) : "Selected user"}'s beta wearable connection is ${result.wearable.connected ? "connected" : "disconnected"}.`);
      await utils.invalidate();
    },
  });

  const users = useMemo(() => (usersQuery.data?.users ?? []) as AdminUser[], [usersQuery.data?.users]);
  const activeMutation = resetProgram.isPending || resetOnboarding.isPending || setPlanTier.isPending || setBetaWearable.isPending;

  const confirmReset = () => {
    if (!pendingReset) return;
    if (pendingReset.action === "program") {
      resetProgram.mutate({ userId: pendingReset.user.id });
      return;
    }
    resetOnboarding.mutate({ userId: pendingReset.user.id });
  };

  const submitAdminPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    unlockAdminWithPassword.mutate({ password: adminPassword });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading management tools...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!hasAdminAccess) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center py-16">
          <div className="max-w-2xl rounded-[2rem] border border-white/10 bg-card p-8 text-card-foreground">
            <ShieldCheck className="size-9 text-primary" />
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.28em] text-primary">Admin management</p>
            <h1 className="mt-4 font-display text-5xl font-light tracking-tight">Admin access required</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">These beta-testing reset tools are restricted to admin accounts. If your signed-in account is not being recognized, use owner verification or enter the private admin password below to unlock this session.</p>
            {statusMessage ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-muted-foreground" role="status" data-admin-owner-unlock-status="true">
                {statusMessage}
              </div>
            ) : null}
            <form onSubmit={submitAdminPassword} className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4" data-admin-password-login-form="true">
              <label htmlFor="admin-password" className="block text-sm font-medium text-foreground">Admin password login</label>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Use the private admin password to unlock Admin Tools for this signed-in session. The password is checked only on the server.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  id="admin-password"
                  name="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Enter admin password"
                  className="min-h-12 flex-1 rounded-full border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  data-admin-password-input="true"
                />
                <Button type="submit" disabled={unlockAdminWithPassword.isPending || adminPassword.length < 8} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" data-admin-password-login-button="true">
                  {unlockAdminWithPassword.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
                  Unlock admin
                </Button>
              </div>
            </form>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={() => unlockOwnerAdmin.mutate()} disabled={unlockOwnerAdmin.isPending} variant="outline" className="rounded-full border-white/10 bg-transparent" data-admin-owner-unlock-button="true">
                {unlockOwnerAdmin.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
                Verify owner admin access
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/10 bg-transparent">
                <Link href="/">Back to JIMMI</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container py-8 md:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <JimmiWordmark variant="member" />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/coach-panel" className="text-muted-foreground hover:text-foreground transition-colors">Coach panel</Link>
            <MemberMenu memberName={user?.name || "Admin"} avatarUrl={null} />
          </nav>
        </header>

        <div className="mx-auto mt-12 max-w-6xl" data-admin-management-reset-tools="beta-testing">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="rounded-[2rem] border border-primary/15 bg-primary/[0.045] p-6 md:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-primary">
                <UserRoundCog className="size-3.5" /> Management UI
              </div>
              <h1 className="mt-6 font-display text-4xl font-light leading-tight tracking-tight md:text-6xl">Beta management controls</h1>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">Use these admin-only tools before beta testing to manage account tiers, grant premium calorie-balance access, simulate a connected Terra wearable, or force a clean program generation cycle.</p>
              <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100" data-admin-reset-audit-warning="true">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  <p><strong>Testing safeguard:</strong> resetting onboarding also clears that user’s generated program and exercise logs so the next generated plan reflects the new onboarding combination. Food logs and the account itself are not deleted.</p>
                </div>
              </div>
              {statusMessage ? (
                <div className="mt-6 flex items-start gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary" role="status" data-admin-reset-status="success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {statusMessage}
                </div>
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-card p-4 text-card-foreground md:p-6" data-admin-user-reset-list="true">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Users</p>
                  <h2 className="mt-2 text-xl font-medium tracking-tight">Onboarding and program state</h2>
                </div>
                <Button type="button" variant="outline" onClick={() => usersQuery.refetch()} disabled={usersQuery.isFetching} className="rounded-full border-white/10 bg-transparent">
                  <RefreshCcw className={`mr-2 size-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>

              {usersQuery.isLoading ? (
                <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-5 animate-spin text-primary" /> Loading users...
                </div>
              ) : usersQuery.error ? (
                <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">Unable to load admin user list: {usersQuery.error.message}</div>
              ) : users.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-muted-foreground">No users are available yet.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {users.map((targetUser) => (
                    <article key={targetUser.id} className="flex flex-col gap-4 py-5" data-admin-user-reset-row="true">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-medium tracking-tight">{userLabel(targetUser, user?.id)}</h3>
                          {targetUser.role === "admin" ? <Badge className="rounded-full bg-primary/15 text-primary hover:bg-primary/15">Admin</Badge> : null}
                          <Badge className={targetUser.planTier !== "free" ? "rounded-full bg-amber-300/15 text-amber-100 hover:bg-amber-300/15" : "rounded-full bg-white/10 text-muted-foreground hover:bg-white/10"} data-admin-account-tier-badge="true">
                            <Crown className="mr-1 size-3" /> {targetUser.planTier === "free" ? "Free" : targetUser.planTier === "core" ? "Core" : targetUser.planTier === "pro" ? "Pro" : "Elite"}
                          </Badge>
                          {targetUser.hasWearableConnection ? <Badge className="rounded-full bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/15" data-admin-wearable-connected-badge="true"><PlugZap className="mr-1 size-3" /> Wearable connected</Badge> : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{targetUser.email || "No email on file"}</p>
                        <div className="mt-4 grid gap-2 text-xs text-muted-foreground grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Onboarding</p>
                            <p className="mt-1 text-foreground">{targetUser.hasOnboarding ? "Completed" : "Not completed"}</p>
                            <p className="mt-1">Updated {formatDate(targetUser.onboardingUpdatedAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Program</p>
                            <p className="mt-1 truncate text-foreground">{targetUser.programTitle || (targetUser.hasProgram ? "Generated program" : "Not generated")}</p>
                            <p className="mt-1">Updated {formatDate(targetUser.programUpdatedAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3" data-admin-account-tier-info="true">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Account tier</p>
                            <p className="mt-1 text-foreground capitalize">{targetUser.planTier}</p>
                            <p className="mt-1">Subscription {targetUser.subscriptionStatus}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3" data-admin-wearable-beta-info="true">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Wearable beta</p>
                            <p className="mt-1 text-foreground">{targetUser.hasWearableConnection ? `${targetUser.wearableProvider || "Wearable"} connected` : "Not connected"}</p>
                            <p className="mt-1">Synced {formatDate(targetUser.wearableLastSyncedAt)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-transparent px-3 py-1" data-admin-tier-selector="true" data-admin-premium-beta-toggle="true">
                          <Crown className="size-4 text-amber-100/70" />
                          <Select
                            value={targetUser.planTier}
                            disabled={activeMutation}
                            onValueChange={(value) => setPlanTier.mutate({ userId: targetUser.id, planTier: value as SubscriptionTier })}
                          >
                            <SelectTrigger className="h-7 w-24 border-0 bg-transparent p-0 text-sm text-amber-100 shadow-none focus:ring-0" data-admin-tier-select-trigger="true">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(TIER_LABELS) as SubscriptionTier[]).map((tier) => (
                                <SelectItem key={tier} value={tier}>{TIER_LABELS[tier]}</SelectItem>
                              ))}
                              <SelectItem value="grant-premium-hint" disabled className="sr-only">Grant premium</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="button" variant="outline" disabled={activeMutation || (targetUser.planTier !== "pro" && targetUser.planTier !== "elite")} onClick={() => setBetaWearable.mutate({ userId: targetUser.id, connected: !targetUser.hasWearableConnection })} className="rounded-full border-emerald-300/25 bg-transparent text-emerald-100 hover:bg-emerald-300/10 hover:text-white" data-admin-wearable-beta-toggle="true">
                          <PlugZap className="mr-2 size-4" /> {targetUser.hasWearableConnection ? "Disconnect wearable" : "Connect beta wearable"}
                        </Button>
                        <Button type="button" variant="outline" disabled={!targetUser.hasProgram || activeMutation} onClick={() => setPendingReset({ user: targetUser, action: "program" })} className="rounded-full border-white/10 bg-transparent" data-admin-reset-program-button="true">
                          <RotateCcw className="mr-2 size-4" /> Reset program
                        </Button>
                        <Button type="button" variant="outline" disabled={!targetUser.hasOnboarding || activeMutation} onClick={() => setPendingReset({ user: targetUser, action: "onboarding" })} className="rounded-full border-red-400/30 bg-transparent text-red-100 hover:bg-red-500/10 hover:text-white" data-admin-reset-onboarding-button="true">
                          <AlertTriangle className="mr-2 size-4" /> Reset onboarding
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <AlertDialog open={Boolean(pendingReset)} onOpenChange={(open) => !open && setPendingReset(null)}>
          <AlertDialogContent className="border-red-500/30 bg-card text-card-foreground" data-admin-reset-confirmation-dialog="required">
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingReset?.action === "onboarding" ? "Reset onboarding for this user?" : "Reset generated program for this user?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingReset?.action === "onboarding"
                  ? `This will remove onboarding answers, generated program data, and exercise logs for ${pendingReset ? userLabel(pendingReset.user, user?.id) : "this user"}. The account and food logs stay intact.`
                  : `This will remove the generated program and exercise logs for ${pendingReset ? userLabel(pendingReset.user, user?.id) : "this user"}. Their current onboarding profile stays intact so a new program can be generated from the same answers.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={activeMutation}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500" onClick={confirmReset} disabled={activeMutation} data-admin-reset-confirmation-action="confirm">
                {activeMutation ? "Resetting..." : "Yes, reset for beta testing"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </main>
  );
}
