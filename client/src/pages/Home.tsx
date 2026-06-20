import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth, LANDING_LOGOUT_REDIRECT_KEY } from "@/_core/hooks/useAuth";
import { getMobileAwareChatEntryPath } from "@/lib/chatTransition";
import { trpc } from "@/lib/trpc";

const integratedFeatures = [
  {
    label: "Voice-first AI coach",
    tone: "teal",
    copy: "Talk to the JIMMI for personalized training tips, meal recommendations, macro information, and more.",
  },
  {
    label: "Adaptive program generation",
    tone: "champagne",
    copy: "Generate a customized plan based on your fitness goals, fitness level, dietary preference, schedule, and health considerations.",
  },
  {
    label: "Nutritional intelligence",
    tone: "violet",
    copy: "Log meals using the food cam, barcode scanner, and voice feature by simply explaining your meal to JIMMI.",
  },
  {
    label: "Data-driven coaching",
    tone: "rose",
    copy: "Keep guidance grounded in your dietary restrictions, allergies, preferences, health context, training history, and saved progress.",
  },
];

const wearableIntegrations = [
  { label: "Oura", wordmark: "ŌURA", logoAlt: "Oura logo-style wordmark", accent: "from-white/12" },
  { label: "Fitbit", logoUrl: "https://cdn.simpleicons.org/fitbit/00b0b9", logoAlt: "Fitbit logo", accent: "from-cyan-300/14" },
  { label: "WHOOP", wordmark: "WHOOP", logoAlt: "WHOOP logo-style wordmark", accent: "from-lime-300/14" },
];

