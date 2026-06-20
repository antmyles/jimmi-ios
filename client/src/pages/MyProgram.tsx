import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CalendarDays, Check, Download, Dumbbell, ExternalLink, FileUp, Loader2, LockKeyhole, Play, RefreshCcw, ShoppingBasket, Sparkles, Utensils, ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { UpgradeModal } from "@/components/UpgradeModal";

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";
const youtubeSearchUrl = (exerciseName: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} exercise form`)}`;
function readLocalOnboardingProfile() {
  if (typeof window === "undefined") return null;
  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return rawProfile ? JSON.parse(rawProfile) : null;
  } catch {
    return null;
  }
}
type Exercise = {
  key?: string;
  name?: string;
  sets?: number;
  reps?: string;
  rest?: string;
  cues?: string;
  youtubeUrl?: string;
};

type TrainingDay = {
  day?: string;
  focus?: string;
  warmup?: string;
  scheduledDate?: string;
  dateLabel?: string;
  status?: "scheduled" | "completed" | "cancelled";
  recoveryWindow?: string;
  adaptationNote?: string;
  completedAt?: string;
  cancelledAt?: string;
  exercises?: Exercise[];
};

type Meal = {
  mealType?: string;
  name?: string;
  ingredients?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  notes?: string;
};

type MealDay = {
  day?: string;
  meals?: Meal[];
};

type ProgramPlan = {
  title?: string;
  overview?: string;
  programDuration?: string;
  durationRationale?: string;
  phaseSummary?: Array<{ phase?: string; focus?: string; weeks?: string }>;
  progressTracking?: Array<{ checkpoint?: string; action?: string; metric?: string }>;
  trainingPlan?: TrainingDay[];
  smartWorkoutAdaptation?: { summary?: string; evidenceUsed?: string[]; adaptedAt?: string; logCount?: number };
  mealPlan?: {
    macroTargets?: { calories?: number; protein?: number; carbs?: number; fat?: number };
    days?: MealDay[];
  };
};

const generationSteps = ["Reviewing your profile", "Choosing the right program length", "Structuring training phases", "Aligning meals and groceries", "Finalizing progress checkpoints"];
const confettiPieces = Array.from({ length: 36 }, (_, index) => {
  const angle = (index / 36) * Math.PI * 2;
  const radius = 92 + (index % 6) * 22;
  return {
    x: `${Math.cos(angle) * radius}px`,
    y: `${Math.sin(angle) * radius}px`,
    delay: `${(index % 9) * 14}ms`,
    color: index % 4 === 0 ? "#E8FF00" : index % 4 === 1 ? "#FAFAFA" : index % 4 === 2 ? "#B7F36B" : "#D9D9D9",
    rotate: `${(index * 31) % 240}deg`,
    width: index % 5 === 0 ? "3px" : index % 2 === 0 ? "4px" : "6px",
    height: index % 5 === 0 ? "18px" : index % 2 === 0 ? "10px" : "6px",
    radius: index % 3 === 0 ? "999px" : "2px",
  };
});

function CompletionConfetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true" data-my-program-confetti="premium-pop">
      <div className="absolute left-1/2 top-[30%] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-200/90 shadow-[0_0_70px_rgba(232,255,0,0.42)]" data-my-program-confetti-burst-origin="center" />
      <div className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime-100/25 bg-black/80 px-5 py-3 text-center shadow-[0_0_55px_rgba(232,255,0,0.24)] backdrop-blur-md [animation:jimmi-confetti-badge-pop_900ms_cubic-bezier(0.16,1,0.3,1)_forwards]" data-my-program-confetti-success="visible">
        <Sparkles className="mx-auto mb-1 size-4 text-lime-100" />
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-lime-50">Program ready</p>
      </div>
      {confettiPieces.map((piece, index) => {
        const style = {
          "--confetti-x": piece.x,
          "--confetti-y": piece.y,
          "--confetti-rotate": piece.rotate,
          animation: `jimmi-confetti-pop-burst 1050ms cubic-bezier(0.16, 1, 0.3, 1) ${piece.delay} forwards`,
          backgroundColor: piece.color,
          width: piece.width,
          height: piece.height,
          borderRadius: piece.radius,
        } as CSSProperties;
        return <span key={`confetti-${index}`} className="absolute left-1/2 top-[30%] opacity-0 shadow-[0_0_14px_rgba(255,255,255,0.38)]" style={style} />;
      })}
    </div>
  );
}

function triggerProgramCompletionHaptic() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate([18, 34, 26]);
  } catch {
    // Haptics are best-effort and unsupported in some browsers or device modes.
  }
}

function formatMacro(value?: number, suffix = "") {
  return `${Math.round(Number(value ?? 0)).toLocaleString()}${suffix}`;
}

function workoutStatusLabel(status?: TrainingDay["status"]) {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Scheduled";
}

function workoutStatusClass(status?: TrainingDay["status"]) {
  if (status === "completed") return "border-lime-300/30 bg-lime-300/[0.08] text-lime-100";
  if (status === "cancelled") return "border-rose-300/25 bg-rose-300/[0.07] text-rose-100";
  return "border-sky-300/25 bg-sky-300/[0.07] text-sky-100";
}

function getLocalTodayIsoDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatTrainingDayLabel(day: TrainingDay, dayIndex: number) {
  if (day.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(day.scheduledDate)) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(`${day.scheduledDate}T12:00:00.000Z`));
  }
  return day.day ?? `Day ${dayIndex + 1}`;
}

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function WorkoutRescheduleDialog({ day, dayIndex, trainingPlan, todayIso, disabled, onReschedule }: { day: TrainingDay; dayIndex: number; trainingPlan: TrainingDay[]; todayIso: string; disabled?: boolean; onReschedule: (dayIndex: number, scheduledDate: string) => void }) {
  const [open, setOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(day.scheduledDate ?? "");

  useEffect(() => {
    if (open) setScheduledDate(day.scheduledDate ?? "");
  }, [day.scheduledDate, open]);

  const submit = () => {
    if (!scheduledDate) {
      toast.error("Choose a new workout date");
      return;
    }
    if (scheduledDate < todayIso) {
      toast.error("Choose today or a future date", { description: "You can't reschedule a workout to a date that has already passed." });
      return;
    }
    const hasAnotherWorkoutOnDate = trainingPlan.some((candidate, candidateIndex) => candidateIndex !== dayIndex && candidate.scheduledDate === scheduledDate && candidate.status !== "cancelled");
    if (hasAnotherWorkoutOnDate) {
      toast.error("That date already has a workout", { description: "Another workout is already scheduled for that date. Please choose a different date." });
      return;
    }
    onReschedule(dayIndex, scheduledDate);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-[0.7rem] uppercase tracking-[0.16em]" data-my-program-workout-action="reschedule">
          <CalendarDays className="mr-1.5 size-3.5" /> Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-zinc-950 text-foreground sm:max-w-sm" data-my-program-reschedule-duplicate-date-guard="other-non-cancelled-workout">
        <DialogHeader>
          <DialogTitle>Reschedule workout</DialogTitle>
          <DialogDescription>Pick the date you want to complete {day.day ?? "this workout"}. Your plan will keep the same exercises.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`workout-date-${dayIndex}`}>Workout date</Label>
          <Input id={`workout-date-${dayIndex}`} type="date" min={todayIso} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} data-my-program-reschedule-past-date-guard="today-or-future" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={disabled || !scheduledDate}>Save date</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkoutCancelConfirmDialog({ day, dayIndex, disabled, onCancel }: { day: TrainingDay; dayIndex: number; disabled?: boolean; onCancel: (dayIndex: number) => void }) {
  const [open, setOpen] = useState(false);

  const confirmCancel = () => {
    onCancel(dayIndex);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled || day.status === "cancelled"} className="h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-[0.7rem] uppercase tracking-[0.16em]" data-my-program-workout-action="cancel">
          <X className="mr-1.5 size-3.5" /> Cancel
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-zinc-950 text-foreground sm:max-w-sm" data-my-program-workout-action="cancel-confirm">
        <DialogHeader>
          <DialogTitle>Cancel workout?</DialogTitle>
          <DialogDescription>Are you sure you&apos;d like to cancel this workout? {day.day ?? "This workout"} will stay in your plan as cancelled.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full border-white/10 bg-white/[0.03]">Keep Workout</Button>
          <Button onClick={confirmCancel} disabled={disabled} className="rounded-full bg-rose-400 text-rose-950 hover:bg-rose-300">Cancel Workout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseLogDialog({ programId, exercise, onSaved }: { programId: number; exercise: Exercise; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(String(exercise.sets ?? 3));
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");
  const [notes, setNotes] = useState("");
  const logExercise = trpc.myProgram.logExercise.useMutation({
    onSuccess: () => {
      toast.success("Exercise logged", { description: `${exercise.name ?? "Exercise"} was added to your program log.` });
      setOpen(false);
      onSaved();
    },
    onError: (error) => toast.error("Could not log exercise", { description: error.message }),
  });

  const submit = () => {
    logExercise.mutate({
      programId,
      exerciseKey: exercise.key || exercise.name || "exercise",
      exerciseName: exercise.name || "Exercise",
      sets: Number(sets) || 0,
      reps: Number(reps) || 0,
      weight: Number(weight) || 0,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-[0.7rem] uppercase tracking-[0.16em]">
          <ClipboardCheck className="mr-1.5 size-3.5" /> Log
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-zinc-950 text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log {exercise.name}</DialogTitle>
          <DialogDescription>Record the sets, reps, and weight you completed for this movement.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="sets">Sets</Label>
            <Input id="sets" inputMode="numeric" value={sets} onChange={(event) => setSets(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reps">Reps</Label>
            <Input id="reps" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight</Label>
            <Input id="weight" inputMode="numeric" value={weight} onChange={(event) => setWeight(event.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="How did this feel?" />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={logExercise.isPending} className="rounded-full">
            {logExercise.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Save log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MyProgram() {
  const utils = trpc.useUtils();
  const { user } = useAuth({ redirectOnUnauthenticated: false });
  const [localProfile] = useState<any>(() => readLocalOnboardingProfile());
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const profile = (profileQuery.data ?? localProfile ?? {}) as { firstName?: string; avatarUrl?: string | null };
  const isLocalFallback = !user && Boolean(localProfile);
  const settingsQuery = trpc.account.settings.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const planTier = settingsQuery.data?.planTier ?? "free";
  const isCorePlus = planTier === "core" || planTier === "pro" || planTier === "elite";
  const programUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { data, isLoading } = trpc.myProgram.get.useQuery(undefined, { retry: false });
  const programRecord = data?.program as ({ id: number; title: string; exportText?: string | null; plan?: ProgramPlan } | null | undefined);
  const program = programRecord?.plan;
  const groceryList = data?.groceryList as ({ categories?: Array<{ name?: string; items?: string[] }>; notes?: string } | null | undefined);
  const logs = data?.logs ?? [];
  const generationQuota = data?.generationQuota ?? { limit: 2, used: 0, remaining: 2, daysRemaining: 30 };
  const canGenerateProgram = generationQuota.remaining > 0;
  const quotaLabel = `${generationQuota.remaining} of ${generationQuota.limit} remaining`;
  const cycleLabel = `${generationQuota.daysRemaining} day${generationQuota.daysRemaining === 1 ? "" : "s"} left in cycle`;
  const [programFocus, setProgramFocus] = useState("");
  const [injuryFocus, setInjuryFocus] = useState("");
  const [injuryFocusOpen, setInjuryFocusOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showCompletionConfetti, setShowCompletionConfetti] = useState(false);
  const [activeProgramTab, setActiveProgramTab] = useState("training");
  const [showGroceryList, setShowGroceryList] = useState(false);
  const [reportInjuryOpen, setReportInjuryOpen] = useState(false);
  const [injuryReport, setInjuryReport] = useState("");
  const [upgradeModalState, setUpgradeModalState] = useState<{ isOpen: boolean; feature: string; tier: "core" | "pro" | "elite" } | null>(null);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const groceryListRef = useRef<HTMLDivElement | null>(null);
  const completionConfettiTimeoutRef = useRef<number | null>(null);

  const scanProgramFile = trpc.chat.scanProgramFile.useMutation({
    onSuccess: (result) => {
      setIsUploading(false);
      if (result.imported) {
        toast.success("Program imported", { description: result.importMessage ?? "Your uploaded program has been saved to My Program." });
        void utils.myProgram.get.invalidate();
      } else {
        toast("Program reviewed", { description: result.importMessage ?? "JIMMI reviewed the file but could not extract a full program structure." });
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error("Upload failed", { description: error.message });
    },
  });

  const handleProgramUpload = async (file?: File) => {
    if (!file) return;
    if (!isCorePlus) {
      toast("Core feature", { description: "Uploading a program PDF is available on Core, Pro, and Elite plans." });
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const fileDataUrl = reader.result as string;
      scanProgramFile.mutate({ fileName: file.name, mimeType: file.type || "application/octet-stream", fileDataUrl });
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error("Could not read file", { description: "Please try a different file." });
    };
    reader.readAsDataURL(file);
  };
  const todayIso = useMemo(() => getLocalTodayIsoDate(), []);
  const triggerCompletionConfetti = () => {
    if (completionConfettiTimeoutRef.current) window.clearTimeout(completionConfettiTimeoutRef.current);
    setShowCompletionConfetti(false);
    window.requestAnimationFrame(() => {
      setShowCompletionConfetti(true);
      completionConfettiTimeoutRef.current = window.setTimeout(() => setShowCompletionConfetti(false), 3200);
    });
  };

  const generateProgram = trpc.myProgram.generate.useMutation({
    onMutate: () => {
      setGenerationProgress(8);
      setShowGenerationModal(true);
      setInjuryFocus("");
      setInjuryFocusOpen(false);
      if (completionConfettiTimeoutRef.current) window.clearTimeout(completionConfettiTimeoutRef.current);
      setShowCompletionConfetti(false);
    },
    onSuccess: () => {
      setGenerationProgress(100);
      triggerProgramCompletionHaptic();
      triggerCompletionConfetti();
      setShowGroceryList(false);
      setProgramFocus("");
      setInjuryFocus("");
      setInjuryFocusOpen(false);
      toast.success("Program generated", { description: "Your training, meal plan, and grocery list are ready in My Program." });
      void utils.myProgram.get.invalidate();
    },
    onError: (error) => {
      setGenerationProgress(0);
      toast.error("Could not generate program", { description: error.message });
    },
  });

  useEffect(() => {
    if (!generateProgram.isPending) return;
    const progressTimer = window.setInterval(() => {
      setGenerationProgress((current) => Math.min(current + 7, 92));
    }, 700);
    return () => window.clearInterval(progressTimer);
  }, [generateProgram.isPending]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (generateProgram.isPending) {
        e.preventDefault();
        e.returnValue = "Your program is still generating. Leaving now may cause the generation to fail. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [generateProgram.isPending]);

  useEffect(() => {
    return () => {
      if (completionConfettiTimeoutRef.current) window.clearTimeout(completionConfettiTimeoutRef.current);
    };
  }, []);

  const activeGenerationStep = generationSteps[Math.min(Math.floor((generationProgress / 100) * generationSteps.length), generationSteps.length - 1)];

  const regenerateExercise = trpc.myProgram.regenerateExercise.useMutation({
    onSuccess: () => {
      toast.success("Exercise replaced", { description: "A similar movement was added to your program." });
      void utils.myProgram.get.invalidate();
    },
    onError: (error) => toast.error("Could not replace exercise", { description: error.message }),
  });

  const regenerateMeal = trpc.myProgram.regenerateMeal.useMutation({
    onSuccess: () => {
      toast.success("Meal swapped", { description: "A new macro-aware option was added and your grocery list was refreshed." });
      void utils.myProgram.get.invalidate();
    },
    onError: (error) => toast.error("Could not swap meal", { description: error.message }),
  });

  const updateWorkoutDay = trpc.myProgram.updateWorkoutDay.useMutation({
    onSuccess: (_, variables) => {
      const message = variables.action === "complete" ? "Workout marked complete" : variables.action === "cancel" ? "Workout cancelled" : "Workout rescheduled";
      toast.success(message, { description: "Your training calendar has been updated." });
      void utils.myProgram.get.invalidate();
    },
    onError: (error) => toast.error("Could not update workout", { description: error.message }),
  });

  const adaptUpcomingWorkouts = trpc.myProgram.adaptUpcomingWorkouts.useMutation({
    onSuccess: (result) => {
      toast.success("Upcoming workouts adapted", { description: result.adaptation?.summary || "JIMMI updated your next sessions from your workout logs and notes." });
      void utils.myProgram.get.invalidate();
    },
    onError: (error) => toast.error("Could not adapt workouts", { description: error.message }),
  });
  const reportInjuryAdapt = trpc.myProgram.adaptUpcomingWorkouts.useMutation({
    onSuccess: (result) => {
      setReportInjuryOpen(false);
      setInjuryReport("");
      toast.success("Program updated for your injury", { description: result.adaptation?.summary || "JIMMI modified your upcoming workouts to work around your injury." });
      void utils.myProgram.get.invalidate();
    },
    onError: (error) => toast.error("Could not update program", { description: error.message }),
  });

  const openGroceryList = () => {
    setActiveProgramTab("meals");
    setShowGroceryList(true);
    window.setTimeout(() => groceryListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    if (groceryList?.categories?.length) {
      toast.success("Grocery list opened", { description: "Your list was generated with your meal plan." });
    } else {
      toast("Grocery list view opened", { description: "Generate a fresh plan if this saved plan was created before automatic groceries were added." });
    }
  };

  const logCountByExercise = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs as Array<{ exerciseKey?: string }>) counts.set(log.exerciseKey ?? "", (counts.get(log.exerciseKey ?? "") ?? 0) + 1);
    return counts;
  }, [logs]);

  const exportMealPlan = () => {
    if (!programRecord?.exportText) {
      toast("Generate a program first", { description: "Your meal plan export will be available after JIMMI creates My Program." });
      return;
    }
    downloadTextFile("jimmi-meal-plan.txt", programRecord.exportText);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {showCompletionConfetti ? <CompletionConfetti /> : null}
      <section className="container py-5 sm:py-7" data-my-program-vertical-spacing="tightened">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <JimmiWordmark variant="member" />
          <nav className="flex items-center gap-3 text-sm">
            <MemberMenu memberName={profile.firstName} avatarUrl={profile.avatarUrl} isLocalFallback={isLocalFallback} />
          </nav>
        </header>

        <Card className="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.13),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.09),transparent_28%),rgba(9,9,11,0.86)]">
          <CardHeader className="grid gap-4 p-5 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:p-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-200/90">Training + meals in one place</p>
              <CardTitle className="mt-3 font-display text-4xl font-light tracking-tight sm:text-5xl">{program?.title ?? "Your fitness goals start with a structured plan."}</CardTitle>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {program?.overview ?? "JIMMI will build a personalised training program and meal plan based on your profile."}
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Textarea
                id="program-focus"
                value={programFocus}
                onChange={(event) => setProgramFocus(event.target.value)}
                maxLength={500}
                rows={3}
                readOnly={generateProgram.isPending}
                data-my-program-focus-input="optional"
                placeholder={"Optional: describe a specific goal or focus (e.g. 'build upper body strength for a 5k in 8 weeks')"}
                className={`min-h-20 w-full rounded-[1.25rem] border-0 bg-black/20 text-sm shadow-none ring-1 ring-white/10 focus-visible:ring-primary/60 lg:w-80 ${generateProgram.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <div className="w-full lg:w-80">
                <button
                  type="button"
                  onClick={() => setInjuryFocusOpen((v) => !v)}
                  disabled={generateProgram.isPending}
                  className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:border-amber-400/50 hover:bg-amber-400/15 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-my-program-injury-input="toggle"
                >
                  <AlertTriangle className="size-3 shrink-0" />
                  <span>{injuryFocusOpen ? "Hide injury details" : "Working around an injury?"}</span>
                </button>
                {injuryFocusOpen && (
                  <Textarea
                    id="injury-focus"
                    value={injuryFocus}
                    onChange={(event) => setInjuryFocus(event.target.value)}
                    maxLength={500}
                    rows={2}
                    autoFocus
                    readOnly={generateProgram.isPending}
                    data-my-program-injury-input="optional"
                    placeholder="e.g. 'bad left knee — avoid high-impact lower body'"
                    className={`mt-2 min-h-14 w-full rounded-[1.25rem] border-0 bg-black/20 text-sm text-white/70 shadow-none ring-1 ring-white/[0.07] placeholder:text-white/25 focus-visible:ring-amber-400/40 ${generateProgram.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                )}
              </div>
              <div className="w-full space-y-2 lg:w-80" data-my-program-generation-quota="2-per-30-day-cycle">
                <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/75">
                  <span>{quotaLabel}</span>
                  <span className="text-white/45">{cycleLabel}</span>
                </div>
                <Button onClick={() => {
                  if (navigator.vibrate) {
                    navigator.vibrate([10, 5, 10]);
                  }
                  generateProgram.mutate({ programFocus: programFocus.trim() || undefined, injuryContext: injuryFocus.trim() || undefined });
                }} disabled={generateProgram.isPending || !canGenerateProgram} title={!canGenerateProgram ? `Your program generation limit resets in ${generationQuota.daysRemaining} day${generationQuota.daysRemaining === 1 ? "" : "s"}.` : undefined} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/35 sm:w-auto lg:w-full" data-my-program-generation-quota-action="enforced">
                  {generateProgram.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />} {generateProgram.isPending ? "Generating..." : canGenerateProgram ? "Generate Plan" : "Limit Reached"}
                </Button>
              </div>
              {program ? (
                <Button onClick={openGroceryList} variant="outline" className="w-full rounded-full border-sky-300/20 bg-sky-300/[0.06] text-sky-50 hover:bg-sky-300/[0.1] sm:w-auto" data-my-program-grocery-action="open-existing">
                  <ShoppingBasket className="mr-2 size-4" /> Grocery List
                </Button>
              ) : null}
              {programRecord?.exportText && isCorePlus ? (
                <Button onClick={exportMealPlan} variant="outline" className="w-full rounded-full border-white/10 bg-white/[0.03] sm:w-auto" data-my-program-export-action="generated-only">
                  <Download className="mr-2 size-4" /> Export Meal Plan
                </Button>
              ) : programRecord?.exportText && !isCorePlus ? (
                <Button onClick={() => setUpgradeModalState({ isOpen: true, feature: "Export Meal Plan", tier: "core" })} variant="outline" className="w-full rounded-full border-amber-300/20 bg-amber-300/[0.06] text-amber-50 hover:bg-amber-300/[0.1] sm:w-auto" data-my-program-export-action="locked">
                  <LockKeyhole className="mr-2 size-4" /> Export Meal Plan
                </Button>
              ) : null}
              {/* Upload Program button — Core+ only */}
              <label
                htmlFor="my-program-upload-input"
                role="button"
                tabIndex={0}
                data-my-program-upload-button="pdf-import"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") programUploadInputRef.current?.click(); }}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm transition sm:w-auto ${
                  isCorePlus
                    ? "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white/90"
                    : "border-white/[0.06] bg-white/[0.015] text-white/30 cursor-not-allowed"
                }`}
                onClick={(e) => { if (!isCorePlus) { e.preventDefault(); toast("Core feature", { description: "Upload a program PDF on Core, Pro, or Elite plans." }); } }}
              >
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : isCorePlus ? <FileUp className="size-4" /> : <LockKeyhole className="size-4" />}
                <span>{isUploading ? "Importing..." : "Upload Program"}</span>
                {!isCorePlus ? <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-amber-200">Core+</span> : null}
              </label>
              <input
                id="my-program-upload-input"
                ref={programUploadInputRef}
                type="file"
                accept="image/*,application/pdf,.txt,.md,.csv"
                className="sr-only"
                disabled={isUploading || !isCorePlus}
                onChange={(e) => { void handleProgramUpload(e.target.files?.[0]); e.currentTarget.value = ""; }}
              />
            </div>
          </CardHeader>
        </Card>

        {generateProgram.isPending ? (
          <div className="mt-4 rounded-[1.75rem] border border-sky-300/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.1),rgba(168,85,247,0.08))] p-5" role="status" aria-live="polite" data-my-program-generation-progress="visible">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-200">Generating your program</p>
                <p className="mt-2 text-sm text-muted-foreground" data-my-program-generation-step="active">{activeGenerationStep}</p>
              </div>
              <p className="font-mono text-xs text-violet-200">{generationProgress}%</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-violet-300 transition-all duration-500" style={{ width: `${generationProgress}%` }} data-my-program-generation-progress-bar="animated" />
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-8 rounded-[2rem] border border-white/10 bg-card p-8 text-center text-muted-foreground">Loading My Program...</div>
        ) : program ? (
          <>
            {/* Transparency Layer: Program Rationale & Methodology */}
            {program.durationRationale || program.phaseSummary?.length ? (
              <Card className="mt-5 border-violet-300/15 bg-white/[0.025]">
                <CardHeader className="pb-3">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-violet-200/90">Program Methodology</p>
                  <CardTitle className="mt-2 text-xl font-light">Why this program works for you</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {program.durationRationale ? (
                    <div>
                      <p className="text-sm leading-6 text-white/80">{program.durationRationale}</p>
                    </div>
                  ) : null}
                  {program.phaseSummary?.length ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-white/60">Program Phases</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {program.phaseSummary.map((phase, idx) => (
                          <div key={idx} className="rounded-lg border border-violet-300/10 bg-violet-300/[0.03] p-3">
                            <p className="text-xs font-semibold text-violet-200">{phase.phase}</p>
                            <p className="mt-1 text-xs text-white/70">{phase.focus}</p>
                            <p className="mt-1 text-[0.7rem] text-white/50">{phase.weeks}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {/* Progress Tracking Checkpoints */}
            {program.progressTracking?.length ? (
              <Card className="mt-4 border-lime-300/15 bg-white/[0.025]">
                <CardHeader className="pb-3">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-200/90">Progress Checkpoints</p>
                  <CardTitle className="mt-2 text-xl font-light">How to measure success</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {program.progressTracking.map((checkpoint, idx) => (
                      <div key={idx} className="flex gap-3 rounded-lg border border-lime-300/10 bg-lime-300/[0.03] p-3">
                        <div className="mt-0.5 shrink-0">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-300/20 text-xs font-semibold text-lime-200">{idx + 1}</div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-lime-50">{checkpoint.checkpoint}</p>
                          <p className="mt-0.5 text-xs text-white/70">{checkpoint.action}</p>
                          <p className="mt-1 text-[0.7rem] text-white/50">Metric: {checkpoint.metric}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Tabs value={activeProgramTab} onValueChange={setActiveProgramTab} className="mt-5">
              <TabsList className="grid w-full max-w-md grid-cols-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
                <TabsTrigger value="training" className="rounded-full"><Dumbbell className="mr-2 size-4" /> Training Plan</TabsTrigger>
                <TabsTrigger value="meals" className="rounded-full"><Utensils className="mr-2 size-4" /> Meal Plan</TabsTrigger>
              </TabsList>

            <TabsContent value="training" className="mt-4 space-y-4" data-my-program-workout-day-tabs="tap-to-open">
              <Card className="border-sky-300/15 bg-white/[0.035]" data-my-program-smart-workout-adaptation="uses-previous-logs-and-notes">
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-2xl">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-sky-200/90">Smart workout adaptation</p>
                    <h3 className="mt-2 font-display text-2xl font-light">Tune upcoming sessions from your logs</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">JIMMI reviews prior workout logs, completed sets, reps, weight, and notes to make smart modifications to upcoming scheduled workouts.</p>
                    {program.smartWorkoutAdaptation?.summary ? (
                      <div className="mt-3 rounded-[1rem] border border-lime-300/15 bg-lime-300/[0.05] p-3" data-my-program-smart-workout-adaptation-summary="latest">
                        <p className="text-sm text-lime-50">{program.smartWorkoutAdaptation.summary}</p>
                        {program.smartWorkoutAdaptation.evidenceUsed?.length ? <p className="mt-1 text-xs text-lime-100/70">Used: {program.smartWorkoutAdaptation.evidenceUsed.slice(0, 3).join(" · ")}</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <Button disabled={!programRecord?.id || adaptUpcomingWorkouts.isPending || !(logs as unknown[]).length} onClick={() => programRecord?.id ? adaptUpcomingWorkouts.mutate({ programId: programRecord.id }) : null} className="rounded-full bg-sky-200 px-5 text-sky-950 hover:bg-sky-100 disabled:bg-white/[0.04] disabled:text-white/35" data-my-program-smart-workout-adaptation-action="adapt-upcoming">
                      {adaptUpcomingWorkouts.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                      Adapt upcoming workouts
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!programRecord?.id}
                      onClick={() => setReportInjuryOpen(true)}
                      className="rounded-full border-amber-400/20 bg-amber-400/[0.05] px-5 text-amber-200/80 hover:border-amber-400/35 hover:bg-amber-400/[0.09] hover:text-amber-100 disabled:border-white/10 disabled:bg-transparent disabled:text-white/25"
                      data-my-program-report-injury-action="open-modal"
                    >
                      Report an injury
                    </Button>
                    {!(logs as unknown[]).length ? <p className="max-w-48 text-xs text-white/45 md:text-right">Log at least one exercise first so JIMMI has real performance data to review.</p> : null}
                  </div>
                </CardContent>
              </Card>
              <Tabs defaultValue="training-day-0">
                <TabsList className="flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-2">
                  {(program.trainingPlan ?? []).map((day, dayIndex) => {
                    const trainingDayLabel = formatTrainingDayLabel(day, dayIndex);
                    return (
                      <TabsTrigger key={`${trainingDayLabel}-trigger-${dayIndex}`} value={`training-day-${dayIndex}`} className="shrink-0 rounded-full px-4 py-2 text-xs" data-my-program-training-day-tab-label="scheduled-date">
                        {trainingDayLabel}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {(program.trainingPlan ?? []).map((day, dayIndex) => {
                  const isLockedDay = !isCorePlus && dayIndex >= 2;
                  const trainingDayLabel = formatTrainingDayLabel(day, dayIndex);
                  const canCompleteToday = day.scheduledDate === todayIso;
                  const completeDisabledReason = day.status === "completed"
                    ? "This workout has already been completed."
                    : !canCompleteToday
                      ? `Complete is available on ${day.dateLabel ?? day.scheduledDate ?? "the scheduled date"}.`
                      : undefined;
                  return (
                  <TabsContent key={`${day.day}-${dayIndex}`} value={`training-day-${dayIndex}`} className="mt-3">
                    <Card className={`border-white/10 bg-card/90 relative ${isLockedDay ? 'opacity-70' : ''}`}>
                      {isLockedDay && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/20 backdrop-blur-xs">
                          <LockKeyhole className="mb-2 size-8 text-white/70" />
                          <p className="text-sm font-semibold text-white">Upgrade to unlock</p>
                          <Button onClick={() => setUpgradeModalState({ isOpen: true, feature: "Full Training Program", tier: "core" })} className="mt-3 rounded-full text-xs">View Plans</Button>
                        </div>
                      )}
                      <CardHeader className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-mono text-xs uppercase tracking-[0.25em] text-sky-200/90" data-my-program-training-day-card-label="scheduled-date">{trainingDayLabel}</p>
                            <CardTitle className="font-display text-3xl font-light">{day.focus}</CardTitle>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end" data-my-program-workout-date-actions="complete-reschedule-cancel">
                            <span className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-white/80">
                              <CalendarDays className="mr-1.5 size-3.5 text-sky-200" /> {day.dateLabel ?? day.scheduledDate ?? "Date pending"}
                            </span>
                            <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[0.7rem] font-medium uppercase tracking-[0.16em] ${workoutStatusClass(day.status)}`} data-my-program-workout-status={day.status ?? "scheduled"}>
                              {workoutStatusLabel(day.status)}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">Warm-up: {day.warmup}</p>
                        <p className="text-xs text-muted-foreground">Recovery guidance: {day.recoveryWindow ?? "Rest or active recovery on the days between scheduled workouts."}</p>
                        {day.adaptationNote ? <p className="rounded-[0.9rem] border border-sky-300/15 bg-sky-300/[0.05] p-3 text-xs leading-5 text-sky-50" data-my-program-smart-workout-adaptation-note="day-level">Smart adjustment: {day.adaptationNote}</p> : null}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button size="sm" disabled={updateWorkoutDay.isPending || day.status === "completed" || !canCompleteToday} title={completeDisabledReason} onClick={() => updateWorkoutDay.mutate({ dayIndex, action: "complete" })} className="h-8 rounded-full bg-lime-300 px-3 text-[0.7rem] uppercase tracking-[0.16em] text-lime-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/35" data-my-program-workout-action="complete" data-my-program-workout-complete-guard="scheduled-date-only">
                            <Check className="mr-1.5 size-3.5" /> Complete
                          </Button>
                          <WorkoutRescheduleDialog day={day} dayIndex={dayIndex} trainingPlan={program.trainingPlan ?? []} todayIso={todayIso} disabled={updateWorkoutDay.isPending} onReschedule={(index, scheduledDate) => updateWorkoutDay.mutate({ dayIndex: index, action: "reschedule", scheduledDate })} />
                          <WorkoutCancelConfirmDialog day={day} dayIndex={dayIndex} disabled={updateWorkoutDay.isPending} onCancel={(index) => updateWorkoutDay.mutate({ dayIndex: index, action: "cancel" })} />
                          {completeDisabledReason && day.status !== "completed" ? (
                            <span className="w-full text-xs text-white/45 sm:w-auto" data-my-program-workout-complete-note="scheduled-date-only">{completeDisabledReason}</span>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2.5 px-5 pb-5">
                        {(day.exercises ?? []).map((exercise, exerciseIndex) => {
                          const exerciseKey = exercise.key || `${dayIndex}-${exerciseIndex}-${exercise.name}`;
                          return (
                            <div key={exerciseKey} className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                  <h3 className="text-lg font-semibold">{exercise.name}</h3>
                                  <p className="mt-1 text-sm text-muted-foreground">{exercise.sets} sets · {exercise.reps} reps · Rest {exercise.rest}</p>
                                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{exercise.cues}</p>
                                  {logCountByExercise.get(exerciseKey) ? <p className="mt-2 text-xs text-primary">Logged {logCountByExercise.get(exerciseKey)} time{logCountByExercise.get(exerciseKey) === 1 ? "" : "s"}</p> : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <ExerciseLogDialog programId={programRecord.id} exercise={{ ...exercise, key: exerciseKey }} onSaved={() => void utils.myProgram.get.invalidate()} />
                                  <a href={exercise.youtubeUrl || youtubeSearchUrl(exercise.name || "exercise")} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-[0.7rem] font-medium uppercase tracking-[0.16em] transition hover:border-primary/50 hover:text-primary">
                                    <Play className="mr-1.5 size-3.5" /> Play
                                  </a>
                                  <Button size="sm" variant="outline" disabled={regenerateExercise.isPending} onClick={() => regenerateExercise.mutate({ exerciseKey, exerciseName: exercise.name || "Exercise", reason: "movement is too advanced, uncomfortable, or unavailable" })} className="h-8 rounded-full border-white/10 bg-white/[0.03] px-3 text-[0.7rem] uppercase tracking-[0.16em]">
                                    <RefreshCcw className="mr-1.5 size-3.5" /> Swap
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  );
                })}
              </Tabs>
            </TabsContent>

            <TabsContent value="meals" className="mt-4 max-w-full space-y-4 overflow-hidden" data-my-program-meal-plan-fit="no-horizontal-page-scroll">
              {!isCorePlus ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/15 p-6 text-center">
                  <LockKeyhole className="mb-3 size-8 text-white/40" />
                  <h3 className="text-lg font-semibold">Meal Plans are a Core+ feature</h3>
                  <p className="mt-2 text-sm text-white/60">Upgrade to Core, Pro, or Elite to unlock personalized meal planning and nutrition tracking.</p>
                  <Button onClick={() => setUpgradeModalState({ isOpen: true, feature: "Meal Plans", tier: "core" })} className="mt-4 rounded-full">View Plans</Button>
                </div>
              ) : (
              <div className={`grid min-w-0 max-w-full gap-4 ${showGroceryList ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)]" : "lg:grid-cols-1"}`}>
                <div className="min-w-0 max-w-full" data-my-program-meal-day-tabs="tap-to-open">
                  <Tabs defaultValue="meal-day-0" className="min-w-0 max-w-full">
                    <TabsList className="flex h-auto w-full max-w-full justify-start gap-2 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-2" data-my-program-meal-day-scroll="horizontal">
                      {(program.mealPlan?.days ?? []).map((day, dayIndex) => (
                        <TabsTrigger key={`${day.day}-meal-trigger-${dayIndex}`} value={`meal-day-${dayIndex}`} className="shrink-0 rounded-full px-4 py-2 text-xs">
                          {day.day ?? `Day ${dayIndex + 1}`}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {(program.mealPlan?.days ?? []).map((day, dayIndex) => (
                      <TabsContent key={`${day.day}-${dayIndex}`} value={`meal-day-${dayIndex}`} className="mt-3 min-w-0 max-w-full overflow-hidden">
                        <Card className="min-w-0 max-w-full overflow-hidden border-white/10 bg-card/90">
                          <CardHeader className="p-5">
                            <p className="font-mono text-xs uppercase tracking-[0.25em] text-violet-200/90">Macro-aligned meals</p>
                            <CardTitle className="font-display text-3xl font-light">{day.day}</CardTitle>
                          </CardHeader>
                          <CardContent className="grid min-w-0 gap-2.5 px-4 pb-5 sm:px-5 md:grid-cols-2">
                            {(day.meals ?? []).map((meal, mealIndex) => (
                              <div key={`${meal.name}-${mealIndex}`} className="relative min-w-0 max-w-full rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-3.5 pr-12" data-my-program-meal-swap="top-right-compact">
                                <Button size="icon" variant="outline" aria-label={`Swap ${meal.mealType ?? "meal"}`} title="Swap meal" disabled={regenerateMeal.isPending} onClick={() => regenerateMeal.mutate({ dayIndex, mealIndex, mealName: meal.name || "Meal", mealType: meal.mealType || "Meal", reason: "the user would prefer another macro-aligned option" })} className="absolute right-3 top-3 size-7 rounded-full border-white/10 bg-white/[0.03] p-0 text-white/70 transition hover:border-primary/50 hover:text-primary" data-my-program-meal-swap-button="compact-top-right">
                                  {regenerateMeal.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCcw className="size-3" />}
                                </Button>
                                <div className="min-w-0">
                                  <div className="min-w-0">
                                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">{meal.mealType}</p>
                                    <h3 className="mt-2 break-words text-lg font-semibold">{meal.name}</h3>
                                  </div>
                                </div>
                                <p className="mt-2 break-words text-sm text-muted-foreground">{formatMacro(meal.calories)} cal · P {formatMacro(meal.protein, "g")} · C {formatMacro(meal.carbs, "g")} · F {formatMacro(meal.fat, "g")}</p>
                                <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">{meal.notes}</p>
                                <p className="mt-3 break-words text-xs text-muted-foreground">Ingredients: {(meal.ingredients ?? []).join(", ")}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
                {showGroceryList ? (
                  <div ref={groceryListRef} className="min-w-0 max-w-full" data-my-program-grocery-scroll-target="true">
                    <Card className="h-fit min-w-0 max-w-full overflow-hidden border-sky-300/15 bg-card/90" data-my-program-grocery-list="opens-existing-list">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-3xl font-light"><ShoppingBasket className="size-6 text-primary" /> Grocery List</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!groceryList?.categories?.length ? <p className="rounded-[1rem] border border-dashed border-white/15 p-4 text-sm text-muted-foreground">Your grocery list will appear automatically after JIMMI generates a fresh plan.</p> : groceryList.categories.map((category, index) => (
                        <div key={`${category.name}-${index}`}>
                          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-sky-200/90">{category.name}</h4>
                          <ul className="mt-2 space-y-1 break-words text-sm text-muted-foreground">
                            {(category.items ?? []).map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        </div>
                      ))}
                      {groceryList?.notes ? <p className="text-sm text-muted-foreground">{groceryList.notes}</p> : null}
                      {programRecord.exportText && isCorePlus ? <Button onClick={exportMealPlan} className="w-full rounded-full"><ExternalLink className="mr-2 size-4" /> Export Meal Plan</Button> : null}
                    </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
              )}
            </TabsContent>
          </Tabs>
          </>
        ) : null}
      </section>

      {/* Report Injury Modal */}
      <Dialog open={reportInjuryOpen} onOpenChange={(open) => { if (!reportInjuryAdapt.isPending) setReportInjuryOpen(open); }}>
        <DialogContent className="max-w-md rounded-[1.5rem] border border-white/10 bg-[#1a1a1a] p-6">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400/80" />
              <DialogTitle className="font-display text-xl font-light">Report an injury</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-6 text-white/50">
              Describe what you're dealing with and JIMMI will modify your upcoming workouts to work around it safely.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Textarea
              value={injuryReport}
              onChange={(e) => setInjuryReport(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="e.g. 'Strained my right shoulder — avoid overhead pressing and heavy pulling for the next 2 weeks'"
              className="rounded-[1.1rem] border-0 bg-black/30 text-sm text-white/80 shadow-none ring-1 ring-white/10 placeholder:text-white/25 focus-visible:ring-amber-400/40"
              disabled={reportInjuryAdapt.isPending}
            />
            <p className="mt-2 text-right font-mono text-[0.6rem] text-white/25">{injuryReport.length}/500</p>
          </div>
          <DialogFooter className="mt-1 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setReportInjuryOpen(false)}
              disabled={reportInjuryAdapt.isPending}
              className="rounded-full border-white/10 bg-transparent text-white/50 hover:bg-white/[0.04] hover:text-white/70"
            >
              Cancel
            </Button>
            <Button
              disabled={!injuryReport.trim() || reportInjuryAdapt.isPending || !programRecord?.id}
              onClick={() => programRecord?.id ? reportInjuryAdapt.mutate({ programId: programRecord.id, injuryContext: injuryReport.trim() }) : null}
              className="rounded-full bg-amber-400/90 px-5 text-amber-950 hover:bg-amber-400 disabled:bg-white/[0.06] disabled:text-white/30"
            >
              {reportInjuryAdapt.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" /> Updating program...</> : <><Sparkles className="mr-2 size-4" /> Update my program</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {upgradeModalState && (
        <UpgradeModal
          isOpen={upgradeModalState.isOpen}
          onClose={() => setUpgradeModalState(null)}
          featureName={upgradeModalState.feature}
          requiredTier={upgradeModalState.tier}
          description={`${upgradeModalState.feature} is available on Core, Pro, and Elite plans.`}
        />
      )}

      {/* Generation in progress modal */}
      <Dialog open={showGenerationModal} onOpenChange={(open) => setShowGenerationModal(open)}>
        <DialogContent className="max-w-md rounded-[1.5rem] border border-sky-300/20 bg-[#1a1a1a] p-6" onPointerDownOutside={(e) => e.preventDefault()}>

          <DialogHeader>
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="size-4 text-sky-300" />
              <DialogTitle className="font-display text-xl font-light">Program generating</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-6 text-white/50">
              Please stay on this page while your personalized training plan, meal plan, and grocery list are being created. Leaving now may cause the generation to fail.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/70">{activeGenerationStep}</p>
                <p className="font-mono text-xs text-sky-300">{generationProgress}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-violet-300 transition-all duration-500" style={{ width: `${generationProgress}%` }} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
