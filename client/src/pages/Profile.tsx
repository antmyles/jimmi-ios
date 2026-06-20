import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Image as ImageIcon, Info, Loader2, Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type ChoiceOption = {
  value: string;
  description: string;
};

type ProfileForm = {
  firstName: string;
  birthday: string;
  gender: string;
  weight: string;
  targetWeight: string;
  height: string;
  healthComplications: string[];
  otherHealthComplication: string;
  dietRestrictions: string[];
  foodAllergies: string[];
  otherFoodAllergy: string;
  fitnessLevel: string;
  activityLevel: string;
  fitnessGoals: string[];
  additionalInfo: string;
};

type ProfileTabId = "personal" | "fitness" | "nutrition" | "health";
type MacroTarget = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
type MacroSummaryItem = {
  key: keyof MacroTarget;
  label: string;
  value: number;
  unit: string;
  note: string;
};
type AvatarFrameSource = "library";
type AvatarFramerState = {
  imageDataUrl: string;
  source: AvatarFrameSource;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type AvatarGesturePoint = {
  x: number;
  y: number;
};

type AvatarGestureStart = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  centerX: number;
  centerY: number;
  distance: number | null;
};

const AVATAR_FRAME_SIZE = 640;
const AVATAR_PREVIEW_SIZE = 256;
const AVATAR_PREVIEW_TO_CANVAS_RATIO = AVATAR_FRAME_SIZE / AVATAR_PREVIEW_SIZE;
const AVATAR_MIN_ZOOM = 1;
const AVATAR_MAX_ZOOM = 2.8;
const AVATAR_MAX_OFFSET = 240;

function clampAvatarValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getAvatarGestureCenter(points: AvatarGesturePoint[]) {
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function getAvatarGestureDistance(points: AvatarGesturePoint[]) {
  if (points.length < 2) return null;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function createImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not prepare that photo."));
    image.src = src;
  });
}

