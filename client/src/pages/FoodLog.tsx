import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Crown, Loader2, Pencil, Plus, Sparkles, Trash2, TrendingDown, TrendingUp, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";
const LOCAL_FOOD_LOG_KEY = "jimmi-local-food-log-entries";
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];
type MacroKey = "calories" | "protein" | "carbs" | "fat";
type MacroTotals = Record<MacroKey, number>;

type FoodLogEntry = {
  id: number;
  logDate: string;
  mealType: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type ProfileLike = {
  firstName?: string;
  avatarUrl?: string | null;
  birthday?: string;
  gender?: string;
  weight?: number;
  targetWeight?: number | null;
  height?: string;
  activityLevel?: string;
  fitnessGoals?: string;
};

type MealFormState = {
  foodName: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
};

const emptyForm: MealFormState = { foodName: "", calories: "", protein: "", carbs: "", fat: "", notes: "" };

function readLocalOnboardingProfile() {
  if (typeof window === "undefined") return null;
  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return rawProfile ? JSON.parse(rawProfile) : null;
  } catch {
    return null;
  }
}

function readLocalFoodLogEntries(): FoodLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const rawEntries = window.localStorage.getItem(LOCAL_FOOD_LOG_KEY);
    return rawEntries ? JSON.parse(rawEntries) : [];
  } catch {
    return [];
  }
}

function writeLocalFoodLogEntries(entries: FoodLogEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_FOOD_LOG_KEY, JSON.stringify(entries));
}

function todayLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function shiftDate(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const current = new Date(year, month - 1, day);
  current.setDate(current.getDate() + days);
  const offset = current.getTimezoneOffset() * 60_000;
  return new Date(current.getTime() - offset).toISOString().slice(0, 10);
}

