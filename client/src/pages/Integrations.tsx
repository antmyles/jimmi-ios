import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, LockKeyhole, PlugZap, Unplug } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MemberMenu } from "@/components/MemberMenu";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const providers = [
  {
    id: "oura",
    name: "Oura",
    category: "Wearable platforms",
    logoKind: "wordmark",
    logoText: "Ō",
    logoClass: "bg-white text-black",
    description: "Link your Oura ring so JIMMI knows how well you slept, how recovered you are, and how active you've been — so every recommendation fits where you actually are today.",
    detailCopy: "Your Oura ring captures a lot — sleep stages, recovery scores, heart rate trends, daily activity. When you connect it, JIMMI uses all of that to understand your body's current state and adjust coaching accordingly. Instead of generic advice, you get guidance that accounts for whether you had a great night's sleep or a rough one.",
    bullets: ["Sleep quality and recovery scores", "Daily activity and movement data", "Heart rate and body temperature trends"],
    connectLabel: "Connect Oura",
    connectedLabel: "Reconnect Oura",
    available: true,
  },
  {
    id: "whoop",
    name: "WHOOP",
    category: "Wearable platforms",
    logoKind: "wordmark",
    logoText: "W",
    logoClass: "bg-[#d7ff38] text-black",
    description: "Link your WHOOP band so JIMMI can see your strain, recovery, and sleep data — and coach you based on how your body is actually performing, not just what's on the plan.",
    detailCopy: "WHOOP tracks how hard your body is working and how well it's bouncing back. When you connect it, JIMMI can see your strain levels, recovery percentage, and sleep performance — and use that to tell you when to push harder, when to dial it back, and why. Your coaching becomes a reflection of your real physiological state.",
    bullets: ["Daily strain and recovery scores", "Sleep performance and debt tracking", "Workout intensity and output data"],
    connectLabel: "Connect WHOOP",
    connectedLabel: "Reconnect WHOOP",
    available: true,
  },
  {
    id: "fitbit",
    name: "Fitbit",
    category: "Wearable platforms",
    logoKind: "image",
    logoUrl: "https://cdn.simpleicons.org/fitbit/00b0b9",
    logoClass: "bg-cyan-300/10 text-cyan-100",
    description: "Link your Fitbit so JIMMI can factor in your steps, sleep, heart rate, and weight trends — giving you coaching that reflects your full health picture, not just your workouts.",
    detailCopy: "Fitbit collects a rich picture of your day — how much you moved, how you slept, how your heart rate trended, and how your weight is shifting over time. Connecting it gives JIMMI the context to coach you more completely, whether you're focused on fat loss, building endurance, or just staying consistent.",
    bullets: ["Steps, activity, and calorie data", "Sleep duration and quality tracking", "Heart rate and weight trend history"],
    connectLabel: "Connect Fitbit via Google Health",
    connectedLabel: "Reconnect Fitbit",
    available: true,
  },
] as const;

type ProviderId = (typeof providers)[number]["id"];

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";

type LocalProfile = {
  firstName?: string;
  avatarUrl?: string | null;
};

function readLocalOnboardingProfile(): LocalProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return rawProfile ? JSON.parse(rawProfile) : null;
  } catch {
    return null;
  }
}

function ProviderLogo({ provider }: { provider: (typeof providers)[number] }) {
  return (
    <span className={`grid size-11 shrink-0 place-items-center rounded-full ${provider.logoClass}`} data-integration-logo={provider.id}>
      {provider.logoKind === "image" ? <img src={provider.logoUrl} alt={`${provider.name} logo`} className="size-6 object-contain" /> : <span className="font-display text-lg font-semibold tracking-tight">{provider.logoText}</span>}
    </span>
  );
}

