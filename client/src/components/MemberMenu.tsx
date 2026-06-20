import { useState } from "react";
import { Apple, LogOut, MessageCircle, Settings, UserRound, Dumbbell, ShieldCheck, PlugZap, PlayCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markLogoutRedirectToLanding, redirectToLandingAfterLogout } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { INTRO_VIDEO_SHOWN_KEY } from "@/lib/chatTransition";
import { toast } from "sonner";

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";

type MemberMenuProps = {
  memberName?: string | null;
  avatarUrl?: string | null;
  isLocalFallback?: boolean;
};

export function MemberMenu({ memberName, avatarUrl, isLocalFallback = false }: MemberMenuProps) {
  const [, setLocation] = useLocation();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const authQuery = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 60_000 });
  // Show admin tools only for admin-role users. While auth is loading, default to
  // showing the item (to avoid flicker for admins) — the AdminManagement page
  // itself enforces the role check server-side.
  const showAdminTools = !isLocalFallback && (authQuery.isLoading || authQuery.data?.role === "admin");
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      redirectToLandingAfterLogout();
    },
  });

  const handleLogout = () => {
    if (isLocalFallback) {
      window.localStorage.removeItem(LOCAL_PROFILE_KEY);
      setConfirmLogoutOpen(false);
      setLocation("/");
      return;
    }

    markLogoutRedirectToLanding();

    logoutMutation.mutate(undefined, {
      onSuccess: () => redirectToLandingAfterLogout(),
      onSettled: () => setConfirmLogoutOpen(false),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Open member navigation" className="size-11 rounded-full border-white/10 bg-white/[0.03] p-0 text-muted-foreground hover:border-primary hover:text-primary" data-member-menu-trigger="avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile avatar" className="size-full rounded-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(143,232,216,0.34),rgba(255,255,255,0.06)_45%,rgba(0,0,0,0.22))] font-mono text-xs uppercase tracking-[0.14em] text-primary">{(memberName || "J").slice(0, 1)}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-white/10 bg-card p-2 text-card-foreground shadow-2xl shadow-black/40">
        <DropdownMenuLabel className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-primary">Member Menu</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/chat"><MessageCircle className="size-4" /> Chat</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/profile"><UserRound className="size-4" /> My Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/food-log"><Apple className="size-4" /> Food Log</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/my-program"><Dumbbell className="size-4" /> My Program</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl" data-member-menu-integrations-link="true">
          <Link href="/integrations"><PlugZap className="size-4" /> Integrations</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/account-settings"><Settings className="size-4" /> Account Settings</Link>
        </DropdownMenuItem>
        {showAdminTools ? (
          <DropdownMenuItem asChild className="cursor-pointer rounded-xl" data-admin-management-menu-link="true">
            <Link href="/admin-management"><ShieldCheck className="size-4" /> Admin Reset Tools</Link>
          </DropdownMenuItem>
        ) : null}
        {showAdminTools ? (
          <DropdownMenuItem
            className="cursor-pointer rounded-xl"
            onSelect={(event) => {
              event.preventDefault();
              try { localStorage.removeItem(INTRO_VIDEO_SHOWN_KEY); } catch { /* ignore */ }
              toast.success("Intro video reset", { description: "Complete onboarding on mobile to preview the clip." });
            }}
            data-member-menu-reset-intro-video="true"
          >
            <PlayCircle className="size-4" /> Reset intro video
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem className="cursor-pointer rounded-xl" onSelect={(event) => {
          event.preventDefault();
          setConfirmLogoutOpen((open) => !open);
        }} disabled={logoutMutation.isPending} data-member-menu-logout-trigger="confirm" data-member-menu-logout-style="default-white">
          <LogOut className="size-4" /> Logout
        </DropdownMenuItem>
        {confirmLogoutOpen ? (
          <div className="px-2 pb-1 pt-0.5" data-logout-confirmation-popover="compact-inline">
            <Button
              type="button"
              size="sm"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="h-8 w-full rounded-full bg-red-600 px-3 text-xs font-medium text-white shadow-lg shadow-red-950/25 hover:bg-red-500 focus-visible:ring-red-500"
              data-logout-confirmation-action="red-confirm"
              data-logout-confirmation-redirect="landing"
            >
              {logoutMutation.isPending ? "Logging out..." : "Log out"}
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