async function renderCircularAvatarFrame(frame: AvatarFramerState) {
  const image = await createImageElement(frame.imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_FRAME_SIZE;
  canvas.height = AVATAR_FRAME_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not frame that photo.");

  const baseScale = Math.max(AVATAR_FRAME_SIZE / image.width, AVATAR_FRAME_SIZE / image.height);
  const drawWidth = image.width * baseScale * frame.zoom;
  const drawHeight = image.height * baseScale * frame.zoom;
  const x = (AVATAR_FRAME_SIZE - drawWidth) / 2 + frame.offsetX;
  const y = (AVATAR_FRAME_SIZE - drawHeight) / 2 + frame.offsetY;

  context.clearRect(0, 0, AVATAR_FRAME_SIZE, AVATAR_FRAME_SIZE);
  context.drawImage(image, x, y, drawWidth, drawHeight);
  context.globalCompositeOperation = "destination-in";
  context.beginPath();
  context.arc(AVATAR_FRAME_SIZE / 2, AVATAR_FRAME_SIZE / 2, AVATAR_FRAME_SIZE / 2, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";

  return canvas.toDataURL("image/png", 0.92);
}

const emptyForm: ProfileForm = {
  firstName: "",
  birthday: "",
  gender: "",
  weight: "",
  targetWeight: "",
  height: "",
  healthComplications: [],
  otherHealthComplication: "",
  dietRestrictions: [],
  foodAllergies: [],
  otherFoodAllergy: "",
  fitnessLevel: "",
  activityLevel: "",
  fitnessGoals: [],
  additionalInfo: "",
};

const genderOptions = ["Male", "Female"];
const activityOptions: ChoiceOption[] = [
  { value: "Sedentary", description: "Mostly seated days." },
  { value: "Lightly active", description: "1-3 easy sessions weekly." },
  { value: "Moderately active", description: "3-5 mixed sessions weekly." },
  { value: "Very active", description: "Hard training most days." },
  { value: "Athlete-level activity", description: "High-volume sport training." },
];
const fitnessLevelOptions: ChoiceOption[] = [
  { value: "Beginner", description: "New to structure." },
  { value: "Returning after time away", description: "Rebuilding consistency." },
  { value: "Intermediate", description: "Consistent with basics." },
  { value: "Advanced", description: "Experienced programming." },
  { value: "Competitive athlete", description: "Competition-focused." },
];
const healthOptions = ["None", "High blood pressure", "Hypertension", "Diabetes", "Asthma", "Rheumatoid arthritis", "Joint pain", "Back pain", "Heart condition", "High cholesterol", "Obesity", "Pregnancy/postpartum", "Other"];
const pregnancyHealthOption = "Pregnancy/postpartum";
const dietOptions = ["None", "Vegetarian", "Vegan", "Pescatarian", "Keto", "Low-carb", "Halal", "Kosher", "Other"];
const allergyOptions = ["None", "Peanuts", "Tree nuts", "Gluten", "Dairy", "Eggs", "Shellfish", "Fish", "Soy", "Wheat", "Sesame", "Other"];
const goalOptions: ChoiceOption[] = [
  { value: "Lose weight", description: "Sustainable weight loss." },
  { value: "Build muscle", description: "Strength and protein focus." },
  { value: "Tone and define", description: "Definition and conditioning." },
  { value: "Athletic performance", description: "Sport, speed, and stamina." },
  { value: "Improve mobility", description: "Range, control, comfort." },
  { value: "Improve recovery", description: "Sleep, soreness, deloads." },
];
const profileTabs: Array<{ id: ProfileTabId; label: string; eyebrow: string; description: string }> = [
  { id: "personal", label: "Personal", eyebrow: "01", description: "Basics." },
  { id: "fitness", label: "Fitness", eyebrow: "02", description: "Training." },
  { id: "nutrition", label: "Nutrition", eyebrow: "03", description: "Food needs." },
  { id: "health", label: "Health", eyebrow: "04", description: "Health notes." },
];
const weightLossGoal = "Lose weight";
const heightOptions = Array.from({ length: 31 }, (_, index) => {
  const totalInches = 54 + index;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet} ft ${inches} in`;
});

const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";
const PROFILE_MACRO_TITLE_TONES: Record<keyof MacroTarget, string> = {
  calories: "text-[#f6d365]",
  protein: "text-[#8fe8d8]",
  carbs: "text-[#b9a7ff]",
  fat: "text-[#f2a7c9]",
};
const inputClass = "min-w-0 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base font-light text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";

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
  const normalizedValues = uniqueList(dietRestrictions.map((item) => item.trim()).filter(Boolean));
  if (normalizedValues.includes("None")) return ["None"];
  return normalizedValues.slice(0, 1);
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

function listText(value?: unknown) {
  const values = splitList(value);
  return values.length > 0 ? values.join(", ") : "—";
}

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

function buildMacroTargets(profile: any): MacroTarget {
  const weight = Math.max(Number(profile?.weight) || 170, 90);
  const goals = splitList(profile?.fitnessGoals).join(", ").toLowerCase();
  const activity = String(profile?.activityLevel ?? "").toLowerCase();
  const activityMultiplier = includesAny(activity, ["very", "active", "athlete", "intense"]) ? 15 : includesAny(activity, ["moderate", "some", "regular"]) ? 14 : 13;
  const goalAdjustment = includesAny(goals, ["lose", "weight", "fat", "lean"]) ? -250 : includesAny(goals, ["muscle", "build", "strength", "gain"]) ? 200 : 0;
  const calories = Math.round((weight * activityMultiplier + goalAdjustment) / 25) * 25;
  const protein = Math.round(weight * (includesAny(goals, ["muscle", "strength", "tone"]) ? 0.9 : 0.8));
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat };
}

function readLocalOnboardingProfile() {
  if (typeof window === "undefined") return null;
  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return rawProfile ? JSON.parse(rawProfile) : null;
  } catch {
    return null;
  }
}

function profileToForm(profile: any): ProfileForm {
  const health = normalizeHealthComplicationSelection(splitList(profile.healthComplications), "", profile.gender ?? "");
  const allergies = normalizeFoodAllergySelection(splitList(profile.foodAllergies), "");

  return {
    firstName: profile.firstName ?? "",
    birthday: profile.birthday ?? "",
    gender: profile.gender ?? "",
    weight: String(profile.weight ?? ""),
    targetWeight: profile.targetWeight ? String(profile.targetWeight) : "",
    height: profile.height ?? "",
    healthComplications: health.healthComplications,
    otherHealthComplication: health.otherHealthComplication,
    dietRestrictions: normalizeDietRestrictionSelection(splitList(profile.dietRestrictions)),
    foodAllergies: allergies.foodAllergies,
    otherFoodAllergy: allergies.otherFoodAllergy,
    fitnessLevel: profile.fitnessLevel ?? "",
    activityLevel: profile.activityLevel ?? "",
    fitnessGoals: splitList(profile.fitnessGoals),
    additionalInfo: profile.additionalInfo ?? "",
  };
}

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 overflow-hidden rounded-xl bg-transparent px-0 py-1.5 ${className}`} data-profile-field-shell="compact-boundary-free">
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.20em] text-muted-foreground">{label}</span>
      <div className="mt-1.5 min-w-0 overflow-hidden">{children}</div>
    </label>
  );
}

function calculateAge(birthday: string | null | undefined): string {
  if (!birthday) return "—";
  const birth = new Date(birthday);
  if (isNaN(birth.getTime())) return "—";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? `${age}` : "—";
}

function DisplayField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.018] px-3 py-2.5 shadow-[inset_1px_0_0_rgba(143,232,216,0.18)]" data-profile-readonly-field="compact-polished" data-profile-field-accent="subtle-cyan-rail">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.20em] text-muted-foreground">{label}</p>
      <div className="mt-1.5 min-w-0 text-sm font-light leading-5 text-foreground">{value || "—"}</div>
    </div>
  );
}

