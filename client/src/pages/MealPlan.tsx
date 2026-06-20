import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Beef, Droplets, Flame, Leaf, Loader2, Salad, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";

type MacroTarget = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  hydration: string;
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

function parseWeight(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 170;
}

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function buildMacroTargets(profile: any): MacroTarget {
  const weight = parseWeight(profile?.weight);
  const goals = splitList(profile?.fitnessGoals).join(", ").toLowerCase();
  const activity = String(profile?.activityLevel ?? "").toLowerCase();
  const activityMultiplier = includesAny(activity, ["very", "active", "athlete", "intense"]) ? 15 : includesAny(activity, ["moderate", "some", "regular"]) ? 14 : 13;
  const goalAdjustment = includesAny(goals, ["lose", "weight", "fat", "lean"]) ? -250 : includesAny(goals, ["muscle", "build", "strength", "gain"]) ? 200 : 0;
  const calories = Math.round((weight * activityMultiplier + goalAdjustment) / 25) * 25;
  const protein = Math.round(weight * (includesAny(goals, ["muscle", "strength", "tone"]) ? 0.9 : 0.8));
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));
  const hydration = `${Math.round(weight * 0.55)}–${Math.round(weight * 0.7)} oz/day`;

  return { calories, protein, carbs, fat, hydration };
}

function buildMealFocus(profile: any) {
  const goals = splitList(profile?.fitnessGoals).join(", ").toLowerCase();
  const fatLoss = includesAny(goals, ["lose", "fat", "weight", "lean"]);
  const muscle = includesAny(goals, ["muscle", "strength", "tone", "build"]);

  return [
    {
      title: "Breakfast",
      detail: muscle ? "Protein oats, Greek yogurt, berries, and a small nut or seed serving." : "Egg or tofu scramble with vegetables and one slow-digesting carb.",
    },
    {
      title: "Lunch",
      detail: fatLoss ? "Lean protein bowl with greens, high-fiber carbs, and a measured dressing." : "Protein-forward grain bowl with colorful vegetables and olive-oil based fats.",
    },
    {
      title: "Training snack",
      detail: "Pair easy carbs with protein: fruit plus yogurt, rice cakes plus turkey, or a smoothie adjusted for allergies.",
    },
    {
      title: "Dinner",
      detail: "Palm-sized protein, two fists of vegetables, a carb matched to training demand, and steady hydration.",
    },
  ];
}

export default function MealPlan() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [localProfile] = useState<any>(() => readLocalOnboardingProfile());
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const profile = profileQuery.data ?? localProfile;
  const isLocalFallback = !user && Boolean(localProfile);
  const restrictions = useMemo(() => splitList(profile?.dietRestrictions), [profile?.dietRestrictions]);
  const allergies = useMemo(() => splitList(profile?.foodAllergies), [profile?.foodAllergies]);
  const macros = useMemo(() => buildMacroTargets(profile), [profile]);
  const meals = useMemo(() => buildMealFocus(profile), [profile]);

  if (loading || (Boolean(user) && profileQuery.isLoading)) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-card p-8 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Preparing your macros...</p>
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
            <p className="mt-4 text-muted-foreground">JIMMI needs your baseline before creating macro guidance.</p>
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
            <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary" data-macro-details-back-to-profile="true"><ArrowLeft className="size-4" /> Back to My Profile</Link>
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.28em] text-primary">Meal Plan</p>
            <h1 className="mt-4 font-display text-5xl font-light leading-none tracking-tight">{profile.firstName}'s nutrition baseline</h1>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">Macro targets are estimates based on your onboarding profile. Use them as a starting point and adjust with results, energy, appetite, and clinical guidance where needed.</p>

            <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="text-foreground">Diet:</span> {restrictions.join(", ") || "None listed"}</div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="text-foreground">Allergies:</span> {allergies.join(", ") || "None listed"}</div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="text-foreground">Goal:</span> {profile.fitnessGoals || "Balanced wellness"}</div>
            </div>

            {isLocalFallback ? <p className="mt-6 rounded-3xl border border-primary/20 bg-primary/[0.08] p-4 text-sm text-muted-foreground">Preview mode is using your local onboarding data. Sign in from the member menu to save macros to your account.</p> : null}
          </aside>

          <section className="rounded-[2rem] border border-white/10 bg-card/90 p-6 md:p-8">
            <div id="macros" className="scroll-mt-8">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Macro estimate</p>
              <h2 className="mt-3 font-display text-4xl font-light tracking-tight">Daily targets to start the conversation.</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.75rem] border border-primary/20 bg-primary/[0.07] p-5"><Flame className="size-5 text-primary" /><p className="mt-4 text-3xl font-light">{macros.calories}</p><p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Calories</p></div>
                <div className="rounded-[1.75rem] border border-white/10 bg-background/70 p-5"><Beef className="size-5 text-primary" /><p className="mt-4 text-3xl font-light">{macros.protein}g</p><p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Protein</p></div>
                <div className="rounded-[1.75rem] border border-white/10 bg-background/70 p-5"><Leaf className="size-5 text-primary" /><p className="mt-4 text-3xl font-light">{macros.carbs}g</p><p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Carbs</p></div>
                <div className="rounded-[1.75rem] border border-white/10 bg-background/70 p-5"><Salad className="size-5 text-primary" /><p className="mt-4 text-3xl font-light">{macros.fat}g</p><p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Fat</p></div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {meals.map((meal) => (
                <article key={meal.title} className="rounded-[1.75rem] border border-white/10 bg-background/70 p-5">
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">{meal.title}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{meal.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <Droplets className="size-5 text-primary" />
                <h3 className="mt-3 font-display text-2xl font-light">Hydration</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Start near <span className="text-foreground">{macros.hydration}</span>, then adjust for sweat, climate, medication guidance, and urine color.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <ShieldCheck className="size-5 text-primary" />
                <h3 className="mt-3 font-display text-2xl font-light">Safety note</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Avoid listed allergens and consult a physician or registered dietitian for medical nutrition therapy, pregnancy/postpartum needs, or chronic conditions.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
