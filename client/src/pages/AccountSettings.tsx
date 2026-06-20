import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, CreditCard, Loader2, PauseCircle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";

type LocalProfile = {
  firstName?: string;
  avatarUrl?: string | null;
};

function readLocalOnboardingProfile(): LocalProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export default function AccountSettings() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const settingsQuery = trpc.account.settings.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const localProfile = readLocalOnboardingProfile();
  const activeProfile = profileQuery.data ?? localProfile;
  const avatarDisplayName = activeProfile?.firstName || user?.name || null;
  const settings = settingsQuery.data || {
    planTier: "free" as const,
    subscriptionStatus: "active" as const,
    autoRenew: true,
  };

  const upgradeAccount = trpc.account.upgradeAccount.useMutation({
    onSuccess: async () => {
      await utils.account.settings.invalidate();
    },
  });
  const downgradeAccount = trpc.account.downgradeAccount.useMutation({
    onSuccess: async () => {
      await utils.account.settings.invalidate();
    },
  });
  const pauseSubscription = trpc.account.pauseSubscription.useMutation({
    onSuccess: async () => {
      await utils.account.settings.invalidate();
    },
  });
  const setAutoRenew = trpc.account.setAutoRenew.useMutation({
    onSuccess: async () => {
      await utils.account.settings.invalidate();
    },
  });
  const deleteAccount = trpc.account.deleteAccount.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      setDeleteDialogOpen(false);
      setLocation("/");
    },
  });

  const handleStripeCheckout = async (tier: "core" | "pro" | "elite") => {
    if (!user) {
      alert("Please sign in first");
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          tier,
          origin: window.location.origin,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("Stripe checkout error:", error);
      alert(`Failed to open checkout: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleLocalDelete = () => {
    window.localStorage.removeItem(LOCAL_PROFILE_KEY);
    setDeleteDialogOpen(false);
    setLocation("/");
  };

  const canDowngradeAccount = settings.planTier !== "free";

  const activeMutation =
    upgradeAccount.isPending ||
    downgradeAccount.isPending ||
    pauseSubscription.isPending ||
    setAutoRenew.isPending;

  if (loading || settingsQuery.isLoading || (Boolean(user) && profileQuery.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = avatarDisplayName || user.name || user.email;
  const isLocalFallback = !profileQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <div data-account-settings-mobile-spacing="comfortable-inset" className="container px-6 py-8 sm:px-8 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <JimmiWordmark className="h-8 w-auto cursor-pointer" />
            </Link>
          </div>
          <MemberMenu memberName={avatarDisplayName} avatarUrl={activeProfile?.avatarUrl ?? null} isLocalFallback={isLocalFallback} />
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Account</h1>
            <p className="mt-2 text-muted-foreground">Manage your profile and subscription preferences</p>
          </div>

          <div data-account-settings-layout="minimal-clean" data-account-settings-list="minimal-rows" className="space-y-4 rounded-lg border border-white/10 bg-white/[0.025] p-6">
            <MinimalRow title="Profile" description="Your account information">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground">{displayName || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{user.email}</p>
                </div>
              </div>
            </MinimalRow>

            <MinimalRow title="Current tier" description="Your subscription status">
              <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Plan Tier</p>
                <p className="mt-2 text-lg font-semibold capitalize text-foreground">
                  {settings.planTier === "free" ? "Free" : settings.planTier === "core" ? "Starter" : settings.planTier === "pro" ? "Pro" : "Elite"}
                </p>
              </div>
            </MinimalRow>

            <MinimalRow title="Pause subscription" description="Temporarily pause billing access while keeping your account.">
              <Button
                type="button"
                onClick={() => pauseSubscription.mutate()}
                disabled={activeMutation || settings.planTier === "free"}
                className="rounded-full border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <PauseCircle className="mr-2 size-4" /> {pauseSubscription.isPending ? "Pausing..." : "Pause"}
              </Button>
            </MinimalRow>

            {(settings.planTier === "free" || settings.planTier === "core" || settings.planTier === "pro") && (
              <MinimalRow title="Upgrade account" description="Upgrade to a higher tier for advanced coaching with Claude AI and priority support.">
                <Select onValueChange={(tier) => handleStripeCheckout(tier as "core" | "pro" | "elite")}>
                  <SelectTrigger className="w-40 rounded-full border-0 bg-primary text-primary-foreground hover:bg-primary/90">
                    <CreditCard className="mr-2 size-4" />
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.planTier === "free" && (
                      <>
                        <SelectItem value="core">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="elite">Elite</SelectItem>
                      </>
                    )}
                    {settings.planTier === "core" && (
                      <>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="elite">Elite</SelectItem>
                      </>
                    )}
                    {settings.planTier === "pro" && <SelectItem value="elite">Elite</SelectItem>}
                  </SelectContent>
                </Select>
              </MinimalRow>
            )}

            {canDowngradeAccount ? (
              <MinimalRow title="Downgrade account" description="Move back to the free account tier and turn off future automatic renewal.">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downgradeAccount.mutate()}
                  disabled={!user || downgradeAccount.isPending}
                  className="rounded-full border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  data-downgrade-account-button="non-free-only"
                >
                  <ArrowDownCircle className="mr-2 size-4" /> {downgradeAccount.isPending ? "Downgrading..." : "Downgrade"}
                </Button>
              </MinimalRow>
            ) : null}

            <MinimalRow title="Auto renewal" description="Turn automatic renewal on or off for the next billing period.">
              <div className="flex items-center gap-3">
                <RefreshCw className="size-4 text-muted-foreground" />
                <Switch
                  checked={settings.autoRenew}
                  onCheckedChange={(checked) => setAutoRenew.mutate({ autoRenew: checked })}
                  disabled={activeMutation || settings.planTier === "free"}
                  aria-label="Toggle auto renewal"
                />
              </div>
            </MinimalRow>

            <MinimalRow title="Delete account" description="Permanently delete your account and all associated data.">
              <Button data-account-delete-section="confirmation-required" data-delete-account-open-confirmation="button-press-only"
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={activeMutation}
                className="rounded-full"
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </Button>
            </MinimalRow>
          </div>
        </div>

        {user?.role === "admin" && (
          <div className="mx-auto mt-10 max-w-3xl sm:mt-12" data-admin-reset-account-settings-link="true">
            <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.025] p-6">
              <h2 className="text-2xl font-bold text-foreground">Beta testing reset tools</h2>
              <p className="text-muted-foreground">Open the admin management reset panel to reset any user's generated program or onboarding before beta testing, including your own account.</p>
              <Link href="/admin-management">
                <Button variant="outline" className="rounded-full border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground">
                  Open reset tools
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-delete-account-confirmation-dialog="opens-after-delete-button">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-delete-account-confirmation-action="confirm-delete"
              onClick={() => deleteAccount.mutate()}
              disabled={deleteAccount.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MinimalRowProps {
  title: string;
  description: string;
  children: ReactNode;
}

function MinimalRow({ title, description, children }: MinimalRowProps) {
  return (
    <div data-account-settings-row="minimal" className="flex items-start justify-between gap-4 border-b border-white/5 pb-6 last:border-0">
      <div className="flex-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
