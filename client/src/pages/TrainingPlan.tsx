import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, Dumbbell, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";

type TrainingBlock = {
  day: string;
  focus: string;
  work: string;
  recovery: string;
};

function readLocalOnboardingProfile() {
  if (typeof window === "undefined") return null;
  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return rawProfile ? JSON.parse(rawProfile) : null;
  } catch {
    return null;
  }
}

function splitList(value?: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function buildTrainingPlan(profile: any): TrainingBlock[] {
  const goals = splitList(profile?.fitnessGoals).join(", ").toLowerCase();
  const fitnessLevel = String(profile?.fitnessLevel ?? "beginner").toLowerCase();
  const isBeginner = includesAny(fitnessLevel, ["beginner", "new", "returning"]);
  const strengthBias = includesAny(goals, ["muscle", "strength", "tone", "build"]);
  const fatLossBias = includesAny(goals, ["lose", "weight", "fat", "lean"]);
  const enduranceBias = includesAny(goals, ["endurance", "cardio", "stamina", "heart"]);

  const strengthVolume = isBeginner ? "2–3 sets of 8–10 controlled reps" : "3–4 sets of 6–12 progressive reps";
  const conditioning = enduranceBias || fatLossBias ? "20–30 minutes Zone 2 cardio or interval walk/run" : "12–18 minutes easy Zone 2 flush";

  return [
    {
      day: "Day 1",
      focus: strengthBias ? "Lower-body strength foundation" : "Full-body strength primer",
      work: `Squat pattern, hip hinge, supported row, and plank work. Use ${strengthVolume}.`,
      recovery: "Finish with hip mobility, nasal breathing, and 5 minutes easy walking.",
    },
    {
      day: "Day 2",
      focus: enduranceBias ? "Cardio capacity" : "Recovery conditioning",
      work: conditioning,
      recovery: "Keep effort conversational. Stop if pain, dizziness, or unusual symptoms appear.",
    },
    {
      day: "Day 3",
      focus: "Upper-body strength and posture",
      work: `Push-up or press variation, row variation, shoulder stability, loaded carry. Use ${strengthVolume}.`,
      recovery: "Add thoracic mobility and gentle neck/shoulder reset work.",
    },
    {
      day: "Day 4",
      focus: "Active recovery",
      work: "20–40 minutes walk, light mobility, easy stretching, or breath-led yoga.",
      recovery: "Prioritize sleep, hydration, and protein at the next meal.",
    },
    {
      day: "Day 5",
      focus: fatLossBias ? "Metabolic full-body circuit" : "Full-body progression session",
      work: "Pair a hinge, squat, press, row, and core move. Move with quality, not speed.",
      recovery: "Log energy and soreness. Reduce volume by 20% if recovery feels poor.",
    },
  ];
}

export default function TrainingPlan() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [localProfile] = useState<any>(() => readLocalOnboardingProfile());
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const profile = profileQuery.data ?? localProfile;
  const isLocalFallback = !user && Boolean(localProfile);
  const goals = useMemo(() => splitList(profile?.fitnessGoals), [profile?.fitnessGoals]);
  const trainingPlan = useMemo(() => buildTrainingPlan(profile), [profile]);

  if (loading || (Boolean(user) && profileQuery.isLoading)) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-card p-8 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Building your training plan...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center py-16">
          <div className="max-w-2xl rounded-[2rem] border border-white/10 bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Profile needed</p>
            <h1 className="mt-4 font-display text-5xl font-light tracking-tight">Finish onboarding first</h1>
            <p className="mt-4 text-muted-foreground">JIMMI needs your baseline before creating a training plan.</p>
            <Link href="/onboarding"><Button className="mt-8 rounded-full bg-primary text-primary-foreground">Go to onboarding</Button></Link>
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
            <Link href="/chat" className="rounded-full border border-white/10 px-4 py-2 text-muted-foreground hover:border-primary hover:text-primary">Chat</Link>
            <MemberMenu memberName={profile.firstName} avatarUrl={profile.avatarUrl} isLocalFallback={isLocalFallback} />
          </nav>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-[2rem] border border-white/10 bg-card p-6">
            <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Back to Chat</Link>
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.28em] text-primary">Training Plan</p>
            <h1 className="mt-4 font-display text-5xl font-light leading-none tracking-tight">{profile.firstName}'s weekly structure</h1>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">This plan translates your onboarding baseline into a practical weekly training rhythm. Treat it as coaching guidance, not medical care.</p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"><span className="text-foreground">Level:</span> {profile.fitnessLevel || "Baseline"}</div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"><span className="text-foreground">Activity:</span> {profile.activityLevel || "Not specified"}</div>
              {goals.slice(0, 3).map((goal) => <div key={goal} className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-primary">{goal}</div>)}
            </div>

            {isLocalFallback ? <p className="mt-6 rounded-3xl border border-primary/20 bg-primary/[0.08] p-4 text-sm text-muted-foreground">Preview mode is using your local onboarding data. Sign in from the member menu to save plans to your account.</p> : null}
          </aside>

          <section className="rounded-[2rem] border border-white/10 bg-card/90 p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Five-day coaching rhythm</p>
                <h2 className="mt-3 font-display text-4xl font-light tracking-tight">Move well, progress gradually, recover deliberately.</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-muted-foreground"><CalendarDays className="mr-2 inline size-4 text-primary" /> 1 week template</div>
            </div>

            <div className="mt-8 grid gap-4">
              {trainingPlan.map((block) => (
                <article key={block.day} className="rounded-[1.75rem] border border-white/10 bg-background/70 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">{block.day}</p>
                      <h3 className="mt-2 font-display text-2xl font-light tracking-tight">{block.focus}</h3>
                    </div>
                    <Dumbbell className="size-6 text-primary" />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground"><span className="text-foreground">Work:</span> {block.work}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground"><span className="text-foreground">Recovery:</span> {block.recovery}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <Sparkles className="size-5 text-primary" />
                <h3 className="mt-3 font-display text-2xl font-light">Progression rule</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">When sets feel smooth for two sessions, add a small amount of resistance or one extra rep while preserving form.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <ShieldCheck className="size-5 text-primary" />
                <h3 className="mt-3 font-display text-2xl font-light">Safety note</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">JIMMI is not a medical professional. Consult your physician before changing training if you have symptoms, injuries, or health concerns.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