function IntegrationHeader({ title, backHref, memberName, avatarUrl, isLocalFallback }: { title: string; backHref: string; memberName?: string | null; avatarUrl?: string | null; isLocalFallback?: boolean }) {
  return (
    <header className="relative flex items-center justify-between pb-9 pt-4" data-integrations-header="mobile-reference">
      <Button asChild variant="outline" size="icon" className="size-14 rounded-full border-white/10 bg-white/[0.03] text-white/80 hover:border-white/20 hover:bg-white/[0.07] hover:text-white" aria-label="Back">
        <Link href={backHref}><ArrowLeft className="size-6" /></Link>
      </Button>
      <h1 className="absolute left-1/2 top-[1.7rem] -translate-x-1/2 whitespace-nowrap text-3xl font-semibold tracking-[-0.04em] text-white">{title}</h1>
      <MemberMenu memberName={memberName} avatarUrl={avatarUrl ?? null} isLocalFallback={isLocalFallback} />
    </header>
  );
}

export default function Integrations() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const localProfile = readLocalOnboardingProfile();
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const wearableQuery = trpc.account.wearableState.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const settingsQuery = trpc.account.settings.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const ouraSetupQuery = trpc.account.ouraSetup.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const whoopSetupQuery = trpc.account.whoopSetup.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const fitbitSetupQuery = trpc.account.fitbitSetup.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const startOuraConnection = trpc.account.startOuraConnection.useMutation({ onSuccess: (result) => window.location.assign(result.authorizationUrl) });
  const startWhoopConnection = trpc.account.startWhoopConnection.useMutation({ onSuccess: (result) => window.location.assign(result.authorizationUrl) });
  const startFitbitConnection = trpc.account.startFitbitConnection.useMutation({ onSuccess: (result) => window.location.assign(result.authorizationUrl) });
  const disconnectOuraConnection = trpc.account.disconnectOuraConnection.useMutation({ onSuccess: async () => utils.account.wearableState.invalidate() });
  const disconnectWhoopConnection = trpc.account.disconnectWhoopConnection.useMutation({ onSuccess: async () => utils.account.wearableState.invalidate() });
  const disconnectFitbitConnection = trpc.account.disconnectFitbitConnection.useMutation({ onSuccess: async () => utils.account.wearableState.invalidate() });

  const activeProfile = profileQuery.data ?? localProfile;
  const isLocalFallback = !user && Boolean(activeProfile);
  const avatarDisplayName = activeProfile?.firstName || user?.name || null;
  const selectedProviderId = location.split("?")[0].split("/")[2] as ProviderId | undefined;
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  const statusParams = new URLSearchParams(location.split("?")[1] ?? "");
  const selectedProviderStatus = selectedProvider ? statusParams.get(selectedProvider.id) : null;
  const wearable = wearableQuery.data ?? { connected: false, provider: null as string | null };
  const isPremium = settingsQuery.data?.planTier === "pro" || settingsQuery.data?.planTier === "elite";

  const startConnection = (providerId: ProviderId) => {
    if (providerId === "oura") startOuraConnection.mutate();
    if (providerId === "whoop") startWhoopConnection.mutate();
    if (providerId === "fitbit") startFitbitConnection.mutate();
  };

  const disconnectConnection = (providerId: ProviderId) => {
    if (providerId === "oura") disconnectOuraConnection.mutate();
    if (providerId === "whoop") disconnectWhoopConnection.mutate();
    if (providerId === "fitbit") disconnectFitbitConnection.mutate();
  };

  if (loading || (Boolean(user) && profileQuery.isLoading)) {
    return (
      <main className="min-h-screen bg-[#191919] text-white">
        <section className="container flex min-h-screen items-center justify-center">
          <div className="text-center"><Loader2 className="mx-auto size-8 animate-spin text-primary" /><p className="mt-4 text-sm text-white/55">Loading integrations...</p></div>
        </section>
      </main>
    );
  }

  if (selectedProvider) {
    const isConnected = wearable.connected && wearable.provider === selectedProvider.id;
    const isPending = selectedProvider.id === "oura" ? startOuraConnection.isPending : selectedProvider.id === "whoop" ? startWhoopConnection.isPending : startFitbitConnection.isPending;
    const isDisconnectPending = selectedProvider.id === "oura" ? disconnectOuraConnection.isPending : selectedProvider.id === "whoop" ? disconnectWhoopConnection.isPending : disconnectFitbitConnection.isPending;
    const isConfigured = selectedProvider.id === "oura" ? ouraSetupQuery.data?.configured : selectedProvider.id === "whoop" ? whoopSetupQuery.data?.configured : fitbitSetupQuery.data?.configured;
    const canConnect = Boolean(user) && selectedProvider.available && Boolean(isConfigured);

    return (
      <main className="min-h-screen bg-[#191919] text-white" data-integrations-route="detail" data-integration-detail-provider={selectedProvider.id} data-premium-ready-integrations="true">
        <section className="mx-auto min-h-screen max-w-[46rem] px-7 py-4 sm:px-8">
          <IntegrationHeader title={selectedProvider.name} backHref="/integrations" memberName={avatarDisplayName} avatarUrl={activeProfile?.avatarUrl ?? null} isLocalFallback={isLocalFallback} />

          <article className="rounded-[1.65rem] bg-[#242424] p-6 shadow-2xl shadow-black/25" data-integration-detail-card={selectedProvider.id}>
            <div className="flex items-start gap-4">
              <ProviderLogo provider={selectedProvider} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/45">{selectedProvider.category}</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-white">{selectedProvider.name} integration</h2>
              </div>
            </div>
            <p className="mt-6 text-base leading-7 text-white/68">{selectedProvider.detailCopy}</p>
            <div className="mt-6 space-y-3">
              {selectedProvider.bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/72">
                  <CheckCircle2 className="size-4 text-primary" /> {bullet}
                </div>
              ))}
            </div>
            {!isPremium && user ? (
              <div className="mt-7 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100" data-integrations-tier-gate="true">
                <LockKeyhole className="mr-2 inline size-4" /> Wearable integrations are available on the <strong>Pro</strong> plan and above. Upgrade to connect {selectedProvider.name} and give JIMMI the full picture of your health.
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm leading-6 text-primary" data-integrations-premium-ready-note="true">
                <LockKeyhole className="mr-2 inline size-4" /> Your plan includes wearable integrations — connect your device below.
              </div>
            )}
            {selectedProviderStatus ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/70" data-integration-oauth-status={selectedProviderStatus}>
                {selectedProviderStatus === "connected" ? `${selectedProvider.name} connected successfully.` : selectedProviderStatus === "denied" ? `${selectedProvider.name} connection was not approved.` : `${selectedProvider.name} connection could not be completed.`}
              </div>
            ) : null}
            {isConnected ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100" data-integration-connected-state={selectedProvider.id}>
                {selectedProvider.name} is connected. You can reconnect to refresh authorization or disconnect it from JIMMI at any time.
              </div>
            ) : null}
            <Button
              type="button"
              disabled={!canConnect || isPending || (!isPremium && Boolean(user))}
              onClick={() => startConnection(selectedProvider.id)}
              className="mt-7 h-13 w-full rounded-full bg-white text-base font-medium text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/45"
              data-integration-connect-provider={selectedProvider.id}
            >
              <PlugZap className="mr-2 size-5" /> {isPending ? `Opening ${selectedProvider.name}...` : isConnected ? selectedProvider.connectedLabel : selectedProvider.connectLabel}
            </Button>
            {isConnected ? (
              <Button
                type="button"
                variant="outline"
                disabled={isDisconnectPending}
                onClick={() => disconnectConnection(selectedProvider.id)}
                className="mt-3 h-13 w-full rounded-full border-white/10 bg-transparent text-base font-medium text-white/72 hover:bg-white/[0.06] hover:text-white"
                data-integration-disconnect-provider={selectedProvider.id}
              >
                <Unplug className="mr-2 size-5" /> {isDisconnectPending ? `Disconnecting ${selectedProvider.name}...` : `Disconnect ${selectedProvider.name}`}
              </Button>
            ) : null}
            {!user ? <p className="mt-3 text-center text-xs text-white/45">Sign in to connect this integration.</p> : null}
            {user && selectedProvider.available && !isConfigured ? <p className="mt-3 text-center text-xs text-white/45">This provider needs administrator configuration before members can connect.</p> : null}
            {user && !selectedProvider.available ? <p className="mt-3 text-center text-xs text-white/45">This integration is planned and will be enabled in a future release.</p> : null}
            {user && selectedProvider.id === "fitbit" && selectedProvider.available ? <p className="mt-3 text-center text-xs text-white/45">Fitbit connects through Google Health. You may be asked to confirm which health data you'd like to share during the sign-in process.</p> : null}
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#191919] text-white" data-integrations-route="overview" data-premium-ready-integrations="true" data-beta-premium-gate-active={isPremium ? "premium" : "beta-open"}>
      <section className="mx-auto min-h-screen max-w-[46rem] px-7 py-4 sm:px-8">
        <IntegrationHeader title="Integrations" backHref="/chat" memberName={avatarDisplayName} avatarUrl={activeProfile?.avatarUrl ?? null} isLocalFallback={isLocalFallback} />

        {!isPremium && user ? (
        <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100" data-integrations-tier-gate="true">
          <LockKeyhole className="mr-2 inline size-4" /> Wearable integrations are available on the <strong>Pro</strong> plan ($19.99/mo). Upgrade to connect your device and give JIMMI the full picture of your health.
        </div>
      ) : null}

        <section aria-labelledby="wearable-platforms-heading" data-integrations-list="reference-grouped-rows">
          <h2 id="wearable-platforms-heading" className="mb-4 text-2xl font-semibold tracking-[-0.04em] text-white/48">Wearable platforms</h2>
          <div className="overflow-hidden rounded-[1.2rem] bg-[#242424] shadow-2xl shadow-black/20">
            {providers.map((provider, index) => {
              const connected = wearable.connected && wearable.provider === provider.id;
              return (
                <Link key={provider.id} href={`/integrations/${provider.id}`} className="group flex items-center gap-5 px-5 py-5 transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none" data-integration-row={provider.id}>
                  <ProviderLogo provider={provider} />
                  <div className={`min-w-0 flex-1 ${index === providers.length - 1 ? "" : "border-b border-white/10 pb-5"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-2xl font-light tracking-[-0.03em] text-white">{provider.name}</p>
                        <p className="mt-1 truncate text-sm text-white/38">{connected ? "Connected" : provider.available ? "Ready to connect" : "Coming soon"}</p>
                      </div>
                      <ChevronRight className="size-7 shrink-0 text-white/42 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="physiq-heading" className="mt-8" data-integrations-physiq-teaser="true">
          <h2 id="physiq-heading" className="mb-4 text-2xl font-semibold tracking-[-0.04em] text-white/48">Coming soon</h2>
          <div className="overflow-hidden rounded-[1.2rem] bg-[#242424] shadow-2xl shadow-black/20">
            <div className="flex items-start gap-5 px-5 py-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M12 3c-1.5 3-4 5-7 6 0 6 3 10 7 12 4-2 7-6 7-12-3-1-5.5-3-7-6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-light tracking-[-0.03em] text-white">PhysIQ <span className="text-white/40">by JIMMI</span></p>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-primary">Elite · Coming Soon</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/55">Most fitness apps tell you how much you weigh. PhysIQ shows you how your body is actually changing. Using your phone's camera and a guided fit frame, PhysIQ takes precise proportional measurements of your shoulders, waist, and hips over time — so you can see your V-taper developing, your waist narrowing, and your physique evolving in ways the scale will never show you. Every check-in feeds directly into JIMMI's coaching, turning visual progress into smarter, more specific guidance. Built exclusively for Elite members.</p>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
