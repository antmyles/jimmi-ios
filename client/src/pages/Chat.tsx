import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Link, useLocation } from "wouter";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, FileUp, LockKeyhole, Loader2, Mic, PlayCircle, Plus, Save, ScanBarcode, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Message } from "@/components/AIChatBox";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { JimmiWebGLOrb, type JimmiOrbState } from "@/components/jimmi-orb";
import { MemberMenu } from "@/components/MemberMenu";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { shouldRouteMicrophoneThroughJimmiDomain, redirectToJimmiPublicDomainForMicrophone } from "@/lib/jimmiBranding";
import { cn } from "@/lib/utils";
import { isNative } from "@/lib/capacitor";

const voiceSilenceDelayMs = 700;
const postFollowUpNoInputMs = 2000;
const voiceActivityThreshold = 0.006;
const minVoiceRecordingMs = 900;
const minDetectedSpeechMs = 120;
const minVoiceBlobBytes = 900;
const voiceFallbackSubmitMs = 30000;
const minVisibleTextThinkingMs = 900;
const silentAudioUnlockDataUri = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
const LOCAL_PROFILE_KEY = "jimmi-local-onboarding-profile";
const LOCAL_TOUR_SEEN_KEY = "jimmi-local-feature-tour-seen";
const FEATURE_TOUR_QUERY_PARAM = "localOnboarding";

const featureTourSteps = [
  {
    eyebrow: "Your coach",
    title: "Talk to JIMMI in plain language",
    body: "Ask for workouts, recovery guidance, nutrition ideas, or help staying consistent. JIMMI uses your onboarding profile as context.",
  },
  {
    eyebrow: "Food tools",
    title: "Scan meals and barcodes",
    body: "Use the plus button to scan food, review macro estimates, and save useful entries to your Food Log.",
  },
  {
    eyebrow: "Program support",
    title: "Add plans and progress context",
    body: "Upload training notes or program files so JIMMI can help interpret them and keep your coaching more specific.",
  },
  {
    eyebrow: "Nutrition tracking",
    title: "Your calorie and macro balance, always in view",
    body: "JIMMI calculates your daily targets based on your goals and body stats. Log meals to track your calorie balance, protein, carbs, and fat \u2014 to see how your intake stacks up each day.",
  },
  {
    eyebrow: "Plans built for you",
    title: "Training and meal plans, generated around your life",
    body: "JIMMI can build a full weekly training program or a personalized meal plan based on your goals, schedule, and dietary preferences. Find them in the Training Plan and Meal Plan sections anytime.",
  },
] as const;

function normalizeTranscriptForIntentGuard(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExternalTranscriptionWatermark(value: string) {
  const normalized = normalizeTranscriptForIntentGuard(value);
  if (!normalized) return false;
  const compact = normalized.replace(/\s+/g, "");
  return (
    /\btranscribed\s+by\s+(?:https\s+)?(?:www\s+)?otter\s+ai\b/.test(normalized) ||
    (/\botter\s+ai\b/.test(normalized) && /\btranscrib(?:ed|er|ing|tion)\b/.test(normalized)) ||
    compact === "transcribedbyotterai" ||
    compact === "transcribedbyhttpsotterai"
  );
}

type ChatVideoEmbed = {
  provider: "youtube";
  exerciseName: string;
  title: string;
  embedUrl: string;
  watchUrl: string;
};

const localExerciseDemoTriggerPattern = /\b(show me a|show me how to|show me how to do|how do you do a|can you show me how to do|show me a video of|show me an example of)\b/i;
const localExerciseDemoTriggerMatchers = [
  /\bcan you show me how to do\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me how to do\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me how to\s+(?:do\s+)?(?:a|an|the)?\s*(.+)$/i,
  /\bhow do you do\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me a video of\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me an example of\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me a\s+(.+)$/i,
] as const;
const localExerciseVideoIds: Array<[RegExp, string]> = [
  [/\bpush\s?up\b/i, "IODxDxX7oi4"],
  [/\bsquat\b/i, "aclHkVaku9U"],
  [/\bdeadlift\b/i, "op9kVnSso6Q"],
  [/\blunge\b/i, "QOVaHwm-Q6U"],
  [/\bplank\b/i, "pSHjTRCQxIw"],
  [/\bpull\s?up\b/i, "eGo4IYlbE5g"],
  [/\bbench press\b/i, "rT7DgCr-3pg"],
  [/\bshoulder press\b|\boverhead press\b/i, "qEwKCR5JCog"],
  [/\bburpee\b/i, "auBLPXO8Fww"],
  [/\bglute bridge\b|\bhip bridge\b/i, "wPM8icPu6H8"],
  [/\bbicep curl\b|\bcurl\b/i, "ykJmrZ5v0Oo"],
  [/\bmountain climber\b/i, "nmwgirgXLYM"],
];
function readLocalOnboardingProfile() {
  if (typeof window === "undefined") return null;
  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return rawProfile ? JSON.parse(rawProfile) : null;
  } catch {
    return null;
  }
}

function formatProfileValue(value: unknown, fallback: string) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(", ") || fallback;
  if (typeof value === "string") return value.trim() || fallback;
  return fallback;
}