function dateFromString(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function displayWeekday(dateString: string) {
  return dateFromString(dateString).toLocaleDateString(undefined, { weekday: "short" });
}

function displayMonthDay(dateString: string) {
  return dateFromString(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function parseHeightInches(height?: string) {
  if (!height) return 68;
  const feetInches = height.match(/(\d+)\s*(?:ft|'|feet)\s*(\d+)?/i);
  if (feetInches) return Number(feetInches[1]) * 12 + Number(feetInches[2] ?? 0);
  const numeric = Number(height.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 68;
  if (/cm/i.test(height)) return numeric / 2.54;
  return numeric > 96 ? numeric / 2.54 : numeric;
}

function getAge(birthday?: string) {
  if (!birthday) return 35;
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return 35;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return Math.min(Math.max(age, 16), 85);
}

function activityMultiplier(activity?: string) {
  const label = (activity ?? "").toLowerCase();
  if (label.includes("sedentary")) return 1.2;
  if (label.includes("light")) return 1.375;
  if (label.includes("very") || label.includes("athlete")) return 1.725;
  if (label.includes("high") || label.includes("active")) return 1.55;
  return 1.45;
}

function deriveMacroTargets(profile: ProfileLike): MacroTotals {
  const weightLb = Math.max(Number(profile.weight) || 170, 90);
  const heightIn = parseHeightInches(profile.height);
  const age = getAge(profile.birthday);
  const gender = (profile.gender ?? "").toLowerCase();
  const goalText = `${profile.fitnessGoals ?? ""} ${profile.targetWeight ?? ""}`.toLowerCase();
  const metricWeight = weightLb * 0.453592;
  const metricHeight = heightIn * 2.54;
  const bmr = 10 * metricWeight + 6.25 * metricHeight - 5 * age + (gender.includes("female") ? -161 : 5);
  let calories = Math.round((bmr * activityMultiplier(profile.activityLevel)) / 25) * 25;
  const targetWeight = Number(profile.targetWeight);
  if (Number.isFinite(targetWeight) && targetWeight > 0) {
    if (targetWeight < weightLb - 3) calories -= 300;
    if (targetWeight > weightLb + 3) calories += 250;
  } else if (goalText.includes("lose") || goalText.includes("cut") || goalText.includes("fat loss")) {
    calories -= 300;
  } else if (goalText.includes("gain") || goalText.includes("muscle") || goalText.includes("bulk")) {
    calories += 250;
  }
  calories = Math.min(Math.max(calories, 1400), 3600);
  const protein = Math.round(weightLb * (goalText.includes("muscle") || goalText.includes("strength") ? 0.9 : 0.8));
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 80);
  return { calories, protein, carbs, fat };
}

function clampPercent(value: number, target: number) {
  if (!target) return 0;
  return Math.min(Math.round((value / target) * 100), 140);
}

function macroTone(value: number, target: number) {
  const percent = target ? value / target : 0;
  if (percent >= 0.9 && percent <= 1.08) return "On target";
  if (percent > 1.08) return "Over goal";
  return "Remaining";
}

function isGoalMet(totals: MacroTotals, targets: MacroTotals): boolean {
  const caloriePercent = targets.calories ? totals.calories / targets.calories : 0;
  const proteinPercent = targets.protein ? totals.protein / targets.protein : 0;
  const carbsPercent = targets.carbs ? totals.carbs / targets.carbs : 0;
  const fatPercent = targets.fat ? totals.fat / targets.fat : 0;
  
  return (
    caloriePercent >= 0.9 && caloriePercent <= 1.08 &&
    proteinPercent >= 0.9 && proteinPercent <= 1.08 &&
    carbsPercent >= 0.9 && carbsPercent <= 1.08 &&
    fatPercent >= 0.9 && fatPercent <= 1.08
  );
}

function toInt(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function totalsFor(entries: FoodLogEntry[]): MacroTotals {
  return entries.reduce(
    (sum, entry) => ({
      calories: sum.calories + entry.calories,
      protein: sum.protein + entry.protein,
      carbs: sum.carbs + entry.carbs,
      fat: sum.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

const MACRO_TITLE_TONES: Record<string, string> = {
  Calories: "text-[#f6d365]",
  Protein: "text-[#8fe8d8]",
  Carbs: "text-[#b9a7ff]",
  Fat: "text-[#f2a7c9]",
};

function MacroProgress({ label, value, target, unit, isComplete }: { label: string; value: number; target: number; unit: string; isComplete?: boolean }) {
  const percent = clampPercent(value, target);
  const remaining = Math.max(target - value, 0);
  const titleTone = MACRO_TITLE_TONES[label] ?? "text-foreground";
  const completionClass = isComplete ? "bg-white/[0.05] border border-green-500/30" : "bg-white/[0.025]";
  return (
    <div className={`rounded-[1.25rem] px-3 py-3 transition-all duration-300 ${completionClass}`} data-food-log-macro={label.toLowerCase()}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-mono text-[0.62rem] uppercase tracking-[0.22em] ${titleTone}`} data-food-log-macro-title-tone={label.toLowerCase()}>{label}</p>
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] !text-white" data-food-log-macro-status="white">{isComplete ? "✓ Complete" : macroTone(value, target)}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-light tracking-tight">{value}<span className="ml-1 text-xs text-muted-foreground">/ {target}{unit}</span></p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-gradient-to-r from-green-400 to-emerald-300" : "bg-gradient-to-r from-[#8fe8d8] to-violet-200"}`} style={{ width: `${Math.min(percent, 100)}%` }} data-food-log-macro-accent="subtle-gradient" /></div>
      <p className="mt-2 text-[0.68rem] !text-white" data-food-log-macro-remaining="forced-white">{remaining > 0 ? `${remaining}${unit} left` : `${Math.max(value - target, 0)}${unit} over`}</p>
    </div>
  );
}

export default function FoodLog() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [selectedDate, setSelectedDate] = useState(() => todayLocalDate());
  const [localProfile] = useState<any>(() => readLocalOnboardingProfile());
  const [localFoodLogEntries, setLocalFoodLogEntries] = useState<FoodLogEntry[]>(() => readLocalFoodLogEntries());
  const [activeMealType, setActiveMealType] = useState<MealType | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [form, setForm] = useState<MealFormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [estimateApplied, setEstimateApplied] = useState(false);
  const [estimateError, setEstimateError] = useState("");
  const utils = trpc.useUtils();
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const foodLogQuery = trpc.foodLog.daily.useQuery({ logDate: selectedDate }, { enabled: Boolean(user), retry: false });
  const calorieBalanceQuery = trpc.foodLog.calorieBalance.useQuery({ logDate: selectedDate }, { enabled: Boolean(user), retry: false, staleTime: 15_000 });
  const profile = (profileQuery.data ?? localProfile) as ProfileLike | null;
  const isLocalFallback = !user && Boolean(localProfile);
  const macroTargets = useMemo(() => deriveMacroTargets(profile ?? {}), [profile]);
  const entries = (user ? (foodLogQuery.data?.entries ?? []) : localFoodLogEntries.filter((entry) => entry.logDate === selectedDate)) as FoodLogEntry[];
  const totals = (user ? (foodLogQuery.data?.totals ?? totalsFor(entries)) : totalsFor(entries)) as MacroTotals;
  const calorieBalance = calorieBalanceQuery.data;
  const editingEntry = useMemo(() => entries.find((entry) => entry.id === editingEntryId) ?? null, [entries, editingEntryId]);
  const formPreview = useMemo<MacroTotals>(() => ({ calories: toInt(form.calories), protein: toInt(form.protein), carbs: toInt(form.carbs), fat: toInt(form.fat) }), [form]);
  const projectedTotals = useMemo<MacroTotals>(() => {
    const baseline = editingEntry ? { calories: totals.calories - editingEntry.calories, protein: totals.protein - editingEntry.protein, carbs: totals.carbs - editingEntry.carbs, fat: totals.fat - editingEntry.fat } : totals;
    return { calories: baseline.calories + formPreview.calories, protein: baseline.protein + formPreview.protein, carbs: baseline.carbs + formPreview.carbs, fat: baseline.fat + formPreview.fat };
  }, [totals, formPreview, editingEntry]);
  const selectedMealLabel = activeMealType ?? "Meal";
  const isEditingMeal = editingEntryId !== null;
  const estimateMacros = trpc.foodLog.estimateMacros.useMutation({
    onSuccess: (estimate) => {
      setForm((state) => ({
        ...state,
        calories: String(estimate.calories),
        protein: String(estimate.protein),
        carbs: String(estimate.carbs),
        fat: String(estimate.fat),
      }));
      setEstimateApplied(true);
      setEstimateError("");
      setFormError("");
    },
    onError: () => {
      setEstimateApplied(false);
      setEstimateError("JIMMI could not estimate this meal right now. You can still enter macros manually.");
    },
  });
  const addMeal = trpc.foodLog.add.useMutation({
    onMutate: async (input) => {
      await utils.foodLog.daily.cancel({ logDate: input.logDate });
      const previous = utils.foodLog.daily.getData({ logDate: input.logDate });
      const optimisticEntry: FoodLogEntry = { id: -Date.now(), logDate: input.logDate, mealType: input.mealType, foodName: input.foodName, calories: Number(input.calories), protein: Number(input.protein), carbs: Number(input.carbs), fat: Number(input.fat), notes: input.notes };
      const nextEntries = [...((previous?.entries ?? []) as FoodLogEntry[]), optimisticEntry];
      utils.foodLog.daily.setData({ logDate: input.logDate }, { entries: nextEntries as any, totals: totalsFor(nextEntries) });
      return { previous };
    },
    onError: (_error, input, context) => { if (context?.previous) utils.foodLog.daily.setData({ logDate: input.logDate }, context.previous); },
    onSettled: (_data, _error, input) => utils.foodLog.daily.invalidate({ logDate: input.logDate }),
  });
  const updateMeal = trpc.foodLog.update.useMutation({
    onMutate: async (input) => {
      await utils.foodLog.daily.cancel({ logDate: input.logDate });
      const previous = utils.foodLog.daily.getData({ logDate: input.logDate });
      const nextEntries = ((previous?.entries ?? []) as FoodLogEntry[]).map((entry) => entry.id === input.id ? { ...entry, mealType: input.mealType, foodName: input.foodName, calories: Number(input.calories), protein: Number(input.protein), carbs: Number(input.carbs), fat: Number(input.fat), notes: input.notes, updatedAt: new Date() } : entry);
      utils.foodLog.daily.setData({ logDate: input.logDate }, { entries: nextEntries as any, totals: totalsFor(nextEntries) });
      return { previous };
    },
    onError: (_error, input, context) => { if (context?.previous) utils.foodLog.daily.setData({ logDate: input.logDate }, context.previous); },
    onSettled: (_data, _error, input) => utils.foodLog.daily.invalidate({ logDate: input.logDate }),
  });
  const deleteMeal = trpc.foodLog.delete.useMutation({
    onMutate: async (input) => {
      const deleteId = Number(input.id);
      setDeletingEntryId(deleteId);
      await utils.foodLog.daily.cancel({ logDate: input.logDate });
      const previous = utils.foodLog.daily.getData({ logDate: input.logDate });
      const nextEntries = ((previous?.entries ?? []) as FoodLogEntry[]).filter((entry) => entry.id !== deleteId);
      utils.foodLog.daily.setData({ logDate: input.logDate }, { entries: nextEntries as any, totals: totalsFor(nextEntries) });
      return { previous };
    },
    onError: (_error, input, context) => { if (context?.previous) utils.foodLog.daily.setData({ logDate: input.logDate }, context.previous); },
    onSettled: (_data, _error, input) => {
      setDeletingEntryId(null);
      return utils.foodLog.daily.invalidate({ logDate: input.logDate });
    },
  });

  function openMealDialog(mealType: MealType) {
    setActiveMealType(mealType);
    setEditingEntryId(null);
    setForm(emptyForm);
    setFormError("");
    setEstimateApplied(false);
    setEstimateError("");
  }

  function openEditMealDialog(entry: FoodLogEntry) {
    const mealType = MEAL_TYPES.includes(entry.mealType as MealType) ? entry.mealType as MealType : "Breakfast";
    setActiveMealType(mealType);
    setEditingEntryId(entry.id);
    setForm({ foodName: entry.foodName, calories: String(entry.calories), protein: String(entry.protein), carbs: String(entry.carbs), fat: String(entry.fat), notes: entry.notes ?? "" });
    setFormError("");
    setEstimateApplied(false);
    setEstimateError("");
  }

  function closeMealDialog() {
    setActiveMealType(null);
    setEditingEntryId(null);
    setForm(emptyForm);
    setFormError("");
    setEstimateApplied(false);
    setEstimateError("");
  }

  async function handleEstimateMacros() {
    const foodName = form.foodName.trim();
    if (foodName.length < 2) {
      setEstimateApplied(false);
      setEstimateError("Enter a food or meal name before asking JIMMI to estimate macros.");
      return;
    }
    setEstimateError("");
    try {
      await estimateMacros.mutateAsync({ foodName });
    } catch {
      // The mutation onError path shows a manual-entry fallback message.
    }
  }

  async function handleSaveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMealType) return;
    if (form.foodName.trim().length < 2) { setFormError("Add a food or meal name before saving."); return; }
    const payload = { logDate: selectedDate, mealType: activeMealType, foodName: form.foodName.trim(), calories: toInt(form.calories), protein: toInt(form.protein), carbs: toInt(form.carbs), fat: toInt(form.fat), notes: form.notes.trim() || null };
    setFormError("");
    if (!user) {
      const nextEntries = isEditingMeal && editingEntryId !== null
        ? localFoodLogEntries.map((entry) => entry.id === editingEntryId ? { ...entry, ...payload, updatedAt: new Date().toISOString() } : entry)
        : [...localFoodLogEntries, { id: -Date.now(), ...payload }];
      setLocalFoodLogEntries(nextEntries);
      writeLocalFoodLogEntries(nextEntries);
      closeMealDialog();
      return;
    }
    if (isEditingMeal && editingEntryId !== null) {
      await updateMeal.mutateAsync({ id: editingEntryId, ...payload });
    } else {
      await addMeal.mutateAsync(payload);
    }
    closeMealDialog();
  }

  async function handleDeleteMeal(entry: FoodLogEntry) {
    setDeletingEntryId(entry.id);
    if (!user) {
      const nextEntries = localFoodLogEntries.filter((item) => item.id !== entry.id);
      setLocalFoodLogEntries(nextEntries);
      writeLocalFoodLogEntries(nextEntries);
      setDeletingEntryId(null);
      return;
    }
    try {
      await deleteMeal.mutateAsync({ id: entry.id, logDate: selectedDate });
    } catch {
      setDeletingEntryId(null);
    }
  }

  if (loading || (Boolean(user) && profileQuery.isLoading)) {
    return <main className="min-h-screen bg-background text-foreground"><section className="container flex min-h-screen items-center justify-center"><div className="rounded-3xl border border-white/10 bg-card p-8 text-center"><Loader2 className="mx-auto size-8 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">Loading your food log...</p></div></section></main>;
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center py-16">
          <div className="max-w-2xl rounded-[2rem] border border-white/10 bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Food Log</p>
            <h1 className="mt-4 font-display text-5xl font-light tracking-tight">Complete onboarding first</h1>
            <p className="mt-4 text-muted-foreground">JIMMI uses your profile baseline to set useful macro targets before daily meal tracking starts.</p>
            <Link href="/onboarding"><Button className="mt-8 rounded-full bg-primary text-primary-foreground">Start onboarding</Button></Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground" data-food-log-page="daily-macro-tracker" data-food-log-color-accents="minimal-cyan-violet">
      <section className="container py-8 md:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
          <JimmiWordmark variant="member" />
          <nav className="flex items-center gap-3 text-sm"><MemberMenu memberName={profile.firstName} avatarUrl={profile.avatarUrl} isLocalFallback={isLocalFallback} /></nav>
        </header>

        <div className="mt-10">
          <section className="rounded-[2.25rem] bg-[radial-gradient(circle_at_top_left,rgba(143,232,216,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.06),transparent_30%),rgba(9,9,11,0.84)] p-5 shadow-2xl shadow-black/30 md:p-7" data-food-log-color-pop="subtle-shell" data-food-log-compact-layout="true">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-2xl"><p className="font-mono text-xs uppercase tracking-[0.28em] text-white" data-food-log-title-accent="white">Daily Food Log</p><h1 className="mt-3 font-display text-5xl font-light leading-none tracking-tight md:text-7xl">Fuel the goal</h1><p className="mt-4 text-muted-foreground">Track meals against JIMMI’s daily macro targets while keeping the page compact and focused.</p></div>
              <Button className="rounded-full bg-primary px-5 text-primary-foreground shadow-lg shadow-primary/10" onClick={() => openMealDialog("Breakfast")} data-food-log-top-add="true" data-food-log-add-meal-enabled="preview-ready"><Plus className="mr-2 size-4" /> Add meal</Button>
            </div>
            {!user ? <div className="mt-5 rounded-3xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">Preview mode: you can test Add Meal now and see macros update on this device. Sign in to sync meals across devices.</div> : null}
            <div className="mt-6 flex items-center gap-2 sm:gap-3" data-food-log-date-nav="matched-controls" data-food-log-date-inline="stacked-abbreviated"><Button variant="ghost" className="h-11 min-w-[6.5rem] shrink-0 rounded-full bg-white/[0.035] px-3 text-xs hover:bg-white/[0.07] sm:min-w-32 sm:px-5 sm:text-sm" onClick={() => setSelectedDate((date) => shiftDate(date, -1))}><ChevronLeft className="mr-1.5 size-4 sm:mr-2" /> Previous</Button><label className="relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center px-1 py-2 text-center"><span className="truncate font-mono text-[0.58rem] uppercase leading-none tracking-[0.18em] text-muted-foreground" data-food-log-date-weekday="true">{displayWeekday(selectedDate)}</span><span className="mt-1 truncate font-display text-base font-light leading-none tracking-tight text-foreground sm:text-lg" data-food-log-date-month-day="true">{displayMonthDay(selectedDate)}</span><Input aria-label="Select food log date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label><Button variant="ghost" className="h-11 min-w-[6.5rem] shrink-0 rounded-full bg-white/[0.035] px-3 text-xs hover:bg-white/[0.07] sm:min-w-32 sm:px-5 sm:text-sm" onClick={() => setSelectedDate((date) => shiftDate(date, 1))}>Next <ChevronRight className="ml-1.5 size-4 sm:ml-2" /></Button></div>
            {(() => { const goalComplete = isGoalMet(totals, macroTargets); return <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-food-log-compact-macros="true"><MacroProgress label="Calories" value={totals.calories} target={macroTargets.calories} unit="" isComplete={goalComplete} /><MacroProgress label="Protein" value={totals.protein} target={macroTargets.protein} unit="g" isComplete={goalComplete} /><MacroProgress label="Carbs" value={totals.carbs} target={macroTargets.carbs} unit="g" isComplete={goalComplete} /><MacroProgress label="Fat" value={totals.fat} target={macroTargets.fat} unit="g" isComplete={goalComplete} /></div>; })()}
            <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-4" data-premium-calorie-balance-tracker="true">
              {calorieBalanceQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> Loading calorie balance...</div>
              ) : !calorieBalance?.premiumActive ? (
                <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center" data-calorie-balance-premium-gate="true">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-100"><Crown className="size-5" /></div>
                  <div><p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Premium calorie balance</p><h2 className="mt-2 text-xl font-medium tracking-tight">Track surplus and deficit once wearable calories are enabled.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">This premium tracker will compare calories in from your food log against active and total calories out from a connected wearable.</p></div>
                  <Button asChild className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"><Link href="/account-settings">Upgrade access</Link></Button>
                </div>
              ) : !calorieBalance.wearableConnected ? (
                <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center" data-calorie-balance-wearable-required="true">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-100"><Watch className="size-5" /></div>
                  <div><p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Wearable connection required</p><h2 className="mt-2 text-xl font-medium tracking-tight">Connect a wearable to unlock your calorie balance tracker.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Once your Oura, Whoop, or Fitbit is connected, JIMMI will compare calories in from your food log against active and total calories out from your device.</p></div>
                  <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]"><Link href="/integrations">Connect wearable</Link></Button>
                </div>
              ) : (
                <div data-calorie-balance-connected-tracker="true">
                  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Calorie balance tracker</p><h2 className="mt-2 text-2xl font-medium tracking-tight">{calorieBalance.balanceDirection === "surplus" ? "Surplus day" : calorieBalance.balanceDirection === "deficit" ? "Deficit day" : calorieBalance.balanceDirection === "sync_pending" ? "Waiting for synced calories out" : "Balanced day"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Calories in are compared against active and total calories out from your connected {calorieBalance.sourceProvider || "wearable"} source.</p></div><div className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${calorieBalance.netCalories >= 0 ? "bg-amber-300/10 text-amber-100" : "bg-emerald-300/10 text-emerald-100"}`}>{calorieBalance.netCalories >= 0 ? <TrendingUp className="mr-2 size-4" /> : <TrendingDown className="mr-2 size-4" />}{calorieBalance.netCalories >= 0 ? "+" : ""}{calorieBalance.netCalories} kcal net</div></div>
                  <div className="mt-5 grid gap-3 md:grid-cols-4">{[["Calories in", calorieBalance.caloriesIn], ["Active out", calorieBalance.activeCaloriesOut], ["Total out", calorieBalance.totalCaloriesOut], ["Net balance", calorieBalance.netCalories]].map(([label, value]) => (<div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary/80">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{Number(value).toLocaleString()} kcal</p></div>))}</div>
                </div>
              )}
            </section>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{entries.length} meal entr{entries.length === 1 ? "y" : "ies"} logged today</span>{foodLogQuery.isFetching ? <span className="inline-flex items-center gap-2 text-primary"><Loader2 className="size-3 animate-spin" /> Syncing</span> : null}</div>
            {entries.length > 0 ? (
              <div className="mt-4 space-y-2" data-food-log-editable-meal-list="true">
                {entries.map((entry) => (
                  <article key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.025] px-4 py-3" data-food-log-meal-row="editable">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-light tracking-tight">{entry.foodName}</p>
                      <p className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">{entry.mealType} • {entry.calories} cal • {entry.protein}p / {entry.carbs}c / {entry.fat}f</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-white/10 bg-black/20 px-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary" onClick={() => openEditMealDialog(entry)} data-food-log-edit-meal-button="true" aria-label={`Edit ${entry.foodName}`}>
                        <Pencil className="mr-1.5 size-3" /> Edit
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8 rounded-full text-red-300 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50" onClick={() => handleDeleteMeal(entry)} disabled={deletingEntryId === entry.id} data-food-log-delete-meal-button="minimal-red-trash" aria-label={`Delete ${entry.foodName}`}>
                        {deletingEntryId === entry.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <Dialog open={Boolean(activeMealType)} onOpenChange={(open) => !open && closeMealDialog()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-card p-0 text-card-foreground sm:max-w-2xl" data-food-log-add-meal-dialog="guided-entry">
          <div className="border-b border-white/10 bg-gradient-to-br from-white/[0.055] to-transparent p-5 sm:p-6">
            <DialogHeader>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.26em] text-primary">{isEditingMeal ? "Edit" : "Add to"} {displayMonthDay(selectedDate)}</p>
              <DialogTitle className="font-display text-3xl font-light tracking-tight sm:text-4xl">{isEditingMeal ? "Edit meal" : "Log a meal"}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">{isEditingMeal ? "Adjust the saved meal details. JIMMI previews how your revised macros change the day before you save." : "Enter the meal details once. JIMMI previews the macro impact before saving and updates your daily totals right after submission."}</DialogDescription>
            </DialogHeader>
          </div>
          <form className="space-y-5 p-5 sm:p-6" onSubmit={handleSaveMeal}>
            <section className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4" data-food-log-meal-type-picker="true">
              <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">Step 1</p><h3 className="mt-1 font-display text-xl font-light">When did you eat?</h3></div><span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-primary">{selectedMealLabel}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{MEAL_TYPES.map((meal) => <Button key={meal} type="button" variant="ghost" className={`rounded-full px-3 py-2 text-xs ${activeMealType === meal ? "bg-primary text-primary-foreground" : "bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07]"}`} onClick={() => setActiveMealType(meal)}>{meal}</Button>)}</div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-4" data-food-log-meal-details-card="true">
              <div><p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">Step 2</p><h3 className="mt-1 font-display text-xl font-light">Meal details</h3></div>
              <div className="mt-4 space-y-3" data-food-log-smart-estimate="jimmi-llm">
                <div className="space-y-2"><Label htmlFor="foodName">Food or meal name</Label><Input id="foodName" value={form.foodName} onChange={(event) => { setForm((state) => ({ ...state, foodName: event.target.value })); setEstimateApplied(false); setEstimateError(""); }} placeholder="Grilled chicken bowl" className="h-12 rounded-2xl border-white/10 bg-black/20" autoFocus /></div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/[0.06] p-3">
                  <p className="text-xs text-muted-foreground">Type the food first, then let JIMMI fill in a realistic starting point.</p>
                  <Button type="button" variant="outline" className="rounded-full border-primary/25 bg-primary/10 text-primary hover:bg-primary/15" onClick={handleEstimateMacros} disabled={estimateMacros.isPending || form.foodName.trim().length < 2} data-food-log-estimate-button="true">
                    {estimateMacros.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />} Estimate with JIMMI
                  </Button>
                </div>
                {estimateApplied ? <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-primary" data-food-log-ai-estimate-note="editable">AI estimate — edit as needed</p> : null}
                {estimateError ? <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100" data-food-log-estimate-error="true">{estimateError}</p> : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4" data-food-log-macro-entry-grid="true">{([["calories", "Calories", "520"], ["protein", "Protein", "42g"], ["carbs", "Carbs", "48g"], ["fat", "Fat", "16g"]] as const).map(([key, label, placeholder]) => <div key={key} className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} inputMode="numeric" value={form[key]} onChange={(event) => setForm((state) => ({ ...state, [key]: event.target.value.replace(/[^0-9]/g, "") }))} placeholder={placeholder} className="h-12 rounded-2xl border-white/10 bg-black/20 text-lg" /></div>)}</div>
              <div className="mt-4 space-y-2"><Label htmlFor="notes">Notes <span className="text-muted-foreground">optional</span></Label><Textarea id="notes" value={form.notes} onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))} placeholder="Portion details, prep notes, restaurant name, or how you felt." className="min-h-20 rounded-2xl border-white/10 bg-black/20" /></div>
            </section>

            <section className="rounded-[1.75rem] border border-primary/15 bg-primary/[0.055] p-4" data-food-log-live-macro-preview="true">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-primary">Live macro preview</p><h3 className="mt-1 font-display text-xl font-light">{isEditingMeal ? "After saving changes" : "After saving this meal"}</h3></div><p className="text-xs text-muted-foreground">Daily totals update instantly on submit.</p></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{([["calories", "Calories", ""], ["protein", "Protein", "g"], ["carbs", "Carbs", "g"], ["fat", "Fat", "g"]] as const).map(([key, label, unit]) => <div key={key} className="rounded-2xl bg-black/20 p-3"><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-light">{projectedTotals[key]}<span className="ml-1 text-xs text-muted-foreground">{unit}</span></p><p className="mt-1 text-[0.68rem] text-primary">{isEditingMeal ? "New" : "+"}{formPreview[key]}{unit}</p></div>)}</div>
            </section>

            {formError ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{formError}</p> : null}
            <DialogFooter className="gap-2 sm:justify-between"><Button type="button" variant="outline" className="rounded-full border-white/10" onClick={closeMealDialog}>Cancel</Button><Button type="submit" disabled={addMeal.isPending || updateMeal.isPending} className="rounded-full bg-primary px-6 text-primary-foreground">{addMeal.isPending || updateMeal.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : isEditingMeal ? <Pencil className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />} {isEditingMeal ? "Save changes" : "Save meal & update macros"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