function SummarySection({ id, title, summary, children, onEdit }: { id: ProfileTabId; title: string; summary: string; children: React.ReactNode; onEdit?: (section: ProfileTabId) => void }) {
  return (
    <section className="rounded-[1.5rem] bg-black/10 p-3 md:p-4" data-profile-section={id} data-profile-readonly-section="compact-polished-boundary-free">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-white" data-profile-section-title-white="true">{title}</p>
          <p className="sr-only">{summary}</p>
        </div>
        {onEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(id)} className="h-8 shrink-0 rounded-full border-white/10 bg-white/[0.035] px-3 text-xs font-light text-muted-foreground hover:border-primary/50 hover:text-primary" data-profile-category-edit={id}>
            <Pencil className="mr-1.5 size-3" /> Edit
          </Button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function HeightScrollSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="max-h-32 overflow-y-auto rounded-xl bg-transparent p-0 [scrollbar-color:rgba(201,184,154,0.42)_rgba(255,255,255,0.06)] [scrollbar-width:thin]" data-profile-height-options="compact-category-save-range">
      <div className="grid gap-1">
        {heightOptions.map((option) => {
          const selected = value === option;
          return (
            <button key={option} type="button" onClick={() => onChange(option)} aria-pressed={selected} className={`rounded-lg px-3 py-1.5 text-left text-sm transition ${selected ? "bg-[#8fe8d8]/10 text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceCardGrid({ value, options, onChange }: { value: string; options: ChoiceOption[]; onChange: (next: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-1" data-profile-choice-layout="compact-category-save-rows">
      {options.map((option, index) => {
        const selected = value === option.value;
        const tileNumber = String(index + 1).padStart(2, "0");
        return (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} aria-pressed={selected} className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-primary/15 sm:px-3 ${selected ? "bg-[linear-gradient(90deg,rgba(143,232,216,0.14),rgba(255,255,255,0.025))] text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "bg-white/[0.018] text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[0.58rem] uppercase tracking-[0.16em] transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] text-black shadow-[0_0_14px_rgba(143,232,216,0.22)]" : "border-white/15 text-muted-foreground group-hover:border-[#8fe8d8]/60 group-hover:text-[#8fe8d8]"}`} aria-hidden="true">{tileNumber}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-light leading-none tracking-tight text-foreground">{option.value}</span>
              <span className="mt-0.5 hidden text-[0.68rem] leading-4 text-muted-foreground sm:block">{option.description}</span>
            </span>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] shadow-[0_0_14px_rgba(143,232,216,0.30)]" : "border-white/25 group-hover:border-[#8fe8d8]/70"}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceCardGrid({ value, options, onChange }: { value: string[]; options: ChoiceOption[]; onChange: (next: string[]) => void }) {
  const toggle = (option: string) => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);

  return (
    <div className="mx-auto max-w-2xl space-y-1" data-profile-choice-layout="compact-category-save-rows" data-choice-mode="multi-select">
      {options.map((option, index) => {
        const selected = value.includes(option.value);
        const tileNumber = String(index + 1).padStart(2, "0");
        return (
          <button key={option.value} type="button" onClick={() => toggle(option.value)} aria-pressed={selected} className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-primary/15 sm:px-3 ${selected ? "bg-[linear-gradient(90deg,rgba(143,232,216,0.14),rgba(255,255,255,0.025))] text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "bg-white/[0.018] text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[0.58rem] uppercase tracking-[0.16em] transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] text-black shadow-[0_0_14px_rgba(143,232,216,0.22)]" : "border-white/15 text-muted-foreground group-hover:border-[#8fe8d8]/60 group-hover:text-[#8fe8d8]"}`} aria-hidden="true">{tileNumber}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-light leading-none tracking-tight text-foreground">{option.value}</span>
              <span className="mt-0.5 hidden text-[0.68rem] leading-4 text-muted-foreground sm:block">{option.description}</span>
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
    <div className="space-y-2" data-profile-health-control="compact-category-save-multi-select-columns" data-choice-mode="multi-select">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.018] px-2.5 py-1.5">
        <span className={`shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.18em] ${value.length > 0 ? "text-[#8fe8d8]" : "text-primary"}`}>{value.length > 0 ? `${value.length} selected` : "Multi-select"}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button key={option} type="button" onClick={() => toggle(option)} aria-pressed={selected} className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs leading-4 transition focus:outline-none focus:ring-4 focus:ring-primary/15 sm:text-sm xl:text-xs ${selected ? "bg-[#8fe8d8]/12 text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "bg-white/[0.018] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>
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
  const selectedValue = value[0] ?? "";
  const chooseSingleOption = (option: string) => {
    const nextValue = selectedValue === option ? [] : [option];
    onChange(nextValue);
  };

  return (
    <div className="space-y-1 rounded-xl bg-transparent p-0" data-profile-nutrition-control="compact-category-save-single-select" data-single-select="true">
      <p className={`px-1 text-sm ${selectedValue ? "text-foreground" : "text-muted-foreground"}`}>{selectedValue || placeholder}</p>
      <div className="grid gap-1">
        {options.map((option) => {
          const selected = selectedValue === option;
          return (
            <button key={option} type="button" onClick={() => chooseSingleOption(option)} aria-pressed={selected} className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition focus:outline-none focus:ring-4 focus:ring-primary/15 ${selected ? "bg-[#8fe8d8]/10 text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "bg-white/[0.018] text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"}`}>
              <span>{option}</span>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${selected ? "border-[#8fe8d8] bg-[#8fe8d8] shadow-[0_0_14px_rgba(143,232,216,0.30)]" : "border-white/25"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextList({ values }: { values: unknown }) {
  const list = splitList(values);
  if (list.length === 0) return <>—</>;
  return <span>{list.join(", ")}</span>;
}

export default function Profile() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [localProfile, setLocalProfile] = useState<any>(() => readLocalOnboardingProfile());
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<ProfileTabId>("personal");
  const [saved, setSaved] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [avatarFrame, setAvatarFrame] = useState<AvatarFramerState | null>(null);
  const [isFramingAvatar, setIsFramingAvatar] = useState(false);
  const [activeMacroInfo, setActiveMacroInfo] = useState<keyof MacroTarget | null>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const photoMenuRef = useRef<HTMLDivElement>(null);
  const photoMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const avatarGesturePointersRef = useRef<Map<number, AvatarGesturePoint>>(new Map());
  const avatarGestureStartRef = useRef<AvatarGestureStart | null>(null);
  const profile = profileQuery.data ?? localProfile;
  const macroTargets = useMemo(() => buildMacroTargets(profile), [profile]);
  const macroSummaryItems = useMemo<MacroSummaryItem[]>(() => [
    { key: "calories", label: "Calories", value: macroTargets.calories, unit: "", note: "Daily energy target based on your weight, activity level, and primary goal direction." },
    { key: "protein", label: "Protein", value: macroTargets.protein, unit: "g", note: "Supports muscle repair, strength training adaptation, and steadier appetite between meals." },
    { key: "carbs", label: "Carbs", value: macroTargets.carbs, unit: "g", note: "Helps fuel training, daily movement, and recovery from higher-output sessions." },
    { key: "fat", label: "Fat", value: macroTargets.fat, unit: "g", note: "Keeps essential dietary fat in the plan while leaving room for protein and training fuel." },
  ], [macroTargets]);
  const activeMacro = macroSummaryItems.find((item) => item.key === activeMacroInfo);
  const isLocalFallback = !user && Boolean(localProfile);
  const visibleHealthOptions = form.gender === "Male" ? healthOptions.filter((option) => option !== pregnancyHealthOption) : healthOptions;
  const needsTargetWeight = form.fitnessGoals.includes(weightLossGoal);

  useEffect(() => {
    if (!profile) return;
    setForm(profileToForm(profile));
  }, [profile]);

  useEffect(() => {
    if (!photoMenuOpen) return;

    const closePhotoMenuOnOutsideTap = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (photoMenuRef.current?.contains(target) || photoMenuTriggerRef.current?.contains(target))) return;
      setPhotoMenuOpen(false);
    };

    document.addEventListener("pointerdown", closePhotoMenuOnOutsideTap);
    return () => document.removeEventListener("pointerdown", closePhotoMenuOnOutsideTap);
  }, [photoMenuOpen]);

  const updateAvatar = trpc.onboarding.updateAvatar.useMutation({
    onSuccess: async () => {
      setPhotoStatus("Profile photo updated.");
      await utils.onboarding.get.invalidate();
      window.setTimeout(() => setPhotoStatus(null), 2400);
    },
    onError: (error) => setPhotoStatus(error.message),
  });

  const updateProfile = trpc.onboarding.updateProfile.useMutation({
    onSuccess: async () => {
      setSaved(true);
      setIsEditing(false);
      await utils.onboarding.get.invalidate();
      window.setTimeout(() => setSaved(false), 2400);
    },
  });

  const updateField = (field: keyof ProfileForm, value: string | string[]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateGender = (gender: string) => {
    setSaved(false);
    setForm((current) => {
      const normalizedHealth = normalizeHealthComplicationSelection(current.healthComplications, current.otherHealthComplication, gender);
      return { ...current, gender, healthComplications: normalizedHealth.healthComplications, otherHealthComplication: normalizedHealth.otherHealthComplication };
    });
  };

  const readPhotoAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });

  const openAvatarFramer = async (event: React.ChangeEvent<HTMLInputElement>, source: AvatarFrameSource) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoMenuOpen(false);
    setPhotoStatus("Photo ready.");
    try {
      const imageDataUrl = await readPhotoAsDataUrl(file);
      setAvatarFrame({ imageDataUrl, source, zoom: 1, offsetX: 0, offsetY: 0 });
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : "Could not open that photo.");
    } finally {
      event.target.value = "";
    }
  };

  const beginAvatarGesture = (points: AvatarGesturePoint[]) => {
    if (!avatarFrame || points.length === 0) return;
    const center = getAvatarGestureCenter(points);
    avatarGestureStartRef.current = {
      zoom: avatarFrame.zoom,
      offsetX: avatarFrame.offsetX,
      offsetY: avatarFrame.offsetY,
      centerX: center.x,
      centerY: center.y,
      distance: getAvatarGestureDistance(points),
    };
  };

  const handleAvatarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!avatarFrame || isFramingAvatar || updateAvatar.isPending) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    avatarGesturePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginAvatarGesture(Array.from(avatarGesturePointersRef.current.values()));
  };

  const handleAvatarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!avatarFrame || !avatarGesturePointersRef.current.has(event.pointerId) || !avatarGestureStartRef.current) return;
    avatarGesturePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(avatarGesturePointersRef.current.values());
    const center = getAvatarGestureCenter(points);
    const start = avatarGestureStartRef.current;
    const distance = getAvatarGestureDistance(points);
    const nextZoom = distance && start.distance
      ? clampAvatarValue(start.zoom * (distance / start.distance), AVATAR_MIN_ZOOM, AVATAR_MAX_ZOOM)
      : start.zoom;
    const nextOffsetX = clampAvatarValue(start.offsetX + ((center.x - start.centerX) * AVATAR_PREVIEW_TO_CANVAS_RATIO), -AVATAR_MAX_OFFSET, AVATAR_MAX_OFFSET);
    const nextOffsetY = clampAvatarValue(start.offsetY + ((center.y - start.centerY) * AVATAR_PREVIEW_TO_CANVAS_RATIO), -AVATAR_MAX_OFFSET, AVATAR_MAX_OFFSET);
    setAvatarFrame((current) => current ? { ...current, zoom: nextZoom, offsetX: nextOffsetX, offsetY: nextOffsetY } : current);
  };

  const handleAvatarPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    avatarGesturePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const remainingPoints = Array.from(avatarGesturePointersRef.current.values());
    if (remainingPoints.length > 0) beginAvatarGesture(remainingPoints);
    else avatarGestureStartRef.current = null;
  };

  const cancelAvatarFraming = () => {
    setAvatarFrame(null);
    setIsFramingAvatar(false);
    setPhotoStatus(null);
  };

  const confirmAvatarFrame = async () => {
    if (!avatarFrame) return;
    setIsFramingAvatar(true);
    setPhotoStatus("Saving framed profile photo...");
    try {
      const imageDataUrl = await renderCircularAvatarFrame(avatarFrame);
      if (isLocalFallback) {
        const nextProfile = { ...(profile ?? {}), avatarUrl: imageDataUrl };
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
        setLocalProfile(nextProfile);
        setAvatarFrame(null);
        setPhotoStatus("Framed profile photo updated on this device.");
        window.setTimeout(() => setPhotoStatus(null), 2400);
        return;
      }
      updateAvatar.mutate({ imageDataUrl }, { onSuccess: () => setAvatarFrame(null) });
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : "Could not save that framed photo.");
    } finally {
      setIsFramingAvatar(false);
    }
  };

  const startEditing = (section: ProfileTabId = "personal") => {
    if (profile) setForm(profileToForm(profile));
    setSaved(false);
    setActiveEditTab(section);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (profile) setForm(profileToForm(profile));
    setIsEditing(false);
    setActiveEditTab("personal");
    setSaved(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isEditing) return;

    const healthSelection = normalizeHealthComplicationSelection(form.healthComplications, form.otherHealthComplication, form.gender);
    const allergySelection = normalizeFoodAllergySelection(form.foodAllergies, form.otherFoodAllergy);
    const weightValue = parseWeightValue(form.weight);
    const targetWeightValue = needsTargetWeight ? parseWeightValue(form.targetWeight) : null;
    const healthComplications = healthSelection.healthComplications.map((item) => item === "Other" && healthSelection.otherHealthComplication ? `Other: ${cleanOtherDetail(healthSelection.otherHealthComplication)}` : item);
    const foodAllergies = allergySelection.foodAllergies.map((item) => item === "Other" && allergySelection.otherFoodAllergy ? `Other: ${cleanOtherDetail(allergySelection.otherFoodAllergy)}` : item);
    const nextProfile = {
      ...(profile ?? {}),
      firstName: form.firstName.trim(),
      birthday: form.birthday,
      gender: form.gender as "Male" | "Female",
      weight: weightValue ?? 0,
      targetWeight: targetWeightValue,
      height: form.height,
      healthComplications: healthComplications.join(", "),
      dietRestrictions: normalizeDietRestrictionSelection(form.dietRestrictions).join(", "),
      foodAllergies: foodAllergies.join(", "),
      fitnessLevel: form.fitnessLevel,
      activityLevel: form.activityLevel,
      fitnessGoals: form.fitnessGoals.join(", "),
      additionalInfo: form.additionalInfo.trim() || null,
    };

    if (isLocalFallback) {
      window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
      setLocalProfile(nextProfile);
      setSaved(true);
      setIsEditing(false);
      setActiveEditTab("personal");
      window.setTimeout(() => setSaved(false), 2400);
      return;
    }

    updateProfile.mutate({
      firstName: nextProfile.firstName,
      birthday: nextProfile.birthday,
      gender: nextProfile.gender,
      weight: nextProfile.weight,
      targetWeight: nextProfile.targetWeight,
      height: nextProfile.height,
      healthComplications,
      dietRestrictions: normalizeDietRestrictionSelection(form.dietRestrictions),
      foodAllergies,
      fitnessLevel: nextProfile.fitnessLevel,
      activityLevel: nextProfile.activityLevel,
      fitnessGoals: form.fitnessGoals,
      additionalInfo: nextProfile.additionalInfo,
    });
  };

  if (loading || (Boolean(user) && profileQuery.isLoading)) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-card p-8 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading your profile...</p>
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
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">No profile yet</p>
            <h1 className="mt-4 font-display text-5xl font-light tracking-tight">Complete onboarding</h1>
            <p className="mt-4 text-muted-foreground">Your My Profile page is populated automatically from onboarding.</p>
            <Link href="/onboarding"><Button className="mt-8 rounded-full bg-primary text-primary-foreground">Start onboarding</Button></Link>
          </div>
        </section>
      </main>
    );
  }

  const profileSaving = !isLocalFallback && updateProfile.isPending;
  const activeTab = profileTabs.find((tab) => tab.id === activeEditTab) ?? profileTabs[0];

  return (
    <main className="min-h-screen bg-background text-foreground" data-profile-color-accents="minimal-cyan">
      <section className="container py-8 md:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <JimmiWordmark variant="member" />
          <nav className="flex items-center gap-3 text-sm">
            <MemberMenu memberName={profile.firstName} avatarUrl={profile.avatarUrl} isLocalFallback={isLocalFallback} />
          </nav>
        </header>

          <form onSubmit={handleSubmit} className="mt-8 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(143,232,216,0.08),transparent_30%),rgba(9,9,11,0.88)] p-4 shadow-2xl shadow-black/40 md:p-6" data-profile-color-pop="subtle-shell" data-profile-editing={isEditing ? "true" : "false"} data-profile-edit-mode={isEditing ? "category-triggered-tabs" : "readonly-summary"}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative size-24 shrink-0 rounded-full border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40" data-avatar-plus-upload="true">
                <div className="size-full overflow-hidden rounded-full">
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile avatar" className="size-full object-cover" /> : <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_35%_25%,rgba(143,232,216,0.30),rgba(255,255,255,0.05)_48%,rgba(0,0,0,0.3))] font-display text-4xl text-primary">{String(profile.firstName || "J").slice(0, 1)}</div>}
                </div>
                <button ref={photoMenuTriggerRef} type="button" aria-label="Add profile photo" onClick={() => setPhotoMenuOpen((open) => !open)} className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-xl shadow-black/50 transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/20">
                  {updateAvatar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-3.5" />}
                </button>
                {photoMenuOpen ? (
                  <div ref={photoMenuRef} className="absolute left-16 top-16 z-20 w-52 rounded-2xl border border-white/10 bg-black/90 p-2 shadow-2xl shadow-black/50 backdrop-blur" data-profile-photo-source-menu="true" data-profile-photo-outside-dismiss="enabled">
                    <button type="button" onClick={() => libraryInputRef.current?.click()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-white/10" data-profile-photo-update-action="native-picker"><ImageIcon className="size-4 text-primary" /> Update photo</button>
                  </div>
                ) : null}
                <input ref={libraryInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => openAvatarFramer(event, "library")} disabled={updateAvatar.isPending || isFramingAvatar} data-profile-library-input="true" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">My Profile</p>
                <h1 className="mt-4 font-display text-5xl font-light leading-none tracking-tight md:text-7xl">{profile.firstName}'s baseline</h1>
                {!isEditing && isLocalFallback ? <p className="mt-5 max-w-2xl text-muted-foreground">Preview changes are saved locally on this device until you sign in.</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {photoStatus ? <span className="text-sm text-muted-foreground">{photoStatus}</span> : null}
              {saved ? <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary"><CheckCircle2 className="size-4" /> Saved</span> : null}
              {isEditing ? (
                <>
                  <Button type="button" variant="outline" onClick={cancelEditing} className="rounded-full border-white/10 bg-transparent px-4 text-muted-foreground hover:border-white/30 hover:text-foreground" data-profile-cancel-edit="true"><X className="mr-2 size-4" /> Cancel</Button>
                  <span className="sr-only" data-profile-global-save="removed">Global save removed</span>
                </>
              ) : (
                <span className="sr-only" data-profile-global-edit="removed">Global edit removed</span>
              )}
            </div>
          </div>

          {updateProfile.error ? <p className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{updateProfile.error.message}</p> : null}

          <section className="mt-6 rounded-[1.5rem] border border-primary/15 bg-primary/[0.045] p-3 md:p-4" data-profile-macro-summary="compact-daily-targets" data-profile-macro-info-card="tap-for-context">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-primary">Daily Macro Targets</p>
                <p className="mt-1 text-xs text-muted-foreground">A compact starting point from your onboarding baseline.</p>
              </div>
              <Link href="/my-program" className="text-xs text-primary/70 hover:text-primary transition-colors">My Program</Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" data-profile-macro-grid="compact-four-up">
              {macroSummaryItems.map((item) => (
                <div key={item.key} className="rounded-2xl bg-black/20 px-3 py-3 shadow-[inset_1px_0_0_rgba(255,255,255,0.08)]" data-profile-macro-card={item.key}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-mono text-[0.58rem] uppercase tracking-[0.18em] ${PROFILE_MACRO_TITLE_TONES[item.key]}`} data-profile-macro-title-tone={item.key}>{item.label}</p>
                    <button type="button" aria-label={`${item.label} macro info`} onClick={() => setActiveMacroInfo((current) => current === item.key ? null : item.key)} className="grid size-5 place-items-center rounded-full border border-white/10 text-white/55 transition hover:border-primary/50 hover:text-primary" data-profile-macro-info-trigger={item.key}>
                      <Info className="size-3" />
                    </button>
                  </div>
                  <p className="mt-1 font-display text-2xl font-light tracking-tight">{item.value}<span className="ml-1 text-xs text-muted-foreground">{item.unit}</span></p>
                </div>
              ))}
            </div>
            {activeMacro ? <p className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-muted-foreground" role="status" data-profile-active-macro-info={activeMacro.key}><span className="text-primary">{activeMacro.label}:</span> {activeMacro.note}</p> : null}
          </section>

          {!isEditing ? (
            <div className="mt-6 space-y-3" data-profile-readonly-summary="compact-polished">
              <SummarySection id="personal" title="Personal baseline" summary="Name, age, gender, height, and current body-weight context." onEdit={startEditing}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" data-profile-readonly-grid="compact-polished">
                  <DisplayField label="First name" value={profile.firstName} />
                  <DisplayField label="Age" value={calculateAge(profile.birthday)} />
                  <DisplayField label="Gender" value={profile.gender} />
                  <DisplayField label="Weight" value={profile.weight ? `${profile.weight} lb` : "—"} />
                  <DisplayField label="Height" value={profile.height} />
                </div>
              </SummarySection>

              <SummarySection id="fitness" title="Fitness direction" summary="Activity level, training experience, goals, and target-weight context." onEdit={startEditing}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-profile-readonly-grid="compact-polished">
                  <DisplayField label="Fitness level" value={profile.fitnessLevel} />
                  <DisplayField label="Activity level" value={profile.activityLevel} />
                  <DisplayField label="Fitness goals" value={<TextList values={profile.fitnessGoals} />} />
                  <DisplayField label="Target weight" value={profile.targetWeight ? `${profile.targetWeight} lb` : "Not set"} />
                </div>
              </SummarySection>

              <SummarySection id="nutrition" title="Nutrition needs" summary="Diet pattern and allergy signals JIMMI should respect when planning meals." onEdit={startEditing}>
                <div className="grid gap-2 md:grid-cols-2" data-profile-readonly-grid="compact-polished">
                  <DisplayField label="Diet preferences" value={<TextList values={profile.dietRestrictions} />} />
                  <DisplayField label="Food allergies" value={<TextList values={profile.foodAllergies} />} />
                </div>
              </SummarySection>

              <SummarySection id="health" title="Health context" summary="Health conditions and additional coaching notes that may affect training or recovery." onEdit={startEditing}>
                <div className="grid gap-2 md:grid-cols-2" data-profile-readonly-grid="compact-polished">
                  <DisplayField label="Health conditions" value={<TextList values={profile.healthComplications} />} />
                  <DisplayField label="Additional notes" value={profile.additionalInfo || "—"} />
                </div>
              </SummarySection>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-black/10 p-2 md:p-3" data-profile-edit-workspace="category-triggered-tabs" data-profile-edit-boundaries="mobile-polished">
              <div className="grid min-w-0 gap-3 xl:grid-cols-[14.5rem_minmax(0,1fr)] xl:items-start" data-profile-category-edit-workspace={activeEditTab} data-profile-save-behavior="category-level">
                <aside className="min-w-0 xl:sticky xl:top-6">
                  <p className="sr-only">Edit profile section</p>
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1" role="tablist" aria-label="Profile edit sections" data-profile-edit-tabs="true" data-profile-edit-copy="removed" data-profile-category-tabs="true">
                    {profileTabs.map((tab) => {
                      const active = activeEditTab === tab.id;
                      return (
                        <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => setActiveEditTab(tab.id)} className={`rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-primary/15 ${active ? "bg-[#8fe8d8]/10 text-foreground shadow-[inset_2px_0_0_rgba(143,232,216,0.72)]" : "bg-white/[0.018] text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"}`} data-profile-edit-tab={tab.id}>
                          <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-primary">{tab.eyebrow}</span>
                          <span className="mt-1 block font-display text-lg font-light leading-none text-foreground">{tab.label}</span>
                          <span className="sr-only">{tab.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <div className="min-w-0 rounded-[1.25rem] bg-transparent p-1" data-profile-edit-panel={activeEditTab} data-profile-edit-panel-boundary="removed">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pb-1">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary">{activeTab.label}</p>
                    <Button type="submit" size="sm" disabled={profileSaving} className="h-8 rounded-full bg-primary px-3 text-xs text-primary-foreground" data-profile-category-save={activeEditTab}>
                      {profileSaving ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <Save className="mr-1.5 size-3" />}
                      Save {activeTab.label}
                    </Button>
                  </div>

                  {activeEditTab === "personal" ? (
                    <div className="grid min-w-0 gap-3 lg:grid-cols-2" data-profile-edit-section="personal" data-profile-birthday-layout="in-frame">
                      <FormField label="First name"><input className={inputClass} value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} required minLength={2} /></FormField>
                      <FormField label="Birthday" className="overflow-hidden" ><input className={`${inputClass} max-w-full appearance-none text-sm [color-scheme:dark] sm:text-base`} type="date" value={form.birthday} onChange={(event) => updateField("birthday", event.target.value)} required data-profile-birthday-input="contained" /></FormField>
                      <FormField label="Gender"><SelectInput value={form.gender} onChange={updateGender} options={genderOptions} placeholder="Select gender" /></FormField>
                      <FormField label="Weight"><input className={inputClass} type="number" min="50" max="700" value={form.weight} onChange={(event) => updateField("weight", event.target.value)} required /></FormField>
                      <FormField label="Height" className="lg:col-span-2"><HeightScrollSelector value={form.height} onChange={(value) => updateField("height", value)} /></FormField>
                    </div>
                  ) : null}

                  {activeEditTab === "fitness" ? (
                    <div className="grid gap-3 lg:grid-cols-2" data-profile-edit-section="fitness">
                      <FormField label="Fitness level"><ChoiceCardGrid value={form.fitnessLevel} options={fitnessLevelOptions} onChange={(value) => updateField("fitnessLevel", value)} /></FormField>
                      <FormField label="Activity level"><ChoiceCardGrid value={form.activityLevel} options={activityOptions} onChange={(value) => updateField("activityLevel", value)} /></FormField>
                      <FormField label="Fitness goals"><MultiChoiceCardGrid value={form.fitnessGoals} options={goalOptions} onChange={(value) => updateField("fitnessGoals", value)} /></FormField>
                      <FormField label="Target weight">
                        {needsTargetWeight ? <input className={inputClass} type="number" min="50" max="700" value={form.targetWeight} onChange={(event) => updateField("targetWeight", event.target.value)} placeholder="Target weight" required /> : <p className="rounded-xl bg-white/[0.018] px-3 py-2 text-sm text-muted-foreground">Select Lose weight to set a target.</p>}
                      </FormField>
                    </div>
                  ) : null}

                  {activeEditTab === "nutrition" ? (
                    <div className="grid gap-3 lg:grid-cols-2" data-profile-edit-section="nutrition">
                      <FormField label="Diet preferences"><SingleSelectDropdown value={form.dietRestrictions} options={dietOptions} onChange={(next) => updateField("dietRestrictions", normalizeDietRestrictionSelection(next))} placeholder="Choose one dietary option" /></FormField>
                      <FormField label="Food allergies">
                        <HealthConditionColumnGrid value={form.foodAllergies} options={allergyOptions} onChange={(next) => {
                          const normalized = normalizeFoodAllergySelection(next, form.otherFoodAllergy);
                          setForm((current) => ({ ...current, foodAllergies: normalized.foodAllergies, otherFoodAllergy: normalized.otherFoodAllergy }));
                        }} />
                        {form.foodAllergies.includes("Other") ? <input className={`${inputClass} mt-3`} value={form.otherFoodAllergy} onChange={(event) => updateField("otherFoodAllergy", event.target.value)} placeholder="Describe the allergy" required /> : null}
                      </FormField>
                    </div>
                  ) : null}

                  {activeEditTab === "health" ? (
                    <div className="grid gap-3 lg:grid-cols-2" data-profile-edit-section="health">
                      <FormField label="Health conditions">
                        <HealthConditionColumnGrid value={form.healthComplications} options={visibleHealthOptions} onChange={(next) => {
                          const normalized = normalizeHealthComplicationSelection(next, form.otherHealthComplication, form.gender);
                          setForm((current) => ({ ...current, healthComplications: normalized.healthComplications, otherHealthComplication: normalized.otherHealthComplication }));
                        }} />
                        {form.healthComplications.includes("Other") ? <input className={`${inputClass} mt-3`} value={form.otherHealthComplication} onChange={(event) => updateField("otherHealthComplication", event.target.value)} placeholder="Describe the condition" required /> : null}
                      </FormField>
                      <FormField label="Additional notes"><textarea className={`${inputClass} min-h-24 resize-none`} value={form.additionalInfo} onChange={(event) => updateField("additionalInfo", event.target.value)} placeholder="Anything JIMMI should account for when coaching you." /></FormField>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </form>

        {avatarFrame ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/72 px-4 pb-3 pt-20 backdrop-blur-md sm:items-start sm:pt-24" role="dialog" aria-modal="true" aria-labelledby="avatar-framer-title" data-profile-avatar-framer="circular-preview" data-profile-avatar-framer-placement="upper">
            <div className="w-full max-w-sm rounded-[1.5rem] border border-white/10 bg-card p-3 shadow-2xl shadow-black/70 md:p-4" data-profile-avatar-framer-shell="compact-polished" data-profile-avatar-framer-spacing="minimized">
              <div className="flex items-center justify-between gap-3">
                <p id="avatar-framer-title" className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary">Framer</p>
                <button type="button" aria-label="Close avatar framer" onClick={cancelAvatarFraming} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-muted-foreground transition hover:border-white/25 hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="mt-3 grid place-items-center" data-profile-avatar-frame-preview="circle" data-profile-avatar-frame-gesture="drag-pinch-touch">
                <div
                  className="relative size-56 touch-none overflow-hidden rounded-full border border-primary/35 bg-black shadow-2xl shadow-black/50 ring-4 ring-white/[0.035] sm:size-60"
                  onPointerDown={handleAvatarPointerDown}
                  onPointerMove={handleAvatarPointerMove}
                  onPointerUp={handleAvatarPointerEnd}
                  onPointerCancel={handleAvatarPointerEnd}
                  onPointerLeave={handleAvatarPointerEnd}
                  data-profile-avatar-touch-surface="true"
                >
                  <img
                    src={avatarFrame.imageDataUrl}
                    alt="Selected profile photo preview"
                    draggable={false}
                    className="absolute left-1/2 top-1/2 max-w-none select-none"
                    style={{
                      width: `${100 * avatarFrame.zoom}%`,
                      height: `${100 * avatarFrame.zoom}%`,
                      objectFit: "cover",
                      transform: `translate(calc(-50% + ${avatarFrame.offsetX / AVATAR_PREVIEW_TO_CANVAS_RATIO}px), calc(-50% + ${avatarFrame.offsetY / AVATAR_PREVIEW_TO_CANVAS_RATIO}px))`,
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(143,232,216,0.55),inset_0_0_38px_rgba(0,0,0,0.25)]" />
                </div>
              </div>

              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end" data-profile-avatar-frame-actions="compact">
                <Button type="button" variant="outline" onClick={cancelAvatarFraming} className="h-9 rounded-full border-white/10 bg-transparent px-4 text-sm text-muted-foreground hover:border-white/30 hover:text-foreground">Cancel</Button>
                <Button type="button" onClick={confirmAvatarFrame} disabled={isFramingAvatar || updateAvatar.isPending} className="h-9 rounded-full bg-primary px-4 text-sm text-primary-foreground" data-profile-avatar-frame-save="true">
                  {isFramingAvatar || updateAvatar.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-3.5" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