function titleCaseExercise(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function sanitizeExerciseRequest(value: string) {
  return value
    .replace(/[?.!]+$/g, "")
    .replace(/\b(?:please|for me|exercise|video|demo|demonstration|tutorial|form)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function extractLocalExerciseDemoRequest(prompt: string) {
  const normalizedPrompt = prompt.trim();
  if (!localExerciseDemoTriggerPattern.test(normalizedPrompt)) return null;
  for (const matcher of localExerciseDemoTriggerMatchers) {
    const match = normalizedPrompt.match(matcher);
    const exerciseName = sanitizeExerciseRequest(match?.[1] ?? "");
    if (exerciseName) return titleCaseExercise(exerciseName);
  }
  return null;
}

function buildLocalVideoEmbed(prompt: string): ChatVideoEmbed | null {
  const exerciseName = extractLocalExerciseDemoRequest(prompt);
  if (!exerciseName) return null;
  const videoId = localExerciseVideoIds.find(([pattern]) => pattern.test(exerciseName))?.[1];
  if (!videoId) return null;
  return {
    provider: "youtube",
    exerciseName,
    title: `${exerciseName} demo`,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

const localInputCorrections: Array<[RegExp, string]> = [
  [/\bgood\s*(?:morning|mornin|mornig|moring)\b/gi, "good morning"],
  [/\bgood\s*(?:afternoon|afternon|aftrnoon)\b/gi, "good afternoon"],
  [/\bgood\s*(?:evening|evenin|evning)\b/gi, "good evening"],
  [/\b(?:jimi|jimmy)\b/gi, "jimmi"],
  [/\b(?:excersize|excercise|exercize)\b/gi, "exercise"],
  [/\b(?:workot|wrkout|work out)\b/gi, "workout"],
  [/\b(?:traning|trainning)\b/gi, "training"],
  [/\bprotien\b/gi, "protein"],
  [/\b(?:nutricion|nutriton)\b/gi, "nutrition"],
  [/\bhydraton\b/gi, "hydration"],
  [/\brecovry\b/gi, "recovery"],
  [/\bstrenght\b/gi, "strength"],
  [/\b(?:slep|sleeep)\b/gi, "sleep"],
  [/\b(?:tetsing|testng)\b/gi, "testing"],
];

function normalizeLocalPromptForRouting(value: string) {
  return localInputCorrections.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    value
      .trim()
      .replace(/[’`]/g, "'")
      .replace(/\s+/g, " "),
  );
}

function isCasualGreeting(prompt: string) {
  return /^(hi|hello|hey|yo|good\s*morning|good\s*afternoon|good\s*evening|what's up|whats up|sup)(?:[\s,]+(?:jimmi|jimmy|coach|there))?[.!?\s]*$/i.test(normalizeLocalPromptForRouting(prompt));
}

function buildLocalCoachingReply(prompt: string, profile: any): Message & { videoEmbed?: ChatVideoEmbed } {
  const videoEmbed = buildLocalVideoEmbed(prompt);
  if (videoEmbed) {
    return {
      role: "assistant",
      content: `Here’s a video demo for **${videoEmbed.exerciseName}**. Would you like a written explanation as well?`,
      videoEmbed,
    };
  }

  const lowerPrompt = normalizeLocalPromptForRouting(prompt).toLowerCase();
  const firstName = formatProfileValue(profile?.firstName, "there");
  const goals = formatProfileValue(profile?.fitnessGoals, "your selected goals");
  const activityLevel = formatProfileValue(profile?.activityLevel, "your current activity level");
  const fitnessLevel = formatProfileValue(profile?.fitnessLevel, "your current fitness level");
  const restrictions = formatProfileValue(profile?.dietRestrictions, "your dietary restrictions");
  const dietaryPreferences = formatProfileValue(profile?.dietaryPreferences, "your personal food preferences");
  const allergies = formatProfileValue(profile?.foodAllergies, "your food allergy context");
  const health = formatProfileValue(profile?.healthComplications, "your health context");
  const medicalNote = /pain|injur|doctor|medical|heart|diabetes|blood|asthma|pregnan|allerg/.test(lowerPrompt)
    ? " JIMMI is not a medical professional — consult your physician."
    : "";

  if (isCasualGreeting(prompt)) {
    return {
      role: "assistant",
      content: `Good to see you, ${firstName} — I’m JIMMI, your personal fitness coach. How can I help with your fitness journey today?`,
    };
  }

  if (/meal|food|macro|protein|calorie|nutrition|eat|diet|hydration|water/.test(lowerPrompt)) {
    return {
      role: "assistant",
      content: `${firstName}, I can help with that.${medicalNote} I’ll keep ${restrictions}, ${dietaryPreferences}, and ${allergies} in mind. A strong starting point is a protein-forward plate, a high-fiber carb, colorful produce, and water. Want me to turn that into a simple meal option for today?`,
    };
  }

  if (/workout|training|lift|cardio|exercise|mobility|recovery|program|routine|strength|run|gym/.test(lowerPrompt)) {
    return {
      role: "assistant",
      content: `${firstName}, here’s a smart starting point.${medicalNote} Warm up first, use controlled form, keep 1–2 reps in reserve, and match the session to what your body can handle today. Want me to write the first workout?`,
    };
  }

  return {
    role: "assistant",
    content: `I’ve got you, ${firstName}.${medicalNote} Tell me what you want help with today — training, meals, recovery, or just getting a plan started.`,
  };
}

type JimmiOrbTopic = "general" | "training" | "nutrition" | "recovery";
type OrbVoiceState = JimmiOrbState;

type MicPromptStatus = "idle" | "granted" | "denied" | "unsupported";

type SmartFoodScanResult = {
  source: "camera" | "barcode" | "restaurant";
  foodName: string;
  serving?: string;
  portion?: string;
  confidence?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  guidance: string;
  suggestion?: string;
  suggestedMealType?: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  sourceNote?: string;
  dataSource?: string;
};

type FoodLogReviewDraft = {
  sourceResult: SmartFoodScanResult;
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  foodName: string;
  serving: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type ProgramScanResult = {
  title: string;
  summary: string;
  suggestions: string[];
  caution?: string;
  imported?: boolean;
  importMessage?: string;
  importedProgram?: {
    id: number;
    title: string;
    route: string;
    trainingDayCount: number;
  } | null;
};

type FoodLoggedInfo = {
  foodName: string;
  mealType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logDate: string;
};

type ChatThreadMessage = Message & {
  videoEmbed?: ChatVideoEmbed;
  scanResult?: SmartFoodScanResult;
  programScanResult?: ProgramScanResult;
  foodLogged?: FoodLoggedInfo;
  tierLimitReached?: boolean;
  createdAt?: Date;
};

function todayLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function scanResultMessage(result: SmartFoodScanResult) {
  const context = result.source === "camera" ? "from your photo" : result.source === "barcode" ? "from that barcode" : "from your restaurant description";
  return `I identified **${result.foodName}** ${context}. Here are the estimated macros and guidance. You can keep chatting with me below, or save it to your Food Log if it looks right. You will be able to review and edit the numbers before the log is saved.`;
}

function isLikelyRestaurantMacroRequest(content: string) {
  const normalized = content.toLowerCase();
  const hasRestaurantName = /\b(chipotle|mcdonald|mcdonalds|mcdonald[’']s|subway|taco bell|wendy[’']s|wendys|starbucks|panera|chick-fil-a|chick fil a|burger king|restaurant|franchise)\b/.test(normalized);
  const hasEatingIntent = /\b(ate|had|ordered|got|food|meal|burrito|bowl|sandwich|burger|wrap|salad|pizza|taco|breakfast|lunch|dinner|snack|calorie|macro|protein|carbs|fat)\b/.test(normalized);
  return hasRestaurantName && hasEatingIntent;
}

function toPositiveIntInput(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

const fatalRecognitionErrors = new Set(["not-allowed", "service-not-allowed"]);
const nonFatalRecognitionErrors = new Set(["aborted", "no-speech", "network", "audio-capture", "language-not-supported", "bad-grammar"]);

type BrowserBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string; format?: string }>>;
};

type BrowserWithBarcodeDetector = typeof window & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BrowserBarcodeDetector;
};

const supportedBarcodeFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"] as const;
const zxingBarcodeFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF];

function isFatalRecognitionError(error?: string) {
  return Boolean(error && fatalRecognitionErrors.has(error));
}

function isNonFatalRecognitionError(error?: string) {
  return !error || nonFatalRecognitionErrors.has(error) || !isFatalRecognitionError(error);
}

type BrowserWithSpeechRecognition = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

function getSupportedVoiceRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function splitList(value?: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  const browserWindow = window as BrowserWithSpeechRecognition;
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") return undefined;
  const browserWindow = window as BrowserWithSpeechRecognition;
  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
}

function triggerOrbHapticFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([20, 20, 20]);
  }
}

function isEmbeddedPreviewContext() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function detectMessageTopic(content: string): JimmiOrbTopic {
  const normalizedContent = content.toLowerCase();
  if (/meal|food|calorie|protein|carb|fat|macro|nutrition|diet|eat|breakfast|lunch|dinner|snack/.test(normalizedContent)) return "nutrition";
  if (/recover|sleep|rest|sore|mobility|stretch|pain|injur|stress|hydration/.test(normalizedContent)) return "recovery";
  if (/workout|training|lift|cardio|exercise|strength|muscle|run|sprint|athletic|performance/.test(normalizedContent)) return "training";
  return "general";
}

function normalizeVoiceClosingReply(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isVoiceSessionClosingReply(value: string) {
  const normalizedValue = normalizeVoiceClosingReply(value);
  if (!normalizedValue || normalizedValue.length > 80) return false;

  const exactClosingReplies = new Set([
    "no",
    "nah",
    "nope",
    "nope thanks",
    "nope thank you",
    "nope thats it",
    "nope that is it",
    "nope thatll be all",
    "nope that will be all",
    "nope im good",
    "nope i am good",
    "nope im all set",
    "nope i am all set",
    "nope all good",
    "nope nothing else",
    "nope nothing more",
    "no thanks",
    "no thank you",
    "no thats it",
    "no that is it",
    "no thatll be all",
    "no that will be all",
    "no im good",
    "no i am good",
    "no im all set",
    "no i am all set",
    "no all good",
    "no nothing else",
    "no nothing more",
    "thats it",
    "that is it",
    "thatll be all",
    "that will be all",
    "im good",
    "i am good",
    "im all set",
    "i am all set",
    "all good",
    "all set",
    "nothing else",
    "nothing more",
    "nothing right now",
    "nothing at the moment",
    "nothing for now",
    "nothing today",
    "nothing else thanks",
    "nothing else thank you",
    "nothing more thanks",
    "nothing more thank you",
    "nothing right now thanks",
    "nothing right now thank you",
    "nothing at the moment thanks",
    "nothing at the moment thank you",
    "nothing for now thanks",
    "nothing for now thank you",
    "nothing today thanks",
    "nothing today thank you",
    "we are good",
    "were good",
    "thanks thats it",
    "thank you thats it",
  ]);

  if (exactClosingReplies.has(normalizedValue)) return true;

  const noPrefixedClosurePattern = /^(?:no|nah|nope)\s+(?:thats it|that is it|thatll be all|that will be all|im good|i am good|im all set|i am all set|all good|nothing else|nothing more|thanks|thank you)$/;
  const nothingClosurePattern = /^nothing(?:\s+(?:else|more|right now|at (?:the )?moment|for now|today))?(?:\s+(?:thanks|thank you))?$/;
  return noPrefixedClosurePattern.test(normalizedValue) || nothingClosurePattern.test(normalizedValue);
}


export default function Chat() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [location, setLocation] = useLocation();
  const [localProfile] = useState<any>(() => readLocalOnboardingProfile());
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const chatHistoryQuery = trpc.chat.history.useQuery(undefined, { enabled: Boolean(user), retry: false, staleTime: 0 });
  const settingsQuery = trpc.account.settings.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const wearableQuery = trpc.account.wearableState.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const utils = trpc.useUtils();
  const chatSaveMessageMutation = trpc.chat.saveMessage.useMutation();
  const markTourSeenMutation = trpc.onboarding.markTourSeen.useMutation({
    onSuccess: () => {
      void utils.onboarding.get.invalidate();
    },
  });
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [micPromptStatus, setMicPromptStatus] = useState<MicPromptStatus>("idle");
  const [orbVoiceState, setOrbVoiceState] = useState<OrbVoiceState>("idle");
  const [lastMessageTopic, setLastMessageTopic] = useState<JimmiOrbTopic>("general");
  const [, setOrbStatusText] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [isResponseInterrupted, setIsResponseInterrupted] = useState(false);
  const [voicePlaybackStatus, setVoicePlaybackStatus] = useState("");
  const suppressNextAssistantResponseRef = useRef(false);
  const pendingVoiceResponseRef = useRef(false);
  const textThinkingStartedAtRef = useRef(0);
  const activeJimmiAudioRef = useRef<HTMLAudioElement | null>(null);
  const primedJimmiAudioRef = useRef<HTMLAudioElement | null>(null);
  const isJimmiAudioPrimedRef = useRef(false);
  const speechPlaybackTokenRef = useRef(0);
  const shouldResumeListeningAfterSpeechRef = useRef(false);
  const restartListeningAfterSpeechRef = useRef<(() => void) | null>(null);
  const voiceTeardownPromiseRef = useRef<Promise<void> | null>(null);
  const voiceAnalyserContextRef = useRef<AudioContext | null>(null);
  const voiceAnalyserFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedVoiceChunksRef = useRef<Blob[]>([]);
  const voiceRecordingStartedAtRef = useRef(0);
  const voiceSpeechStartedAtRef = useRef(0);
  const activeMicStreamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const voiceFallbackSubmitTimerRef = useRef<number | null>(null);
  const postFollowUpNoInputTimerRef = useRef<number | null>(null);
  const shouldStartPostFollowUpNoInputTimerRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const hasDetectedSpeechRef = useRef(false);
  const shouldKeepListeningRef = useRef(false);
  const voiceCaptureGenerationRef = useRef(0);
  const isChatVoiceMountedRef = useRef(true);
  const ignoreRecognitionEndRef = useRef(false);
  const suppressRecognitionErrorRef = useRef(false);
  const recognitionEndedAfterRecoverableErrorRef = useRef(false);
  const [isComposerDictating, setIsComposerDictating] = useState(false);
  const composerDictationRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const composerDictationFinalRef = useRef("");
  const composerDictationInterimRef = useRef("");
  const composerDictationShouldListenRef = useRef(false);
  const composerDictationRestartTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatRetryCountRef = useRef(0);
  const chatRetryPayloadRef = useRef<Array<{ role: "user" | "assistant"; content: string }> | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const programFileInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  // Ref callback: when the video element unmounts (node = null), capture any
  // live stream from srcObject into barcodeScannerStreamRef so stopBarcodeScanner
  // can still stop the tracks even though the element is gone from the DOM.
  const barcodeVideoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    if (!node && barcodeVideoRef.current) {
      // Video is unmounting — grab the stream before it's lost.
      const liveStream = barcodeVideoRef.current.srcObject instanceof MediaStream ? barcodeVideoRef.current.srcObject : null;
      if (liveStream) {
        liveStream.getTracks().forEach((track) => track.stop());
      }
    }
    barcodeVideoRef.current = node;
  }, []);
  const barcodeScannerStreamRef = useRef<MediaStream | null>(null);
  const barcodeScanFrameRef = useRef<number | null>(null);
  const barcodeScannerControlsRef = useRef<IScannerControls | null>(null);
  const hasBarcodeScanCompletedRef = useRef(false);
  const chatResizeDragRef = useRef<{ startY: number; startExpanded: boolean } | null>(null);
  const hydratedChatMessageCountRef = useRef(-1); // -1 = never hydrated; >=0 = count of messages last loaded from server
  const [isPlusPanelOpen, setIsPlusPanelOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [barcodeScannerStatus, setBarcodeScannerStatus] = useState("");
  const [activeFoodScan, setActiveFoodScan] = useState<SmartFoodScanResult | null>(null);
  const [programScanResult, setProgramScanResult] = useState<ProgramScanResult | null>(null);
  const [scanStatusText, setScanStatusText] = useState("");
  const [saveScanStatusText, setSaveScanStatusText] = useState("");
  const [foodLogReviewDraft, setFoodLogReviewDraft] = useState<FoodLogReviewDraft | null>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [featureTourStepIndex, setFeatureTourStepIndex] = useState(0);
  const [isFeatureTourOpen, setIsFeatureTourOpen] = useState(false);
  const hasConsideredFeatureTourRef = useRef(false);
  // Permission rationale dialogs — shown once before the first camera/mic request
  const [showCameraRationale, setShowCameraRationale] = useState(false);
  const [pendingBarcodeOpen, setPendingBarcodeOpen] = useState(false);
  const [showMicRationale, setShowMicRationale] = useState(false);
  const [pendingVoiceStart, setPendingVoiceStart] = useState(false);
  const [upgradeModalState, setUpgradeModalState] = useState<{ isOpen: boolean; feature: string; tier: "core" | "pro" | "elite" } | null>(null);
  const isChatExpandedRef = useRef(false);
  const profile = profileQuery.data ?? localProfile;
  const isLocalFallback = !user && Boolean(localProfile);
  const planTier = settingsQuery.data?.planTier ?? "free";
  const isCorePlus = planTier === "core" || planTier === "pro" || planTier === "elite";
  const connectedWearableProvider = wearableQuery.data?.connected ? wearableQuery.data.provider : null;
  const wearableDisplayName = connectedWearableProvider === "oura" ? "Oura" : connectedWearableProvider === "whoop" ? "WHOOP" : connectedWearableProvider === "fitbit" ? "Fitbit" : null;
  const goals = useMemo(() => splitList(profile?.fitnessGoals), [profile?.fitnessGoals]);
  const restrictions = useMemo(() => splitList(profile?.dietRestrictions), [profile?.dietRestrictions]);
  const allergies = useMemo(() => splitList(profile?.foodAllergies), [profile?.foodAllergies]);
  const health = useMemo(() => splitList(profile?.healthComplications), [profile?.healthComplications]);

  const handleChatResizePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    chatResizeDragRef.current = { startY: event.clientY, startExpanded: isChatExpanded };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [isChatExpanded]);

  const handleChatResizePointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const drag = chatResizeDragRef.current;
    if (!drag) return;
    const deltaY = event.clientY - drag.startY;
    if (deltaY > 28) { isChatExpandedRef.current = true; setIsChatExpanded(true); }
    if (deltaY < -28) { isChatExpandedRef.current = false; setIsChatExpanded(false); }
  }, []);

  const handleChatResizePointerEnd = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const drag = chatResizeDragRef.current;
    chatResizeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaY) < 10) {
      setIsChatExpanded((current) => {
        isChatExpandedRef.current = !current;
        return !current;
      });
    }
  }, []);

  useEffect(() => {
    if (!user || chatHistoryQuery.isLoading || !chatHistoryQuery.data) return;
    const savedMessages = chatHistoryQuery.data.messages.map((message) => ({ role: message.role, content: message.content, createdAt: message.createdAt ? new Date(message.createdAt) : undefined }) satisfies ChatThreadMessage);
    const serverCount = savedMessages.length;
    const lastHydratedCount = hydratedChatMessageCountRef.current;
    // First load: always hydrate if server has messages.
    // Subsequent loads (background refetch): only re-hydrate if the server returned more
    // messages AND the user hasn't sent any new messages in this session (i.e. local
    // message count still equals what we last loaded — no in-progress conversation to protect).
    const isFirstLoad = lastHydratedCount === -1;
    const serverHasMoreMessages = serverCount > lastHydratedCount;
    if (!isFirstLoad && !serverHasMoreMessages) return;
    // Don't overwrite an active conversation: if the user has already sent messages
    // beyond what we last hydrated, leave the local state alone.
    setMessages((current) => {
      if (!isFirstLoad && current.length > lastHydratedCount) return current;
      if (serverCount === 0) return current; // server returned nothing; keep current
      hydratedChatMessageCountRef.current = serverCount;
      return savedMessages;
    });
  }, [chatHistoryQuery.data, chatHistoryQuery.isLoading, user]);

  useEffect(() => {
    if (!profile || messages.length > 0) return;
    // If the user is logged in, wait until chat history has fully loaded before
    // deciding whether to show the welcome message. This prevents the welcome
    // message from overwriting saved history when both are available on the same
    // render cycle (e.g. after cache-seeded re-login where hydratedChatMessageCountRef
    // hasn't been set yet because both effects run in the same React batch).
    if (user) {
      // Still loading — wait for the query to settle
      if (chatHistoryQuery.isLoading) return;
      // History loaded and has messages — the hydration effect will set them;
      // don't overwrite with the welcome message
      if (chatHistoryQuery.data && chatHistoryQuery.data.messages.length > 0) return;
      // History loaded but empty (new user or expired) — show welcome message
    }
    setMessages([
      {
        role: "assistant",
        content: `Welcome, ${profile.firstName} — I'm JIMMI, your personal fitness coach. I can help with training, recovery, meals, macros, sleep, hydration, and staying consistent. How can I support your fitness journey today?`,
      },
    ]);
  }, [chatHistoryQuery.data, chatHistoryQuery.isLoading, messages.length, profile, user]);

  useEffect(() => {
    if (!profile || hasConsideredFeatureTourRef.current) return;
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    const arrivedFromOnboarding = query.get(FEATURE_TOUR_QUERY_PARAM) === "1";
    if (!arrivedFromOnboarding) return;

    hasConsideredFeatureTourRef.current = true;
    const localTourSeen = window.localStorage.getItem(LOCAL_TOUR_SEEN_KEY) === "1";
    if (profile.tourSeen || localTourSeen) return;

    setFeatureTourStepIndex(0);
    setIsFeatureTourOpen(true);
  }, [profile]);

  const clearFeatureTourRouteMarker = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(FEATURE_TOUR_QUERY_PARAM)) return;
    url.searchParams.delete(FEATURE_TOUR_QUERY_PARAM);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl || "/chat");
  }, []);

  const completeFeatureTour = useCallback(() => {
    setIsFeatureTourOpen(false);
    clearFeatureTourRouteMarker();
    if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_TOUR_SEEN_KEY, "1");
    if (user && !profile?.tourSeen) {
      markTourSeenMutation.mutate();
    }
  }, [clearFeatureTourRouteMarker, markTourSeenMutation, profile?.tourSeen, user]);

  const handleFeatureTourNext = useCallback(() => {
    setFeatureTourStepIndex((currentStep) => {
      if (currentStep >= featureTourSteps.length - 1) {
        completeFeatureTour();
        return currentStep;
      }
      return currentStep + 1;
    });
  }, [completeFeatureTour]);

  const activeFeatureTourStep = featureTourSteps[featureTourStepIndex];

  const persistAssistantMessage = useCallback((message: ChatThreadMessage) => {
    setMessages((current) => [...current, message]);
    if (user) chatSaveMessageMutation.mutate({ role: "assistant", content: message.content });
  }, [chatSaveMessageMutation, user]);

  const getJimmiAudioElement = useCallback(() => {
    if (typeof Audio === "undefined") return null;
    if (!primedJimmiAudioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      primedJimmiAudioRef.current = audio;
    }
    return primedJimmiAudioRef.current;
  }, []);

  const primeJimmiAudioPlayback = useCallback(() => {
    const audio = getJimmiAudioElement();
    if (!audio || isJimmiAudioPrimedRef.current) return;
    audio.muted = true;
    audio.volume = 0;
    audio.src = silentAudioUnlockDataUri;
    const unlockPromise = audio.play();
    if (!unlockPromise) {
      isJimmiAudioPrimedRef.current = true;
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
      return;
    }
    unlockPromise
      .then(() => {
        isJimmiAudioPrimedRef.current = true;
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audio.volume = 1;
      })
      .catch(() => {
        audio.muted = false;
        audio.volume = 1;
      });
  }, [getJimmiAudioElement]);

  const releaseJimmiAudioElement = useCallback(() => {
    const audio = primedJimmiAudioRef.current ?? activeJimmiAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    audio.removeAttribute("src");
    audio.load();
    activeJimmiAudioRef.current = null;
  }, []);

  const stopJimmiAudioPlayback = useCallback((statusText = "JIMMI voice stopped. Tap the orb when you’re ready to speak again.") => {
    speechPlaybackTokenRef.current += 1;
    releaseJimmiAudioElement();
    setVoicePlaybackStatus(statusText);
    setOrbVoiceState("idle");
    setOrbStatusText(statusText);
  }, [releaseJimmiAudioElement]);

  const playJimmiAudio = useCallback((audioUrl: string) => {
    if (!audioUrl) return;
    const playbackToken = speechPlaybackTokenRef.current + 1;
    speechPlaybackTokenRef.current = playbackToken;
    const shouldResumeListening = shouldResumeListeningAfterSpeechRef.current;
    const resolvedAudioUrl = audioUrl.startsWith("data:") || audioUrl.startsWith("blob:") ? audioUrl : new URL(audioUrl, window.location.origin).toString();
    const audio = getJimmiAudioElement();
    if (!audio) {
      setVoicePlaybackStatus("JIMMI voice could not initialize in this browser. Tap the orb to speak again.");
      setOrbVoiceState("idle");
      setOrbStatusText("JIMMI responded in text. Tap the orb to speak again.");
      shouldResumeListeningAfterSpeechRef.current = false;
      return;
    }

    let hasMarkedPlaybackStarted = false;
    const markPlaybackStarted = () => {
      if (speechPlaybackTokenRef.current !== playbackToken || hasMarkedPlaybackStarted) return;
      hasMarkedPlaybackStarted = true;
      activeJimmiAudioRef.current = audio;
      setVoicePlaybackStatus("JIMMI is speaking now.");
      setOrbVoiceState("speaking");
      setOrbStatusText("JIMMI is speaking. Tap the orb to interrupt.");
    };

    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    audio.muted = false;
    audio.volume = 1;
    audio.preload = "auto";
    audio.src = resolvedAudioUrl;
    audio.load();
    activeJimmiAudioRef.current = audio;
    setVoicePlaybackStatus(isJimmiAudioPrimedRef.current ? "JIMMI’s voice response is readying for playback." : "Starting JIMMI’s voice response.");
    setOrbVoiceState("thinking");
    setOrbStatusText("JIMMI’s answer is ready. Preparing audio playback.");
    audio.onplaying = markPlaybackStarted;
    audio.onended = () => {
      if (speechPlaybackTokenRef.current !== playbackToken) return;
      releaseJimmiAudioElement();
      setVoicePlaybackStatus("JIMMI finished speaking.");
      shouldResumeListeningAfterSpeechRef.current = false;
      if (shouldResumeListening && !isChatExpandedRef.current) {
        setOrbVoiceState("listening");
        setOrbStatusText("JIMMI asked a question. Listening for your answer.");
        window.setTimeout(() => restartListeningAfterSpeechRef.current?.(), 0);
        return;
      }
      setOrbVoiceState("idle");
      setOrbStatusText("JIMMI responded. Tap the orb to speak again.");
    };
    audio.onerror = () => {
      if (speechPlaybackTokenRef.current !== playbackToken) return;
      releaseJimmiAudioElement();
      shouldResumeListeningAfterSpeechRef.current = false;
      setVoicePlaybackStatus("JIMMI voice playback could not start automatically. Tap the orb to speak again.");
      setOrbVoiceState("idle");
      setOrbStatusText("JIMMI responded in text. Tap the orb to speak again.");
    };
    void audio.play()
      .then(markPlaybackStarted)
      .catch(() => {
        if (speechPlaybackTokenRef.current !== playbackToken) return;
        window.setTimeout(() => {
          if (speechPlaybackTokenRef.current !== playbackToken) return;
          void audio.play()
            .then(markPlaybackStarted)
            .catch(() => {
        if (speechPlaybackTokenRef.current !== playbackToken) return;
        releaseJimmiAudioElement();
        shouldResumeListeningAfterSpeechRef.current = false;
        setVoicePlaybackStatus("Browser autoplay blocked JIMMI’s voice. Tap the orb to try voice again.");
              setOrbVoiceState("idle");
              setOrbStatusText("JIMMI responded in text. Tap the orb to speak again.");
            });
        }, 120);
      });
  }, [getJimmiAudioElement, releaseJimmiAudioElement]);

  const jimmiSpeechMutation = trpc.chat.speak.useMutation({
    onSuccess: (result) => {
      playJimmiAudio(result.audioUrl);
    },
    onError: (error) => {
      setVoicePlaybackStatus(`JIMMI voice is unavailable right now. ${error.message}`);
      setOrbVoiceState("idle");
      setOrbStatusText("JIMMI responded in text. Tap the orb to speak again.");
    },
  });

  const speakJimmiResponse = useCallback((content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || !user) {
      setOrbVoiceState("idle");
      setOrbStatusText("JIMMI responded. Tap the orb to speak again.");
      return;
    }
    jimmiSpeechMutation.mutate({ text: trimmedContent });
  }, [jimmiSpeechMutation, user]);

  const voiceTranscriptionMutation = trpc.chat.transcribeVoice.useMutation({
    onSuccess: (result) => {
      const transcript = result.text.trim();
      if (!transcript) {
        setOrbVoiceState("idle");
        setOrbStatusText("JIMMI could not detect speech. Tap the orb and try again.");
        return;
      }
      if (isExternalTranscriptionWatermark(transcript)) {
        setVoiceTranscript("");
        setChatInput("");
        setOrbVoiceState("idle");
        setOrbStatusText("JIMMI ignored an external transcription watermark. Tap the orb and speak your message again.");
        return;
      }
      setVoiceTranscript(transcript);
      sendVoiceTranscript(transcript);
    },
    onError: (error) => {
      setVoiceTranscript("");
      setChatInput("");
      setOrbVoiceState("idle");
      setOrbStatusText(`Voice transcription could not finish. ${error.message}`);
    },
  });

  const foodImageScanMutation = trpc.chat.analyzeFoodImage.useMutation({
    onMutate: () => {
      setOrbVoiceState("thinking");
      setActiveFoodScan(null);
      setProgramScanResult(null);
      setScanStatusText("JIMMI is thinking through the photo, identifying food and portions, then estimating macros...");
      setSaveScanStatusText("");
    },
    onSuccess: (result) => {
      setOrbVoiceState("idle");
      if (!result.isFood) {
        const fallbackMessage = "I could not confidently identify the food or portion from that photo. Please retake it with the full meal clearly visible, or simply describe the meal and portion sizes so I can calculate macros and fitness insights.";
        setActiveFoodScan(null);
        setProgramScanResult(null);
        setScanStatusText("Food not identifiable. Retake the photo or describe the meal for macro and fitness insights.");
        persistAssistantMessage({ role: "assistant", content: fallbackMessage });
        return;
      }
      const nextResult: SmartFoodScanResult = { source: "camera", foodName: result.foodName, portion: result.portion, confidence: result.confidence, calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, guidance: result.guidance, suggestedMealType: "Snack" };
      setActiveFoodScan(nextResult);
      setProgramScanResult(null);
      setScanStatusText("Food and portions identified. JIMMI calculated macros and customized fitness insights for your goals.");
      persistAssistantMessage({ role: "assistant", content: scanResultMessage(nextResult), scanResult: nextResult });
    },
    onError: (error) => {
      setOrbVoiceState("idle");
      setActiveFoodScan(null);
      setScanStatusText(`JIMMI could not scan that image. Retake the photo or describe the meal so JIMMI can calculate macros and fitness insights. ${error.message}`);
      persistAssistantMessage({ role: "assistant", content: `I could not scan that food image yet. Retake the photo or describe the meal and portion sizes, and I can estimate macros with fitness insights. ${error.message}` });
    },
  });
  const programFileScanMutation = trpc.chat.scanProgramFile.useMutation({
    onMutate: () => setScanStatusText("JIMMI is reviewing the uploaded program file..."),
    onSuccess: (result) => {
      setProgramScanResult(result);
      setActiveFoodScan(null);
      setScanStatusText("Program scan complete.");
      const suggestions = result.suggestions.length ? `\n\nSuggestions:\n${result.suggestions.map((item) => `- ${item}`).join("\n")}` : "";
      const importNote = result.importMessage ? `\n\n${result.importMessage}` : "";
      persistAssistantMessage({ role: "assistant", content: `**${result.title}**\n\n${result.summary}${suggestions}${result.caution ? `\n\n${result.caution}` : ""}${importNote}`, programScanResult: result });
    },
    onError: (error) => {
      setScanStatusText(`JIMMI could not scan that file. ${error.message}`);
      persistAssistantMessage({ role: "assistant", content: `I could not scan that file yet. ${error.message}` });
    },
  });
  const barcodeScanMutation = trpc.chat.scanBarcode.useMutation({
    onMutate: () => {
      setOrbVoiceState("thinking");
      setActiveFoodScan(null);
      setProgramScanResult(null);
      setScanStatusText("JIMMI is thinking through that barcode, checking product macros, and comparing it with your goals...");
      setSaveScanStatusText("");
    },
    onSuccess: (result) => {
      setOrbVoiceState("idle");
      if (!result.found) {
        const fallbackMessage = `${result.message} If you can, type the product name, serving size, and nutrition label details so JIMMI can still calculate macros and give fitness insights for your goals.`;
        setActiveFoodScan(null);
        setProgramScanResult(null);
        setScanStatusText("Product barcode not identifiable. Explain the food or label details for fitness insights.");
        persistAssistantMessage({ role: "assistant", content: fallbackMessage });
        return;
      }
      const nextResult: SmartFoodScanResult = { source: "barcode", foodName: result.foodName, serving: result.serving, calories: result.macros.calories, protein: result.macros.protein, carbs: result.macros.carbs, fat: result.macros.fat, guidance: result.guidance, suggestion: result.suggestion, suggestedMealType: result.suggestedMealType };
      setActiveFoodScan(nextResult);
      setProgramScanResult(null);
      setScanStatusText("Product identified. JIMMI found relevant macro information and personalized guidance for your goals.");
      persistAssistantMessage({ role: "assistant", content: scanResultMessage(nextResult), scanResult: nextResult });
    },
    onError: (error) => {
      setOrbVoiceState("idle");
      setActiveFoodScan(null);
      setScanStatusText(`JIMMI could not read that barcode. Explain the food or nutrition label details for macro and fitness insights. ${error.message}`);
      setMessages((current) => [...current, { role: "assistant", content: `I could not identify that barcode yet. Tell me the product name, serving size, and nutrition label details, and I can still calculate macros with fitness insights. ${error.message}` }]);
    },
  });

  const restaurantMealEstimateMutation = trpc.chat.estimateRestaurantMeal.useMutation({
    onMutate: () => {
      setOrbVoiceState("thinking");
      setActiveFoodScan(null);
      setProgramScanResult(null);
      setFoodLogReviewDraft(null);
      setScanStatusText("JIMMI is checking restaurant macro context, portion size, and whether more detail is needed...");
      setSaveScanStatusText("");
    },
    onSuccess: (result) => {
      setOrbVoiceState("idle");
      void utils.chat.history.invalidate();
      if (result.status === "needs_clarification") {
        const questions = result.clarifyingQuestions.map((question) => `- ${question}`).join("\n");
        setScanStatusText("JIMMI needs a few details before estimating that restaurant meal.");
        persistAssistantMessage({ role: "assistant", content: `${result.guidance}\n\n${questions}` });
        return;
      }
      const nextResult: SmartFoodScanResult = {
        source: "restaurant",
        foodName: result.foodName,
        serving: result.serving,
        portion: result.portion,
        confidence: result.confidence,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        guidance: result.guidance,
        suggestion: result.suggestion,
        suggestedMealType: result.suggestedMealType,
        dataSource: result.dataSource,
        sourceNote: result.sourceNote,
      };
      setActiveFoodScan(nextResult);
      setProgramScanResult(null);
      setScanStatusText("Restaurant meal estimated. Review and edit the macros before saving them to your Food Log.");
      persistAssistantMessage({ role: "assistant", content: scanResultMessage(nextResult), scanResult: nextResult });
    },
    onError: (error) => {
      setOrbVoiceState("idle");
      setScanStatusText(`JIMMI could not estimate that restaurant meal yet. ${error.message}`);
      persistAssistantMessage({ role: "assistant", content: `I could not estimate that restaurant meal yet. Tell me the restaurant, exact menu item, portion eaten, and any major customizations, and I’ll try again. ${error.message}` });
    },
  });
  const saveScanToFoodLogMutation = trpc.foodLog.add.useMutation({
    onMutate: () => {
      setSaveScanStatusText("Saving to Food Log...");
    },
    onSuccess: (_entry, input) => {
      utils.foodLog.daily.invalidate({ logDate: input.logDate });
      setSaveScanStatusText("Saved to Food Log.");
      toast.success("Saved to Food Log", {
        description: `${input.foodName} was added to today’s log.`,
        duration: 2200,
      });
      persistAssistantMessage({ role: "assistant", content: `Saved **${input.foodName}** to today’s Food Log.` });
    },
    onError: (error) => {
      setSaveScanStatusText(`Could not save to Food Log. ${error.message}`);
      toast.error("Could not save to Food Log", {
        description: error.message,
        duration: 3200,
      });
    },
  });

  const chatMutation = trpc.chat.send.useMutation({
    onSuccess: (response) => {
      if (suppressNextAssistantResponseRef.current) {
        suppressNextAssistantResponseRef.current = false;
        setIsResponseInterrupted(false);
        setOrbVoiceState("idle");
        setOrbStatusText("Interrupted. Tap the orb when you're ready to speak again.");
        return;
      }

      // Free tier daily limit reached — show upgrade prompt in chat
      if ("tierLimitReached" in response && response.tierLimitReached) {
        setMessages((current) => [...current, { role: "assistant", content: response.content, tierLimitReached: true }]);
        setIsResponseInterrupted(false);
        setOrbVoiceState("idle");
        setOrbStatusText("Daily message limit reached.");
        return;
      }

      // Invalidate chat history so the transcript is always fresh on the next mount/focus.
      void utils.chat.history.invalidate();

      // JIMMI auto-logged a food entry — invalidate the food log cache and show a toast
      if ("foodLogged" in response && response.foodLogged && typeof response.foodLogged === "object") {
        const logged = response.foodLogged as FoodLoggedInfo;
        utils.foodLog.daily.invalidate({ logDate: logged.logDate });
        utils.foodLog.calorieBalance.invalidate({ logDate: logged.logDate });
        toast.success("Logged to Food Log", {
          description: `${logged.foodName} — ${logged.calories} cal, ${logged.protein}g protein`,
          duration: 2800,
        });
      }

      const shouldSpeakResponse = pendingVoiceResponseRef.current;
      pendingVoiceResponseRef.current = false;
      const elapsedThinkingMs = Math.max(0, Date.now() - textThinkingStartedAtRef.current);
      const responseDelayMs = shouldSpeakResponse ? 0 : Math.max(0, minVisibleTextThinkingMs - elapsedThinkingMs);
      window.setTimeout(() => {
        setMessages((current) => [...current, { ...response, createdAt: new Date() }]);
        setIsResponseInterrupted(false);
        if (shouldSpeakResponse) {
          shouldResumeListeningAfterSpeechRef.current = !isVoiceSessionClosingReply(response.content);
          setVoicePlaybackStatus("Preparing JIMMI’s concise voice summary...");
          setOrbVoiceState("thinking");
          setOrbStatusText("Preparing JIMMI’s voice response.");
          speakJimmiResponse(response.content);
        } else {
          setOrbVoiceState("idle");
          setOrbStatusText("JIMMI responded. Tap the orb to speak again.");
        }
      }, responseDelayMs);
    },
    onError: (error) => {
      if (suppressNextAssistantResponseRef.current) {
        suppressNextAssistantResponseRef.current = false;
        setIsResponseInterrupted(false);
        setOrbVoiceState("idle");
        setOrbStatusText("Interrupted. Tap the orb when you’re ready to speak again.");
        return;
      }

      // Auto-retry on transient errors (network blip, 503, rate limit backoff)
      // Skip retry for rate-limit errors (TOO_MANY_REQUESTS) — user sent too fast
      const isTooManyRequests = (error as any)?.data?.code === "TOO_MANY_REQUESTS";
      const payload = chatRetryPayloadRef.current;
      if (!isTooManyRequests && payload && chatRetryCountRef.current < 2) {
        const attempt = chatRetryCountRef.current + 1;
        chatRetryCountRef.current = attempt;
        const delayMs = attempt === 1 ? 1500 : 4000; // 1.5s, then 4s
        window.setTimeout(() => {
          setOrbStatusText(`Retrying… (attempt ${attempt + 1} of 3)`);
          chatMutation.mutate({ messages: payload, clientDate: todayLocalDate() });
        }, delayMs);
        return;
      }
      // All retries exhausted or non-retryable error
      chatRetryCountRef.current = 0;
      chatRetryPayloadRef.current = null;
      const friendlyMsg = isTooManyRequests
        ? "Please wait a moment before sending another message."
        : "I couldn't complete that coaching response just now. Please try again in a moment.";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: friendlyMsg,
        },
      ]);
      setIsResponseInterrupted(false);
      setOrbVoiceState("error");
      setOrbStatusText("JIMMI had trouble responding. Tap the orb to try again.");
    },
  });

  const handleSendMessage = useCallback((content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || chatMutation.isPending || restaurantMealEstimateMutation.isPending) return;

    const nextMessages: ChatThreadMessage[] = [...messages, { role: "user", content: trimmedContent, createdAt: new Date() }];
    setLastMessageTopic(detectMessageTopic(trimmedContent));
    const chatPayload = nextMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }))
      .slice(-20); // server enforces max 20 messages; keep the most recent context
    suppressNextAssistantResponseRef.current = false;
    setIsResponseInterrupted(false);
    setMessages(nextMessages);
    if (user && isLikelyRestaurantMacroRequest(trimmedContent)) {
      textThinkingStartedAtRef.current = Date.now();
      setOrbVoiceState("thinking");
      setOrbStatusText("JIMMI is checking restaurant macros and portion math.");
      chatSaveMessageMutation.mutate({ role: "user", content: trimmedContent });
      restaurantMealEstimateMutation.mutate({ description: trimmedContent });
      return;
    }

    if (isLocalFallback && profile) {
      textThinkingStartedAtRef.current = Date.now();
      setOrbVoiceState("thinking");
      setOrbStatusText("JIMMI is thinking through a focused coaching response.");
      window.setTimeout(() => {
        const shouldSpeakResponse = pendingVoiceResponseRef.current;
        pendingVoiceResponseRef.current = false;
        const localReply = buildLocalCoachingReply(trimmedContent, profile);
        setMessages((current) => [...current, localReply]);
        if (shouldSpeakResponse && user) {
          shouldResumeListeningAfterSpeechRef.current = !isVoiceSessionClosingReply(localReply.content);
          setVoicePlaybackStatus("Preparing JIMMI’s concise voice summary...");
          setOrbVoiceState("thinking");
          setOrbStatusText("Preparing JIMMI’s voice response.");
          speakJimmiResponse(localReply.content);
        } else {
          setOrbVoiceState("idle");
          setOrbStatusText("JIMMI responded. Tap the orb to speak again.");
        }
      }, minVisibleTextThinkingMs);
      return;
    }

    textThinkingStartedAtRef.current = Date.now();
    setOrbVoiceState("thinking");
    setOrbStatusText("JIMMI is thinking through your message.");
    chatRetryCountRef.current = 0;
    chatRetryPayloadRef.current = chatPayload;
    chatMutation.mutate({ messages: chatPayload, clientDate: todayLocalDate() });
  }, [chatMutation, chatSaveMessageMutation, isLocalFallback, messages, profile, restaurantMealEstimateMutation, speakJimmiResponse, user]);

  const handleCameraFoodFile = useCallback(async (file?: File) => {
    if (!file) return;
    if (!user) {
      setScanStatusText("Sign in to use camera food recognition and save scanned foods.");
      return;
    }
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      foodImageScanMutation.mutate({ imageDataUrl, source: "camera" });
      setIsPlusPanelOpen(false);
    } catch (error) {
      setScanStatusText(error instanceof Error ? error.message : "Could not read that image.");
    }
  }, [foodImageScanMutation, user]);

  const handleProgramFile = useCallback(async (file?: File) => {
    if (!file) return;
    if (!user) {
      setScanStatusText("Sign in to let JIMMI scan program files.");
      return;
    }
    try {
      const fileDataUrl = await readFileAsDataUrl(file);
      programFileScanMutation.mutate({ fileName: file.name, mimeType: file.type || "application/octet-stream", fileDataUrl });
      setIsPlusPanelOpen(false);
    } catch (error) {
      setScanStatusText(error instanceof Error ? error.message : "Could not read that file.");
    }
  }, [programFileScanMutation, user]);

  const stopBarcodeScanner = useCallback(() => {
    if (barcodeScanFrameRef.current !== null) {
      window.cancelAnimationFrame(barcodeScanFrameRef.current);
      barcodeScanFrameRef.current = null;
    }
    // Stop ZXing controls — this stops its internal scanning loop but may not
    // release the underlying MediaStream on all browsers.
    barcodeScannerControlsRef.current?.stop();
    barcodeScannerControlsRef.current = null;
    // Capture the stream from the video element BEFORE clearing srcObject —
    // ZXing holds the stream internally and attaches it to video.srcObject;
    // we must grab it here so we can stop its tracks even after the video
    // element unmounts and barcodeVideoRef.current becomes null.
    const video = barcodeVideoRef.current;
    const videoStream = video?.srcObject instanceof MediaStream ? video.srcObject : null;
    if (videoStream && !barcodeScannerStreamRef.current) {
      barcodeScannerStreamRef.current = videoStream;
    }
    // Stop the stream we requested via getUserMedia (native BarcodeDetector path)
    // and any ZXing-internal stream captured above.
    barcodeScannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    barcodeScannerStreamRef.current = null;
    // Clear the video element.
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  const closeBarcodeScanner = useCallback(() => {
    stopBarcodeScanner();
    hasBarcodeScanCompletedRef.current = false;
    setIsBarcodeScannerOpen(false);
    setBarcodeScannerStatus("");
  }, [stopBarcodeScanner]);

  const handleDetectedBarcode = useCallback((rawValue?: string) => {
    const rawBarcode = rawValue?.replace(/\D/g, "");
    if (!rawBarcode || hasBarcodeScanCompletedRef.current) return;
    hasBarcodeScanCompletedRef.current = true;
    // Close the scanner immediately (synchronously) so the video element is
    // unmounted right away — this is the most reliable way to release the
    // camera on iOS Safari, where video.srcObject = null alone is not enough.
    stopBarcodeScanner();
    closeBarcodeScanner();
    barcodeScanMutation.mutate({ barcode: rawBarcode });
  }, [barcodeScanMutation, closeBarcodeScanner, stopBarcodeScanner]);

  const handleOpenBarcodeScanner = useCallback(async () => {
    setIsPlusPanelOpen(false);

    // On Capacitor (iOS/Android): use native MLKit scanner — no web camera UI needed
    if (isNative()) {
      const { scanBarcodeNative } = await import("@/hooks/useBarcodeScanner");
      const result = await scanBarcodeNative();
      if (result?.rawValue) {
        handleDetectedBarcode(result.rawValue);
      }
      return;
    }

    // Web fallback: show camera permission rationale on first use
    const hasSeenCameraRationale = localStorage.getItem("jimmi_camera_rationale_seen") === "1";
    if (!hasSeenCameraRationale) {
      setPendingBarcodeOpen(true);
      setShowCameraRationale(true);
      return;
    }
    setScanStatusText("");
    setBarcodeScannerStatus("Point the camera at the product barcode.");
    hasBarcodeScanCompletedRef.current = false;
    setIsBarcodeScannerOpen(true);
  }, [handleDetectedBarcode]);

  useEffect(() => {
    if (!isBarcodeScannerOpen) return;

    let isCancelled = false;

    const startBarcodeScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setBarcodeScannerStatus("Live camera barcode scanning is not supported in this browser. Describe the product or label details to JIMMI instead.");
        return;
      }

      const video = barcodeVideoRef.current;
      if (!video) {
        setBarcodeScannerStatus("Scanner view is loading. Try opening the scanner again if it does not start.");
        return;
      }
      video.setAttribute("playsinline", "true");

      const BarcodeDetectorConstructor = (window as BrowserWithBarcodeDetector).BarcodeDetector;
      if (BarcodeDetectorConstructor) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          });

          if (isCancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          barcodeScannerStreamRef.current = stream;
          video.srcObject = stream;
          await video.play();

          if (isCancelled) return;

          setBarcodeScannerStatus("Center the barcode inside the rectangle and hold steady.");
          const detector = new BarcodeDetectorConstructor({ formats: [...supportedBarcodeFormats] });
          const scanFrame = async () => {
            if (isCancelled || hasBarcodeScanCompletedRef.current || !barcodeVideoRef.current) return;
            try {
              const detectedCodes = await detector.detect(barcodeVideoRef.current);
              handleDetectedBarcode(detectedCodes[0]?.rawValue);
            } catch {
              setBarcodeScannerStatus("Keep the barcode centered and steady.");
            }
            if (!hasBarcodeScanCompletedRef.current) barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
          };
          barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
          return;
        } catch {
          stopBarcodeScanner();
          if (isCancelled) return;
        }
      }

      try {
        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, zxingBarcodeFormats);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 500 });
        setBarcodeScannerStatus("Center the barcode inside the rectangle and hold steady.");
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video,
          (result, _error, controlsFromCallback) => {
            barcodeScannerControlsRef.current = controlsFromCallback;
            if (isCancelled || hasBarcodeScanCompletedRef.current) return;
            const text = result?.getText?.();
            if (text) {
              controlsFromCallback.stop();
              // Immediately stop the stream tracks here — ZXing's controls.stop()
              // halts scanning but does NOT release the MediaStream on iOS Safari.
              // We must stop tracks synchronously before any React state update
              // so the camera indicator turns off right away.
              const activeStream = video.srcObject instanceof MediaStream ? video.srcObject : null;
              activeStream?.getTracks().forEach((track) => track.stop());
              if (activeStream) barcodeScannerStreamRef.current = null;
              handleDetectedBarcode(text);
            }
          },
        );
        barcodeScannerControlsRef.current = controls;
      } catch {
        if (isCancelled) return;
        stopBarcodeScanner();
        hasBarcodeScanCompletedRef.current = false;
        setIsBarcodeScannerOpen(false);
        setBarcodeScannerStatus("");
        setScanStatusText(isEmbeddedPreviewContext() ? "Camera access may be blocked in preview. Open the site directly and try scanning again." : "Camera access was not enabled or barcode scanning could not start. Try again, or describe the product and nutrition label to JIMMI.");
      }
    };

    void startBarcodeScanner();

    return () => {
      isCancelled = true;
      stopBarcodeScanner();
    };
  }, [handleDetectedBarcode, isBarcodeScannerOpen, stopBarcodeScanner]);

  // Belt-and-suspenders for iOS Safari: when the scanner closes, stop any
  // remaining camera tracks that may still be live. iOS Safari keeps the
  // camera indicator on until every track on every MediaStream is stopped,
  // even if the video element has been removed from the DOM.
  useEffect(() => {
    if (isBarcodeScannerOpen) return;
    stopBarcodeScanner();
  }, [isBarcodeScannerOpen, stopBarcodeScanner]);


  const handleReviewFoodScanBeforeLog = useCallback((scanResult = activeFoodScan) => {
    if (!scanResult) return;
    if (!user) {
      setSaveScanStatusText("Sign in to save scanned foods to your Food Log.");
      toast("Sign in required", {
        description: "Sign in to save scanned foods to your Food Log.",
        duration: 2600,
      });
      return;
    }
    setFoodLogReviewDraft({
      sourceResult: scanResult,
      mealType: scanResult.suggestedMealType ?? "Snack",
      foodName: scanResult.foodName,
      serving: scanResult.serving ?? scanResult.portion ?? "estimated serving",
      calories: String(scanResult.calories),
      protein: String(scanResult.protein),
      carbs: String(scanResult.carbs),
      fat: String(scanResult.fat),
    });
  }, [activeFoodScan, user]);

  const handleConfirmReviewedFoodLog = useCallback(() => {
    if (!foodLogReviewDraft) return;
    const source = foodLogReviewDraft.sourceResult;
    const calories = toPositiveIntInput(foodLogReviewDraft.calories, source.calories);
    const protein = toPositiveIntInput(foodLogReviewDraft.protein, source.protein);
    const carbs = toPositiveIntInput(foodLogReviewDraft.carbs, source.carbs);
    const fat = toPositiveIntInput(foodLogReviewDraft.fat, source.fat);
    saveScanToFoodLogMutation.mutate({
      logDate: todayLocalDate(),
      mealType: foodLogReviewDraft.mealType,
      foodName: foodLogReviewDraft.foodName.trim() || source.foodName,
      calories,
      protein,
      carbs,
      fat,
      notes: `Added from JIMMI ${source.source} estimate after user review. Serving: ${foodLogReviewDraft.serving || source.serving || source.portion || "estimated"}. ${source.sourceNote ?? ""}`.trim(),
    });
    setFoodLogReviewDraft(null);
  }, [foodLogReviewDraft, saveScanToFoodLogMutation]);

  const handleChatSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || chatMutation.isPending) return;
    handleSendMessage(trimmedInput);
    setChatInput("");
  }, [chatInput, chatMutation.isPending, handleSendMessage]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const trimmedInput = chatInput.trim();
      if (!trimmedInput || chatMutation.isPending) return;
      handleSendMessage(trimmedInput);
      setChatInput("");
    }
  }, [chatInput, chatMutation.isPending, handleSendMessage]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearVoiceFallbackSubmitTimer = useCallback(() => {
    if (voiceFallbackSubmitTimerRef.current) {
      window.clearTimeout(voiceFallbackSubmitTimerRef.current);
      voiceFallbackSubmitTimerRef.current = null;
    }
  }, []);

  const clearPostFollowUpNoInputTimer = useCallback(() => {
    if (postFollowUpNoInputTimerRef.current) {
      window.clearTimeout(postFollowUpNoInputTimerRef.current);
      postFollowUpNoInputTimerRef.current = null;
    }
  }, []);

  const clearComposerDictationRestartTimer = useCallback(() => {
    if (composerDictationRestartTimerRef.current) {
      window.clearTimeout(composerDictationRestartTimerRef.current);
      composerDictationRestartTimerRef.current = null;
    }
  }, []);

  const stopVoiceActivityDetector = useCallback(() => {
    if (voiceAnalyserFrameRef.current !== null) {
      window.cancelAnimationFrame(voiceAnalyserFrameRef.current);
      voiceAnalyserFrameRef.current = null;
    }
    const audioContext = voiceAnalyserContextRef.current;
    voiceAnalyserContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  }, []);

  const stopActiveMicTracks = useCallback(() => {
    stopVoiceActivityDetector();
    activeMicStreamRef.current?.getTracks().forEach((track) => {
      if (track.readyState !== "ended") track.stop();
    });
    activeMicStreamRef.current = null;
  }, [stopVoiceActivityDetector]);

  const scrollToChatBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const viewport = chatScrollRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport], [data-slot="scroll-area-viewport"]');
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    });
  }, []);

  const stopComposerDictation = useCallback(() => {
    composerDictationShouldListenRef.current = false;
    clearComposerDictationRestartTimer();
    const activeComposerRecognition = composerDictationRecognitionRef.current;
    composerDictationRecognitionRef.current = null;
    if (activeComposerRecognition) {
      activeComposerRecognition.onerror = null;
      activeComposerRecognition.onend = null;
      activeComposerRecognition.onresult = null;
      try {
        activeComposerRecognition.abort?.();
      } catch {
        // Intentional composer dictation stops should not surface browser-specific recognition errors.
      }
      try {
        activeComposerRecognition.stop();
      } catch {
        // Some browsers throw when stop follows abort; the local dictation state is already controlled.
      }
    }
    composerDictationFinalRef.current = "";
    composerDictationInterimRef.current = "";
    setIsComposerDictating(false);
  }, [clearComposerDictationRestartTimer]);

  const startComposerDictation = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setMicPromptStatus("unsupported");
      setOrbStatusText("Speech-to-text dictation is not supported in this browser. You can keep typing in the message box.");
      return;
    }

    stopComposerDictation();
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    composerDictationRecognitionRef.current = recognition;
    composerDictationFinalRef.current = chatInput.trim();
    composerDictationInterimRef.current = "";
    composerDictationShouldListenRef.current = true;
    setIsComposerDictating(true);
    setMicPromptStatus("granted");
    setOrbStatusText("Composer dictation is active. This only fills the message box; tap the orb for two-way voice with JIMMI.");

    const restartComposerDictation = (delayMs: number) => {
      clearComposerDictationRestartTimer();
      composerDictationRestartTimerRef.current = window.setTimeout(() => {
        if (!isChatVoiceMountedRef.current || !composerDictationShouldListenRef.current || composerDictationRecognitionRef.current !== recognition) return;
        try {
          recognition.start();
        } catch {
          composerDictationShouldListenRef.current = false;
          composerDictationRecognitionRef.current = null;
          setIsComposerDictating(false);
          setOrbStatusText("Composer dictation paused. Tap the message mic to try again, or tap the orb for two-way voice.");
        }
      }, delayMs);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          composerDictationFinalRef.current = `${composerDictationFinalRef.current} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }
      composerDictationInterimRef.current = interimTranscript;
      setChatInput(`${composerDictationFinalRef.current} ${composerDictationInterimRef.current}`.trim());
    };
    recognition.onerror = (event) => {
      if (isNonFatalRecognitionError(event.error) && composerDictationShouldListenRef.current) {
        restartComposerDictation(160);
        return;
      }
      composerDictationShouldListenRef.current = false;
      composerDictationRecognitionRef.current = null;
      setIsComposerDictating(false);
      setMicPromptStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "idle");
      setOrbStatusText(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone permission was blocked for message dictation." : "Composer dictation paused. Tap the message mic to try again.");
    };
    recognition.onend = () => {
      if (composerDictationShouldListenRef.current && composerDictationRecognitionRef.current === recognition) {
        restartComposerDictation(120);
        return;
      }
      if (composerDictationRecognitionRef.current === recognition) composerDictationRecognitionRef.current = null;
      setIsComposerDictating(false);
    };

    try {
      recognition.start();
    } catch {
      composerDictationShouldListenRef.current = false;
      composerDictationRecognitionRef.current = null;
      setIsComposerDictating(false);
      setOrbStatusText("Composer dictation could not start. Tap the orb only when you want two-way voice conversation.");
    }
  }, [chatInput, clearComposerDictationRestartTimer, stopComposerDictation]);

  const stopOrbSpeechRecognition = useCallback(() => {
    ignoreRecognitionEndRef.current = true;
    suppressRecognitionErrorRef.current = true;
    recognitionEndedAfterRecoverableErrorRef.current = false;
    const activeRecognition = recognitionRef.current;
    recognitionRef.current = null;
    if (activeRecognition) {
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      activeRecognition.onresult = null;
      try {
        activeRecognition.abort?.();
      } catch {
        // Releasing browser speech recognition should never block the recorder handoff.
      }
      try {
        activeRecognition.stop();
      } catch {
        // Some browsers throw when stop follows abort; the intended state is already local.
      }
    }
    window.setTimeout(() => {
      suppressRecognitionErrorRef.current = false;
    }, 250);
  }, []);

  const stopVoiceCapture = useCallback((nextState: OrbVoiceState, statusText: string) => {
    voiceCaptureGenerationRef.current += 1;
    clearSilenceTimer();
    clearVoiceFallbackSubmitTimer();
    clearPostFollowUpNoInputTimer();
    shouldStartPostFollowUpNoInputTimerRef.current = false;
    ignoreRecognitionEndRef.current = true;
    suppressRecognitionErrorRef.current = true;
    recognitionEndedAfterRecoverableErrorRef.current = false;
    const activeRecorder = mediaRecorderRef.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.ondataavailable = null;
      activeRecorder.onstop = null;
      try {
        activeRecorder.stream?.getTracks().forEach((track) => {
          if (track.readyState !== "ended") track.stop();
        });
        activeRecorder.stop();
      } catch {
        // Manual voice stops should never surface as errors.
      }
    }
    mediaRecorderRef.current = null;
    recordedVoiceChunksRef.current = [];
    voiceRecordingStartedAtRef.current = 0;
    voiceSpeechStartedAtRef.current = 0;
    stopOrbSpeechRecognition();
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    hasDetectedSpeechRef.current = false;
    shouldKeepListeningRef.current = false;
    setVoiceTranscript("");
    stopActiveMicTracks();
    setOrbVoiceState(nextState);
    setOrbStatusText(statusText);
    window.setTimeout(() => {
      suppressRecognitionErrorRef.current = false;
    }, 250);
  }, [clearPostFollowUpNoInputTimer, clearSilenceTimer, clearVoiceFallbackSubmitTimer, stopActiveMicTracks, stopOrbSpeechRecognition]);

  const schedulePostFollowUpNoInputTimer = useCallback((sessionGeneration: number) => {
    clearPostFollowUpNoInputTimer();
    postFollowUpNoInputTimerRef.current = window.setTimeout(() => {
      if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || !shouldKeepListeningRef.current || hasDetectedSpeechRef.current) return;
      shouldKeepListeningRef.current = false;
      stopVoiceCapture("idle", "JIMMI did not hear an answer, so voice returned to idle. Tap the orb to speak again.");
    }, postFollowUpNoInputMs);
  }, [clearPostFollowUpNoInputTimer, stopVoiceCapture]);

  const startVoiceActivityDetector = useCallback((stream: MediaStream, recorder: MediaRecorder, sessionGeneration: number) => {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setOrbStatusText("Listening. Pause, then tap the orb if JIMMI does not respond automatically.");
      return;
    }

    try {
      stopVoiceActivityDetector();
      const audioContext = new AudioContextConstructor();
      voiceAnalyserContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.28;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastVoiceAt = 0;

      const tick = () => {
        if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || mediaRecorderRef.current !== recorder || recorder.state !== "recording") {
          return;
        }

        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const centered = (samples[index] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const now = Date.now();

        if (rms > voiceActivityThreshold) {
          clearPostFollowUpNoInputTimer();
          lastVoiceAt = now;
          if (!hasDetectedSpeechRef.current) {
            voiceSpeechStartedAtRef.current = now;
          }
          hasDetectedSpeechRef.current = true;
          setOrbStatusText("Listening. Pause briefly when you're ready for JIMMI to respond.");
        }

        if (hasDetectedSpeechRef.current && lastVoiceAt > 0 && now - lastVoiceAt >= voiceSilenceDelayMs) {
          const recordingAge = now - voiceRecordingStartedAtRef.current;
          const speechAge = now - voiceSpeechStartedAtRef.current;
          if (recordingAge < minVoiceRecordingMs || speechAge < minDetectedSpeechMs) {
            voiceAnalyserFrameRef.current = window.requestAnimationFrame(tick);
            return;
          }
          shouldKeepListeningRef.current = false;
          stopOrbSpeechRecognition();
          setOrbVoiceState("thinking");
          setOrbStatusText("I heard you. JIMMI is thinking now.");
          try {
            recorder.requestData?.();
          } catch {
            // Some browsers do not allow requestData immediately before stop; stopping still flushes available audio.
          }
          try {
            recorder.stop();
          } catch {
            mediaRecorderRef.current = null;
            recordedVoiceChunksRef.current = [];
            stopActiveMicTracks();
            setOrbVoiceState("idle");
            setOrbStatusText("Voice response could not start. Tap the orb to try again.");
          }
          return;
        }

        voiceAnalyserFrameRef.current = window.requestAnimationFrame(tick);
      };

      if (audioContext.state === "suspended") {
        void audioContext.resume().finally(() => {
          voiceAnalyserFrameRef.current = window.requestAnimationFrame(tick);
        });
      } else {
        voiceAnalyserFrameRef.current = window.requestAnimationFrame(tick);
      }
    } catch {
      setOrbStatusText("Listening. Pause, then tap the orb if JIMMI does not respond automatically.");
    }
  }, [clearPostFollowUpNoInputTimer, stopActiveMicTracks, stopVoiceActivityDetector]);

  const startServerBackedVoiceRecording = useCallback((stream: MediaStream, sessionGeneration: number, shouldArmPostFollowUpNoInputTimer = false) => {
    if (typeof MediaRecorder === "undefined") {
      stopActiveMicTracks();
      setMicPromptStatus("unsupported");
      setOrbVoiceState("unsupported");
      setOrbStatusText("Voice recording is not supported in this browser. You can keep using text chat.");
      return;
    }

    const mimeType = getSupportedVoiceRecordingMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recordedVoiceChunksRef.current = [];
    voiceRecordingStartedAtRef.current = Date.now();
    voiceSpeechStartedAtRef.current = 0;
    mediaRecorderRef.current = recorder;
    activeMicStreamRef.current = stream;
    setMicPromptStatus("granted");
    setVoiceTranscript("");
    setChatInput("");
    setOrbVoiceState("listening");
    setOrbStatusText("Listening. Pause briefly when you're ready for JIMMI to respond.");

    recorder.ondataavailable = (event) => {
      if (!event.data?.size) return;
      recordedVoiceChunksRef.current.push(event.data);
      const recordedByteSize = recordedVoiceChunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
      if (recordedByteSize >= minVoiceBlobBytes && !hasDetectedSpeechRef.current) {
        clearPostFollowUpNoInputTimer();
        hasDetectedSpeechRef.current = true;
        voiceSpeechStartedAtRef.current = Date.now();
        setOrbStatusText("Listening. Capturing your voice for JIMMI now.");
      }
    };
    recorder.onerror = () => {
      clearVoiceFallbackSubmitTimer();
      if (voiceCaptureGenerationRef.current !== sessionGeneration) return;
      mediaRecorderRef.current = null;
      recordedVoiceChunksRef.current = [];
      voiceRecordingStartedAtRef.current = 0;
      voiceSpeechStartedAtRef.current = 0;
      stopActiveMicTracks();
      shouldKeepListeningRef.current = false;
      setOrbVoiceState("idle");
      setOrbStatusText("Voice recording paused. Tap the orb to try again or keep using text chat.");
    };
    recorder.onstop = () => {
      clearVoiceFallbackSubmitTimer();
      if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration) return;
      const chunks = recordedVoiceChunksRef.current;
      recordedVoiceChunksRef.current = [];
      mediaRecorderRef.current = null;
      stopOrbSpeechRecognition();
      stopActiveMicTracks();
      const recordedByteSize = chunks.reduce((total, chunk) => total + chunk.size, 0);
      if (!chunks.length || recordedByteSize < minVoiceBlobBytes) {
        shouldKeepListeningRef.current = false;
        setOrbVoiceState("idle");
        setOrbStatusText("JIMMI did not receive enough audio. Tap the orb and try again.");
        return;
      }
      const blob = new Blob(chunks, { type: chunks[0]?.type || mimeType || "audio/webm" });
      setOrbVoiceState("thinking");
      setOrbStatusText("I heard you. JIMMI is thinking now.");
      readFileAsDataUrl(blob)
        .then((audioDataUrl) => {
          if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration) return;
          voiceTranscriptionMutation.mutate({ audioDataUrl, mimeType: blob.type.split(";")[0].trim() || mimeType.split(";")[0].trim() || "audio/webm" });
        })
        .catch((error) => {
          if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration) return;
          shouldKeepListeningRef.current = false;
          setOrbVoiceState("idle");
          setOrbStatusText(error instanceof Error ? error.message : "Voice response could not start. Tap the orb to try again.");
        });
    };

    try {
      recorder.start(250);
      if (shouldArmPostFollowUpNoInputTimer) schedulePostFollowUpNoInputTimer(sessionGeneration);
      clearVoiceFallbackSubmitTimer();
      voiceFallbackSubmitTimerRef.current = window.setTimeout(() => {
        if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || mediaRecorderRef.current !== recorder || recorder.state !== "recording") return;
        const recordedByteSize = recordedVoiceChunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
        if (recordedByteSize < minVoiceBlobBytes) {
          setOrbStatusText("Listening. Keep speaking so JIMMI can capture enough audio.");
          return;
        }
        shouldKeepListeningRef.current = false;
        hasDetectedSpeechRef.current = true;
        stopOrbSpeechRecognition();
        setOrbVoiceState("thinking");
        setOrbStatusText("I heard you. JIMMI is thinking now.");
        try {
          recorder.requestData?.();
        } catch {
          // Stopping still flushes available audio in browsers that reject requestData here.
        }
        try {
          recorder.stop();
        } catch {
          mediaRecorderRef.current = null;
          recordedVoiceChunksRef.current = [];
          voiceRecordingStartedAtRef.current = 0;
          voiceSpeechStartedAtRef.current = 0;
          stopActiveMicTracks();
          setOrbVoiceState("idle");
          setOrbStatusText("Voice response could not start. Tap the orb to try again.");
        }
      }, voiceFallbackSubmitMs);
      startVoiceActivityDetector(stream, recorder, sessionGeneration);
    } catch {
      mediaRecorderRef.current = null;
      recordedVoiceChunksRef.current = [];
      voiceRecordingStartedAtRef.current = 0;
      voiceSpeechStartedAtRef.current = 0;
      stopActiveMicTracks();
      shouldKeepListeningRef.current = false;
      setOrbVoiceState("idle");
      setOrbStatusText("Voice recording could not start. Tap the orb to try again or keep using text chat.");
    }
  }, [clearPostFollowUpNoInputTimer, clearVoiceFallbackSubmitTimer, schedulePostFollowUpNoInputTimer, startVoiceActivityDetector, stopActiveMicTracks, stopOrbSpeechRecognition, voiceTranscriptionMutation]);

  const stopServerBackedVoiceRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return false;
    if (recorder.state === "inactive") return true;
    shouldKeepListeningRef.current = false;
    clearPostFollowUpNoInputTimer();
    stopOrbSpeechRecognition();
    setOrbVoiceState("thinking");
    setOrbStatusText("I heard you. JIMMI is thinking now.");
    try {
      recorder.stop();
    } catch {
      mediaRecorderRef.current = null;
      recordedVoiceChunksRef.current = [];
      voiceRecordingStartedAtRef.current = 0;
      voiceSpeechStartedAtRef.current = 0;
      stopActiveMicTracks();
      setOrbVoiceState("idle");
      setOrbStatusText("Voice response could not start. Tap the orb to try again.");
    }
    return true;
  }, [clearPostFollowUpNoInputTimer, stopActiveMicTracks, stopOrbSpeechRecognition]);

  const sendVoiceTranscript = useCallback((rawTranscript: string) => {
    const spokenMessage = rawTranscript.trim();
    if (!spokenMessage) return;
    clearPostFollowUpNoInputTimer();
    if (isExternalTranscriptionWatermark(spokenMessage)) {
      setVoiceTranscript("");
      setChatInput("");
      shouldKeepListeningRef.current = false;
      pendingVoiceResponseRef.current = false;
      setOrbVoiceState("idle");
      setOrbStatusText("JIMMI ignored an external transcription watermark. Tap the orb and speak your message again.");
      return;
    }
    if (isVoiceSessionClosingReply(spokenMessage)) {
      setVoiceTranscript("");
      setChatInput("");
      shouldKeepListeningRef.current = false;
      shouldResumeListeningAfterSpeechRef.current = false;
      pendingVoiceResponseRef.current = false;
      setVoicePlaybackStatus("Voice conversation ended. Tap the orb when you want to speak with JIMMI again.");
      setOrbVoiceState("idle");
      setOrbStatusText("Voice conversation ended. Tap the orb when you want to speak with JIMMI again.");
      return;
    }
    setVoiceTranscript("");
    setChatInput("");
    shouldKeepListeningRef.current = false;
    pendingVoiceResponseRef.current = true;
    setOrbVoiceState("thinking");
    setOrbStatusText("I heard you. JIMMI is thinking now.");
    handleSendMessage(spokenMessage);
  }, [clearPostFollowUpNoInputTimer, handleSendMessage]);

  const scheduleSilenceAutoSend = useCallback(() => {
    const candidate = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
    if (!candidate || !hasDetectedSpeechRef.current) return;

    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      const transcriptToSend = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
      ignoreRecognitionEndRef.current = true;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      stopActiveMicTracks();
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      sendVoiceTranscript(transcriptToSend);
    }, voiceSilenceDelayMs);
  }, [clearSilenceTimer, sendVoiceTranscript, stopActiveMicTracks]);

  const startVoiceListeningSession = useCallback(async () => {
    const sessionGeneration = voiceCaptureGenerationRef.current + 1;
    voiceCaptureGenerationRef.current = sessionGeneration;
    shouldKeepListeningRef.current = false;
    clearSilenceTimer();
    clearVoiceFallbackSubmitTimer();
    clearPostFollowUpNoInputTimer();
    stopVoiceActivityDetector();

    if (!voiceTeardownPromiseRef.current) {
      voiceTeardownPromiseRef.current = new Promise<void>((resolve) => {
        const staleRecognition = recognitionRef.current;
        recognitionRef.current = null;
        if (staleRecognition) {
          staleRecognition.onerror = null;
          staleRecognition.onend = null;
          staleRecognition.onresult = null;
          try {
            staleRecognition.abort?.();
          } catch {
            // Stale recognition cleanup should not block a fresh voice turn.
          }
          try {
            staleRecognition.stop();
          } catch {
            // Some browsers throw when recognition has already ended.
          }
        }

        const staleRecorder = mediaRecorderRef.current;
        mediaRecorderRef.current = null;
        if (staleRecorder && staleRecorder.state !== "inactive") {
          staleRecorder.ondataavailable = null;
          staleRecorder.onerror = null;
          staleRecorder.onstop = null;
          try {
            staleRecorder.stream?.getTracks().forEach((track) => {
              if (track.readyState !== "ended") track.stop();
            });
            staleRecorder.stop();
          } catch {
            // Stale recorder cleanup should not block a fresh voice turn.
          }
        }

        stopActiveMicTracks();
        releaseJimmiAudioElement();
        window.setTimeout(resolve, 260);
      }).finally(() => {
        voiceTeardownPromiseRef.current = null;
        ignoreRecognitionEndRef.current = false;
        suppressRecognitionErrorRef.current = false;
      });
    }
    await voiceTeardownPromiseRef.current;
    if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration) return;

    recordedVoiceChunksRef.current = [];
    voiceRecordingStartedAtRef.current = 0;
    voiceSpeechStartedAtRef.current = 0;
    const SpeechRecognition = getSpeechRecognitionConstructor();
    const canUseServerBackedRecording = typeof MediaRecorder !== "undefined";
    if ((!SpeechRecognition && !canUseServerBackedRecording) || !navigator.mediaDevices?.getUserMedia) {
      setMicPromptStatus("unsupported");
      setOrbVoiceState("unsupported");
      setOrbStatusText("Voice input is not supported in this browser. You can keep using text chat.");
      return;
    }

    clearSilenceTimer();
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    hasDetectedSpeechRef.current = false;
    shouldKeepListeningRef.current = true;
    const shouldArmPostFollowUpNoInputTimer = shouldStartPostFollowUpNoInputTimerRef.current;
    shouldStartPostFollowUpNoInputTimerRef.current = false;
    setVoiceTranscript("");
    setOrbVoiceState("listening");
    setOrbStatusText("Listening. JIMMI is waiting for your voice.");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || !shouldKeepListeningRef.current) {
        stream.getTracks().forEach((track) => {
          if (track.readyState !== "ended") track.stop();
        });
        return;
      }
    } catch {
      shouldKeepListeningRef.current = false;
      setMicPromptStatus("denied");
      setOrbVoiceState("idle");
      setOrbStatusText(isEmbeddedPreviewContext() ? "Preview microphone access may be blocked. Open the site directly to test voice, or keep using text chat." : "Microphone access was not enabled. Tap to try again or keep using text chat.");
      return;
    }

    try {
      if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || !shouldKeepListeningRef.current) {
        stream.getTracks().forEach((track) => {
          if (track.readyState !== "ended") track.stop();
        });
        return;
      }

      setMicPromptStatus("granted");
      activeMicStreamRef.current = stream;

      if (canUseServerBackedRecording) {
        startServerBackedVoiceRecording(stream, sessionGeneration, shouldArmPostFollowUpNoInputTimer);
        return;
      }

      if (!SpeechRecognition) {
        stopActiveMicTracks();
        shouldKeepListeningRef.current = false;
        setMicPromptStatus("unsupported");
        setOrbVoiceState("unsupported");
        setOrbStatusText("Voice input is not supported in this browser. You can keep using text chat.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;
      ignoreRecognitionEndRef.current = false;
      suppressRecognitionErrorRef.current = false;
      recognitionEndedAfterRecoverableErrorRef.current = false;

      recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
          } else {
            interimTranscript = `${interimTranscript} ${transcript}`.trim();
          }
        }

        interimTranscriptRef.current = interimTranscript;
        const visibleTranscript = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
        setVoiceTranscript(visibleTranscript);
        if (visibleTranscript) {
          clearPostFollowUpNoInputTimer();
          hasDetectedSpeechRef.current = true;
          setOrbStatusText("Listening. Pause briefly when you're ready for JIMMI to respond.");
          scheduleSilenceAutoSend();
        } else {
          clearSilenceTimer();
          setOrbStatusText("Listening. JIMMI is waiting for your voice.");
        }
      };

      recognition.onerror = (event) => {
        if (ignoreRecognitionEndRef.current || suppressRecognitionErrorRef.current || event.error === "aborted") {
          return;
        }

        if (isNonFatalRecognitionError(event.error)) {
          clearSilenceTimer();
          recognitionEndedAfterRecoverableErrorRef.current = true;
          if (shouldKeepListeningRef.current) {
            setOrbVoiceState("listening");
            setOrbStatusText("Listening. JIMMI is waiting for your voice.");
          } else {
            setOrbVoiceState("idle");
            setOrbStatusText("Voice listening paused. Tap the orb to speak again.");
          }
          return;
        }

        clearSilenceTimer();
        shouldKeepListeningRef.current = false;
        stopActiveMicTracks();
        recognitionRef.current = null;
        setMicPromptStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "idle");
        setOrbVoiceState("idle");
        setOrbStatusText(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone permission was blocked. Tap to try again or keep using text chat." : "Microphone input paused. Tap to try again or keep using text chat.");
      };

      recognition.onend = () => {
        if (ignoreRecognitionEndRef.current) {
          ignoreRecognitionEndRef.current = false;
          return;
        }

        if (recognitionEndedAfterRecoverableErrorRef.current) {
          recognitionEndedAfterRecoverableErrorRef.current = false;
          if (shouldKeepListeningRef.current && !hasDetectedSpeechRef.current) {
            setOrbVoiceState("listening");
            setOrbStatusText("Listening. JIMMI is waiting for your voice.");
            window.setTimeout(() => {
              if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || !shouldKeepListeningRef.current || recognitionRef.current !== recognition) return;
              try {
                recognition.start();
              } catch {
                shouldKeepListeningRef.current = false;
                stopActiveMicTracks();
                recognitionRef.current = null;
                setOrbVoiceState("idle");
                setOrbStatusText("Listening paused. Tap the orb to speak again.");
              }
            }, 160);
            return;
          }
          setOrbVoiceState("idle");
          setOrbStatusText("Voice listening paused. Tap the orb to speak again.");
          return;
        }

        if (shouldKeepListeningRef.current && !hasDetectedSpeechRef.current) {
          setOrbVoiceState("listening");
          setOrbStatusText("Listening. JIMMI is waiting for your voice.");
          window.setTimeout(() => {
            if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || !shouldKeepListeningRef.current || recognitionRef.current !== recognition) return;
            try {
              recognition.start();
            } catch {
              shouldKeepListeningRef.current = false;
              stopActiveMicTracks();
              recognitionRef.current = null;
              setOrbVoiceState("idle");
              setOrbStatusText("Listening paused. Tap the orb to speak again.");
            }
          }, 80);
          return;
        }

        // Browser auto-stopped recognition mid-speech (common on mobile after ~5-7s).
        // Restart immediately whether or not the silence timer is running — the user may
        // still be actively speaking when the browser kills the session. Preserve any
        // existing silence timer so JIMMI only transitions to thinking after a true pause.
        if (hasDetectedSpeechRef.current && shouldKeepListeningRef.current) {
          window.setTimeout(() => {
            if (!isChatVoiceMountedRef.current || voiceCaptureGenerationRef.current !== sessionGeneration || !shouldKeepListeningRef.current || recognitionRef.current !== recognition) return;
            try {
              recognition.start();
            } catch {
              // Could not restart — if silence timer is pending it will fire naturally;
              // otherwise fall back to idle so the user can tap to speak again.
              if (silenceTimerRef.current === null) {
                shouldKeepListeningRef.current = false;
                stopActiveMicTracks();
                recognitionRef.current = null;
                setOrbVoiceState((current) => (current === "listening" ? "idle" : current));
                setOrbStatusText("Listening ended. Tap the orb to speak again.");
              }
            }
          }, 80);
          return;
        }

        shouldKeepListeningRef.current = false;
        stopActiveMicTracks();
        recognitionRef.current = null;
        setOrbVoiceState((current) => (current === "listening" ? "idle" : current));
        setOrbStatusText("Listening ended. Tap the orb to speak again.");
      };

      try {
        recognition.start();
        if (shouldArmPostFollowUpNoInputTimer) schedulePostFollowUpNoInputTimer(sessionGeneration);
      } catch {
        shouldKeepListeningRef.current = false;
        stopActiveMicTracks();
        recognitionRef.current = null;
        setOrbVoiceState("idle");
        setOrbStatusText("Voice listening paused. Tap the orb to speak again.");
      }
    } catch {
      clearSilenceTimer();
      clearVoiceFallbackSubmitTimer();
      clearPostFollowUpNoInputTimer();
      shouldKeepListeningRef.current = false;
      stopActiveMicTracks();
      recognitionRef.current = null;
      setOrbVoiceState("idle");
      setOrbStatusText("Voice listening paused. Tap the orb to speak again.");
    }
  }, [clearPostFollowUpNoInputTimer, clearSilenceTimer, clearVoiceFallbackSubmitTimer, releaseJimmiAudioElement, schedulePostFollowUpNoInputTimer, startServerBackedVoiceRecording, stopActiveMicTracks, stopVoiceActivityDetector]);

  const handleOrbTap = useCallback(async () => {
    triggerOrbHapticFeedback();
    primeJimmiAudioPlayback();
    stopComposerDictation();

    if (orbVoiceState === "speaking" || jimmiSpeechMutation.isPending || (chatMutation.isPending && !isResponseInterrupted)) {
      suppressNextAssistantResponseRef.current = true;
      pendingVoiceResponseRef.current = false;
      setIsResponseInterrupted(true);
      stopJimmiAudioPlayback("Interrupted. Tap the orb again when you’re ready to speak.");
      stopVoiceCapture("idle", "Interrupted. Tap the orb again when you’re ready to speak.");
      return;
    }

    if (orbVoiceState === "listening") {
      // Second tap while listening: always cancel and return to idle.
      // Do NOT call stopServerBackedVoiceRecording() here — that would trigger
      // the transcription/send pipeline. Instead, discard the audio and go idle.
      stopVoiceCapture("idle", "Tap the orb to speak with JIMMI.");
      return;
    }

    if (shouldRouteMicrophoneThroughJimmiDomain()) {
      setMicPromptStatus("idle");
      setOrbVoiceState("idle");
      setOrbStatusText("Opening JIMMI on askjimmi.com so the microphone prompt does not show the temporary preview host.");
      redirectToJimmiPublicDomainForMicrophone();
      return;
    }

    // Show microphone permission rationale on first use (before browser permission prompt)
    const hasSeenMicRationale = localStorage.getItem("jimmi_mic_rationale_seen") === "1";
    if (!hasSeenMicRationale) {
      setPendingVoiceStart(true);
      setShowMicRationale(true);
      return;
    }

    await startVoiceListeningSession();
  }, [chatMutation.isPending, isResponseInterrupted, jimmiSpeechMutation.isPending, orbVoiceState, primeJimmiAudioPlayback, startVoiceListeningSession, stopComposerDictation, stopJimmiAudioPlayback, stopVoiceCapture]);

  useEffect(() => {
      restartListeningAfterSpeechRef.current = () => {
      if (!isChatVoiceMountedRef.current || chatMutation.isPending || jimmiSpeechMutation.isPending) return;
      // If the chat window is expanded (JIMMI orb is hidden), do not auto-resume listening.
      // The user must collapse the chat and tap the orb explicitly.
      if (isChatExpandedRef.current) {
        setOrbVoiceState("idle");
        setOrbStatusText("JIMMI responded. Tap the orb to speak again.");
        return;
      }
      if (recognitionRef.current || mediaRecorderRef.current) {
        stopVoiceCapture("listening", "Resetting the microphone for your answer.");
      }
      window.setTimeout(() => {
        if (!isChatVoiceMountedRef.current || chatMutation.isPending || jimmiSpeechMutation.isPending) return;
        // Re-check in case the user expanded the chat during the 120ms delay.
        if (isChatExpandedRef.current) {
          setOrbVoiceState("idle");
          setOrbStatusText("JIMMI responded. Tap the orb to speak again.");
          return;
        }
        shouldStartPostFollowUpNoInputTimerRef.current = true;
        void startVoiceListeningSession();
      }, 120);
    };
    return () => {
      restartListeningAfterSpeechRef.current = null;
    };
  }, [chatMutation.isPending, jimmiSpeechMutation.isPending, startVoiceListeningSession, stopVoiceCapture]);

  const handleComposerMicPress = useCallback(() => {
    if (chatMutation.isPending || orbVoiceState === "listening" || orbVoiceState === "speaking" || jimmiSpeechMutation.isPending || voiceTranscriptionMutation.isPending) return;
    if (isComposerDictating) {
      stopComposerDictation();
      setOrbStatusText("Composer dictation stopped. Tap send when your message is ready, or tap the orb for two-way voice.");
      return;
    }
    startComposerDictation();
  }, [chatMutation.isPending, isComposerDictating, jimmiSpeechMutation.isPending, orbVoiceState, startComposerDictation, stopComposerDictation, voiceTranscriptionMutation.isPending]);

  useEffect(() => {
    const pathname = location.split("?")[0];
    const isOnChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
    if (!isOnChatRoute) {
      stopComposerDictation();
      stopVoiceCapture("idle", "Voice capture stopped because you left JIMMI Chat.");
    }
  }, [location, stopComposerDictation, stopVoiceCapture]);

  useEffect(() => {
    isChatVoiceMountedRef.current = true;
    const stopAllVoiceMedia = () => {
      voiceCaptureGenerationRef.current += 1;
      clearSilenceTimer();
      clearVoiceFallbackSubmitTimer();
      clearPostFollowUpNoInputTimer();
      shouldKeepListeningRef.current = false;
      ignoreRecognitionEndRef.current = true;
      suppressRecognitionErrorRef.current = true;
      stopVoiceActivityDetector();
      stopComposerDictation();
      const activeRecognition = recognitionRef.current;
      recognitionRef.current = null;
      if (activeRecognition) {
        activeRecognition.onerror = null;
        activeRecognition.onend = null;
        activeRecognition.onresult = null;
        try {
          activeRecognition.abort?.();
        } catch {
          // Browser-specific recognition cleanup errors are safe to ignore while leaving the page.
        }
        try {
          activeRecognition.stop();
        } catch {
          // The desired state is already controlled locally.
        }
      }
      const activeRecorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (activeRecorder && activeRecorder.state !== "inactive") {
        activeRecorder.ondataavailable = null;
        activeRecorder.onstop = null;
        try {
          activeRecorder.stream?.getTracks().forEach((track) => {
            if (track.readyState !== "ended") track.stop();
          });
          activeRecorder.stop();
        } catch {
          // Recorder cleanup should never block navigation cleanup.
        }
      }
      recordedVoiceChunksRef.current = [];
      voiceRecordingStartedAtRef.current = 0;
      voiceSpeechStartedAtRef.current = 0;
      stopActiveMicTracks();
      stopJimmiAudioPlayback("JIMMI voice stopped because you left the chat page.");
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopAllVoiceMedia();
    };
    // iOS Safari: stop mic tracks synchronously on pagehide (most reliable cross-browser)
    const handlePageHide = () => {
      // Synchronously stop all mic tracks so the browser mic indicator clears immediately
      activeMicStreamRef.current?.getTracks().forEach((track) => {
        try { track.stop(); } catch { /* ignore */ }
      });
      activeMicStreamRef.current = null;
      stopAllVoiceMedia();
    };
    // iOS PWA background freeze event
    const handleFreeze = () => stopAllVoiceMedia();
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", stopAllVoiceMedia);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("freeze", handleFreeze);
    return () => {
      isChatVoiceMountedRef.current = false;
      stopAllVoiceMedia();
      // Synchronously stop mic tracks on unmount (route navigation)
      activeMicStreamRef.current?.getTracks().forEach((track) => {
        try { track.stop(); } catch { /* ignore */ }
      });
      activeMicStreamRef.current = null;
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", stopAllVoiceMedia);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("freeze", handleFreeze);
      stopBarcodeScanner();
    };
  }, [clearPostFollowUpNoInputTimer, clearSilenceTimer, stopActiveMicTracks, stopBarcodeScanner, stopComposerDictation, stopJimmiAudioPlayback, stopVoiceActivityDetector]);

  const isScanAnalyzing = foodImageScanMutation.isPending || barcodeScanMutation.isPending || programFileScanMutation.isPending;
  const isVoiceProcessing = voiceTranscriptionMutation.isPending;
  const isJimmiThinking = (chatMutation.isPending && !isResponseInterrupted) || isScanAnalyzing || isVoiceProcessing;
  const isJimmiSpeaking = orbVoiceState === "speaking";
  const hasLiveVoiceTranscript = voiceTranscript.trim().length > 0;
  const visualOrbState: OrbVoiceState = isJimmiSpeaking ? "speaking" : isJimmiThinking || jimmiSpeechMutation.isPending ? "thinking" : orbVoiceState;
  const visibleVoiceStage = orbVoiceState === "listening" ? "listening" : isJimmiSpeaking ? "speaking" : isJimmiThinking || jimmiSpeechMutation.isPending ? "thinking" : "idle";
  const orbInstruction = orbVoiceState === "listening" ? "Tap to stop listening" : isJimmiSpeaking ? "Tap to interrupt JIMMI" : "Tap to speak";
  const orbStateLabel = visibleVoiceStage === "listening" ? "Listening" : visibleVoiceStage === "thinking" ? "Thinking" : visibleVoiceStage === "speaking" ? "Speaking" : orbVoiceState === "unsupported" ? "Voice unsupported" : micPromptStatus === "denied" && isEmbeddedPreviewContext() ? "Preview mic blocked" : micPromptStatus === "denied" ? "Mic blocked" : "Tap to speak";
  const displayMessages = messages.filter((message) => message.role !== "system");
  const isChatSending = !isLocalFallback && chatMutation.isPending;
  const isScanThinking = foodImageScanMutation.isPending || barcodeScanMutation.isPending || programFileScanMutation.isPending;
  const isComposerMicActive = isComposerDictating;
  const isTwoWayVoiceActive = orbVoiceState === "listening" || orbVoiceState === "speaking" || jimmiSpeechMutation.isPending || voiceTranscriptionMutation.isPending;
  const isComposerMicDisabled = chatMutation.isPending || isTwoWayVoiceActive;
  const canSubmitChat = chatInput.trim().length > 0 && !chatMutation.isPending;
  const isTextResponseThinking = isJimmiThinking && !pendingVoiceResponseRef.current;
  const orbMotionScale = isTextResponseThinking ? 0.46 : 1;

  useEffect(() => {
    scrollToChatBottom("smooth");
  }, [displayMessages.length, isChatSending, voiceTranscript, scrollToChatBottom]);

  if (loading || (Boolean(user) && profileQuery.isLoading)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" className="block h-[1.45rem] w-auto md:h-[1.65rem]" />
          <div className="h-0.5 w-12 animate-pulse rounded-full bg-white/40" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-white/50">Loading your coaching room</span>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-white/30">This may take a moment on first load</span>
        </div>
      </main>
    );
  }

  // Auto-redirect to onboarding when authenticated but no profile — avoids dead-end screen
  useEffect(() => {
    if (!loading && user && !profileQuery.isLoading && !profile) {
      setLocation("/onboarding");
    }
  }, [loading, user, profileQuery.isLoading, profile, setLocation]);

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" className="block h-[1.45rem] w-auto md:h-[1.65rem]" />
          <div className="h-0.5 w-12 animate-pulse rounded-full bg-white/40" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-white/50">Setting up your profile</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100svh] min-h-[100svh] w-full max-w-full min-w-0 flex-col items-center justify-start overflow-hidden overflow-x-clip overscroll-none bg-background text-foreground [touch-action:pan-y]" data-chat-page-width-containment="viewport-safe" data-chat-focused-input-overflow-guard="mobile-browser-safe" data-chat-desktop-centering="viewport-flex-centered">
      <section className="mx-auto box-border flex h-[100svh] min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden px-2 py-2 [padding-left:max(0.5rem,env(safe-area-inset-left))] [padding-right:max(0.5rem,env(safe-area-inset-right))] sm:px-4 md:mx-0 md:max-w-3xl md:self-center md:py-5" data-chat-shell-width-containment="no-viewport-width" data-chat-safe-area-width-containment="true" data-chat-shell-desktop-centering="parent-flex-centered">
        <header className="flex w-full min-w-0 max-w-full shrink-0 flex-nowrap items-center justify-between gap-2 overflow-hidden border-b border-white/10 pb-2.5 md:gap-3 md:pb-3">
          <JimmiWordmark variant="member" className="jimmi-wordmark min-w-0 shrink text-xl md:text-2xl" />
          <nav className="flex min-w-0 max-w-[60%] shrink-0 items-center justify-end gap-2 overflow-hidden text-xs md:max-w-full md:text-sm">
            {wearableDisplayName ? (
              <Link
                href="/integrations"
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white/48 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white/68"
                aria-label={`${wearableDisplayName} connected — manage integrations`}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-400/75" />
                <span className="hidden sm:inline">{wearableDisplayName}</span>
                <span className="sm:hidden">{wearableDisplayName.slice(0, 1)}</span>
              </Link>
            ) : null}
            <MemberMenu memberName={profile.firstName} avatarUrl={profile.avatarUrl} isLocalFallback={isLocalFallback} />
          </nav>
        </header>

        <div data-chat-expandable-shell={isChatExpanded ? "expanded" : "normal"} className="mx-auto mt-2 box-border flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-white/10 bg-black/84 px-2 pb-2 pt-2.5 shadow-2xl shadow-black/60 backdrop-blur sm:rounded-[1.85rem] sm:px-3 sm:pt-3 md:mt-4 md:px-5 md:pb-3 md:pt-4">
          <section aria-label="JIMMI chat transcription" className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[1.15rem] border border-white/[0.08] bg-white/[0.022] p-2.5 sm:rounded-[1.45rem] sm:p-3 md:p-4">
            <div ref={chatScrollRef} data-chat-auto-scroll="true" data-chat-scroll-touch-enabled="true" className="min-h-0 min-w-0 flex-1 overflow-hidden overflow-x-hidden touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
              <ScrollArea className="h-full w-full min-w-0 max-w-full overflow-x-hidden pr-1 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] sm:pr-2">
                <div className="min-w-0 max-w-full space-y-2.5 overflow-x-hidden pb-3 touch-pan-y sm:pb-4">
                {displayMessages.length === 0 ? null : (
                  displayMessages.map((message, index) => (
                    <article key={`${message.role}-${index}`} data-chat-message-card={message.role === "assistant" ? "jimmi-response-scroll-readable" : "user-message"} data-chat-scan-result-inline={message.scanResult ? "food-program-barcode" : undefined} className={`box-border min-w-0 max-w-[92%] overflow-hidden rounded-[1.05rem] border px-2.5 py-2 text-xs leading-5 break-words sm:max-w-[94%] sm:px-3 md:max-w-[82%] ${message.role === "user" ? "ml-auto border-white/10 bg-white text-black" : "border-white/[0.08] bg-white/[0.045] text-white/78"}`}>
                      <p className="mb-1 font-mono text-[0.52rem] uppercase tracking-[0.22em] text-current opacity-45">{message.role === "user" ? "You" : "JIMMI"}{message.createdAt ? <span className="ml-2 normal-case tracking-normal opacity-60">{new Date(message.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span> : null}</p>
                      {message.role === "assistant" ? <div data-chat-assistant-response-body="scroll-readable" className="prose prose-sm prose-invert max-w-none overflow-visible break-words text-xs leading-5 [&_*]:break-words"><ReactMarkdown>{message.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                      {message.videoEmbed ? (
                        <div data-chat-youtube-embed-card="exercise-demo" className="mt-3 min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black/36 text-white/72">
                          <div className="flex min-w-0 items-center gap-2 border-b border-white/[0.07] px-2.5 py-2 text-[0.58rem] uppercase tracking-[0.14em] text-white/48 sm:px-3 sm:text-[0.64rem] sm:tracking-[0.18em]">
                            <PlayCircle className="size-3.5 text-primary" /> YouTube exercise demo
                          </div>
                          <div className="aspect-video w-full max-w-full bg-black">
                            <iframe
                              title={message.videoEmbed.title}
                              src={message.videoEmbed.embedUrl}
                              className="h-full w-full"
                              loading="lazy"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-2.5 py-2 sm:px-3">
                            <span className="min-w-0 max-w-full break-words font-medium text-white/78">{message.videoEmbed.exerciseName}</span>
                            <a href={message.videoEmbed.watchUrl} target="_blank" rel="noreferrer" className="text-[0.68rem] font-medium text-primary underline-offset-4 hover:underline">Open on YouTube</a>
                          </div>
                        </div>
                      ) : null}
                      {message.scanResult ? (
                        <div data-chat-inline-scan-result-card="food-program-barcode" data-chat-save-scan-to-food-log="available" className="mt-3 min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black/28 p-2.5 text-white/72 sm:p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0"><p className="break-words font-medium text-white">{message.scanResult.foodName}</p><p className="mt-1 break-words text-white/50">{message.scanResult.serving ?? message.scanResult.portion ?? "Estimated serving"} · {message.scanResult.confidence ?? "estimated"}</p></div>
                            <Button type="button" size="sm" onClick={() => handleReviewFoodScanBeforeLog(message.scanResult)} disabled={saveScanToFoodLogMutation.isPending} data-save-food-log-success-popup="sonner" className="rounded-full bg-primary text-primary-foreground"><Save className="mr-1.5 size-3.5" /> {saveScanToFoodLogMutation.isPending ? "Saving..." : "Review & Save to Food Log"}</Button>
                          </div>
                          <div className="mt-3 grid min-w-0 grid-cols-2 gap-1.5 text-center sm:grid-cols-4"><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{message.scanResult.calories}<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Cal</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{message.scanResult.protein}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Protein</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{message.scanResult.carbs}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Carbs</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{message.scanResult.fat}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Fat</b></span></div>
                          <div data-chat-scan-guidance-scroll-readable="inline-thread" className="mt-2 max-h-36 overflow-y-auto overscroll-contain pr-1 text-white/58 touch-pan-y [-webkit-overflow-scrolling:touch]"><p className="break-words">{message.scanResult.guidance}</p>{message.scanResult.suggestion ? <p className="mt-1 break-words">{message.scanResult.suggestion}</p> : null}{message.scanResult.sourceNote ? <p className="mt-1 break-words text-white/42">{message.scanResult.sourceNote}</p> : null}</div>
                          {saveScanStatusText ? <p className="mt-2 font-medium text-primary" role="status">{saveScanStatusText}</p> : null}
                        </div>
                      ) : null}
                      {message.programScanResult?.imported ? (
                        <div data-chat-inline-program-import-card="pdf-imported-my-program" className="mt-3 min-w-0 max-w-full overflow-hidden rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-2.5 text-white/78 sm:p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-medium text-white">{message.programScanResult.importedProgram?.title ?? message.programScanResult.title}</p>
                              <p data-chat-program-import-message="my-program-confirmation" className="mt-1 break-words text-white/58">{message.programScanResult.importMessage ?? "JIMMI imported this PDF into My Program."}</p>
                              {message.programScanResult.importedProgram?.trainingDayCount ? <p className="mt-1 break-words text-white/42">{message.programScanResult.importedProgram.trainingDayCount} training days saved.</p> : null}
                            </div>
                            <Link href={message.programScanResult.importedProgram?.route ?? "/my-program"} data-chat-program-import-view-my-program="true" className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70">View My Program</Link>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
                {isChatSending || isScanThinking ? (
                  <article data-jimmi-thinking-state="chat-or-scan" className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-[1.1rem] border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-xs text-white/62">
                    <Loader2 className="size-3.5 animate-spin" /> {isScanThinking ? "JIMMI is thinking through the scan..." : "JIMMI is thinking..."}
                  </article>
                ) : null}
                </div>
              </ScrollArea>
            </div>

          </section>

          <div className="flex shrink-0 justify-center py-1.5">
            <button
              type="button"
              aria-label={isChatExpanded ? "Slide chat window up to show JIMMI" : "Drag chat window down to expand chat and hide JIMMI"}
              aria-pressed={isChatExpanded}
              data-chat-expand-drag-line="bottom-border"
              data-chat-expanded={isChatExpanded ? "true" : "false"}
              onPointerDown={handleChatResizePointerDown}
              onPointerMove={handleChatResizePointerMove}
              onPointerUp={handleChatResizePointerEnd}
              onPointerCancel={handleChatResizePointerEnd}
              className="group flex h-6 w-full max-w-[9rem] touch-none cursor-ns-resize items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
            >
              <span className="h-1 w-16 rounded-full bg-white/18 transition group-hover:bg-primary/70 group-focus-visible:bg-primary" />
              <span className="sr-only">{isChatExpanded ? "Chat expanded. Slide up or tap to show JIMMI again." : "Slide down or tap to expand the chat and hide JIMMI."}</span>
            </button>
          </div>

          <section aria-label="JIMMI voice visual" data-orb-frame-safe="true" data-orb-mobile-clip-guard="true" data-orb-unclipped-stage="true" data-transcription-placement="chat-box-live" data-orb-clarity-tuned="true" data-orb-ultra-quality="true" data-orb-touch-affordance="expanded" data-speech-gated-listening="true" data-silence-delay-ms="700" data-text-thinking-motion-scale="0.46" data-orb-desktop-viewport-recenter="left-corrected" data-min-visible-text-thinking-ms={minVisibleTextThinkingMs} data-jimmi-visual-hidden-by-chat={isChatExpanded ? "true" : "false"} aria-hidden={isChatExpanded} className={`relative flex min-w-0 shrink-0 flex-col items-center overflow-hidden px-1 transition-all duration-300 ease-out sm:px-2 md:-translate-x-8 lg:-translate-x-10 xl:-translate-x-12 ${isChatExpanded ? "max-h-0 py-0 opacity-0 pointer-events-none" : "max-h-[22rem] py-3 opacity-100 md:py-4"}`}>
            <div className="relative flex min-h-[12.75rem] w-full min-w-0 max-w-full items-center justify-center overflow-hidden sm:min-h-[16.25rem] sm:overflow-visible md:min-h-[17.75rem]" data-last-message-topic={lastMessageTopic}>
              <span className="pointer-events-none absolute inset-x-1/2 top-1/2 size-[min(74vw,15.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.016] blur-3xl md:size-[min(36svh,17rem)]" aria-hidden="true" />
              <JimmiWebGLOrb
                state={visualOrbState}
                isPressed={orbVoiceState === "listening" && hasLiveVoiceTranscript}
                onClick={handleOrbTap}
                ariaLabel={`JIMMI upgraded WebGL orb. ${orbInstruction}.`}
                size="clamp(10.75rem, 31svh, 16.5rem)"
                motionScale={orbMotionScale}
                quality="ultra"
                className="relative z-10"
              />
            </div>
            <div aria-label="JIMMI current orb state" data-orb-current-state-label="true" data-orb-current-state={visibleVoiceStage} data-listening-persists-until-thinking-or-tapped="true" className="mt-1.5 flex items-center justify-center px-2">
              <span
                data-orb-state-tag={visibleVoiceStage}
                data-active="true"
                className="rounded-full border border-white/24 bg-white/[0.105] px-3 py-1 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-white shadow-[0_0_24px_rgba(255,255,255,0.07)] transition"
                aria-live="polite"
              >
                {orbStateLabel}
              </span>
            </div>
            <p className="sr-only" aria-live="polite">{hasLiveVoiceTranscript ? `Two-way orb voice is capturing your speech without activating message-box dictation. ${orbStateLabel}` : voicePlaybackStatus || orbStateLabel}</p>
            {voicePlaybackStatus ? <p data-jimmi-elevenlabs-playback-status="true" className="sr-only" aria-live="polite">{voicePlaybackStatus}</p> : null}
          </section>


          <input id="chat-camera-food-input" ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" data-chat-camera-food-input="true" onChange={(event) => { void handleCameraFoodFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          <input id="chat-program-file-input" ref={programFileInputRef} type="file" accept="image/*,application/pdf,.txt,.md,.csv" className="sr-only" data-chat-program-file-input="true" onChange={(event) => { void handleProgramFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />

          {isPlusPanelOpen ? (
            <section data-chat-plus-action-panel="camera-files-barcode" data-chat-plus-panel-style="minimal-three-function" className="mt-2 shrink-0 rounded-[1.45rem] border border-white/[0.08] bg-[#141414]/95 p-2.5 text-white shadow-[0_18px_54px_rgba(0,0,0,0.38)] backdrop-blur-xl">
              <div className="mb-1.5 flex items-center justify-center">
                <span data-chat-plus-panel-handle="true" className="h-1 w-9 rounded-full bg-white/18" />
              </div>
              <div className="flex justify-end px-1 pb-1.5">
                <button type="button" aria-label="Close add panel" onClick={() => setIsPlusPanelOpen(false)} className="grid size-7 shrink-0 place-items-center rounded-full text-white/42 transition hover:bg-white/[0.06] hover:text-white"><X className="size-3.5" /></button>
              </div>
              <div data-chat-plus-action-list="minimal" className="space-y-1">
                <button
                  type="button"
                  data-chat-camera-food-option="macro-recognition"
                  onClick={() => { if (!isCorePlus) { setUpgradeModalState({ isOpen: true, feature: "Camera", tier: "core" }); return; } cameraInputRef.current?.click(); }}
                  className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/74">{isCorePlus ? <Camera className="size-4" /> : <LockKeyhole className="size-4" />}</span>
                  <span className="block min-w-0 flex-1 text-sm font-medium text-white/88"><span>Camera</span>{!isCorePlus ? <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-amber-200">Core+</span> : null}</span>
                </button>
                <label htmlFor="chat-program-file-input" role="button" tabIndex={0} data-chat-add-files-option="direct-file-picker" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { if (!isCorePlus) { setUpgradeModalState({ isOpen: true, feature: "Add files", tier: "core" }); return; } programFileInputRef.current?.click(); } }} onClick={() => { if (!isCorePlus) { setUpgradeModalState({ isOpen: true, feature: "Add files", tier: "core" }); return; } }} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/74">{isCorePlus ? <FileUp className="size-4" /> : <LockKeyhole className="size-4" />}</span>
                  <span className="block min-w-0 flex-1 text-sm font-medium text-white/88"><span>Add files</span>{!isCorePlus ? <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-amber-200">Core+</span> : null}</span>
                </label>
                <button
                  type="button"
                  data-chat-barcode-scanner-option="live-camera-product-macro-guidance"
                  onClick={() => { if (!isCorePlus) { setUpgradeModalState({ isOpen: true, feature: "Barcode Scanner", tier: "core" }); return; } void handleOpenBarcodeScanner(); }}
                  className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/74">{isCorePlus ? <ScanBarcode className="size-4" /> : <LockKeyhole className="size-4" />}</span>
                  <span className="block min-w-0 flex-1 text-sm font-medium text-white/88"><span>Barcode Scanner</span>{!isCorePlus ? <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-amber-200">Core+</span> : null}</span>
                </button>
              </div>
            </section>
          ) : null}






          {isBarcodeScannerOpen ? (
            <section data-live-barcode-scanner-overlay="true" aria-label="Live barcode scanner" className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 text-white backdrop-blur-xl">
              <div className="w-full max-w-md overflow-hidden rounded-[1.7rem] border border-white/12 bg-[#0f0f0f] shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
                <div className="flex items-center justify-end p-3">
                  <button type="button" aria-label="Close barcode scanner" onClick={closeBarcodeScanner} className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/58 transition hover:text-white"><X className="size-4" /></button>
                </div>
                <div className="relative mx-3 aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-black md:aspect-[4/5]">
                  <video ref={barcodeVideoRefCallback} data-live-barcode-scanner-video="true" className="h-full w-full object-cover" muted playsInline autoPlay />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_24%,rgba(0,0,0,0.34)_64%)]" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-primary/90 bg-black/10 shadow-[0_0_0_999px_rgba(0,0,0,0.26),0_0_28px_rgba(232,255,0,0.32)]" data-barcode-placement-guide="rectangle">
                    <span className="absolute -left-1 -top-1 size-7 rounded-tl-xl border-l-4 border-t-4 border-white" />
                    <span className="absolute -right-1 -top-1 size-7 rounded-tr-xl border-r-4 border-t-4 border-white" />
                    <span className="absolute -bottom-1 -left-1 size-7 rounded-bl-xl border-b-4 border-l-4 border-white" />
                    <span className="absolute -bottom-1 -right-1 size-7 rounded-br-xl border-b-4 border-r-4 border-white" />
                    <span className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-primary/90 shadow-[0_0_18px_rgba(232,255,0,0.65)]" />
                  </div>
                  <p className="pointer-events-none absolute bottom-4 left-6 right-6 rounded-full bg-black/52 px-3 py-2 text-center text-[0.62rem] uppercase tracking-[0.24em] text-white/72">Align barcode inside rectangle</p>
                </div>
                <p className="px-5 py-4 text-center text-xs leading-5 text-white/62" aria-live="polite">{barcodeScannerStatus || "Point the camera at the product barcode."}</p>
              </div>
            </section>
          ) : null}


          <Dialog open={Boolean(foodLogReviewDraft)} onOpenChange={(open) => { if (!open) setFoodLogReviewDraft(null); }}>
            <DialogContent className="border-white/10 bg-[#10100f] text-white sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Review macros before logging</DialogTitle>
                <DialogDescription className="text-white/58">JIMMI estimated these macros. Edit any field if your portion or ingredients were different, then save to your Food Log.</DialogDescription>
              </DialogHeader>
              {foodLogReviewDraft ? (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="review-food-name" className="text-white/70">Food name</Label>
                    <Input id="review-food-name" value={foodLogReviewDraft.foodName} onChange={(event) => setFoodLogReviewDraft((draft) => draft ? { ...draft, foodName: event.target.value } : draft)} className="border-white/12 bg-white/[0.06] text-white" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="review-serving" className="text-white/70">Serving or portion</Label>
                    <Input id="review-serving" value={foodLogReviewDraft.serving} onChange={(event) => setFoodLogReviewDraft((draft) => draft ? { ...draft, serving: event.target.value } : draft)} className="border-white/12 bg-white/[0.06] text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
                      <div className="grid gap-2" key={key}>
                        <Label htmlFor={`review-${key}`} className="text-white/70">{key === "calories" ? "Calories" : `${key.charAt(0).toUpperCase()}${key.slice(1)} (g)`}</Label>
                        <Input id={`review-${key}`} inputMode="numeric" type="number" min="0" value={foodLogReviewDraft[key]} onChange={(event) => setFoodLogReviewDraft((draft) => draft ? { ...draft, [key]: event.target.value } : draft)} className="border-white/12 bg-white/[0.06] text-white" />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="review-meal-type" className="text-white/70">Meal type</Label>
                    <select id="review-meal-type" value={foodLogReviewDraft.mealType} onChange={(event) => setFoodLogReviewDraft((draft) => draft ? { ...draft, mealType: event.target.value as FoodLogReviewDraft["mealType"] } : draft)} className="h-10 rounded-md border border-white/12 bg-white/[0.06] px-3 text-sm text-white outline-none focus-visible:ring-1 focus-visible:ring-primary">
                      <option className="bg-[#10100f]" value="Breakfast">Breakfast</option>
                      <option className="bg-[#10100f]" value="Lunch">Lunch</option>
                      <option className="bg-[#10100f]" value="Dinner">Dinner</option>
                      <option className="bg-[#10100f]" value="Snack">Snack</option>
                    </select>
                  </div>
                </div>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFoodLogReviewDraft(null)} className="border-white/12 text-white hover:bg-white/[0.06]">Cancel</Button>
                <Button type="button" onClick={handleConfirmReviewedFoodLog} disabled={saveScanToFoodLogMutation.isPending} className="bg-primary text-primary-foreground">{saveScanToFoodLogMutation.isPending ? "Saving..." : "Save reviewed log"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isFeatureTourOpen} onOpenChange={(open) => { if (!open) completeFeatureTour(); }}>
            <DialogContent showCloseButton={false} data-post-onboarding-feature-tour="once-only-mobile-safe" data-feature-tour-mobile-frame="contained-within-viewport" className="max-h-[min(82svh,32rem)] w-[calc(100svw-1.5rem)] max-w-[23rem] overflow-y-auto rounded-[1.6rem] border-white/12 bg-[#10100f] p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.68)] sm:max-w-md sm:p-5">
              <DialogHeader className="space-y-2 text-left">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-primary/90">Feature tour · {featureTourStepIndex + 1} of {featureTourSteps.length}</p>
                <DialogTitle className="font-display text-2xl font-light tracking-tight text-white">{activeFeatureTourStep.title}</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-white/62">{activeFeatureTourStep.body}</DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3" data-feature-tour-brief-informative-copy="true">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white/42">{activeFeatureTourStep.eyebrow}</p>
                <div className="mt-3 flex gap-1.5" aria-label="Feature tour progress">
                  {featureTourSteps.map((step, index) => (
                    <span key={step.title} className={cn("h-1.5 flex-1 rounded-full transition", index <= featureTourStepIndex ? "bg-primary" : "bg-white/12")} />
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={completeFeatureTour} data-feature-tour-skip-button="subtle" className="rounded-full px-4 text-white/48 hover:bg-white/[0.055] hover:text-white">Skip</Button>
                <Button type="button" onClick={handleFeatureTourNext} data-feature-tour-next-button="true" className="rounded-full bg-primary px-5 text-primary-foreground hover:brightness-110">
                  {featureTourStepIndex >= featureTourSteps.length - 1 ? "Start chatting" : "Next"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Camera permission rationale dialog — shown once before first barcode scan */}
          <Dialog open={showCameraRationale} onOpenChange={(open) => { if (!open) { setShowCameraRationale(false); setPendingBarcodeOpen(false); } }}>
            <DialogContent className="max-w-[22rem] rounded-[1.6rem] border-white/12 bg-[#10100f] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.68)]">
              <DialogHeader className="space-y-2 text-left">
                <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-white/[0.07]">
                  <Camera className="size-5 text-white/70" />
                </div>
                <DialogTitle className="font-display text-xl font-light tracking-tight text-white">Camera access</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-white/62">
                  JIMMI uses your camera to scan product barcodes and look up nutrition information. No images or video are stored — the camera is only used to read the barcode.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-2 gap-2">
                <Button type="button" variant="ghost" onClick={() => { setShowCameraRationale(false); setPendingBarcodeOpen(false); }} className="rounded-full px-4 text-white/48 hover:bg-white/[0.055] hover:text-white">Not now</Button>
                <Button type="button" onClick={() => {
                  localStorage.setItem("jimmi_camera_rationale_seen", "1");
                  setShowCameraRationale(false);
                  if (pendingBarcodeOpen) {
                    setPendingBarcodeOpen(false);
                    setScanStatusText("");
                    setBarcodeScannerStatus("Point the camera at the product barcode.");
                    hasBarcodeScanCompletedRef.current = false;
                    setIsBarcodeScannerOpen(true);
                  }
                }} className="rounded-full bg-primary px-5 text-primary-foreground hover:brightness-110">Allow camera</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Microphone permission rationale dialog — shown once before first voice session */}
          <Dialog open={showMicRationale} onOpenChange={(open) => { if (!open) { setShowMicRationale(false); setPendingVoiceStart(false); } }}>
            <DialogContent className="max-w-[22rem] rounded-[1.6rem] border-white/12 bg-[#10100f] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.68)]">
              <DialogHeader className="space-y-2 text-left">
                <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-white/[0.07]">
                  <Mic className="size-5 text-white/70" />
                </div>
                <DialogTitle className="font-display text-xl font-light tracking-tight text-white">Microphone access</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-white/62">
                  JIMMI uses your microphone so you can speak your food logs, workouts, and questions hands-free. Your voice is transcribed and only the text is stored — audio is never saved.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-2 gap-2">
                <Button type="button" variant="ghost" onClick={() => { setShowMicRationale(false); setPendingVoiceStart(false); }} className="rounded-full px-4 text-white/48 hover:bg-white/[0.055] hover:text-white">Not now</Button>
                <Button type="button" onClick={async () => {
                  localStorage.setItem("jimmi_mic_rationale_seen", "1");
                  setShowMicRationale(false);
                  if (pendingVoiceStart) {
                    setPendingVoiceStart(false);
                    await startVoiceListeningSession();
                  }
                }} className="rounded-full bg-primary px-5 text-primary-foreground hover:brightness-110">Allow microphone</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <form onSubmit={handleChatSubmit} data-chat-mobile-overflow-guard="true" data-chat-focused-composer-width-guard="ios-keyboard-safe" className="mt-2 box-border flex w-full min-w-0 max-w-full shrink-0 items-end gap-1 overflow-hidden rounded-full border border-white/10 bg-white/[0.055] p-1.5 pl-2 shadow-[0_18px_54px_rgba(0,0,0,0.34)] [contain:inline-size] sm:gap-2 sm:pl-2.5">
            <button type="button" aria-label="Add attachment" aria-expanded={isPlusPanelOpen} data-chat-plus-button="smart-actions" onClick={() => setIsPlusPanelOpen((open) => !open)} className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-black/50 text-white/50 transition hover:text-white sm:size-9">
              <Plus className="size-4" />
            </button>
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message JIMMI..."
              rows={1}
              className="min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base leading-5 text-white outline-none placeholder:text-white/34 sm:text-sm"
            />
            <button
              type="button"
              aria-label={isComposerMicActive ? "Stop message-box dictation" : "Start message-box dictation"}
              aria-pressed={isComposerMicActive}
              data-chat-composer-mic="message-box-dictation-only"
              data-chat-composer-mic-state={isComposerMicActive ? "dictating" : "idle"}
              data-chat-composer-mic-independent-from-orb="true"
              disabled={isComposerMicDisabled}
              onClick={handleComposerMicPress}
              className={cn(
                "mb-0.5 grid size-8 shrink-0 place-items-center rounded-full text-white/42 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-35",
                isComposerMicActive ? "bg-white/[0.11] text-primary shadow-[0_0_14px_rgba(255,255,255,0.08)]" : "hover:bg-white/[0.055] hover:text-white/72"
              )}
            >
              <Mic className="size-3.5" />
            </button>
            <Button type="submit" size="icon" disabled={!canSubmitChat || restaurantMealEstimateMutation.isPending} className="mb-0.5 size-8 shrink-0 rounded-full bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/35 sm:size-9">
              {chatMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
      </section>
      
      {upgradeModalState && (
        <UpgradeModal
          isOpen={upgradeModalState.isOpen}
          onClose={() => setUpgradeModalState(null)}
          featureName={upgradeModalState.feature}
          requiredTier={upgradeModalState.tier}
          description={`${upgradeModalState.feature} is available on Core, Pro, and Elite plans.`}
        />
      )}
    </main>
  );}
