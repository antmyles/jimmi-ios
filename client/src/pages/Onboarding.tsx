import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { shouldRouteMicrophoneThroughJimmiDomain, redirectToJimmiPublicDomainForMicrophone } from "@/lib/jimmiBranding";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { getMobileAwareChatEntryPath } from "@/lib/chatTransition";
import { UNAUTHED_ERR_MSG } from "@shared/const";

type MicSetupStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "preview-host";

type OnboardingForm = {
  name: string;
  birthday: string;
  gender: string;
  weight: string;
  height: string;
  healthComplications: string[];
  otherHealthComplication: string;
  dietRestrictions: string[];
  dietaryPreferences: string;
  foodAllergies: string[];
  otherFoodAllergy: string;
  fitnessLevel: string;
  activityLevel: string;
  fitnessGoals: string[];
  targetWeight: string;
  additionalInfo: string;
  eventType: string;
  weeksUntilRace: string;
  currentWeeklyVolume: string;
  previousRaceTimes: string;
  availableTrainingDaysPerWeek: string;
};

const STORAGE_KEY = "jimmi-onboarding-draft";
const PENDING_SUBMIT_KEY = "jimmi-onboarding-pending-submit";
const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";
const RESUME_SUBMIT_PARAM = "resumeOnboarding";
const RESUME_DRAFT_PARAM = "resumeDraft";

const emptyForm: OnboardingForm = {
  name: "",
  birthday: "",
  gender: "",
  weight: "",
  height: "",
  healthComplications: [],
  otherHealthComplication: "",
  dietRestrictions: [],
  dietaryPreferences: "",
  foodAllergies: [],
  otherFoodAllergy: "",
  fitnessLevel: "",
  activityLevel: "",
  fitnessGoals: [],
  targetWeight: "",
  additionalInfo: "",
  eventType: "",
  weeksUntilRace: "",
  currentWeeklyVolume: "",
  previousRaceTimes: "",
  availableTrainingDaysPerWeek: "",
};

type ChoiceOption = {
  value: string;
  description: string;
};

const genderOptions = ["Male", "Female"];
const activityOptions: ChoiceOption[] = [
  { value: "Sedentary", description: "Little to no structured exercise, often paired with a desk-based or mostly seated day." },
  { value: "Lightly active", description: "Light movement or easy workouts about 1-3 days per week, such as walking or casual training." },
  { value: "Moderately active", description: "Consistent workouts about 3-5 days per week with a mix of strength, cardio, classes, or sports." },
  { value: "Very active", description: "Hard training, physically demanding work, or purposeful exercise most days of the week." },
  { value: "Athlete-level activity", description: "Structured performance training, sport practice, or high-volume sessions nearly every day." },
];
const fitnessLevelOptions: ChoiceOption[] = [
  { value: "Beginner", description: "You are new to structured training or want simple coaching from the ground up." },
  { value: "Returning after time away", description: "You have trained before but are rebuilding consistency, confidence, or capacity." },
  { value: "Intermediate", description: "You train consistently and understand basic movement patterns, but still want guided progression." },
  { value: "Advanced", description: "You are experienced with structured programs, heavier loads, and more specific performance targets." },
  { value: "Competitive athlete", description: "You train for competition, events, sport performance, or demanding measurable outcomes." },
];
const healthOptions = ["None", "High blood pressure", "Hypertension", "Diabetes", "Asthma", "Rheumatoid arthritis", "Joint pain", "Back pain", "Heart condition", "High cholesterol", "Obesity", "Pregnancy/postpartum", "Other"];
const pregnancyHealthOption = "Pregnancy/postpartum";
const dietOptions = ["None", "Vegetarian", "Vegan", "Pescatarian", "Keto", "Low-carb", "Halal", "Kosher", "Other"];
const allergyOptions = ["None", "Peanuts", "Tree nuts", "Gluten", "Dairy", "Eggs", "Shellfish", "Fish", "Soy", "Wheat", "Sesame", "Other"];
const legacyDietAllergyMap = new Map([
  ["Gluten-free", "Gluten"],
  ["Dairy-free", "Dairy"],
]);
const goalOptions: ChoiceOption[] = [
  { value: "Lose weight", description: "Reduce body weight with sustainable nutrition habits, training structure, and recovery-aware pacing." },
  { value: "Build muscle", description: "Add lean muscle through progressive strength training, recovery, and protein-aware nutrition." },
  { value: "Tone and define", description: "Improve muscular definition with strength work, conditioning, and habits that support a leaner look." },
  { value: "Athletic performance", description: "Train toward sport, speed, power, stamina, agility, or measurable performance outcomes." },
  { value: "Improve mobility", description: "Move with better range, control, and comfort through flexibility and joint-friendly training." },
  { value: "Improve recovery", description: "Prioritize soreness management, sleep quality, deloading, and sustainable training rhythm." },
];
const eventTypeOptions: ChoiceOption[] = [
  { value: "General Fitness", description: "Focus on general fitness and wellness" },
  { value: "5K", description: "Training for a 5-kilometer running race" },
  { value: "10K", description: "Training for a 10-kilometer running race" },
  { value: "Half Marathon", description: "Training for a half marathon (13.1 miles)" },
  { value: "Marathon", description: "Training for a full marathon (26.2 miles)" },
  { value: "Triathlon", description: "Training for a triathlon (swim, bike, run)" },
  { value: "Hyrox", description: "Training for a Hyrox functional fitness race" },
];
const steps = ["Basics", "Activity", "Fitness", "Goal", "Event", "Nutrition", "Health", "Review"];
const weightLossGoal = "Lose weight";