const differentiationPoints = [
  "Most fitness apps stop at workouts. Meal trackers often stop at numbers. Recovery tools often live somewhere else. JIMMI connects the full loop.",
  "Your fitness coach, program builder, macro tracker, meal planner, and accountability layer are designed to work from the same context.",
  "The result is a cleaner member experience: one luxe workspace for training programs, nutritional guidance, and recovery recommendations that usually require multiple subscriptions.",
];

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, setLocation] = useLocation();
  // Warm up the server as soon as the landing page loads so it's ready when the user taps Log In
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [warmupInput] = useState(() => ({ timestamp: Date.now() }));
  trpc.system.health.useQuery(warmupInput, { retry: false, refetchOnWindowFocus: false, staleTime: Infinity });
  // Only fetch profile once we know the user is authenticated
  const profileQuery = trpc.onboarding.get.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;
    // Clear any stale logout marker so re-login always redirects correctly
    window.sessionStorage.removeItem(LANDING_LOGOUT_REDIRECT_KEY);
    // Wait until the profile query has settled before deciding where to send the user
    if (profileQuery.isLoading) return;
    if (profileQuery.data) {
      // Has a profile — go to chat (replace so landing page is not in back stack)
      setLocation(getMobileAwareChatEntryPath({ reason: "auth" }), { replace: true });
    } else {
      // Authenticated but no profile — go to onboarding (replace so landing page is not in back stack)
      setLocation("/onboarding", { replace: true });
    }
  }, [isAuthenticated, loading, profileQuery.isLoading, profileQuery.data, setLocation]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground" data-beta-landing-refresh="integrated-coaching">
      <div className="absolute inset-0 bg-black" aria-hidden="true" />
      <video
        className="pointer-events-none absolute left-1/2 top-[14%] h-[132vh] w-[218vw] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-100 brightness-[1.9] contrast-110 sm:top-[36%] sm:h-[132vh] sm:w-[158vw] lg:left-[68%] lg:top-[40%] lg:h-[136vh] lg:w-[136vw]"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        {/* iOS Safari requires H.264 Baseline/Main profile for muted autoplay */}
        <source src="/manus-storage/jimmi-orb-landing-ios_compat_ab819f61.mp4" type="video/mp4; codecs=avc1.42E01E" />
        <source src="/manus-storage/jimmi-orb-landing-web_e359bfe8.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_36%,transparent_0%,rgba(0,0,0,0.06)_34%,rgba(0,0,0,0.74)_74%,#000_100%)]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.94)_32%,rgba(0,0,0,0.48)_62%,#000_100%)]" aria-hidden="true" />
      <div className="absolute left-[-8rem] top-[28%] h-64 w-64 rounded-full bg-[#8fe8d8]/[0.07] blur-3xl" aria-hidden="true" />
      <div className="absolute right-[14%] top-[18%] h-40 w-40 rounded-full bg-[#d8c7a3]/[0.06] blur-3xl" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/80 to-transparent" aria-hidden="true" />

      <section className="container relative z-10 flex min-h-[100svh] flex-col px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <JimmiWordmark variant="landing" className="jimmi-wordmark text-2xl text-white" />
          <a
            href="/login"
            aria-label="Log in to JIMMI"
            className="font-mono text-[0.68rem] font-light uppercase tracking-[0.3em] text-white/78 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            Log In
          </a>
        </header>

        <div className="flex flex-none items-center py-10 sm:py-12 lg:py-14">
          <section className="max-w-4xl">
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-white/70">AI-Powered Coaching</p>
            <h1 className="mt-4 max-w-5xl font-display text-5xl font-light leading-[0.9] tracking-[-0.04em] text-white md:text-7xl lg:text-[7.35rem]">
              Train with precision. Recover with intent.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72 md:text-xl md:leading-9">
              JIMMI is an AI fitness coach that learns your body, your goals, your health conditions, and your schedule, then builds a fully personalised training and nutrition plan around your lifestyle. Available 24/7, never judgmental, always working with your specific data.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-14 rounded-full bg-white px-8 text-base text-black hover:bg-white/90" asChild>
                <a href="/signup">
                  Start For Free
                  <ArrowRight className="ml-2 size-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="h-14 rounded-full border-white/15 bg-black/20 px-8 text-base text-foreground backdrop-blur hover:border-white hover:bg-white hover:text-black" asChild>
                <a href="#features">Explore Features</a>
              </Button>
            </div>
          </section>
        </div>

        {/* Pricing Section */}
        <section className="py-4 border-t border-white/10" aria-labelledby="pricing-heading">
          <div className="rounded-[2rem] border border-white/10 bg-black/35 p-5 backdrop-blur-md sm:p-7">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/55">Pricing</p>
              <h2 id="pricing-heading" className="mt-2 font-display text-3xl font-light tracking-[-0.03em] text-white md:text-4xl">
                Choose Your Tier
              </h2>
              <p className="mt-4 mx-auto max-w-xl text-sm leading-6 text-white/60">
                Start free or try one of our premium tiers.
              </p>
              <div className="mt-8">
                <Button variant="link" size="lg" asChild>
                  <a href="/pricing" className="text-white/72 hover:text-white text-base">
                    View detailed comparison →
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-6 border-t border-white/10 py-4" aria-labelledby="features-heading">
          <div className="rounded-[2rem] border border-white/10 bg-black/35 p-5 backdrop-blur-md sm:p-7">
            <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/55">Integrated coaching</p>
                <h2 id="features-heading" className="mt-2 font-display text-3xl font-light tracking-[-0.03em] text-white md:text-4xl">
                  Premium Feature Set
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                  JIMMI is built for people who want high-touch coaching intelligence without a noisy stack of disconnected fitness apps.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2" data-landing-feature-grid="integrated-beta-features">
                {integratedFeatures.map((feature) => (
                  <article key={feature.label} data-feature-tone={feature.tone} className="group rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#8fe8d8]/35 hover:bg-white/[0.055]">
                    <div className="mb-4 h-1 w-10 rounded-full bg-[#8fe8d8]/80 group-data-[feature-tone=champagne]:bg-[#d8c7a3]/80 group-data-[feature-tone=violet]:bg-[#b9a7ff]/80 group-data-[feature-tone=rose]:bg-[#ffc0cb]/70" aria-hidden="true" />
                    <p className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-white/55">{feature.label}</p>
                    <p className="mt-3 text-sm leading-6 text-white/72">{feature.copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

        </section>

        <section className="pb-5 pt-0" aria-labelledby="differentiation-heading" data-competitive-differentiation="one-context-platform">
          <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(143,232,216,0.09),rgba(255,255,255,0.03)_34%,rgba(216,199,163,0.08))] p-5 backdrop-blur-md lg:grid-cols-[0.85fr_1.15fr] sm:p-7">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#d8c7a3]">Why it is different</p>
              <h2 id="differentiation-heading" className="mt-3 font-display text-3xl font-light tracking-[-0.03em] text-white md:text-4xl">
                Built as one coaching platform
              </h2>
            </div>
            <ul className="space-y-3">
              {differentiationPoints.map((point, idx) => (
                <li key={idx} className="flex gap-3 text-sm leading-6 text-white/72">
                  <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#8fe8d8]/70" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pb-5 pt-1" aria-labelledby="integrations-heading" data-integrations-section="wearable-brands" data-integrations-placement="landing-bottom">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/24 px-4 py-4 backdrop-blur-sm sm:px-5 sm:py-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-white/42">COMPATIBLE INTEGRATIONS</p>
                <h2 id="integrations-heading" className="mt-1 font-display text-xl font-light tracking-[-0.03em] text-white/82 sm:text-2xl">
                  Coaching starts with context.
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/52">
                  We work with the brands that already know you for better insights.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[1rem] border border-white/10 bg-white/10 sm:grid-cols-3" aria-label="Planned wearable calorie and sleep integrations">
              {wearableIntegrations.map((brand) => (
                <div key={brand.label} className="flex min-h-20 flex-col items-center justify-center bg-black/58 px-3 py-4 text-center transition hover:bg-white/[0.045]" data-integration-logo-card={brand.label} data-minimal-integration-logo="true">
                  <div className="flex h-8 items-center justify-center" aria-hidden="true">
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt="" className="max-h-6 max-w-[5.75rem] object-contain opacity-85 grayscale transition hover:grayscale-0" loading="lazy" />
                    ) : (
                      <span className="font-mono text-base font-semibold uppercase tracking-[0.18em] text-white/82">{brand.wordmark}</span>
                    )}
                  </div>
                  <span className="sr-only">{brand.logoAlt}</span>
                  <span className="mt-2 text-[0.68rem] font-medium tracking-tight text-white/48">{brand.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <footer className="flex flex-col gap-3 border-t border-white/10 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between" aria-label="JIMMI legal links">
          <p>© 2026 JIMMI. Fitness coaching for training, nutrition, and recovery.</p>
          <nav className="flex gap-4" aria-label="Legal navigation">
            <a className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-4 focus-visible:ring-offset-black" href="/privacy">
              Privacy Policy
            </a>
            <a className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-4 focus-visible:ring-offset-black" href="/terms">
              Terms of Service
            </a>
          </nav>
        </footer>
      </section>
    </main>
  );
}