const heightOptions = Array.from({ length: 31 }, (_, index) => {
  const totalInches = 54 + index;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet} ft ${inches} in`;
});

function splitList(value?: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeOtherSelection(values: string[] = [], otherValue = "") {
  let otherDetail = otherValue.trim();
  const normalizedValues = values.map((item) => {
    const trimmed = item.trim();
    if (trimmed.toLowerCase().startsWith("other:")) {
      otherDetail = otherDetail || trimmed.replace(/^other:\s*/i, "").trim();
      return "Other";
    }
    return trimmed;
  });
  return { values: uniqueList(normalizedValues), otherDetail };
}

function normalizeDietRestrictionSelection(dietRestrictions: string[] = []) {
  const normalizedValues = uniqueList(dietRestrictions.map((item) => item.trim()).filter(Boolean)).filter((item) => !legacyDietAllergyMap.has(item));
  if (normalizedValues.includes("None")) return ["None"];
  return normalizedValues.slice(0, 1);
}

function extractLegacyDietAllergies(dietRestrictions: string[] = []) {
  return dietRestrictions.map((item) => legacyDietAllergyMap.get(item.trim())).filter((item): item is string => Boolean(item));
}

function normalizeFoodAllergySelection(foodAllergies: string[] = [], otherFoodAllergy = "") {
  const normalized = normalizeOtherSelection(foodAllergies, otherFoodAllergy);
  return { foodAllergies: normalized.values, otherFoodAllergy: normalized.otherDetail };
}

function normalizeHealthComplicationSelection(healthComplications: string[] = [], otherHealthComplication = "", gender = "") {
  const normalized = normalizeOtherSelection(healthComplications, otherHealthComplication);
  const values = gender === "Male" ? normalized.values.filter((item) => item !== pregnancyHealthOption) : normalized.values;
  return { healthComplications: values, otherHealthComplication: normalized.otherDetail };
}

function cleanOtherDetail(value: string) {
  return value.trim().replace(/\s*,\s*/g, "; ");
}

function parseWeightValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateBirthdayAge(birthday: string, today = new Date()) {
  const birthDate = new Date(`${birthday}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function latestBirthdayForMinimumAge(minimumAge: number) {
  const today = new Date();
  const latest = new Date(Date.UTC(today.getUTCFullYear() - minimumAge, today.getUTCMonth(), today.getUTCDate()));
  return latest.toISOString().slice(0, 10);
}

const minimumBirthday = latestBirthdayForMinimumAge(8);
const birthdaySample = "2014-05-09";

function getOnboardingProgressTone(progress: number) {
  if (progress <= 33) {
    return {
      label: "low",
      className: "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.34)]",
      textClassName: "text-red-400",
    };
  }

  if (progress <= 74) {
    return {
      label: "mid",
      className: "bg-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.30)]",
      textClassName: "text-yellow-300",
    };
  }

  return {
    label: "high",
    className: "bg-green-500 shadow-[0_0_16px_rgba(34,197,94,0.32)]",
    textClassName: "text-green-400",
  };
}

function parseResumeDraft(search: string) {
  const params = new URLSearchParams(search);
  const encodedDraft = params.get(RESUME_DRAFT_PARAM);
  if (!encodedDraft) return null;
  try {
    return JSON.parse(encodedDraft) as Partial<OnboardingForm> & { fitnessGoal?: string };
  } catch {
    return null;
  }
}


function buildLocalProfile(form: OnboardingForm) {
  return {
    firstName: form.name.trim() || "there",
    birthday: form.birthday,
    gender: form.gender.trim(),
    weight: Number(form.weight) || 0,
    targetWeight: form.targetWeight ? Number(form.targetWeight) : null,
    height: form.height.trim(),
    healthComplications: serializeHealthComplications(form.healthComplications, form.otherHealthComplication),
    dietRestrictions: form.dietRestrictions.join(", "),
    dietaryPreferences: form.dietaryPreferences.trim() || null,
    foodAllergies: serializeFoodAllergies(form.foodAllergies, form.otherFoodAllergy),
    fitnessLevel: form.fitnessLevel,
    activityLevel: form.activityLevel,
    fitnessGoals: form.fitnessGoals.join(", "),
    additionalInfo: form.additionalInfo.trim() || null,
    onboardingComplete: true,
    tourSeen: false,
  };
}

function serializeOtherSelection(values: string[], otherValue: string) {
  const otherDetail = cleanOtherDetail(otherValue);
  return values.map((value) => value === "Other" && otherDetail ? `Other: ${otherDetail}` : value);
}

function serializeFoodAllergies(foodAllergies: string[], otherFoodAllergy: string) {
  return serializeOtherSelection(foodAllergies, otherFoodAllergy);
}

function serializeHealthComplications(healthComplications: string[], otherHealthComplication: string) {
  return serializeOtherSelection(healthComplications, otherHealthComplication);
}

function formatFoodAllergies(foodAllergies: string[], otherFoodAllergy: string) {
  return serializeFoodAllergies(foodAllergies, otherFoodAllergy).join(", ");
}

function formatHealthComplications(healthComplications: string[], otherHealthComplication: string) {
  return serializeHealthComplications(healthComplications, otherHealthComplication).join(", ");
}

function Field({ label, error, children, hint, required = true }: { label: string; error?: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">{label}{required ? <span className="ml-1 text-red-400" aria-hidden="true">*</span> : null}</span>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-4 focus:ring-primary/10" />;
}

function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-foreground outline-none transition focus:border-primary/70 focus:ring-4 focus:ring-primary/10">
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function HeightScrollSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="max-h-44 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.035] p-2 [scrollbar-color:rgba(201,184,154,0.42)_rgba(255,255,255,0.06)] [scrollbar-width:thin]">
      <div className="grid gap-2">
        {heightOptions.map((option) => {
          const selected = value === option;
          return (
            <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-xl px-4 py-2 text-left text-sm transition ${selected ? "border border-[#8fe8d8]/70 bg-[#8fe8d8]/10 text-foreground shadow-[0_0_22px_rgba(143,232,216,0.10)]" : "border border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.05] hover:text-foreground"}`}>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceCardGrid({ value, options, onChange, columns }: { value: string; options: ChoiceOption[]; onChange: (next: string) => void; columns: string }) {
  const compactWidth = columns.includes("lg:grid-cols-4") ? "max-w-2xl" : "max-w-2xl";

  return (
    <div className={`mx-auto ${compactWidth} overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20`} data-choice-layout="luxury-list-rows">
      {options.map((option, index) => {
        const selected = value === option.value;
        const tileNumber = String(index + 1).padStart(2, "0");
        return (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} aria-pressed={selected} className={`group flex w-full items-center gap-4 border-b border-white/10 px-4 py-4 text-left transition last:border-b-0 focus:outline-none focus:ring-4 focus:ring-primary/15 sm:px-5 ${selected ? "bg-[linear-gradient(90deg,rgba(143,232,216,0.13),rgba(255,255,255,0.026))] text-foreground" : "bg-transparent text-muted-foreground hover:bg-white/[0.035] hover:text-foreground"}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[0.62rem] uppercase tracking-[0.18em] transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] text-black shadow-[0_0_18px_rgba(143,232,216,0.26)]" : "border-white/15 text-muted-foreground group-hover:border-[#8fe8d8]/60 group-hover:text-[#8fe8d8]"}`} aria-hidden="true">{tileNumber}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-light leading-none tracking-tight text-foreground">{option.value}</span>
              <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
            </span>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] shadow-[0_0_14px_rgba(143,232,216,0.30)]" : "border-white/25 group-hover:border-[#8fe8d8]/70"}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceCardGrid({ value, options, onChange, columns }: { value: string[]; options: ChoiceOption[]; onChange: (next: string[]) => void; columns: string }) {
  const compactWidth = columns.includes("lg:grid-cols-4") ? "max-w-2xl" : "max-w-2xl";
  const toggle = (option: string) => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);

  return (
    <div className={`mx-auto ${compactWidth} overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20`} data-choice-layout="luxury-list-rows" data-choice-mode="multi-select">
      {options.map((option, index) => {
        const selected = value.includes(option.value);
        const tileNumber = String(index + 1).padStart(2, "0");
        return (
          <button key={option.value} type="button" onClick={() => toggle(option.value)} aria-pressed={selected} className={`group flex w-full items-center gap-4 border-b border-white/10 px-4 py-4 text-left transition last:border-b-0 focus:outline-none focus:ring-4 focus:ring-primary/15 sm:px-5 ${selected ? "bg-[linear-gradient(90deg,rgba(143,232,216,0.13),rgba(255,255,255,0.026))] text-foreground" : "bg-transparent text-muted-foreground hover:bg-white/[0.035] hover:text-foreground"}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[0.62rem] uppercase tracking-[0.18em] transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] text-black shadow-[0_0_18px_rgba(143,232,216,0.26)]" : "border-white/15 text-muted-foreground group-hover:border-[#8fe8d8]/60 group-hover:text-[#8fe8d8]"}`} aria-hidden="true">{tileNumber}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-light leading-none tracking-tight text-foreground">{option.value}</span>
              <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
            </span>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] text-black shadow-[0_0_14px_rgba(143,232,216,0.30)]" : "border-white/25 group-hover:border-[#8fe8d8]/70"}`} aria-hidden="true">
              {selected ? <span className="h-1.5 w-1.5 rounded-full bg-black" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HealthConditionColumnGrid({ value, options, onChange }: { value: string[]; options: string[]; onChange: (next: string[]) => void }) {
  const toggle = (option: string) => {
    if (option === "None") return onChange(value.includes("None") ? [] : ["None"]);
    const withoutNone = value.filter((item) => item !== "None");
    onChange(withoutNone.includes(option) ? withoutNone.filter((item) => item !== option) : [...withoutNone, option]);
  };

  return (
    <div className="space-y-3" data-health-layout="two-column-health-grid" data-health-control="compact-multi-select-columns" data-choice-mode="multi-select">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
        <span className={`shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.18em] ${value.length > 0 ? "text-[#8fe8d8]" : "text-primary"}`}>{value.length > 0 ? `${value.length} selected` : "Multi-select"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button key={option} type="button" onClick={() => toggle(option)} aria-pressed={selected} className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs leading-4 transition focus:outline-none focus:ring-4 focus:ring-primary/15 sm:text-sm xl:text-xs ${selected ? "border-[#8fe8d8]/80 bg-[#8fe8d8]/12 text-foreground shadow-[0_0_20px_rgba(143,232,216,0.12)]" : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-[#8fe8d8]/50 hover:bg-white/[0.06] hover:text-foreground"}`}>
              <span>{option}</span>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] shadow-[0_0_14px_rgba(143,232,216,0.30)]" : "border-white/25"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SingleSelectDropdown({ value, options, onChange, placeholder }: { value: string[]; options: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedValue = value[0] ?? "";
  const selectedSummary = selectedValue || placeholder;
  const chooseSingleOption = (option: string) => {
    const nextValue = selectedValue === option ? [] : [option];
    onChange(nextValue);
    detailsRef.current?.removeAttribute("open");
  };

  return (
    <details ref={detailsRef} className="group rounded-2xl border border-white/10 bg-white/[0.035]" data-nutrition-control="compact-single-select-dropdown" data-single-select-autocollapse="true">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left text-sm text-foreground outline-none transition marker:hidden focus:ring-4 focus:ring-primary/10 group-open:border-b group-open:border-white/10 [&::-webkit-details-marker]:hidden">
        <span className={selectedValue ? "text-foreground" : "text-muted-foreground"}>{selectedSummary}</span>
        {selectedValue ? null : <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-primary">Open</span>}
      </summary>
      <div className="max-h-64 overflow-y-auto p-2 [scrollbar-color:rgba(201,184,154,0.42)_rgba(255,255,255,0.06)] [scrollbar-width:thin]">
        {options.map((option) => {
          const selected = selectedValue === option;
          return (
            <button key={option} type="button" onClick={() => chooseSingleOption(option)} aria-pressed={selected} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${selected ? "bg-[#8fe8d8]/10 text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>
              <span>{option}</span>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] shadow-[0_0_14px_rgba(143,232,216,0.30)]" : "border-white/25"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </details>
  );
}

function MultiSelectDropdown({ value, options, onChange, placeholder }: { value: string[]; options: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const toggle = (option: string) => {
    if (option === "None") {
      onChange(value.includes("None") ? [] : ["None"]);
      detailsRef.current?.removeAttribute("open");
      return;
    }
    const withoutNone = value.filter((item) => item !== "None");
    onChange(withoutNone.includes(option) ? withoutNone.filter((item) => item !== option) : [...withoutNone, option]);
  };
  const selectedSummary = value.length > 0 ? value.join(", ") : placeholder;

  return (
    <details ref={detailsRef} className="group rounded-2xl border border-white/10 bg-white/[0.035]" data-nutrition-control="compact-multi-select-dropdown" data-none-autocollapse="true">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left text-sm text-foreground outline-none transition marker:hidden focus:ring-4 focus:ring-primary/10 group-open:border-b group-open:border-white/10 [&::-webkit-details-marker]:hidden">
        <span className={value.length > 0 ? "text-foreground" : "text-muted-foreground"}>{selectedSummary}</span>
        <span className={`shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.18em] ${value.length > 0 ? "text-[#8fe8d8]" : "text-primary"}`}>{value.length > 0 ? `${value.length} selected` : "Open"}</span>
      </summary>
      <div className="max-h-64 overflow-y-auto p-2 [scrollbar-color:rgba(201,184,154,0.42)_rgba(255,255,255,0.06)] [scrollbar-width:thin]">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button key={option} type="button" onClick={() => toggle(option)} aria-pressed={selected} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${selected ? "bg-[#8fe8d8]/10 text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>
              <span>{option}</span>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] shadow-[0_0_14px_rgba(143,232,216,0.30)]" : "border-white/25"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </details>
  );
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof OnboardingForm, boolean>>>({});
  const [attemptedSteps, setAttemptedSteps] = useState<Record<number, boolean>>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [pendingAuthSubmit, setPendingAuthSubmit] = useState(false);
  const [showMicSetup, setShowMicSetup] = useState(false);
  const [micSetupStatus, setMicSetupStatus] = useState<MicSetupStatus>("idle");
  const utils = trpc.useUtils();

  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const completeMutation = trpc.onboarding.complete.useMutation({
    onSuccess: async () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PENDING_SUBMIT_KEY);
      setPendingAuthSubmit(false);
      await utils.onboarding.get.invalidate();
      setShowMicSetup(true);
    },
    onError: (error) => {
      if (error.message === UNAUTHED_ERR_MSG) return;
      localStorage.removeItem(PENDING_SUBMIT_KEY);
      setPendingAuthSubmit(false);
    },
  });

  useEffect(() => {
    const resumeDraft = typeof window === "undefined" ? null : parseResumeDraft(window.location.search);
    const saved = localStorage.getItem(STORAGE_KEY);
    const hasResumeSubmit = typeof window !== "undefined" && new URLSearchParams(window.location.search).get(RESUME_SUBMIT_PARAM) === "1";
    const shouldResumeSubmit = hasResumeSubmit || localStorage.getItem(PENDING_SUBMIT_KEY) === "true";
    setPendingAuthSubmit(shouldResumeSubmit);
    const draftSource = resumeDraft ? JSON.stringify(resumeDraft) : saved;
    if (draftSource) {
      try {
          const parsed = typeof draftSource === "string" ? JSON.parse(draftSource) as Partial<OnboardingForm> & { fitnessGoal?: string } : draftSource;
          const parsedDietRestrictions = Array.isArray(parsed.dietRestrictions) ? parsed.dietRestrictions : [];
          const savedDietRestrictions = normalizeDietRestrictionSelection(parsedDietRestrictions);
          const savedAllergies = normalizeFoodAllergySelection([...(Array.isArray(parsed.foodAllergies) ? parsed.foodAllergies : []), ...extractLegacyDietAllergies(parsedDietRestrictions)], parsed.otherFoodAllergy);
          const savedHealth = normalizeHealthComplicationSelection(Array.isArray(parsed.healthComplications) ? parsed.healthComplications : [], parsed.otherHealthComplication, parsed.gender);
          setForm({
            ...emptyForm,
            ...parsed,
            dietRestrictions: savedDietRestrictions,
            dietaryPreferences: typeof parsed.dietaryPreferences === "string" ? parsed.dietaryPreferences : "",
            healthComplications: savedHealth.healthComplications,
            otherHealthComplication: savedHealth.otherHealthComplication,
            foodAllergies: savedAllergies.foodAllergies,
            otherFoodAllergy: savedAllergies.otherFoodAllergy,
            fitnessGoals: Array.isArray(parsed.fitnessGoals) ? parsed.fitnessGoals : parsed.fitnessGoal ? [parsed.fitnessGoal] : [],
            targetWeight: parsed.targetWeight ? String(parsed.targetWeight) : "",
          });
          if (shouldResumeSubmit) setStep(steps.length - 1);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PENDING_SUBMIT_KEY);
        setPendingAuthSubmit(false);
      }
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!profileQuery.data || pendingAuthSubmit) return;
    const savedDietRestrictionsSource = splitList(profileQuery.data.dietRestrictions);
    const savedAllergies = normalizeFoodAllergySelection([...splitList(profileQuery.data.foodAllergies), ...extractLegacyDietAllergies(savedDietRestrictionsSource)]);
    const savedHealth = normalizeHealthComplicationSelection(splitList(profileQuery.data.healthComplications), "", profileQuery.data.gender ?? "");
    setForm({
      name: profileQuery.data.firstName ?? "",
      birthday: profileQuery.data.birthday ?? "",
      gender: profileQuery.data.gender ?? "",
      weight: String(profileQuery.data.weight ?? ""),
      height: profileQuery.data.height ?? "",
      healthComplications: savedHealth.healthComplications,
      otherHealthComplication: savedHealth.otherHealthComplication,
      dietRestrictions: normalizeDietRestrictionSelection(savedDietRestrictionsSource),
      dietaryPreferences: profileQuery.data.dietaryPreferences ?? "",
      foodAllergies: savedAllergies.foodAllergies,
      otherFoodAllergy: savedAllergies.otherFoodAllergy,
      fitnessLevel: profileQuery.data.fitnessLevel ?? "",
      activityLevel: profileQuery.data.activityLevel ?? "",
      fitnessGoals: splitList(profileQuery.data.fitnessGoals),
      targetWeight: profileQuery.data.targetWeight ? String(profileQuery.data.targetWeight) : "",
      additionalInfo: profileQuery.data.additionalInfo ?? "",
      eventType: profileQuery.data.eventType ?? "",
      weeksUntilRace: profileQuery.data.weeksUntilRace ? String(profileQuery.data.weeksUntilRace) : "",
      currentWeeklyVolume: profileQuery.data.currentWeeklyVolume ?? "",
      previousRaceTimes: profileQuery.data.previousRaceTimes ?? "",
      availableTrainingDaysPerWeek: profileQuery.data.availableTrainingDaysPerWeek ? String(profileQuery.data.availableTrainingDaysPerWeek) : "",
    });
  }, [pendingAuthSubmit, profileQuery.data]);

  useEffect(() => {
    if (!draftLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [draftLoaded, form]);

  const previousStepRef = useRef(step);
  const progress = Math.round(((step + 1) / steps.length) * 100);
  const progressTone = getOnboardingProgressTone(progress);

  useEffect(() => {
    if (previousStepRef.current === step || typeof window === "undefined") return;
    previousStepRef.current = step;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [step]);
  const visibleHealthOptions = form.gender === "Male" ? healthOptions.filter((option) => option !== pregnancyHealthOption) : healthOptions;

  const markFieldTouched = (field: keyof OnboardingForm) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    markFieldTouched(key);
    setForm((current) => {
      let next: OnboardingForm = { ...current, [key]: value };
      if (key === "gender" && value === "Male") {
        next = { ...next, healthComplications: current.healthComplications.filter((item) => item !== pregnancyHealthOption) };
      }
      if (key === "fitnessGoals" && Array.isArray(value) && !value.includes(weightLossGoal)) {
        next = { ...next, targetWeight: "" };
      }
      const nextErrors = collectStepErrors(step, next);
      setErrors(nextErrors);
      return next;
    });
  };

  const updateFoodAllergies = (nextFoodAllergies: string[]) => {
    markFieldTouched("foodAllergies");
    setForm((current) => {
      const next = {
        ...current,
        foodAllergies: nextFoodAllergies,
        otherFoodAllergy: nextFoodAllergies.includes("Other") ? current.otherFoodAllergy : "",
      };
      setErrors(collectStepErrors(step, next));
      return next;
    });
  };

  const updateHealthComplications = (nextHealthComplications: string[]) => {
    markFieldTouched("healthComplications");
    setForm((current) => {
      const allowedHealthComplications = current.gender === "Male" ? nextHealthComplications.filter((item) => item !== pregnancyHealthOption) : nextHealthComplications;
      const next = {
        ...current,
        healthComplications: allowedHealthComplications,
        otherHealthComplication: allowedHealthComplications.includes("Other") ? current.otherHealthComplication : "",
      };
      setErrors(collectStepErrors(step, next));
      return next;
    });
  };

  const collectStepErrors = (targetStep = step, source: OnboardingForm = form) => {
    const nextErrors: Record<string, string> = {};
    if (targetStep === 0) {
      if (source.name.trim().length < 2) nextErrors.name = "First name must be at least 2 characters.";
      if (!source.birthday) nextErrors.birthday = "Date of birth is required.";
      else if (calculateBirthdayAge(source.birthday) === null) nextErrors.birthday = "Enter a valid date of birth.";
      else if ((calculateBirthdayAge(source.birthday) ?? 0) < 8) nextErrors.birthday = "You must be at least 8 years old to use JIMMI.";
      if (!genderOptions.includes(source.gender.trim())) nextErrors.gender = "Select Male or Female.";
      if (!source.weight.trim()) nextErrors.weight = "Weight is required.";
      else if (parseWeightValue(source.weight) === null) nextErrors.weight = "Enter a valid weight.";
      if (!source.height.trim()) nextErrors.height = "Height is required.";
    }
    if (targetStep === 1 && !source.activityLevel.trim()) nextErrors.activityLevel = "Activity level is required.";
    if (targetStep === 2 && !source.fitnessLevel.trim()) nextErrors.fitnessLevel = "Fitness level is required.";
    if (targetStep === 3) {
      if (source.fitnessGoals.length === 0) nextErrors.fitnessGoals = "Select at least one fitness goal.";
      if (source.fitnessGoals.includes(weightLossGoal)) {
        const currentWeight = parseWeightValue(source.weight);
        const targetWeight = parseWeightValue(source.targetWeight);
        if (!source.targetWeight.trim()) nextErrors.targetWeight = "Target weight is required when losing weight is a goal.";
        else if (targetWeight === null) nextErrors.targetWeight = "Enter a valid target weight.";
        else if (currentWeight !== null && targetWeight >= currentWeight) nextErrors.targetWeight = "Target weight must be less than your current weight.";
      }
    }
    if (targetStep === 4) {
      // Step 4 (Event) has no required validation - event type is optional
    }
    if (targetStep === 5) {
      if (source.dietRestrictions.length === 0) nextErrors.dietRestrictions = "Select one dietary option.";
      if (source.dietRestrictions.length > 1) nextErrors.dietRestrictions = "Choose only one dietary option.";
      if (source.foodAllergies.length === 0) nextErrors.foodAllergies = "Select at least one allergy option.";
      if (source.foodAllergies.includes("Other") && !source.otherFoodAllergy.trim()) nextErrors.otherFoodAllergy = "Please specify the other food allergy.";
    }
    if (targetStep === 6) {
      if (source.healthComplications.length === 0) nextErrors.healthComplications = "Select at least one health complication option.";
      if (source.healthComplications.includes("Other") && !source.otherHealthComplication.trim()) nextErrors.otherHealthComplication = "Please specify the other health complication.";
    }
    return nextErrors;
  };

  const validateStep = (targetStep = step) => {
    const nextErrors = collectStepErrors(targetStep, form);
    setAttemptedSteps((current) => ({ ...current, [targetStep]: true }));
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateTouchedField = (field: keyof OnboardingForm) => {
    markFieldTouched(field);
    setErrors(collectStepErrors(step, form));
  };

  const getFieldError = (field: keyof OnboardingForm) => {
    const error = errors[field];
    if (!error) return undefined;
    return touchedFields[field] || attemptedSteps[step] ? error : undefined;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = async () => {
    for (let i = 0; i < steps.length - 1; i += 1) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    if (!user) {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(buildLocalProfile(form)));
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PENDING_SUBMIT_KEY);
      setPendingAuthSubmit(false);
      // Skip mic setup dialog and go directly to chat
      enterChatAfterMicSetup();
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    localStorage.setItem(PENDING_SUBMIT_KEY, "true");
    setPendingAuthSubmit(true);
    const gender = form.gender.trim() as "Male" | "Female";
    await completeMutation.mutateAsync({
      firstName: form.name.trim(),
      birthday: form.birthday,
      gender,
      weight: Number(form.weight),
      targetWeight: form.targetWeight ? Number(form.targetWeight) : null,
      height: form.height.trim(),
      healthComplications: serializeHealthComplications(form.healthComplications, form.otherHealthComplication),
      dietRestrictions: form.dietRestrictions,
      dietaryPreferences: form.dietaryPreferences.trim() || null,
      foodAllergies: serializeFoodAllergies(form.foodAllergies, form.otherFoodAllergy),
      fitnessLevel: form.fitnessLevel,
      activityLevel: form.activityLevel,
      fitnessGoals: form.fitnessGoals,
      additionalInfo: form.additionalInfo.trim() || null,
    });
  };

  useEffect(() => {
    if (!draftLoaded || !pendingAuthSubmit || !user || completeMutation.isPending) return;
    void submit();
  }, [draftLoaded, pendingAuthSubmit, user, completeMutation.isPending]);

  useEffect(() => {
    if (!draftLoaded || !pendingAuthSubmit || loading || user || completeMutation.isPending) return;
    const fallbackTimer = window.setTimeout(() => {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(buildLocalProfile(form)));
      localStorage.removeItem(PENDING_SUBMIT_KEY);
      setPendingAuthSubmit(false);
      enterChatAfterMicSetup();
    }, 1200);
    return () => window.clearTimeout(fallbackTimer);
  }, [completeMutation.isPending, draftLoaded, form, loading, pendingAuthSubmit, setLocation, user]);

  const enterChatAfterMicSetup = () => {
    setShowMicSetup(false);
    const destination = user ? "/chat" : "/chat?localOnboarding=1";
    setLocation(getMobileAwareChatEntryPath({ destination, reason: "onboarding" }));
  };

  const requestMicrophoneAndEnterChat = async () => {
    if (shouldRouteMicrophoneThroughJimmiDomain()) {
      setMicSetupStatus("preview-host");
      window.setTimeout(() => redirectToJimmiPublicDomainForMicrophone(), 350);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicSetupStatus("unsupported");
      return;
    }

    setMicSetupStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicSetupStatus("granted");
      window.setTimeout(enterChatAfterMicSetup, 450);
    } catch {
      setMicSetupStatus("denied");
    }
  };

  if (loading || (pendingAuthSubmit && !showMicSetup) || completeMutation.isPending) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-card p-8 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{pendingAuthSubmit ? "Opening JIMMI Chat..." : "Preparing your JIMMI onboarding..."}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
      <section className="container py-8 md:py-12">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <JimmiWordmark variant="onboarding" className="jimmi-wordmark text-2xl text-foreground" />
          <p className="hidden font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground sm:block">{user ? "Onboarding saved as you go" : "Onboarding opens Chat instantly"}</p>
        </header>

        <div className="mx-auto mt-10 max-w-4xl">
          <div className="mb-5 rounded-[1.5rem] border border-white/10 bg-card/70 p-4">
            <div className="flex items-center justify-between gap-4 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <span>Step {step + 1} of {steps.length}</span>
              <span className={`transition-colors duration-500 ${progressTone.textClassName}`} data-progress-percentage-tone={progressTone.label}>{progress}% complete</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`Onboarding progress: ${progress}% complete`}>
              <div className={`h-full rounded-full transition-[width,background-color,box-shadow] duration-500 ease-out ${progressTone.className}`} data-progress-tone={progressTone.label} style={{ width: `${progress}%` }} />
            </div>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-card/90 p-6 shadow-2xl shadow-black/40 md:p-8">
            {step === 0 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 01</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Basic details</h2></div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="First name" error={getFieldError("name")}><TextInput value={form.name} onChange={(event) => update("name", event.target.value)} onBlur={() => validateTouchedField("name")} placeholder="Alex" minLength={2} /></Field>
                  <Field label="Date of Birth" error={getFieldError("birthday")} hint="JIMMI stores this securely to keep your profile age current automatically. You must be at least 8 years old."><TextInput type="date" value={form.birthday} onChange={(event) => update("birthday", event.target.value)} onBlur={() => validateTouchedField("birthday")} placeholder={birthdaySample} max={minimumBirthday} /></Field>
                  <Field label="Gender" error={getFieldError("gender")}><SelectInput value={form.gender} onChange={(value) => update("gender", value)} options={genderOptions} placeholder="Select gender" /></Field>
                  <Field label="Weight" error={getFieldError("weight")} hint="Enter weight in pounds for now."><TextInput inputMode="numeric" value={form.weight} onChange={(event) => update("weight", event.target.value)} onBlur={() => validateTouchedField("weight")} placeholder="185" /></Field>
                  <Field label="Height" error={getFieldError("height")} hint="Scroll and select your height."><HeightScrollSelector value={form.height} onChange={(value) => update("height", value)} /></Field>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 02</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Activity level</h2><p className="mt-3 text-muted-foreground">Choose the row that best matches your usual week. Each option explains what the activity level means.</p></div>
                <Field label="Activity level" error={errors.activityLevel}><ChoiceCardGrid value={form.activityLevel} onChange={(value) => update("activityLevel", value)} options={activityOptions} columns="sm:grid-cols-2 lg:grid-cols-3" /></Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 03</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Fitness level</h2><p className="mt-3 text-muted-foreground">Pick the row that best describes your current training experience, not where you want to be.</p></div>
                <Field label="Fitness level" error={errors.fitnessLevel}><ChoiceCardGrid value={form.fitnessLevel} onChange={(value) => update("fitnessLevel", value)} options={fitnessLevelOptions} columns="sm:grid-cols-2 lg:grid-cols-3" /></Field>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 04</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Fitness goal</h2><p className="mt-3 text-muted-foreground">Select one or more coaching goals. JIMMI will use each selected goal to shape your training, nutrition, and recovery guidance.</p></div>
                <Field label="Fitness goal" error={errors.fitnessGoals}><MultiChoiceCardGrid value={form.fitnessGoals} onChange={(value) => update("fitnessGoals", value)} options={goalOptions} columns="sm:grid-cols-2 lg:grid-cols-4" /></Field>
                {form.fitnessGoals.includes(weightLossGoal) ? (
                  <Field label="Target weight" error={errors.targetWeight} hint="Enter a goal weight in pounds. It must be lower than the current weight you entered in Basic details.">
                    <TextInput inputMode="numeric" value={form.targetWeight} onChange={(event) => update("targetWeight", event.target.value)} onBlur={() => setErrors(collectStepErrors(step, form))} placeholder="170" />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 05</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Event training (optional)</h2><p className="mt-3 text-muted-foreground">Are you training for any of the following? Select your event type, or skip if you're focused on general fitness.</p></div>
                <Field label="Event type" required={false}><ChoiceCardGrid value={form.eventType} onChange={(value) => update("eventType", value)} options={eventTypeOptions} columns="sm:grid-cols-2 lg:grid-cols-3" /></Field>
                {form.eventType && form.eventType !== "" && form.eventType !== "General Fitness" ? (
                  <>
                    <Field label="Weeks until race" required={false} hint="How many weeks until your target event?"><TextInput inputMode="numeric" value={form.weeksUntilRace} onChange={(event) => update("weeksUntilRace", event.target.value)} placeholder="12" /></Field>
                    <Field label="Current weekly volume" required={false} hint="e.g., '30 miles/week' for running or 'swim 5km, bike 50km, run 15km' for triathlon"><TextInput value={form.currentWeeklyVolume} onChange={(event) => update("currentWeeklyVolume", event.target.value)} placeholder="30 miles per week" /></Field>
                    <Field label="Previous race times (optional)" required={false} hint="e.g., '5K: 22:30, 10K: 47:15' - helps us understand your current fitness level"><TextInput value={form.previousRaceTimes} onChange={(event) => update("previousRaceTimes", event.target.value)} placeholder="5K: 22:30" /></Field>
                    <Field label="Available training days per week" required={false} hint="How many days per week can you train?"><TextInput inputMode="numeric" value={form.availableTrainingDaysPerWeek} onChange={(event) => update("availableTrainingDaysPerWeek", event.target.value)} placeholder="5" /></Field>
                  </>
                ) : null}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 06</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Nutrition needs</h2><p className="mt-3 text-muted-foreground">Choose one dietary pattern, then select every allergy that applies. Gluten and dairy now live with allergies so safety signals stay distinct from preference.</p></div>
                <Field label="Dietary restrictions" error={errors.dietRestrictions}><SingleSelectDropdown value={form.dietRestrictions} options={dietOptions} onChange={(next) => update("dietRestrictions", normalizeDietRestrictionSelection(next))} placeholder="Select one dietary restriction" /></Field>
                <Field label="Specific dietary preferences (optional)" required={false} hint="Use this for personal food preferences that are not medical restrictions, such as high-protein breakfast, Mediterranean meals, no red meat, simple meal prep, or budget-friendly foods.">
                  <textarea value={form.dietaryPreferences} onChange={(event) => update("dietaryPreferences", event.target.value)} rows={3} className="w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-4 focus:ring-primary/10" placeholder="Example: Mediterranean-style meals, no red meat, high-protein breakfast, simple meal prep." />
                </Field>
                <Field label="Food allergies" error={errors.foodAllergies}><MultiSelectDropdown value={form.foodAllergies} options={allergyOptions} onChange={updateFoodAllergies} placeholder="Select food allergies" /></Field>
                {form.foodAllergies.includes("Other") ? (
                  <Field label="Specify other food allergy" error={errors.otherFoodAllergy} hint="Enter the allergy so JIMMI can avoid unsafe nutrition suggestions.">
                    <TextInput value={form.otherFoodAllergy} onChange={(event) => update("otherFoodAllergy", event.target.value)} placeholder="Example: strawberries" />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 07</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Health complications</h2><p className="mt-3 text-muted-foreground">Select every option that applies so JIMMI can keep coaching boundaries safer and more useful.</p></div>
                <Field label="Health complications" error={errors.healthComplications}><HealthConditionColumnGrid value={form.healthComplications} options={visibleHealthOptions} onChange={updateHealthComplications} /></Field>
                {form.healthComplications.includes("Other") ? (
                  <Field label="Specify other health complication" error={errors.otherHealthComplication} hint="Enter the condition or consideration so JIMMI can keep coaching safer and more relevant.">
                    <TextInput value={form.otherHealthComplication} onChange={(event) => update("otherHealthComplication", event.target.value)} placeholder="Example: migraines" />
                  </Field>
                ) : null}
                <Field label="Additional info (optional)" required={false}><textarea value={form.additionalInfo} onChange={(event) => update("additionalInfo", event.target.value)} rows={4} className="w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-4 focus:ring-primary/10" placeholder="Add injuries, schedule, equipment access, food preferences, medication considerations, or anything JIMMI should remember." /></Field>
              </div>
            ) : null}

            {step === 7 ? (
              <div className="space-y-6">
                <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Step 08</p><h2 className="mt-3 font-display text-4xl font-light tracking-tight">Review and start</h2><p className="mt-3 text-muted-foreground">JIMMI will use this baseline to personalize your first coaching conversation and populate My Profile.</p></div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["First name", form.name], ["Gender", form.gender], ["Weight", form.weight ? `${form.weight} lb` : "—"], ["Target weight", form.targetWeight ? `${form.targetWeight} lb` : "—"], ["Height", form.height], ["Activity", form.activityLevel], ["Fitness", form.fitnessLevel], ["Goals", form.fitnessGoals.join(", ")], ["Diet", form.dietRestrictions.join(", ")], ["Diet preferences", form.dietaryPreferences || "—"], ["Allergies", formatFoodAllergies(form.foodAllergies, form.otherFoodAllergy)], ["Health", formatHealthComplications(form.healthComplications, form.otherHealthComplication)], ["Additional info", form.additionalInfo || "—"]
                  ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="mt-2 text-sm leading-6 text-foreground">{String(value) || "—"}</p></div>)}
                </div>
              </div>
            ) : null}

            {completeMutation.error ? <p className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{completeMutation.error.message}</p> : null}

            <footer className="mt-10 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" disabled={step === 0 || completeMutation.isPending} onClick={() => setStep((current) => Math.max(current - 1, 0))} className="rounded-full border-white/10 bg-transparent text-foreground hover:border-primary hover:text-primary">
                <ArrowLeft className="mr-2 size-4" /> Back
              </Button>
              {step < steps.length - 1 ? (
                <Button type="button" onClick={goNext} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">Continue <ArrowRight className="ml-2 size-4" /></Button>
              ) : (
                <Button type="button" onClick={submit} disabled={completeMutation.isPending} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {completeMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Start Coaching
                </Button>
              )}
            </footer>
          </section>
        </div>
      </section>
    </main>
 
      <AlertDialog open={showMicSetup} onOpenChange={setShowMicSetup}>
        <AlertDialogContent className="border-white/10 bg-black text-white shadow-2xl shadow-black/70">
          <AlertDialogHeader>
            <div className="mb-3 grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
              {micSetupStatus === "requesting" ? <Loader2 className="size-5 animate-spin text-white" /> : <Mic className="size-5 text-white" />}
            </div>
            <AlertDialogTitle className="font-display text-3xl font-light tracking-tight text-white">JIMMI would like to enable your mic</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-white/58">
              Enable microphone access once so JIMMI voice is ready when you enter Chat. You can still use text if you skip or if the browser blocks access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {micSetupStatus === "denied" ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">Microphone access was not enabled. You can continue with text and update browser permissions later.</p> : null}
          {micSetupStatus === "preview-host" ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">Opening JIMMI on askjimmi.com so the microphone prompt does not show the temporary preview host.</p> : null}
          {micSetupStatus === "unsupported" ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">This browser does not support microphone setup here. Text chat will still work.</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={enterChatAfterMicSetup} className="rounded-full border-white/10 bg-transparent text-white/62 hover:bg-white/[0.06] hover:text-white">Skip for now</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void requestMicrophoneAndEnterChat(); }} disabled={micSetupStatus === "requesting"} className="rounded-full bg-white text-black hover:bg-white/90">
              {micSetupStatus === "requesting" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mic className="mr-2 size-4" />}
              Enable mic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
