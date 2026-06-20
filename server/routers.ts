import { z } from "zod";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { coachOverrideMacros, coachOverrideProgram, countTodayUserChatMessages, createChatMessage, createExerciseLogEntry, createFoodLogEntry, deleteFoodLogEntry, deleteUserAccountData, disconnectGoogleHealthConnection, disconnectOuraConnection, disconnectWhoopConnection, getAccountSettings, getCalorieBalanceForDate, getCalorieBalanceRange, getJimmiProfile, getJimmiProgram, getProgramGenerationQuota, getStripeCustomerByUserId, getStripeSubscriptionByUserId, getStripeInvoicesByUserId, getUserByEmail, getUserByGoogleId, getUserById, getUserByOpenId, getWearableConnectionState, listChatMessages, listEliteUsersForCoach, listExerciseLogEntries, listExerciseLogEntriesForCoach, listFoodLogEntries, listFoodLogEntriesForCoach, listUsersForAdminManagement, markJimmiTourSeen, recordProgramGeneration, resetUserOnboardingState, resetUserProgramGeneration, setBetaWearableConnection, updateAccountSettings, updateFoodLogEntry, updateJimmiProfileAvatar, updateJimmiProgramGroceryList, updateUserGoogleId, updateUserPasswordHash, updateUserPlanTier, updateUserRole, upsertJimmiProfile, upsertJimmiProgram, upsertUser } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { getLLMModelForUser } from "./llm-gating";
import { storagePut } from "./storage";
import { estimateRestaurantMacros } from "./restaurantNutrition";
import { createOuraAuthorizationUrl, isOuraConfigured, OURA_REDIRECT_URI, OURA_SCOPES } from "./oura";
import { createWhoopAuthorizationUrl, isWhoopConfigured, WHOOP_REDIRECT_URI, WHOOP_SCOPES, WHOOP_WEBHOOK_URL } from "./whoop";
import { buildGoogleHealthAuthUrl, GOOGLE_HEALTH_REDIRECT_URI, GOOGLE_HEALTH_SCOPES, isGoogleHealthConfigured } from "./google-health";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getSportSpecificPrompt } from "./sport-specific-prompts";
import { FREE_CHAT_DAILY_LIMIT, tierAtLeast } from "../shared/tiers";
type AuthUser = NonNullable<import("./_core/context").TrpcContext["user"]>;

// ─── Per-user rate limiter for chat.send ──────────────────────────────────────
// Prevents a single user from spamming the LLM endpoint (cost protection).
// Uses a simple in-memory map: acceptable for a single-instance Cloud Run
// deployment. If you scale to multiple instances, replace with Redis.
const CHAT_SEND_MIN_INTERVAL_MS = 3_000; // 1 request per 3 seconds per user
const chatSendLastSentAt = new Map<number, number>();
/** Exported for test teardown only — do not use in production code. */
export function _resetChatSendRateLimiter(): void {
  chatSendLastSentAt.clear();
}
function checkChatSendRateLimit(userId: number): void {
  const now = Date.now();
  const last = chatSendLastSentAt.get(userId) ?? 0;
  if (now - last < CHAT_SEND_MIN_INTERVAL_MS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Please wait a moment before sending another message.",
    });
  }
  chatSendLastSentAt.set(userId, now);
  // Prune old entries every ~1000 requests to prevent unbounded map growth
  if (chatSendLastSentAt.size > 1000) {
    const cutoff = now - 60_000;
    for (const [uid, ts] of Array.from(chatSendLastSentAt.entries())) {
      if (ts < cutoff) chatSendLastSentAt.delete(uid);
    }
  }
}



function isGoalsMet(totals: Record<string, number>, targets: Record<string, number>): boolean {
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

export function withOwnerAdminRole(user: AuthUser | null | undefined) {
  if (!user) return user;
  const isOwner = Boolean(ENV.ownerOpenId && user.openId === ENV.ownerOpenId);
  return isOwner && user.role !== "admin" ? { ...user, role: "admin" as const } : user;
}

export function canUnlockOwnerAdminAccess(user: AuthUser | null | undefined) {
  if (!user) return false;
  return user.role === "admin" || Boolean(ENV.ownerOpenId && user.openId === ENV.ownerOpenId);
}

export function isAdminFallbackPasswordConfigured() {
  return ENV.adminFallbackPassword.length >= 8;
}

export function canUnlockAdminWithPassword(password: string) {
  if (!isAdminFallbackPasswordConfigured()) return false;
  const expected = Buffer.from(ENV.adminFallbackPassword, "utf8");
  const supplied = Buffer.from(password, "utf8");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function calculateAge(birthday: string) {
  const birthDate = new Date(`${birthday}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function isAtLeastEightYearsOld(birthday: string) {
  const age = calculateAge(birthday);
  return age !== null && age >= 8;
}

const allowedGenders = ["Male", "Female"] as const;

const requiredString = z.string().trim().min(1, "This field is required.");
const requiredArray = z.array(requiredString).min(1, "Choose at least one option.");
const singleDietRestrictionArray = z.array(requiredString).min(1, "Choose one dietary option.").max(1, "Choose only one dietary option.").refine((values) => values.every((value) => value !== "Gluten-free" && value !== "Dairy-free"), "Gluten and dairy should be selected under allergies.");

const onboardingInput = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters.").max(120),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your birthday in YYYY-MM-DD format.").refine(isAtLeastEightYearsOld, "You must be at least 8 years old to use JIMMI."),
  gender: z.enum(allowedGenders, { message: "Select Male or Female." }),
  weight: z.coerce.number().int().min(50, "Enter a realistic weight.").max(700, "Enter a realistic weight."),
  targetWeight: z.coerce.number().int().min(50, "Enter a realistic target weight.").max(700, "Enter a realistic target weight.").nullable().optional(),
  height: requiredString.max(20),
  healthComplications: requiredArray,
  dietRestrictions: singleDietRestrictionArray,
  dietaryPreferences: z.string().trim().max(600).optional().nullable(),
  foodAllergies: requiredArray,
  fitnessLevel: requiredString.max(80),
  activityLevel: requiredString.max(80),
  fitnessGoals: requiredArray,
  additionalInfo: z.string().trim().max(1200).optional().nullable(),
}).superRefine((input, ctx) => {
  if (input.fitnessGoals.includes("Lose weight")) {
    if (input.targetWeight == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetWeight"], message: "Target weight is required when losing weight is a goal." });
    } else if (input.targetWeight >= input.weight) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetWeight"], message: "Target weight must be less than your current weight." });
    }
  }
});

const avatarUploadInput = z.object({
  imageDataUrl: z.string().min(1).max(7_000_000),
});

const logDateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for the food log date.");
const mealTypeInput = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);
const foodLogEntryInput = z.object({
  logDate: logDateInput,
  mealType: mealTypeInput,
  foodName: z.string().trim().min(2, "Enter a food or meal name.").max(180),
  calories: z.coerce.number().int().min(0).max(5000),
  protein: z.coerce.number().int().min(0).max(500),
  carbs: z.coerce.number().int().min(0).max(800),
  fat: z.coerce.number().int().min(0).max(400),
  notes: z.string().trim().max(600).optional().nullable(),
});
const macroEstimateInput = z.object({ foodName: z.string().trim().min(2, "Enter a food or meal name to estimate.").max(180) });
const foodImageScanInput = z.object({ imageDataUrl: z.string().min(1).max(8_000_000), source: z.enum(["camera", "upload"]).default("camera") });
const programFileScanInput = z.object({ fileName: z.string().trim().min(1).max(180), mimeType: z.string().trim().min(1).max(120), fileDataUrl: z.string().min(1).max(10_000_000) });
const barcodeScanInput = z.object({ barcode: z.string().trim().regex(/^[0-9]{6,18}$/, "Enter a valid numeric food barcode.") });
const restaurantMealEstimateInput = z.object({ description: z.string().trim().min(3, "Tell JIMMI the restaurant and what you ate.").max(500) });
const adminResetTargetInput = z.object({ userId: z.coerce.number().int().positive() });
const adminPasswordUnlockInput = z.object({ password: z.string().min(8, "Enter the admin password.").max(128, "Admin password is too long.") });
const adminPlanTierInput = adminResetTargetInput.extend({ planTier: z.enum(["free", "core", "pro", "elite"]) });
const adminWearableConnectionInput = adminResetTargetInput.extend({ connected: z.boolean() });

function decodeAvatarDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Use a PNG, JPEG, or WebP image.");
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 4_000_000) throw new Error("Profile photo must be under 4 MB.");
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return { buffer, contentType, extension };
}

const chatMessageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const jimmiSpeechInput = z.object({
  text: z.string().trim().min(1).max(4000),
});

const jimmiVoiceTranscriptionInput = z.object({
  audioDataUrl: z.string().min(1).max(8_000_000),
  mimeType: z.string().trim().min(1).max(120).optional(),
});

const maxSpokenSummaryLength = 260;
const spokenFollowUpQuestion = "Is there anything else I can help you with?";
const spokenHandoffPhrasePattern = /\b(?:i\s+(?:put|left|included|added)\s+(?:the\s+)?details\s+in\s+(?:the\s+)?chat|(?:the\s+)?details\s+(?:are|'re|were)\s+in\s+(?:the\s+)?chat|see\s+(?:the\s+)?chat|check\s+(?:the\s+)?chat|read\s+(?:the\s+)?chat|main\s+takeaway\s*:?)\b/gi;

function normalizeTextForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_#>~|]/g, "")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
}

function containsSpokenHandoffPhrase(text: string) {
  spokenHandoffPhrasePattern.lastIndex = 0;
  return spokenHandoffPhrasePattern.test(text);
}

function removeSpokenHandoffPhrases(text: string) {
  spokenHandoffPhrasePattern.lastIndex = 0;
  return text
    .replace(spokenHandoffPhrasePattern, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateSpokenSummary(text: string) {
  if (text.length <= maxSpokenSummaryLength) return text;
  const trimmed = text.slice(0, maxSpokenSummaryLength + 1);
  const lastWordBoundary = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, lastWordBoundary > 180 ? lastWordBoundary : maxSpokenSummaryLength).trim()}...`;
}

function findMacroAmount(text: string, label: RegExp) {
  const labelSource = label.source;
  const labelThenValue = new RegExp(`\\b(?:${labelSource})\\b[^0-9]{0,32}([0-9][0-9,.]*)\\s*(?:g|grams|calories|cals|kcal)?`, "i");
  const valueThenLabel = new RegExp(`([0-9][0-9,.]*)\\s*(?:g|grams|calories|cals|kcal)?\\s*(?:of\\s+)?\\b(?:${labelSource})\\b`, "i");
  const match = text.match(labelThenValue) || text.match(valueThenLabel);
  return match?.[1]?.replace(/\.0$/, "");
}

function buildMacroSpokenSummary(text: string) {
  const calories = findMacroAmount(text, /calories|cals|kcal/);
  const protein = findMacroAmount(text, /protein/);
  const carbs = findMacroAmount(text, /carbs|carbohydrates/);
  const fat = findMacroAmount(text, /fat|fats/);
  const macroFacts = [protein, carbs, fat].filter(Boolean).length;
  if (macroFacts < 2 && !calories) return "";

  const parts: string[] = [];
  if (protein) parts.push(`${protein} grams of protein`);
  if (carbs) parts.push(`${carbs} grams of carbs`);
  if (fat) parts.push(`${fat} grams of fat`);
  const caloriePhrase = calories ? `about ${calories} calories` : "";
  const macroPhrase = parts.length ? parts.join(", ").replace(/, ([^,]*)$/, ", and $1") : "";
  const answer = caloriePhrase && macroPhrase
    ? `Your macros are ${caloriePhrase}, with ${macroPhrase}.`
    : caloriePhrase
      ? `Your macro target is ${caloriePhrase}.`
      : `Your macros are ${macroPhrase}.`;
  return `${answer} ${spokenFollowUpQuestion}`;
}

function hasSimilarSpokenFollowUpIntent(sentence: string) {
  const normalized = sentence
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9'’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    /\blet me know (?:how|if|when) (?:i|jimmi|you|you'd|you would) (?:can|want|would like|like|need)\b/.test(normalized) ||
    /\blet me know if (?:there(?:'|’)?s |there is )?(?:anything else|something else|more)\b/.test(normalized) ||
    /\b(?:there(?:'|’)?s |there is )?(?:anything else|something else) (?:i|jimmi) can (?:do to )?(?:assist|help|support) (?:you )?(?:with)?\b/.test(normalized) ||
    /\bfeel free to (?:ask|tell|message) (?:me|jimmi)\b/.test(normalized) ||
    /\b(?:how|what) can (?:i|jimmi) (?:assist|help|support) you\b/.test(normalized) ||
    /\b(?:need|want|would you like) (?:anything else|more detail|more help|help with anything else)\b/.test(normalized) ||
    /\b(?:anything else|something else) (?:i|jimmi) can (?:assist|help|support) (?:you )?(?:with)?\b/.test(normalized)
  );
}

function shouldSkipSpokenFollowUp(text: string) {
  const normalizedText = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9'’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/\bi(?:'|’)?ll be here when you(?:'|’)?re ready\b/.test(normalizedText)) return true;

  const candidateSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(-2);
  return candidateSentences.some(hasSimilarSpokenFollowUpIntent);
}

function appendSpokenFollowUp(text: string) {
  if (/\?\s*$/.test(text) || shouldSkipSpokenFollowUp(text)) return text;
  return `${text.replace(/[\s.]*$/, ".")} ${spokenFollowUpQuestion}`;
}

export function buildConciseVoiceSummary(text: string) {
  const speechText = removeSpokenHandoffPhrases(normalizeTextForSpeech(text));
  if (!speechText) return "";

  const macroSummary = buildMacroSpokenSummary(speechText);
  if (macroSummary) return truncateSpokenSummary(macroSummary);

  const sentences = speechText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => removeSpokenHandoffPhrases(sentence.trim()))
    .filter(Boolean)
    .filter((sentence) => !containsSpokenHandoffPhrase(sentence));
  const directAnswer = (sentences.slice(0, 2).join(" ") || speechText).replace(/^(?:sure|absolutely|of course|here(?:'|’)s)\b[:,\s-]*/i, "");
  return appendSpokenFollowUp(truncateSpokenSummary(directAnswer));
}

function decodeVoiceAudioDataUrl(audioDataUrl: string, explicitMimeType?: string) {
  const match = audioDataUrl.match(/^data:(audio\/[a-z0-9.+-]+(?:\s*;\s*[^,;]+=[^,;]+)*);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error("Record audio in a supported browser audio format.");
  const contentType = (explicitMimeType || match[1]).split(";")[0].trim().toLowerCase();
  const allowedContentTypes = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/x-m4a"]);
  if (!allowedContentTypes.has(contentType)) throw new Error("Use WebM, MP4, MP3, WAV, OGG, or M4A audio for transcription.");
  const audioBytes = Buffer.from(match[2], "base64");
  if (!audioBytes.length) throw new Error("The voice recording was empty.");
  if (audioBytes.length < 6_500) throw new Error("JIMMI did not receive enough real audio to transcribe. Please tap the orb and speak again.");
  if (audioBytes.length > 6_000_000) throw new Error("Voice recordings must stay under 6 MB.");
  const extension = contentType === "audio/mpeg" || contentType === "audio/mp3" ? "mp3" : contentType === "audio/wav" ? "wav" : contentType === "audio/ogg" ? "ogg" : contentType === "audio/mp4" || contentType === "audio/x-m4a" ? "m4a" : "webm";
  return { audioBytes, contentType, extension };
}

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
    /\botter\s+ai\b/.test(normalized) && /\btranscrib(?:ed|er|ing|tion)\b/.test(normalized) ||
    compact === "transcribedbyotterai" ||
    compact === "transcribedbyhttpsotterai"
  );
}

async function transcribeJimmiVoice(audioDataUrl: string, mimeType?: string) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("JIMMI voice transcription is not configured yet.");
  const decoded = decodeVoiceAudioDataUrl(audioDataUrl, mimeType);
  const formData = new FormData();
  const audioBlob = new Blob([new Uint8Array(decoded.audioBytes)], { type: decoded.contentType });
  formData.append("file", audioBlob, `jimmi-voice-input.${decoded.extension}`);
  formData.append("model", "whisper-1");
  formData.append("language", "en");
  formData.append("response_format", "verbose_json");
  formData.append("prompt", "Transcribe only the user's spoken fitness coaching message for JIMMI. If the audio is empty, silence, corrupted, background noise, recorder watermarks, meeting captions, external app credits such as Transcribed by Otter.ai, or unrelated media, return an empty transcript. Common words include workout, recovery, macros, protein, hydration, soreness, mobility, sets, reps, and calories.");

  const response = await fetch(`${ENV.forgeApiUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Voice transcription failed with HTTP ${response.status}${errorText ? `: ${errorText.slice(0, 180)}` : ""}`);
  }

  const payload = await response.json().catch(() => ({})) as { text?: string; language?: string; segments?: Array<{ text?: string; no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number }> };
  const text = String(payload.text ?? "").trim();
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  const hasReliableSegment = segments.length === 0 || segments.some((segment) => {
    const segmentText = String(segment.text ?? "").trim();
    const noSpeechProb = typeof segment.no_speech_prob === "number" ? segment.no_speech_prob : 0;
    const avgLogprob = typeof segment.avg_logprob === "number" ? segment.avg_logprob : 0;
    const compressionRatio = typeof segment.compression_ratio === "number" ? segment.compression_ratio : 0;
    return segmentText.length > 0 && noSpeechProb < 0.72 && avgLogprob > -1.35 && compressionRatio < 3.2;
  });
  if (!text || !hasReliableSegment) throw new Error("JIMMI could not confidently detect your speech in that recording. Please tap the orb and speak again.");
  if (isExternalTranscriptionWatermark(text)) throw new Error("JIMMI ignored an external transcription watermark. Tap the orb and speak your message again.");
  return { text, language: payload.language ?? "en" };
}

async function synthesizeJimmiSpeech(userId: string, text: string) {
  const apiKey = ENV.elevenLabsApiKey;
  const voiceId = ENV.elevenLabsVoiceId;
  const speechText = buildConciseVoiceSummary(text);

  if (!apiKey || !voiceId) {
    throw new Error("JIMMI voice is not configured yet.");
  }
  if (!speechText) {
    throw new Error("JIMMI needs text before creating a spoken response.");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=4&output_format=mp3_22050_32`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: speechText,
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.48,
        similarity_boost: 0.82,
        style: 0.2,
        use_speaker_boost: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`JIMMI voice generation failed with HTTP ${response.status}${errorText ? `: ${errorText.slice(0, 180)}` : ""}`);
  }

  const audioBytes = Buffer.from(await response.arrayBuffer());
  if (!audioBytes.length) {
    throw new Error("JIMMI voice generation returned an empty audio file.");
  }

  return {
    audioUrl: `data:audio/mpeg;base64,${audioBytes.toString("base64")}`,
    audioKey: `inline-jimmi-voice/user-${userId}/reply-${Date.now()}.mp3`,
    contentType: "audio/mpeg" as const,
    voiceId,
    spokenText: speechText,
  };
}

function serializeProfileInput(input: z.infer<typeof onboardingInput>, tourSeen = false) {
  return {
    firstName: input.firstName,
    birthday: input.birthday,
    gender: input.gender,
    weight: input.weight,
    targetWeight: input.fitnessGoals.includes("Lose weight") ? input.targetWeight ?? null : null,
    height: input.height,
    healthComplications: input.healthComplications.join(", "),
    dietRestrictions: input.dietRestrictions.join(", "),
    dietaryPreferences: input.dietaryPreferences?.trim() || null,
    foodAllergies: input.foodAllergies.join(", "),
    fitnessLevel: input.fitnessLevel,
    activityLevel: input.activityLevel,
    fitnessGoals: input.fitnessGoals.join(", "),
    additionalInfo: input.additionalInfo || null,
    tourSeen,
  };
}

function withComputedProfile<T extends { birthday: string }>(profile: T | undefined) {
  if (!profile) return null;
  return { ...profile, age: calculateAge(profile.birthday), onboardingComplete: true };
}

function buildProfileContext(profile: NonNullable<Awaited<ReturnType<typeof getJimmiProfile>>>) {
  const goals = profile.fitnessGoals || "not selected";
  const diet = profile.dietRestrictions || "none listed";
  const dietaryPreferences = profile.dietaryPreferences || "none listed";
  const allergies = profile.foodAllergies || "none listed";
  const health = profile.healthComplications || "none listed";
  const targetWeight = profile.targetWeight ? `${profile.targetWeight} lb` : "not set";

  return [
    "Personal identity and greeting context:",
    `- First name: ${profile.firstName}`,
    `- Age: ${calculateAge(profile.birthday) ?? "unknown"}`,
    `- Gender: ${profile.gender}`,
    "Body metrics:",
    `- Current weight: ${profile.weight} lb`,
    `- Target weight: ${targetWeight}`,
    `- Height: ${profile.height}`,
    "Training readiness:",
    `- Activity level: ${profile.activityLevel}`,
    `- Fitness level: ${profile.fitnessLevel}`,
    `- Fitness goals: ${goals}`,
    "Nutrition and safety context:",
    `- Dietary restrictions: ${diet}`,
    `- Specific dietary preferences: ${dietaryPreferences}`,
    `- Food allergies: ${allergies}`,
    `- Health complications: ${health}`,
    `- Additional notes: ${profile.additionalInfo || "none"}`,
    "Combination handling instructions:",
    "- Always consider the combined profile, not one field in isolation. Adapt recommendations when goals, activity level, fitness level, allergies, diet restrictions, health complications, weight goals, age, gender, height, and additional notes interact.",
    "- When nutrition advice intersects with food allergies or diet restrictions, avoid unsafe foods and offer practical substitutions.",
    "- When training advice intersects with health complications, injuries, pain, pregnancy, asthma, diabetes, heart concerns, or other medical-adjacent inputs, keep guidance conservative and include the required physician disclaimer.",
    "- When weight goals intersect with fitness goals, avoid extreme dieting and recommend sustainable training, protein, hydration, sleep, and habit structure.",
  ].join("\n");
}

const medicalDisclaimer = "JIMMI is not a medical professional — consult your physician.";

const jimmiCoachingSystemPrompt = `${medicalDisclaimer} is the exact disclaimer text required for medical-adjacent guidance.

You are JIMMI, a conversational AI fitness coach specializing in fitness, wellness, recovery, habit support, and nutrition. Speak like a supportive coach: warm, direct, practical, and natural rather than robotic.

Deeper reasoning approach (use your thinking capability):
- Before responding, reason through the user's complete profile context: age, fitness level, health complications, goals, dietary restrictions, allergies, and activity level.
- When recommendations could conflict (e.g., user has lower back pain but wants to deadlift), reason through the safety implications and offer modifications rather than blanket rejections.
- For nutrition guidance, consider the user's specific dietary preferences, allergies, and macro targets together — do not recommend foods that conflict with their stated restrictions.
- For exercise modifications, reason from first principles: what muscle group is being trained, what is the user's limitation, and what alternatives train the same group safely?
- When uncertain about a recommendation (e.g., conflicting health conditions), explicitly acknowledge the uncertainty and suggest consulting their physician rather than guessing.
- Use progressive overload logic: base progression suggestions on the user's recent workout history, effort level, and recovery indicators from their logs.

Food and workout logging capability (critical):
- You have DIRECT access to the user's Food Log and workout log inside the JIMMI app. When a user tells you what they ate, drank, or what workout they completed, you can log it for them immediately.
- NEVER say you "can't log" meals, food, drinks, or workouts. You always can. This is a core feature.
- When a user describes food or a meal they ate, acknowledge it warmly, confirm the key details (food name, approximate portion, meal type), and let them know you are logging it. Example: "Got it — logging that chicken and rice as lunch now."
- When macro details are unclear, give a brief best-effort estimate based on the described food and portion, then confirm you logged it. Do not ask the user to go to the Food Log manually.
- When a user describes a completed workout, acknowledge it, note any key details (exercises, sets, reps, effort), and confirm you are logging it.
- Keep food log confirmations short and natural — one sentence is enough. Then offer a brief coaching note if it fits (e.g., how the meal fits their macro targets).

Core behavior:
- Greet or address the user by their onboarding first name when it feels natural, and always use the first name in the first assistant answer of a conversation when profile context is available.
- When the user sends a casual greeting such as “hi,” “hello,” “hey,” “good morning,” “goodmorning,” “good afternoon,” “goodafternoon,” “good evening,” or “goodevening,” mirror the greeting naturally and warmly without listing goals, activity level, fitness level, diet, allergies, health conditions, body metrics, or other onboarding details.
- When the user politely declines more help with phrases such as "nothing, thank you," "nothing at the moment, thank you," "right now, thank you," "no thank you," "not right now," "that's it," "nothing, that's it," or "I'm good," acknowledge briefly and end the turn without asking another question. This should let the chat return to idle instead of repeating a generic capability prompt.
- When the user says "note this," "remember this," "keep that in mind," "don't forget," or similar context-saving instructions, respond with a brief natural acknowledgment such as "Got it, noted." or "Noted — I'll keep that in mind." Do not redirect to scope or ask a follow-up question unless the user provides content to note.
- When the user says thanks, thank you, thanks JIMMI, appreciate it, or a similar gratitude-only message, respond with a brief natural acknowledgement such as "You're welcome — let me know if there's anything else I can do to help." Do not redirect, repeat your capabilities, or reopen a coaching topic unless the user asks one.
- Sift out obvious typos, missing spaces, and common voice-to-text mistakes before deciding a message is off-topic, especially for greetings, gratitude, polite declines, and fitness terms like workout, exercise, protein, nutrition, hydration, recovery, sleep, and strength.
- For low-content check-ins such as “testing” or “test,” acknowledge naturally and invite the user back into their fitness journey instead of using a stiff rejection.
- All responses should feel warm, conversational, specific to the user’s message, and non-redundant. Avoid repeating the same capability list or fallback wording across turns.
- Answer only fitness, wellness, health, recovery, habit, or nutrition questions. If the user asks clearly outside that scope (e.g., "tell me a joke", "what's the weather", "help me with my taxes"), politely redirect them in one warm sentence without reciting a long list of categories. Example: "I'm here to help with fitness and wellness — that's where I shine. What can I help you with on your fitness journey?" Keep the redirect brief and warm, never generic or robotic.
- Keep answers concise and useful. Prefer 1-3 short paragraphs or a compact step list, then ask whether the user wants more detail only when it fits naturally.
- Personalize every answer from the complete onboarding profile and any combination of its inputs: first name, age, gender, height, current weight, target weight, activity level, fitness level, fitness goals, health complications, dietary restrictions, specific dietary preferences, food allergies, and additional notes.
- Treat onboarding details as private coaching context. Use them silently to shape recommendations, but do not recap, enumerate, or expose the user’s profile in the visible chat unless the user explicitly asks what JIMMI knows about them or a specific detail is directly necessary to answer the question.
- Never ignore safety constraints. If advice is medical-adjacent, begin the answer exactly with the required disclaimer text.

Topic expertise JIMMI should cover:
- Training plans, exercise selection, strength, cardio, conditioning, mobility, flexibility, warmups, cooldowns, progressive overload, beginner-to-advanced adjustments, soreness, and recovery.
- Nutrition, protein, macros, calories, meal timing, hydration, supplements at a general education level, dietary restrictions, food allergies, grocery choices, and practical meal structure.
- Wellness habits, sleep, stress, energy, consistency, motivation, behavior change, schedule constraints, and sustainable weight management.

Program generation boundary (critical):
- In the chat, JIMMI can suggest a single workout session, a quick exercise circuit, or a brief workout idea tailored to the user's goals and level. This is the limit of what JIMMI generates directly in the chat.
- If a user asks for a comprehensive training program, multi-week plan, periodized plan, full program, or a complete meal plan (e.g. "build me a 12-week program," "create a full training and meal plan," "give me a comprehensive plan," "design me a program," "make me a workout plan"), JIMMI must NOT generate it in the chat. Instead, warmly redirect the user to the My Program tab with a message like: "For a full personalized program — training plan, meal plan, and everything tailored to your goals — head over to your My Program tab. That's where I build you a complete, structured plan. Want me to point you there?" Adjust the wording naturally to fit the conversation, but always redirect rather than generate the full plan in chat.

Personalization method:
- First identify what the user is asking for, then silently cross-check the onboarding combination that matters most.
- For greetings or open-ended small talk, keep the answer warm and simple, then invite the user to choose a coaching direction.
- If details conflict or are missing, reason through the safest approach and give a recommendation that respects all stated constraints.
- Do not claim to diagnose, treat, cure, or replace a clinician.

Macro estimation precision:
- When a user describes food without exact portions, ask one clarifying question (e.g., "About the size of your palm?") rather than guessing wildly.
- For multi-item meals, sum the macros of all mentioned items — do not ignore components.
- When portion size is genuinely unclear, give a reasonable range (e.g., "400-500 cal") rather than a false point estimate.

Habit formation and motivation:
- Use research-backed language: emphasize consistency over perfection, celebrate small wins, and frame setbacks as learning opportunities.
- When a user misses a day or falls off track, respond with encouragement and a forward-looking suggestion rather than guilt.
- Highlight streaks and progress when appropriate to reinforce positive behavior.`;

const allowedTopicPattern = /\b(fitness|fit|workout|training|train|exercise|strength|cardio|conditioning|mobility|stretch|flexibility|warmup|cooldown|recovery|recover|wellness|health|healthy|nutrition|nutrient|macro|macros|protein|carb|fat|calorie|calories|meal|diet|food|foods|allergy|allergies|hydration|water|sleep|stress|weight|muscle|body|injury|pain|soreness|heart|blood|diabetes|cholesterol|vitamin|supplement|steps|walking|running|run|gym|lift|lifting|program|routine|habit|energy|motivation|consistency|goal|goals|plateau|metabolism|fasting|meal prep|posture|log|logged|logging|track|tracked|tracking|ate|eaten|eat|eating|had|drink|drank|drinking|breakfast|lunch|dinner|snack|snacks|chicken|beef|fish|rice|pasta|bread|salad|fruit|vegetable|vegetables|burger|pizza|wings|fries|sandwich|wrap|smoothie|shake|coffee|juice|soda|water|milk|yogurt|oats|eggs|steak|turkey|pork|lamb|shrimp|salmon|tuna|avocado|nuts|beans|lentils|soup|bowl|plate|portion|serving|ounce|oz|gram|grams|cup|cups|slice|piece|pieces|can|can you log|please log|add to my log|add this to|save this|record this|i had|i ate|i drank|i just had|just ate|just had|for breakfast|for lunch|for dinner|for a snack)\b/i;
const casualGreetingPattern = /^(hi|hello|hey|yo|good\s*morning|good\s*afternoon|good\s*evening|what's up|whats up|sup)(?:[\s,]+(?:jimmi|jimmy|coach|there))?[.!?\s]*$/i;
const timeOfDayGreetingPattern = /^(good\s*morning|good\s*afternoon|good\s*evening)(?:[\s,]+(?:jimmi|jimmy|coach|there))?[.!?\s]*$/i;
const lowContentCheckInPattern = /^(?:just\s+)?(?:test|testing|checking|check|test message|this is a test)(?:[\s,]+(?:jimmi|jimmy|coach|there))?[.!?\s]*$/i;
const gratitudeOnlyPattern = /^(?:(?:ok(?:ay)?\s+)?(?:thanks?|thank\s+you|thank\s+u|appreciate\s+(?:it|you)|much\s+appreciated|perfect\s+thanks|cool\s+thanks|great\s+thanks|sounds\s+good\s+thanks|got\s+it\s+thanks|alright\s+thanks|all\s+good\s+thanks)(?:[\s,]+(?:jimmi|jimmy|coach|man|bro|sir|there))?|(?:thanks?|thank\s+you)[\s,]+(?:jimmi|jimmy|coach))(?:[.!?\s]*)$/i;
const helpDeclinePattern = /^(?:(?:no|nope|nah)(?:\s+(?:thanks?|thank\s+you|thank\s+u))?|(?:no|nope|nah)\s+(?:(?:that'?s|thats)|that\s+is)\s+(?:it|all)(?:\s+(?:thanks?|thank\s+you|thank\s+u))?|(?:nothing(?:\s+(?:(?:that'?s|thats)\s+(?:it|all)|else|more|right\s+now|at\s+(?:the\s+)?moment|for\s+now|today))?|not\s+right\s+now|right\s+now|all\s+set|i(?:'|\s+a)?m\s+good|im\s+good|(?:that'?s|thats)\s+(?:it|all)|that\s+is\s+(?:it|all)|i'?m\s+(?:done|finished|all\s+(?:set|good|done))|we'?re\s+(?:good|done)|done\s+for\s+now|that'?s\s+(?:all\s+(?:i\s+)?(?:need|needed)|enough|fine|great|perfect))(?:\s+(?:thanks?|thank\s+you|thank\s+u))?)(?:\s+(?:jimmi|jimmy|coach|man|bro|sir|there))?$/i;
const medicalAdjacentPattern = /\b(medical|doctor|physician|diagnos|disease|condition|symptom|injury|pain|prescription|medicine|medication|blood pressure|diabetes|heart|cholesterol|pregnan|surgery|therapy|therapist|treatment|allergy|allergies|asthma)\b/i;
const exerciseDemoTriggerPattern = /\b(show me a|show me how to|show me how to do|how do you do a|can you show me|can you show me how to do|show me a video of|show me an example of)\b/i;
const knownExerciseTermPattern = /\b(push\s?up|press|squat|deadlift|lunge|plank|row|curl|raise|pull\s?up|chin\s?up|dip|burpee|bridge|crunch|sit\s?up|thruster|clean|snatch|jerk|swing|hinge|step\s?up|jump|run|walk|stretch|mobility|yoga|pilates|cardio|exercise|workout|lift|form|pigeon|downward|warrior|tree|child|cobra|cat\s?cow|mountain|corpse|shoulder|stand|inversion|pose|asana|flow|vinyasa|hatha|power)\b/i;
const commonInputCorrections: Array<[RegExp, string]> = [
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

function normalizeUserMessageForRouting(value: string) {
  return commonInputCorrections.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    value
      .trim()
      .replace(/[’`]/g, "'")
      .replace(/\s+/g, " "),
  );
}

const exerciseDemoTriggerMatchers = [
  /\bcan you show me\s+(?:(?:how to do|the)\s+)?(?:a|an|the)?\s*(.+)$/i,
  /\bcan you show me how to do\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me how to do\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me how to\s+(?:do\s+)?(?:a|an|the)?\s*(.+)$/i,
  /\bhow do you do\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me a video of\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me an example of\s+(?:a|an|the)?\s*(.+)$/i,
  /\bshow me a\s+(.+)$/i,
] as const;
const curatedExerciseVideoIds: Array<[RegExp, string]> = [
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

type ChatVideoEmbed = {
  provider: "youtube";
  exerciseName: string;
  title: string;
  embedUrl: string;
  watchUrl: string;
};

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

function extractExerciseDemoRequest(message: string) {
  const normalizedMessage = normalizeUserMessageForRouting(message);
  if (!exerciseDemoTriggerPattern.test(normalizedMessage)) return null;
  for (const matcher of exerciseDemoTriggerMatchers) {
    const match = normalizedMessage.match(matcher);
    const exerciseName = sanitizeExerciseRequest(match?.[1] ?? "");
    if (exerciseName) return titleCaseExercise(exerciseName);
  }
  return null;
}

function getCuratedExerciseVideoId(exerciseName: string) {
  return curatedExerciseVideoIds.find(([pattern]) => pattern.test(exerciseName))?.[1] ?? null;
}

async function lookupYouTubeVideoId(exerciseName: string) {
  const curatedId = getCuratedExerciseVideoId(exerciseName);
  if (curatedId) return curatedId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const query = encodeURIComponent(`${exerciseName} exercise form tutorial`);
    const response = await fetch(`https://www.youtube.com/results?search_query=${query}`, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 JIMMI fitness coach" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const ids = Array.from(html.matchAll(/\"videoId\":\"([A-Za-z0-9_-]{11})\"/g)).map((match) => match[1]);
    return ids.find((id, index) => ids.indexOf(id) === index) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildExerciseDemoEmbed(messages: Array<z.infer<typeof chatMessageInput>>) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const exerciseName = extractExerciseDemoRequest(lastUserMessage);
  if (!exerciseName) return null;
  if (!allowedTopicPattern.test(lastUserMessage) && !knownExerciseTermPattern.test(exerciseName)) return null;

  const videoId = await lookupYouTubeVideoId(exerciseName);
  if (!videoId) return null;

  return {
    provider: "youtube" as const,
    exerciseName,
    title: `${exerciseName} demo`,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  } satisfies ChatVideoEmbed;
}

function getLastUserMessage(messages: Array<z.infer<typeof chatMessageInput>>) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function normalizeHelpDeclineMessage(value: string) {
  return normalizeUserMessageForRouting(value).replace(/[.!?,;:]+/g, " ").replace(/\s+/g, " ").trim();
}

function isHelpDeclineMessage(value: string) {
  return helpDeclinePattern.test(normalizeHelpDeclineMessage(value));
}

function isAllowedCoachingTopic(messages: Array<z.infer<typeof chatMessageInput>>) {
  const lastUserMessage = normalizeUserMessageForRouting(getLastUserMessage(messages));
  const exerciseDemoRequest = extractExerciseDemoRequest(lastUserMessage);
  return allowedTopicPattern.test(lastUserMessage) || casualGreetingPattern.test(lastUserMessage) || gratitudeOnlyPattern.test(lastUserMessage) || isHelpDeclineMessage(lastUserMessage) || Boolean(exerciseDemoRequest && knownExerciseTermPattern.test(exerciseDemoRequest));
}

function formatTimeOfDayGreeting(value: string) {
  const compact = value.toLowerCase().replace(/\s+/g, "");
  if (compact === "goodmorning") return "Good morning";
  if (compact === "goodafternoon") return "Good afternoon";
  if (compact === "goodevening") return "Good evening";
  return `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}`;
}

function buildCasualGreetingResponse(messages: Array<z.infer<typeof chatMessageInput>>, profile: NonNullable<Awaited<ReturnType<typeof getJimmiProfile>>>) {
  const lastUserMessage = normalizeUserMessageForRouting(getLastUserMessage(messages));
  if (!casualGreetingPattern.test(lastUserMessage)) return null;
  const timeOfDayGreeting = lastUserMessage.match(timeOfDayGreetingPattern)?.[1];
  const greetingLead = timeOfDayGreeting ? formatTimeOfDayGreeting(timeOfDayGreeting) : "Hi";
  return `${greetingLead}, ${profile.firstName}. I’m here to help you achieve your fitness goals. What can I do for you today?`;
}

function buildLowContentCheckInResponse(messages: Array<z.infer<typeof chatMessageInput>>, profile: NonNullable<Awaited<ReturnType<typeof getJimmiProfile>>>) {
  const lastUserMessage = normalizeUserMessageForRouting(getLastUserMessage(messages));
  if (!lowContentCheckInPattern.test(lastUserMessage)) return null;
  return `All good, ${profile.firstName}. I’m here when you’re ready — training, meals, recovery, or anything else you want to work through.`;
}

function buildGratitudeResponse(messages: Array<z.infer<typeof chatMessageInput>>, profile: NonNullable<Awaited<ReturnType<typeof getJimmiProfile>>>) {
  const lastUserMessage = normalizeUserMessageForRouting(getLastUserMessage(messages));
  if (!gratitudeOnlyPattern.test(lastUserMessage)) return null;
  return `You’re welcome, ${profile.firstName}. Let me know if there’s anything else I can do to help.`;
}

function buildHelpDeclineResponse(messages: Array<z.infer<typeof chatMessageInput>>, profile: NonNullable<Awaited<ReturnType<typeof getJimmiProfile>>>) {
  const lastUserMessage = getLastUserMessage(messages);
  if (!isHelpDeclineMessage(lastUserMessage)) return null;
  return `You got it, ${profile.firstName}. I’ll be here when you’re ready.`;
}

function buildWarmScopeRedirect(profile: NonNullable<Awaited<ReturnType<typeof getJimmiProfile>>>) {
  return `I’m with you, ${profile.firstName}. I can best help when we keep it tied to your training, recovery, nutrition, or wellness — what would you like to work on next?`;
}

function needsMedicalDisclaimer(messages: Array<z.infer<typeof chatMessageInput>>, response: string) {
  const userText = messages.filter((message) => message.role === "user").map((message) => message.content).join("\n");
  return medicalAdjacentPattern.test(`${userText}\n${response}`);
}

function normalizeAssistantContent(content: string | unknown) {
  if (typeof content === "string") return content.trim();
  return "I had trouble forming that response. Try me again with what you want help with, and I’ll keep it focused and practical.";
}

function boundedMacro(value: unknown, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function parseMacroEstimate(content: unknown) {
  const raw = typeof content === "string" ? content : JSON.stringify(content ?? {});
  const parsed = JSON.parse(raw) as { calories?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown };
  return {
    calories: boundedMacro(parsed.calories, 0, 5000),
    protein: boundedMacro(parsed.protein, 0, 500),
    carbs: boundedMacro(parsed.carbs, 0, 800),
    fat: boundedMacro(parsed.fat, 0, 400),
  };
}

function decodeImageDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Use a PNG, JPEG, or WebP food image.");
  return { mimeType: match[1], dataUrl: imageDataUrl };
}

function parseJsonObject(content: unknown) {
  const raw = typeof content === "string" ? content : JSON.stringify(content ?? {});
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return {} as Record<string, any>;
  }
}

function parseFoodImageScan(content: unknown) {
  const parsed = parseJsonObject(content);
  const macros = typeof parsed.macros === "object" && parsed.macros ? parsed.macros : parsed;
  return {
    isFood: Boolean(parsed.isFood),
    foodName: typeof parsed.foodName === "string" && parsed.foodName.trim() ? parsed.foodName.trim().slice(0, 180) : "Identified food",
    portion: typeof parsed.portion === "string" ? parsed.portion.trim().slice(0, 180) : "estimated serving",
    confidence: typeof parsed.confidence === "string" ? parsed.confidence.trim().slice(0, 40) : "estimated",
    calories: boundedMacro(macros.calories, 0, 5000),
    protein: boundedMacro(macros.protein, 0, 500),
    carbs: boundedMacro(macros.carbs, 0, 800),
    fat: boundedMacro(macros.fat, 0, 400),
    guidance: typeof parsed.guidance === "string" ? parsed.guidance.trim().slice(0, 700) : "Review the estimate, adjust if needed, then save it to your Food Log if it looks right.",
  };
}

function parseProgramScan(content: unknown) {
  const parsed = parseJsonObject(content);
  return {
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 160) : "Program scan",
    summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 900) : "JIMMI reviewed the uploaded file for training, recovery, nutrition, or wellness details.",
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
    caution: typeof parsed.caution === "string" ? parsed.caution.trim().slice(0, 500) : "",
  };
}

function stringList(value: unknown, limit = 6) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit) : [];
}

function normalizeImportedProgramPlan(content: unknown, macros: { calories: number; protein: number; carbs: number; fat: number }, fileName: string) {
  const parsed = parseJsonObject(content);
  const rawProgram = typeof parsed.program === "object" && parsed.program ? parsed.program as Record<string, any> : {};
  const rawTrainingPlan = Array.isArray(rawProgram.trainingPlan) ? rawProgram.trainingPlan : [];
  const trainingPlan = rawTrainingPlan.slice(0, 42).map((day: any, dayIndex: number) => {
    const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
    return {
      day: String(day?.day || `Day ${dayIndex + 1}`).slice(0, 80),
      focus: String(day?.focus || "Imported workout").slice(0, 140),
      warmup: String(day?.warmup || "Use 5-10 minutes of easy movement and specific warm-up sets before training.").slice(0, 260),
      exercises: exercises.slice(0, 18).map((exercise: any, exerciseIndex: number) => {
        const name = String(exercise?.name || `Exercise ${exerciseIndex + 1}`).slice(0, 160);
        return {
          key: String(exercise?.key || `${dayIndex + 1}-${exerciseIndex + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`).slice(0, 120),
          name,
          sets: Math.min(Math.max(Number.parseInt(String(exercise?.sets ?? 0), 10) || 0, 0), 20),
          reps: String(exercise?.reps || "See imported notes").slice(0, 80),
          rest: String(exercise?.rest || "Rest as prescribed or 60-120 seconds.").slice(0, 100),
          cues: String(exercise?.cues || exercise?.notes || "Use controlled reps and stop if pain or unsafe symptoms appear.").slice(0, 260),
          youtubeUrl: String(exercise?.youtubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise form`)}`).slice(0, 400),
        };
      }),
    };
  }).filter((day: any) => day.exercises.length > 0);

  if (!trainingPlan.length) return null;

  const phaseSummary = Array.isArray(rawProgram.phaseSummary) && rawProgram.phaseSummary.length
    ? rawProgram.phaseSummary.slice(0, 8).map((phase: any) => ({ phase: String(phase?.phase || "Imported phase").slice(0, 80), focus: String(phase?.focus || "Follow the uploaded program structure.").slice(0, 180), weeks: String(phase?.weeks || "As written").slice(0, 80) }))
    : [{ phase: "Imported program", focus: "Follow the uploaded training structure while JIMMI tracks execution and recovery.", weeks: String(rawProgram.programDuration || "As written").slice(0, 80) }];

  const progressTracking = Array.isArray(rawProgram.progressTracking) && rawProgram.progressTracking.length
    ? rawProgram.progressTracking.slice(0, 8).map((item: any) => ({ checkpoint: String(item?.checkpoint || "Weekly review").slice(0, 120), action: String(item?.action || "Review performance, recovery, and adherence.").slice(0, 180), metric: String(item?.metric || "Completed workouts, load, reps, soreness, and energy.").slice(0, 160) }))
    : [{ checkpoint: "Weekly review", action: "Review completed workouts, recovery, and any missed sessions.", metric: "Adherence, load, reps, soreness, and energy." }];

  const importedMeals = Array.isArray(rawProgram.mealPlan?.days) ? rawProgram.mealPlan.days.slice(0, 14) : [];
  const mealPlan = {
    macroTargets: macros,
    days: importedMeals.map((day: any, dayIndex: number) => ({
      day: String(day?.day || `Day ${dayIndex + 1}`).slice(0, 80),
      meals: Array.isArray(day?.meals) ? day.meals.slice(0, 8).map((meal: any) => ({
        mealType: String(meal?.mealType || "Meal").slice(0, 60),
        name: String(meal?.name || "Imported meal").slice(0, 160),
        ingredients: stringList(meal?.ingredients, 12),
        calories: boundedMacro(meal?.calories, 0, 5000),
        protein: boundedMacro(meal?.protein, 0, 500),
        carbs: boundedMacro(meal?.carbs, 0, 800),
        fat: boundedMacro(meal?.fat, 0, 400),
        notes: String(meal?.notes || "Imported from the uploaded program.").slice(0, 260),
      })) : [],
    })),
  };

  return ensurePlanHasWorkoutSchedule({
    title: String(rawProgram.title || parsed.title || fileName.replace(/\.pdf$/i, "") || "Imported JIMMI Program").slice(0, 180),
    overview: String(rawProgram.overview || parsed.summary || "Imported from an uploaded program PDF. JIMMI preserved the training structure and added safety review notes where needed.").slice(0, 1200),
    programDuration: String(rawProgram.programDuration || "Imported duration").slice(0, 80),
    durationRationale: String(rawProgram.durationRationale || "This duration comes from the uploaded program. JIMMI will help you track adherence and recovery as you move through it.").slice(0, 500),
    importSource: { fileName, importedAt: new Date().toISOString(), sourceType: "pdf" },
    phaseSummary,
    progressTracking,
    trainingPlan,
    mealPlan,
  });
}

function buildImportedProgramExport(plan: any) {
  const sections = [
    `JIMMI Imported Program: ${plan?.title ?? "Imported Program"}`,
    "",
    plan?.overview ?? "",
    "",
    "Training Plan",
    "",
    ...(Array.isArray(plan?.trainingPlan) ? plan.trainingPlan.flatMap((day: any) => [
      `${day.day ?? "Day"} — ${day.focus ?? "Workout"}`,
      ...(Array.isArray(day.exercises) ? day.exercises.map((exercise: any) => `- ${exercise.name}: ${exercise.sets || 0} sets x ${exercise.reps || "as written"}; rest ${exercise.rest || "as needed"}. ${exercise.cues || ""}`) : []),
      "",
    ]) : []),
  ];
  return sections.join("\n").trim();
}

function parseGuidance(content: unknown) {
  const parsed = parseJsonObject(content);
  return {
    guidance: typeof parsed.guidance === "string" ? parsed.guidance.trim().slice(0, 700) : "This product can fit if the serving works with your daily macro targets. Want more detail?",
    suggestion: typeof parsed.suggestion === "string" ? parsed.suggestion.trim().slice(0, 500) : "Pair it with a protein-forward, minimally processed option if needed.",
    suggestedMealType: ["Breakfast", "Lunch", "Dinner", "Snack"].includes(parsed.suggestedMealType) ? parsed.suggestedMealType as "Breakfast" | "Lunch" | "Dinner" | "Snack" : "Snack",
  };
}

function macroFromProduct(product: any, keys: string[], max: number) {
  const nutriments = product?.nutriments ?? {};
  for (const key of keys) {
    const value = Number(nutriments[key]);
    if (Number.isFinite(value) && value >= 0) return boundedMacro(value, 0, max);
  }
  return 0;
}

async function lookupOpenFoodFactsProduct(barcode: string) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`, {
    headers: { "User-Agent": "JIMMI-Fit-Recovery/1.0 (https://manus.im)" },
  });
  if (!response.ok) throw new Error("Barcode lookup is temporarily unavailable.");
  const payload = await response.json() as any;
  if (payload.status !== 1 || !payload.product) return null;
  return payload.product;
}

function parseHeightInches(height: string) {
  const trimmed = height.trim().toLowerCase();
  const feetInches = trimmed.match(/(\d+)\s*(?:ft|'|feet)\s*(\d+)?/);
  if (feetInches) return Number(feetInches[1]) * 12 + Number(feetInches[2] ?? 0);
  const inches = trimmed.match(/(\d+)\s*(?:in|\")/);
  if (inches) return Number(inches[1]);
  const numeric = Number(trimmed.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 68;
}

function calculateDailyMacroTargets(profile: NonNullable<Awaited<ReturnType<typeof getJimmiProfile>>>) {
  const age = calculateAge(profile.birthday) ?? 35;
  const weightKg = profile.weight * 0.453592;
  const heightCm = parseHeightInches(profile.height) * 2.54;
  const sexOffset = profile.gender === "Male" ? 5 : -161;
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexOffset;
  const activity = profile.activityLevel.toLowerCase();
  const activityMultiplier = activity.includes("very") || activity.includes("athlete") ? 1.725 : activity.includes("active") ? 1.55 : activity.includes("light") ? 1.375 : activity.includes("sedentary") ? 1.2 : 1.45;
  const goals = profile.fitnessGoals.toLowerCase();
  const goalAdjustment = goals.includes("lose") ? -350 : goals.includes("gain") || goals.includes("muscle") ? 250 : 0;
  const calories = Math.max(1400, Math.round((bmr * activityMultiplier + goalAdjustment) / 25) * 25);
  const protein = Math.max(80, Math.round((profile.targetWeight ?? profile.weight) * (goals.includes("muscle") || goals.includes("gain") ? 0.9 : 0.75)));
  const fat = Math.max(45, Math.round((calories * 0.25) / 9));
  const carbs = Math.max(90, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

function safeJsonParse<T>(content: string | null | undefined, fallback: T): T {
  if (!content) return fallback;
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function extractLlmJson<T>(content: unknown, fallback: T): T {
  if (typeof content !== "string") return fallback;
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  return safeJsonParse(fenced || trimmed, fallback);
}

function buildMealPlanExport(program: any, groceryList?: any) {
  const meals = Array.isArray(program?.mealPlan?.days) ? program.mealPlan.days : [];
  const sections = [
    `JIMMI Meal Plan Export: ${program?.title ?? "My Program"}`,
    "",
    ...meals.flatMap((day: any) => [
      `${day.day ?? "Day"}`,
      ...(Array.isArray(day.meals) ? day.meals.map((meal: any) => `- ${meal.mealType}: ${meal.name} — ${meal.calories ?? 0} cal, ${meal.protein ?? 0}g protein, ${meal.carbs ?? 0}g carbs, ${meal.fat ?? 0}g fat. ${meal.notes ?? ""}`) : []),
      "",
    ]),
  ];
  if (groceryList?.categories) {
    sections.push("Grocery List", "");
    for (const category of groceryList.categories) {
      sections.push(`${category.name}: ${(category.items ?? []).join(", ")}`);
    }
  }
  return sections.join("\n").trim();
}

async function createGroceryListFromMealPlan(plan: any) {
  const llmResponse = await invokeLLM({
    disableThinking: true,
    messages: [
      { role: "system", content: "Create a practical grocery list from a meal plan. Combine duplicate ingredients, group items by store section, and return JSON only." },
      { role: "user", content: JSON.stringify(plan?.mealPlan ?? {}) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "jimmi_grocery_list", strict: true, schema: { type: "object", properties: { categories: { type: "array", items: { type: "object", properties: { name: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["name", "items"], additionalProperties: false } }, notes: { type: "string" } }, required: ["categories", "notes"], additionalProperties: false } } }
  });
  return extractLlmJson(llmResponse.choices[0]?.message.content, { categories: [], notes: "" });
}

// ─── Chat food-log intent detection ─────────────────────────────────────────

type ChatFoodLogIntent =
  | { action: "log"; foodName: string; mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack"; calories: number; protein: number; carbs: number; fat: number; confirmationNote: string }
  | { action: "none" };

// Trigger only on phrases that indicate the user is REPORTING past consumption, not asking a question.
// Deliberately excludes "for breakfast/lunch/dinner/snack" because those appear in questions like
// "What should I have for lunch?" — the LLM classifier handles ambiguous cases.
const foodLogIntentTriggerPattern = /\b(just had|just ate|just drank|i had|i ate|i drank|i've had|i've eaten|i just ate|i just had|i just drank|had a|had some|ate a|ate some|drank a|drank some|log (?:this|that|my|a|an)|please log|can you log|add (?:this|that|my) to|save (?:this|that) to|record (?:this|that)|track (?:this|that))\b/i;
// Pre-filter: messages that start with a question word are never food log reports
// Exception: "can/could/would/will you log/track/record/add" are explicit log requests — let them through
const foodLogQuestionPrefixPattern = /^\s*(?:what|how|why|when|where|who|which|is|are|do|does|did|give me|suggest|recommend|tell me|help me|show me|(?:can|could|should|would|will)(?!\s+(?:you\s+)?(?:log|track|record|add|save)))/i;

async function detectChatFoodLogIntent(messages: Array<z.infer<typeof chatMessageInput>>, profileContext: string): Promise<ChatFoodLogIntent> {
  const lastUserMessage = getLastUserMessage(messages);
  if (!foodLogIntentTriggerPattern.test(lastUserMessage)) return { action: "none" };
  // Skip LLM call entirely for messages that start with a question word — they are never food log reports
  if (foodLogQuestionPrefixPattern.test(lastUserMessage)) return { action: "none" };

  const now = new Date();
  const hour = now.getHours();
  const defaultMealType: "Breakfast" | "Lunch" | "Dinner" | "Snack" =
    hour < 10 ? "Breakfast" : hour < 14 ? "Lunch" : hour < 19 ? "Dinner" : "Snack";

  try {
    const llmResponse = await invokeLLM({
      disableThinking: true,
      messages: [
        {
          role: "system",
          content: `You are a food log intent classifier for a fitness app. Determine whether the user's message is describing food or drinks they consumed and wants logged.\n\nCRITICAL RULE — MULTI-ITEM MEALS: When the user mentions multiple foods or drinks in one message (e.g. "I had a doughnut, double espresso and an orange"), you MUST combine ALL items into a single log entry. Set foodName to a concise combined name (e.g. "Doughnut, double espresso & orange") and set calories/protein/carbs/fat to the SUM of all items. Never ignore any mentioned item.\n\nIf the message is about asking for advice, planning meals, or general nutrition questions (not describing something already eaten), return action=none.\n\nUser profile context:\n${profileContext}\n\nDefault meal type based on current time: ${defaultMealType}`,
        },
        { role: "user", content: lastUserMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "jimmi_food_log_intent",
          strict: true,
          schema: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["log", "none"], description: "log if the user described eating/drinking something to be logged; none otherwise" },
              foodName: { type: "string", description: "Concise food or meal name for the log entry, max 120 chars" },
              mealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack"] },
              calories: { type: "integer", description: "Estimated calories" },
              protein: { type: "integer", description: "Estimated protein grams" },
              carbs: { type: "integer", description: "Estimated carbohydrate grams" },
              fat: { type: "integer", description: "Estimated fat grams" },
              confirmationNote: { type: "string", description: "One short natural sentence confirming the log and optionally noting how it fits the user's goals" },
            },
            required: ["action", "foodName", "mealType", "calories", "protein", "carbs", "fat", "confirmationNote"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = llmResponse.choices[0]?.message.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) as Record<string, any> : {};
    if (parsed.action !== "log") return { action: "none" };
    return {
      action: "log",
      foodName: String(parsed.foodName || "Meal").trim().slice(0, 120),
      mealType: (["Breakfast", "Lunch", "Dinner", "Snack"].includes(parsed.mealType) ? parsed.mealType : defaultMealType) as "Breakfast" | "Lunch" | "Dinner" | "Snack",
      calories: boundedMacro(parsed.calories, 0, 5000),
      protein: boundedMacro(parsed.protein, 0, 500),
      carbs: boundedMacro(parsed.carbs, 0, 800),
      fat: boundedMacro(parsed.fat, 0, 400),
      confirmationNote: typeof parsed.confirmationNote === "string" ? parsed.confirmationNote.trim().slice(0, 400) : `Logged ${parsed.foodName || "that"} to your Food Log.`,
    };
  } catch {
    return { action: "none" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const exerciseLogInput = z.object({
  programId: z.coerce.number().int().positive(),
  exerciseKey: z.string().trim().min(1).max(120),
  exerciseName: z.string().trim().min(1).max(220),
  sets: z.coerce.number().int().min(0).max(20),
  reps: z.coerce.number().int().min(0).max(200),
  weight: z.coerce.number().int().min(0).max(1500),
  notes: z.string().trim().max(500).optional().nullable(),
});

const regenerateExerciseInput = z.object({
  exerciseKey: z.string().trim().min(1).max(120),
  exerciseName: z.string().trim().min(1).max(220),
  reason: z.string().trim().max(300).optional().nullable(),
});

const regenerateMealInput = z.object({
  dayIndex: z.coerce.number().int().min(0).max(6),
  mealIndex: z.coerce.number().int().min(0).max(8),
  mealName: z.string().trim().min(1).max(220),
  mealType: z.string().trim().min(1).max(80),
  reason: z.string().trim().max(300).optional().nullable(),
});

const generateProgramInput = z.object({
  programFocus: z.string().trim().max(500).optional().nullable(),
  injuryContext: z.string().trim().max(500).optional().nullable(),
}).optional();

const workoutActionInput = z.object({
  dayIndex: z.number().int().min(0),
  action: z.enum(["complete", "reschedule", "cancel"]),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid workout date.").optional(),
});

const smartWorkoutAdaptationInput = z.object({
  programId: z.coerce.number().int().positive(),
  memberRequest: z.string().trim().max(500).optional().nullable(),
  injuryContext: z.string().trim().max(500).optional().nullable(),
}).optional();

const workoutStatusValues = new Set(["scheduled", "completed", "cancelled"]);

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatWorkoutDateLabel(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${isoDate}T12:00:00.000Z`));
}

function ensurePlanHasWorkoutSchedule<T extends Record<string, any> | null>(plan: T, startDate = todayIsoDate()): T {
  if (!plan || !Array.isArray(plan.trainingPlan)) return plan;
  let lastScheduledDate = startDate;
  plan.trainingPlan = plan.trainingPlan.map((day: any, dayIndex: number) => {
    const scheduledDate = typeof day?.scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.scheduledDate)
      ? day.scheduledDate
      : addDaysToIsoDate(startDate, dayIndex * 2);
    lastScheduledDate = scheduledDate;
    const status = workoutStatusValues.has(day?.status) ? day.status : "scheduled";
    const nextWorkoutDate = addDaysToIsoDate(scheduledDate, 2);
    return {
      ...day,
      scheduledDate,
      dateLabel: formatWorkoutDateLabel(scheduledDate),
      status,
      recoveryWindow: day?.recoveryWindow || `Rest, mobility, or light walking until ${formatWorkoutDateLabel(nextWorkoutDate)}.`,
    };
  });
  plan.workoutScheduleSummary = plan.workoutScheduleSummary || `Workout days are scheduled every other day starting ${formatWorkoutDateLabel(startDate)}, with recovery days between sessions.`;
  plan.lastScheduledWorkoutDate = plan.lastScheduledWorkoutDate || lastScheduledDate;
  return plan;
}

function buildExerciseLogAdaptationContext(logs: any[]) {
  return logs.slice(-30).map((log) => ({
    exerciseKey: log.exerciseKey,
    exerciseName: log.exerciseName,
    sets: Number(log.sets ?? 0),
    reps: Number(log.reps ?? 0),
    weight: Number(log.weight ?? 0),
    notes: log.notes || "",
    loggedAt: log.loggedAt instanceof Date ? log.loggedAt.toISOString() : log.loggedAt,
  }));
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => withOwnerAdminRole(ctx.user)),
    unlockOwnerAdmin: protectedProcedure.mutation(async ({ ctx }) => {
      if (!canUnlockOwnerAdminAccess(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This signed-in account is not authorized for owner-admin access." });
      }
      const promotedUser = ctx.user.role === "admin" ? ctx.user : await updateUserRole(ctx.user.id, "admin");
      return { success: true, user: withOwnerAdminRole(promotedUser ?? { ...ctx.user, role: "admin" as const }) };
    }),
    unlockAdminWithPassword: protectedProcedure.input(adminPasswordUnlockInput).mutation(async ({ ctx, input }) => {
      if (!isAdminFallbackPasswordConfigured()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin password login is not configured yet." });
      }
      if (!canUnlockAdminWithPassword(input.password)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "That admin password is not correct." });
      }
      const promotedUser = ctx.user.role === "admin" ? ctx.user : await updateUserRole(ctx.user.id, "admin");
      return { success: true, user: withOwnerAdminRole(promotedUser ?? { ...ctx.user, role: "admin" as const }) };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    exchangeCode: publicProcedure
      .input(z.object({ code: z.string(), state: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const tokenResponse = await sdk.exchangeCodeForToken(input.code, input.state);
          const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
          if (!userInfo.openId) throw new TRPCError({ code: "BAD_REQUEST", message: "openId missing from user info" });
          const normalizedName = userInfo.name?.trim() || null;
          await upsertUser({
            openId: userInfo.openId,
            name: normalizedName,
            email: userInfo.email ?? null,
            loginMethod: userInfo.loginMethod ?? (userInfo as unknown as Record<string, string>).platform ?? null,
            lastSignedIn: new Date(),
          });
          const sessionToken = await sdk.createSessionToken(userInfo.openId, {
            name: normalizedName ?? undefined,
            expiresInMs: ONE_YEAR_MS,
          });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          // Extract returnPath from state
          let returnPath = "/chat-transition?reason=auth";
          try {
            const decoded = JSON.parse(atob(input.state)) as { returnPath?: string };
            if (typeof decoded.returnPath === "string" && decoded.returnPath.startsWith("/")) {
              returnPath = decoded.returnPath;
            }
          } catch { /* use default */ }
          // Fetch the user row and profile so the client can seed both auth.me and
          // onboarding.get caches directly — eliminating cold-start round-trips after login.
          const freshUser = await getUserByOpenId(userInfo.openId);
          const userForCache = freshUser ? withOwnerAdminRole(freshUser) : null;
          const profileForCache = freshUser ? (await getJimmiProfile(freshUser.id) ?? null) : null;
          const profileWithComputed = profileForCache
            ? { ...profileForCache, age: calculateAge(profileForCache.birthday), onboardingComplete: true }
            : null;
          // Also fetch recent chat history so the client can seed the chat.history
          // cache directly — eliminating the cold-start wait for messages on re-login.
          const chatHistoryMessages = freshUser ? await listChatMessages(freshUser.id) : [];
          const chatHistory = { messages: chatHistoryMessages, retentionDays: 7 };
          return { success: true, returnPath, user: userForCache, profile: profileWithComputed, chatHistory } as const;
        } catch (error) {
          console.error("[OAuth] exchangeCode failed", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Authentication failed. Please try again." });
        }
      }),
    // ─── Custom Email/Password Sign-up ────────────────────────────────────────
    signup: publicProcedure
      .input(z.object({
        email: z.string().trim().email("Enter a valid email address.").max(320),
        password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password is too long."),
        name: z.string().trim().min(1, "Enter your name.").max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        const normalizedEmail = input.email.toLowerCase().trim();
        // Check for duplicate email
        const existing = await getUserByEmail(normalizedEmail);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists. Please log in instead.",
          });
        }
        // Hash password
        const passwordHash = await bcrypt.hash(input.password, 12);
        // Create a unique openId for email/password users
        const openId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await upsertUser({
          openId,
          name: input.name.trim(),
          email: normalizedEmail,
          loginMethod: "email",
          lastSignedIn: new Date(),
        });
        const newUser = await getUserByEmail(normalizedEmail);
        if (!newUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account creation failed. Please try again." });
        await updateUserPasswordHash(newUser.id, passwordHash);
        // Create session
        const sessionToken = await sdk.createSessionToken(openId, { name: input.name.trim(), expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, returnPath: "/onboarding" } as const;
      }),
    // ─── Custom Email/Password Login ──────────────────────────────────────────
    login: publicProcedure
      .input(z.object({
        email: z.string().trim().email("Enter a valid email address.").max(320),
        password: z.string().min(1, "Enter your password.").max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const normalizedEmail = input.email.toLowerCase().trim();
        const user = await getUserByEmail(normalizedEmail);
        if (!user || !user.passwordHash) {
          // Use same error for both not-found and wrong-password to prevent email enumeration
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password." });
        }
        const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
        if (!passwordMatch) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password." });
        }
        // Update last signed in
        await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? undefined, expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        // Determine where to send the user
        const profile = await getJimmiProfile(user.id);
        const returnPath = profile ? "/chat" : "/onboarding";
        return { success: true, returnPath } as const;
      }),
    // ─── Google Sign-In cache seeder ─────────────────────────────────────────
    // Called by the frontend after Google Sign-In sets the session cookie.
    // Returns user + profile + chatHistory so the client can seed all caches
    // in one round-trip — eliminating the cold-start black screen.
    googleComplete: protectedProcedure
      .query(async ({ ctx }) => {
        const freshUser = await getUserByOpenId(ctx.user.openId);
        const userForCache = freshUser ? withOwnerAdminRole(freshUser) : null;
        const profileForCache = freshUser ? (await getJimmiProfile(freshUser.id) ?? null) : null;
        const profileWithComputed = profileForCache
          ? { ...profileForCache, age: calculateAge(profileForCache.birthday), onboardingComplete: true }
          : null;
        const chatHistoryMessages = freshUser ? await listChatMessages(freshUser.id) : [];
        const chatHistory = { messages: chatHistoryMessages, retentionDays: 7 };
        const returnPath = profileWithComputed ? "/chat-transition?reason=auth" : "/onboarding";
        return { user: userForCache, profile: profileWithComputed, chatHistory, returnPath } as const;
      }),
    // ─── Google OAuth initiation ──────────────────────────────────────────────
    googleAuthUrl: publicProcedure
      .input(z.object({ origin: z.string().url() }))
      .query(({ input }) => {
        const googleClientId = process.env.GOOGLE_SIGNIN_CLIENT_ID ?? "";
        if (!googleClientId) {
          throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Google Sign-In is not configured yet." });
        }
        const redirectUri = process.env.GOOGLE_SIGNIN_REDIRECT_URI ?? `${input.origin}/api/auth/google/callback`;
        const params = new URLSearchParams({
          client_id: googleClientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "openid email profile",
          access_type: "offline",
          prompt: "select_account",
        });
        return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
      }),
  }),
  onboarding: router({
    get: protectedProcedure.query(async ({ ctx }) => withComputedProfile(await getJimmiProfile(ctx.user.id))),
    complete: protectedProcedure.input(onboardingInput).mutation(async ({ ctx, input }) => {
      const profile = await upsertJimmiProfile(ctx.user.id, serializeProfileInput(input, false));
      return withComputedProfile(profile);
    }),
    updateProfile: protectedProcedure.input(onboardingInput).mutation(async ({ ctx, input }) => {
      const existing = await getJimmiProfile(ctx.user.id);
      const profile = await upsertJimmiProfile(ctx.user.id, { ...serializeProfileInput(input, existing?.tourSeen ?? false), avatarUrl: existing?.avatarUrl ?? null });
      return withComputedProfile(profile);
    }),
    updateAvatar: protectedProcedure.input(avatarUploadInput).mutation(async ({ ctx, input }) => {
      const decoded = decodeAvatarDataUrl(input.imageDataUrl);
      const uploaded = await storagePut(`avatars/user-${ctx.user.id}/profile.${decoded.extension}`, decoded.buffer, decoded.contentType);
      return withComputedProfile(await updateJimmiProfileAvatar(ctx.user.id, uploaded.url));
    }),
    markTourSeen: protectedProcedure.mutation(async ({ ctx }) => withComputedProfile(await markJimmiTourSeen(ctx.user.id))),
  }),
  myProgram: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const quota = await getProgramGenerationQuota(ctx.user.id);
      const program = await getJimmiProgram(ctx.user.id);
      if (!program) return { program: null, groceryList: null, logs: [], generationQuota: quota };
      return {
        program: { ...program, plan: ensurePlanHasWorkoutSchedule(safeJsonParse(program.planJson, null)) },
        groceryList: safeJsonParse(program.groceryListJson, null),
        logs: await listExerciseLogEntries(ctx.user.id, program.id),
        generationQuota: quota,
      };
    }),
    generate: protectedProcedure.input(generateProgramInput).mutation(async ({ ctx, input }) => {
      const quota = await getProgramGenerationQuota(ctx.user.id);
      if (quota.remaining <= 0) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `You have used both program generations for this 30-day cycle. ${quota.daysRemaining} day${quota.daysRemaining === 1 ? "" : "s"} remaining before your limit resets.` });
      }
      const profile = await getJimmiProfile(ctx.user.id);
      if (!profile) throw new Error("Complete onboarding before generating My Program.");
      const macros = calculateDailyMacroTargets(profile);
      const requestedFocus = input?.programFocus?.trim();
      const sportSpecificPrompt = getSportSpecificPrompt(profile.eventType);
      const raceContextLines = profile.eventType && profile.eventType !== "general" ? [
        "\nRace-Specific Context:",
        `- Event type: ${profile.eventType}`,
        ...(profile.weeksUntilRace ? [`- Weeks until race: ${profile.weeksUntilRace}`] : []),
        ...(profile.currentWeeklyVolume ? [`- Current weekly volume: ${profile.currentWeeklyVolume}`] : []),
        ...(profile.availableTrainingDaysPerWeek ? [`- Available training days per week: ${profile.availableTrainingDaysPerWeek}`] : []),
        ...(profile.previousRaceTimes ? [`- Previous race times: ${profile.previousRaceTimes}`] : []),
      ].join("\n") : "";
      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: `${sportSpecificPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}${raceContextLines}\n\nGenerate one safe, comprehensive program with an expert-selected duration. Do not default to 7 days unless the user explicitly requests a 7-day program in their optional focus text. Choose the program length from the user's goals, fitness level, health context, schedule, constraints, and recovery needs. Save-ready output only. Speak directly to the user in first person. Include a concise rationale for the selected duration and progress-tracking checkpoints across the full plan. The training plan and meal plan must match the profile, daily macros, dietary restrictions, specific dietary preferences, allergies, health complications, activity level, fitness level, and goals. Each exercise needs a YouTube search URL, not a specific claim about a verified video. Keep exercises practical and include beginner-friendly substitutions when needed.` },
          { role: "user", content: `Create my consolidated expert-guided program with daily macro targets: ${JSON.stringify(macros)}. Select the right program duration for me based on my profile and optional focus text, then include training days, progression guidance, progress checkpoints, and a meal plan rotation that fits my macros as closely as possible.${requestedFocus ? ` Specific goal or focus from me: ${requestedFocus}` : ""}${input?.injuryContext?.trim() ? ` Current injury or physical limitation to work around: ${input.injuryContext.trim()}` : ""}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "jimmi_my_program",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                overview: { type: "string" },
                programDuration: { type: "string" },
                durationRationale: { type: "string" },
                phaseSummary: { type: "array", items: { type: "object", properties: { phase: { type: "string" }, focus: { type: "string" }, weeks: { type: "string" } }, required: ["phase", "focus", "weeks"], additionalProperties: false } },
                progressTracking: { type: "array", items: { type: "object", properties: { checkpoint: { type: "string" }, action: { type: "string" }, metric: { type: "string" } }, required: ["checkpoint", "action", "metric"], additionalProperties: false } },
                trainingPlan: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "string" },
                      focus: { type: "string" },
                      warmup: { type: "string" },
                      exercises: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            name: { type: "string" },
                            sets: { type: "integer" },
                            reps: { type: "string" },
                            rest: { type: "string" },
                            cues: { type: "string" },
                            youtubeUrl: { type: "string" }
                          },
                          required: ["key", "name", "sets", "reps", "rest", "cues", "youtubeUrl"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["day", "focus", "warmup", "exercises"],
                    additionalProperties: false
                  }
                },
                mealPlan: {
                  type: "object",
                  properties: {
                    macroTargets: { type: "object", properties: { calories: { type: "integer" }, protein: { type: "integer" }, carbs: { type: "integer" }, fat: { type: "integer" } }, required: ["calories", "protein", "carbs", "fat"], additionalProperties: false },
                    days: { type: "array", items: { type: "object", properties: { day: { type: "string" }, meals: { type: "array", items: { type: "object", properties: { mealType: { type: "string" }, name: { type: "string" }, ingredients: { type: "array", items: { type: "string" } }, calories: { type: "integer" }, protein: { type: "integer" }, carbs: { type: "integer" }, fat: { type: "integer" }, notes: { type: "string" } }, required: ["mealType", "name", "ingredients", "calories", "protein", "carbs", "fat", "notes"], additionalProperties: false } } }, required: ["day", "meals"], additionalProperties: false } }
                  },
                  required: ["macroTargets", "days"],
                  additionalProperties: false
                }
              },
              required: ["title", "overview", "programDuration", "durationRationale", "phaseSummary", "progressTracking", "trainingPlan", "mealPlan"],
              additionalProperties: false
            }
          }
        }
      });
      const plan = ensurePlanHasWorkoutSchedule(extractLlmJson(llmResponse.choices[0]?.message.content, null as any));
      if (!plan) throw new Error("JIMMI could not generate a program right now. Try again in a moment.");
      const groceryList = await createGroceryListFromMealPlan(plan);
      const saved = await upsertJimmiProgram(ctx.user.id, {
        title: String(plan.title || "My JIMMI Program").slice(0, 180),
        macroCalories: macros.calories,
        macroProtein: macros.protein,
        macroCarbs: macros.carbs,
        macroFat: macros.fat,
        planJson: JSON.stringify(plan),
        groceryListJson: JSON.stringify(groceryList),
        exportText: buildMealPlanExport(plan, groceryList),
      });
      await recordProgramGeneration(ctx.user.id);
      const updatedQuota = await getProgramGenerationQuota(ctx.user.id);
      return { program: saved ? { ...saved, plan } : null, groceryList, generationQuota: updatedQuota };
    }),
    logExercise: protectedProcedure.input(exerciseLogInput).mutation(async ({ ctx, input }) => ({ logs: await createExerciseLogEntry({ userId: ctx.user.id, programId: input.programId, exerciseKey: input.exerciseKey, exerciseName: input.exerciseName, sets: input.sets, reps: input.reps, weight: input.weight, notes: input.notes || null }) ?? [] })),
    adaptUpcomingWorkouts: protectedProcedure.input(smartWorkoutAdaptationInput).mutation(async ({ ctx, input }) => {
      const profile = await getJimmiProfile(ctx.user.id);
      const saved = await getJimmiProgram(ctx.user.id);
      if (!profile || !saved) throw new Error("Generate My Program before adapting upcoming workouts.");
      if (input?.programId && input.programId !== saved.id) throw new TRPCError({ code: "BAD_REQUEST", message: "That saved program could not be found." });
      const plan = ensurePlanHasWorkoutSchedule(safeJsonParse<any>(saved.planJson, null));
      if (!plan || !Array.isArray(plan.trainingPlan)) throw new Error("Your saved program needs to be regenerated before adapting upcoming workouts.");
      const logs = await listExerciseLogEntries(ctx.user.id, saved.id);
      if (!logs.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Log at least one workout before asking JIMMI to adapt upcoming workouts." });
      const upcomingWorkoutIndexes = plan.trainingPlan
        .map((day: any, index: number) => ({ day, index }))
        .filter(({ day }: any) => day?.status !== "completed" && day?.status !== "cancelled" && (!day?.scheduledDate || day.scheduledDate >= todayIsoDate()))
        .map(({ index }: any) => index);
      if (!upcomingWorkoutIndexes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "There are no upcoming scheduled workouts available to adapt." });

      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}\n\nYou are modifying upcoming workouts in an already-saved program. Use prior workout logs, completed volume, load, reps, and member notes to make smart, safe modifications. Preserve completed and cancelled workout days exactly. Only adjust upcoming scheduled days. Prefer modest progression when logs look strong, deload or simplify when notes mention pain, fatigue, poor sleep, soreness, form issues, or missed work.${input?.injuryContext?.trim() ? " CRITICAL: The member has reported an injury or physical limitation. Injury-safe modifications take absolute priority over progression or performance. Replace or remove any exercises that stress the injured area. Substitute with movements that train the same muscle group through a pain-free range of motion. Add a brief adaptationNote to each modified day explaining the change. Include the required physician disclaimer in the adaptationSummary." : ""} Return JSON only.` },
          { role: "user", content: JSON.stringify({ memberRequest: input?.injuryContext?.trim() ? `INJURY REPORT — prioritise injury-safe modifications above all else. Injury or limitation: ${input.injuryContext.trim()}. ${input?.memberRequest || ""}`.trim() : (input?.memberRequest || "Adapt upcoming workouts based on my previous workout logs and notes."), today: todayIsoDate(), upcomingWorkoutIndexes, currentTrainingPlan: plan.trainingPlan, recentWorkoutLogs: buildExerciseLogAdaptationContext(logs) }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "jimmi_smart_workout_adaptation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                adaptationSummary: { type: "string" },
                evidenceUsed: { type: "array", items: { type: "string" } },
                trainingPlan: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "string" },
                      focus: { type: "string" },
                      warmup: { type: "string" },
                      scheduledDate: { type: "string" },
                      dateLabel: { type: "string" },
                      status: { type: "string" },
                      recoveryWindow: { type: "string" },
                      adaptationNote: { type: "string" },
                      exercises: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            name: { type: "string" },
                            sets: { type: "integer" },
                            reps: { type: "string" },
                            rest: { type: "string" },
                            cues: { type: "string" },
                            youtubeUrl: { type: "string" }
                          },
                          required: ["key", "name", "sets", "reps", "rest", "cues", "youtubeUrl"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["day", "focus", "warmup", "scheduledDate", "dateLabel", "status", "recoveryWindow", "adaptationNote", "exercises"],
                    additionalProperties: false
                  }
                }
              },
              required: ["adaptationSummary", "evidenceUsed", "trainingPlan"],
              additionalProperties: false
            }
          }
        }
      });
      const adaptation = extractLlmJson(llmResponse.choices[0]?.message.content, null as any);
      if (!adaptation?.trainingPlan?.length) throw new Error("JIMMI could not adapt your upcoming workouts right now.");
      const originalTrainingPlan = plan.trainingPlan;
      plan.trainingPlan = adaptation.trainingPlan.map((day: any, index: number) => {
        const originalDay = originalTrainingPlan[index];
        if (originalDay?.status === "completed" || originalDay?.status === "cancelled") return originalDay;
        return { ...originalDay, ...day, smartAdaptedAt: new Date().toISOString() };
      });
      plan.smartWorkoutAdaptation = {
        summary: adaptation.adaptationSummary,
        evidenceUsed: adaptation.evidenceUsed,
        adaptedAt: new Date().toISOString(),
        logCount: logs.length,
      };
      const updated = await upsertJimmiProgram(ctx.user.id, { title: saved.title, macroCalories: saved.macroCalories, macroProtein: saved.macroProtein, macroCarbs: saved.macroCarbs, macroFat: saved.macroFat, planJson: JSON.stringify(plan), groceryListJson: saved.groceryListJson, exportText: buildMealPlanExport(plan, safeJsonParse(saved.groceryListJson, null)) });
      return { program: updated ? { ...updated, plan } : null, adaptation: plan.smartWorkoutAdaptation };
    }),
    updateWorkoutDay: protectedProcedure.input(workoutActionInput).mutation(async ({ ctx, input }) => {
      const saved = await getJimmiProgram(ctx.user.id);
      if (!saved) throw new Error("Generate My Program before updating workout days.");
      const plan = ensurePlanHasWorkoutSchedule(safeJsonParse<any>(saved.planJson, null));
      if (!plan || !Array.isArray(plan.trainingPlan)) throw new Error("Your saved program needs to be regenerated before updating workout days.");
      const workoutDay = plan.trainingPlan[input.dayIndex];
      if (!workoutDay) throw new Error("That workout day could not be found in your saved plan.");

      if (input.action === "complete") {
        if (workoutDay.scheduledDate !== todayIsoDate()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This workout can only be marked complete on its scheduled date." });
        }
        workoutDay.status = "completed";
        workoutDay.completedAt = new Date().toISOString();
      }
      if (input.action === "cancel") {
        workoutDay.status = "cancelled";
        workoutDay.cancelledAt = new Date().toISOString();
      }
      if (input.action === "reschedule") {
        if (!input.scheduledDate) throw new Error("Choose a new date before rescheduling this workout.");
        if (input.scheduledDate < todayIsoDate()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can't reschedule a workout to a date that has already passed." });
        }
        const hasAnotherWorkoutOnDate = plan.trainingPlan.some((candidate: any, candidateIndex: number) => candidateIndex !== input.dayIndex && candidate?.scheduledDate === input.scheduledDate && candidate?.status !== "cancelled");
        if (hasAnotherWorkoutOnDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Another workout is already scheduled for that date. Please choose a different date." });
        }
        workoutDay.previousScheduledDate = workoutDay.scheduledDate;
        workoutDay.scheduledDate = input.scheduledDate;
        workoutDay.dateLabel = formatWorkoutDateLabel(input.scheduledDate);
        workoutDay.status = "scheduled";
        workoutDay.rescheduledAt = new Date().toISOString();
        workoutDay.recoveryWindow = `Rest, mobility, or light walking until ${formatWorkoutDateLabel(input.scheduledDate)}.`;
      }

      const updated = await upsertJimmiProgram(ctx.user.id, { title: saved.title, macroCalories: saved.macroCalories, macroProtein: saved.macroProtein, macroCarbs: saved.macroCarbs, macroFat: saved.macroFat, planJson: JSON.stringify(plan), groceryListJson: saved.groceryListJson, exportText: buildMealPlanExport(plan, safeJsonParse(saved.groceryListJson, null)) });
      return { program: updated ? { ...updated, plan } : null };
    }),
    regenerateExercise: protectedProcedure.input(regenerateExerciseInput).mutation(async ({ ctx, input }) => {
      const profile = await getJimmiProfile(ctx.user.id);
      const saved = await getJimmiProgram(ctx.user.id);
      if (!profile || !saved) throw new Error("Generate My Program before replacing exercises.");
      const plan = safeJsonParse<any>(saved.planJson, null);
      if (!plan) throw new Error("Your saved program needs to be regenerated before replacing exercises.");
      const llmResponse = await invokeLLM({
        disableThinking: true,
        messages: [
          { role: "system", content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}\n\nReturn one safer, similar exercise replacement for the same training intent. Keep it suitable for the user's level and limitations.` },
          { role: "user", content: `Replace this exercise with a similar alternative. Exercise: ${input.exerciseName}. Reason: ${input.reason || "movement is too advanced, uncomfortable, or unavailable"}. Return a new exercise object with key, name, sets, reps, rest, cues, and youtubeUrl.` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "jimmi_exercise_replacement", strict: true, schema: { type: "object", properties: { key: { type: "string" }, name: { type: "string" }, sets: { type: "integer" }, reps: { type: "string" }, rest: { type: "string" }, cues: { type: "string" }, youtubeUrl: { type: "string" } }, required: ["key", "name", "sets", "reps", "rest", "cues", "youtubeUrl"], additionalProperties: false } } }
      });
      const replacement = extractLlmJson(llmResponse.choices[0]?.message.content, null as any);
      if (!replacement) throw new Error("JIMMI could not replace that exercise right now.");
      for (const day of plan.trainingPlan ?? []) {
        const exercises = Array.isArray(day.exercises) ? day.exercises : [];
        const index = exercises.findIndex((exercise: any) => exercise.key === input.exerciseKey);
        if (index >= 0) exercises[index] = { ...replacement, key: `${input.exerciseKey}-alt-${Date.now()}` };
      }
      const updated = await upsertJimmiProgram(ctx.user.id, { title: saved.title, macroCalories: saved.macroCalories, macroProtein: saved.macroProtein, macroCarbs: saved.macroCarbs, macroFat: saved.macroFat, planJson: JSON.stringify(plan), groceryListJson: saved.groceryListJson, exportText: buildMealPlanExport(plan, safeJsonParse(saved.groceryListJson, null)) });
      return { program: updated ? { ...updated, plan } : null, replacement };
    }),
    regenerateMeal: protectedProcedure.input(regenerateMealInput).mutation(async ({ ctx, input }) => {
      const profile = await getJimmiProfile(ctx.user.id);
      const saved = await getJimmiProgram(ctx.user.id);
      if (!profile || !saved) throw new Error("Generate My Program before swapping meals.");
      const plan = safeJsonParse<any>(saved.planJson, null);
      if (!plan) throw new Error("Your saved program needs to be regenerated before swapping meals.");
      const macros = { calories: saved.macroCalories, protein: saved.macroProtein, carbs: saved.macroCarbs, fat: saved.macroFat };
      const currentDay = plan.mealPlan?.days?.[input.dayIndex];
      const currentMeal = currentDay?.meals?.[input.mealIndex];
      if (!currentDay || !currentMeal) throw new Error("That meal could not be found in your saved plan.");
      const llmResponse = await invokeLLM({
        disableThinking: true,
        messages: [
          { role: "system", content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}\n\nReturn one replacement meal that fits the same meal type, respects dietary restrictions, specific dietary preferences, allergies, health context, and stays close to the original meal macros and the user's daily macro goals. Return JSON only.` },
          { role: "user", content: `Swap this meal for another macro-aware option. Day: ${currentDay.day ?? input.dayIndex + 1}. Meal type: ${input.mealType}. Current meal: ${input.mealName}. Current macros: ${JSON.stringify({ calories: currentMeal.calories, protein: currentMeal.protein, carbs: currentMeal.carbs, fat: currentMeal.fat })}. Daily macro goals: ${JSON.stringify(macros)}. Reason: ${input.reason || "the user would prefer another option"}. Return mealType, name, ingredients, calories, protein, carbs, fat, and notes.` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "jimmi_meal_replacement", strict: true, schema: { type: "object", properties: { mealType: { type: "string" }, name: { type: "string" }, ingredients: { type: "array", items: { type: "string" } }, calories: { type: "integer" }, protein: { type: "integer" }, carbs: { type: "integer" }, fat: { type: "integer" }, notes: { type: "string" } }, required: ["mealType", "name", "ingredients", "calories", "protein", "carbs", "fat", "notes"], additionalProperties: false } } }
      });
      const replacement = extractLlmJson(llmResponse.choices[0]?.message.content, null as any);
      if (!replacement) throw new Error("JIMMI could not swap that meal right now.");
      currentDay.meals[input.mealIndex] = { ...replacement, mealType: replacement.mealType || input.mealType };
      const groceryList = await createGroceryListFromMealPlan(plan);
      const updated = await upsertJimmiProgram(ctx.user.id, { title: saved.title, macroCalories: saved.macroCalories, macroProtein: saved.macroProtein, macroCarbs: saved.macroCarbs, macroFat: saved.macroFat, planJson: JSON.stringify(plan), groceryListJson: JSON.stringify(groceryList), exportText: buildMealPlanExport(plan, groceryList) });
      return { program: updated ? { ...updated, plan } : null, groceryList, replacement };
    }),
    generateGroceryList: protectedProcedure.mutation(async ({ ctx }) => {
      const saved = await getJimmiProgram(ctx.user.id);
      if (!saved) throw new Error("Generate My Program before opening a grocery list.");
      const plan = safeJsonParse<any>(saved.planJson, null);
      if (!plan) throw new Error("Your saved program needs to be regenerated before opening a grocery list.");
      const existingGroceryList = safeJsonParse(saved.groceryListJson, null as any);
      if (existingGroceryList?.categories?.length) return { program: { ...saved, plan }, groceryList: existingGroceryList };
      const groceryList = await createGroceryListFromMealPlan(plan);
      const updated = await updateJimmiProgramGroceryList(ctx.user.id, JSON.stringify(groceryList), buildMealPlanExport(plan, groceryList));
      return { program: updated ? { ...updated, plan } : null, groceryList };
    }),
  }),
  foodLog: router({
    estimateMacros: publicProcedure.input(macroEstimateInput).mutation(async ({ input }) => {
      const llmResponse = await invokeLLM({
        disableThinking: true,
        messages: [
          {
            role: "system",
            content: "You estimate nutrition macros for common foods and meals. Return only realistic integer estimates for a typical logged portion. If the user gives a portion size, use it. If no portion is given, assume one normal adult serving. Do not add explanation.",
          },
          {
            role: "user",
            content: `Estimate calories and macros for: ${input.foodName}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "food_log_macro_estimate",
            strict: true,
            schema: {
              type: "object",
              properties: {
                calories: { type: "integer", description: "Estimated calories for the described food or meal." },
                protein: { type: "integer", description: "Estimated protein grams for the described food or meal." },
                carbs: { type: "integer", description: "Estimated carbohydrate grams for the described food or meal." },
                fat: { type: "integer", description: "Estimated fat grams for the described food or meal." },
              },
              required: ["calories", "protein", "carbs", "fat"],
              additionalProperties: false,
            },
          },
        },
      });

      return parseMacroEstimate(llmResponse.choices[0]?.message.content);
    }),
    daily: protectedProcedure.input(z.object({ logDate: logDateInput })).query(async ({ ctx, input }) => {
      const entries = await listFoodLogEntries(ctx.user.id, input.logDate);
      const totals = entries.reduce(
        (sum, entry) => ({
          calories: sum.calories + entry.calories,
          protein: sum.protein + entry.protein,
          carbs: sum.carbs + entry.carbs,
          fat: sum.fat + entry.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      return { entries, totals };
    }),
    calorieBalance: protectedProcedure.input(z.object({ logDate: logDateInput })).query(async ({ ctx, input }) => {
      return getCalorieBalanceForDate(ctx.user.id, input.logDate);
    }),
    add: protectedProcedure.input(foodLogEntryInput).mutation(async ({ ctx, input }) => {
      const entries = await createFoodLogEntry({
        userId: ctx.user.id,
        logDate: input.logDate,
        mealType: input.mealType,
        foodName: input.foodName,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        notes: input.notes || null,
      });
      return { entries: entries ?? [] };
    }),
    update: protectedProcedure.input(foodLogEntryInput.extend({ id: z.coerce.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const entries = await updateFoodLogEntry(ctx.user.id, input.id, {
        logDate: input.logDate,
        mealType: input.mealType,
        foodName: input.foodName,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        notes: input.notes || null,
      });
      return { entries: entries ?? [] };
    }),
    delete: protectedProcedure.input(z.object({ id: z.coerce.number().int().positive(), logDate: logDateInput })).mutation(async ({ ctx, input }) => {
      await deleteFoodLogEntry(ctx.user.id, input.id);
      return { entries: await listFoodLogEntries(ctx.user.id, input.logDate) };
    }),
  }),
  chat: router({
    estimateRestaurantMeal: protectedProcedure.input(restaurantMealEstimateInput).mutation(async ({ ctx, input }) => {
      const profile = await getJimmiProfile(ctx.user.id);
      if (!profile) throw new Error("Complete onboarding before using restaurant macro estimates.");
      return estimateRestaurantMacros(input.description, buildProfileContext(profile));
    }),
    analyzeFoodImage: protectedProcedure.input(foodImageScanInput).mutation(async ({ ctx, input }) => {
      const profile = await getJimmiProfile(ctx.user.id);
      if (!profile) throw new Error("Complete onboarding before using JIMMI food recognition.");
      const image = decodeImageDataUrl(input.imageDataUrl);
      const llmResponse = await invokeLLM({
        disableThinking: true,
        messages: [
          {
            role: "system",
            content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}\n\nIdentify whether the submitted image contains edible food or drink. If it is not food, return isFood false and ask for a clear food image. If it is food, estimate portion size and macros. Keep guidance concise and personalized without exposing private profile details.`,
          },
          {
            role: "user",
            content: [
              { type: "text" as const, text: `Scan this ${input.source === "camera" ? "camera capture" : "uploaded food image"}. Return realistic food identification, macro estimates, and one concise suggestion. Macro values must be editable by the user before saving.` },
              { type: "image_url" as const, image_url: { url: image.dataUrl, detail: "high" as const } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "jimmi_food_image_scan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                isFood: { type: "boolean" },
                foodName: { type: "string" },
                portion: { type: "string" },
                confidence: { type: "string" },
                macros: {
                  type: "object",
                  properties: {
                    calories: { type: "integer" },
                    protein: { type: "integer" },
                    carbs: { type: "integer" },
                    fat: { type: "integer" },
                  },
                  required: ["calories", "protein", "carbs", "fat"],
                  additionalProperties: false,
                },
                guidance: { type: "string" },
              },
              required: ["isFood", "foodName", "portion", "confidence", "macros", "guidance"],
              additionalProperties: false,
            },
          },
        },
      });
      return parseFoodImageScan(llmResponse.choices[0]?.message.content);
    }),
    scanProgramFile: protectedProcedure.input(programFileScanInput).mutation(async ({ ctx, input }) => {
      const profile = await getJimmiProfile(ctx.user.id);
      if (!profile) throw new Error("Complete onboarding before asking JIMMI to scan program files.");
      const scanSettings = await getAccountSettings(ctx.user.id);
      const scanTier = (scanSettings.planTier ?? "free") as import("../shared/tiers").SubscriptionTier;
      if (!tierAtLeast(scanTier, "core")) throw new TRPCError({ code: "FORBIDDEN", message: "Program file import is available on Core, Pro, and Elite plans. Upgrade to unlock this feature." });
      const isImage = input.mimeType.startsWith("image/");
      const isPdf = input.mimeType === "application/pdf";

      if (isPdf) {
        const macros = calculateDailyMacroTargets(profile);
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}\n\nYou are importing an uploaded workout-program PDF into JIMMI. Extract the program structure into JIMMI's My Program format when the PDF contains workouts. Preserve the original program's exercise names, sets, reps, rest, schedule, phases, and notes when available. If nutrition is present, include it; otherwise leave meal days empty and keep JIMMI macro targets. Keep safety cautions concise and do not invent medical advice.` },
            { role: "user", content: [
              { type: "text" as const, text: `Import this uploaded PDF program named ${input.fileName}. Return a concise scan summary plus a structured program JIMMI can save to My Program.` },
              { type: "file_url" as const, file_url: { url: input.fileDataUrl, mime_type: "application/pdf" as const } },
            ] },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "jimmi_pdf_program_import",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  suggestions: { type: "array", items: { type: "string" } },
                  caution: { type: "string" },
                  program: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      overview: { type: "string" },
                      programDuration: { type: "string" },
                      durationRationale: { type: "string" },
                      phaseSummary: { type: "array", items: { type: "object", properties: { phase: { type: "string" }, focus: { type: "string" }, weeks: { type: "string" } }, required: ["phase", "focus", "weeks"], additionalProperties: false } },
                      progressTracking: { type: "array", items: { type: "object", properties: { checkpoint: { type: "string" }, action: { type: "string" }, metric: { type: "string" } }, required: ["checkpoint", "action", "metric"], additionalProperties: false } },
                      trainingPlan: { type: "array", items: { type: "object", properties: { day: { type: "string" }, focus: { type: "string" }, warmup: { type: "string" }, exercises: { type: "array", items: { type: "object", properties: { key: { type: "string" }, name: { type: "string" }, sets: { type: "integer" }, reps: { type: "string" }, rest: { type: "string" }, cues: { type: "string" }, youtubeUrl: { type: "string" } }, required: ["key", "name", "sets", "reps", "rest", "cues", "youtubeUrl"], additionalProperties: false } } }, required: ["day", "focus", "warmup", "exercises"], additionalProperties: false } },
                      mealPlan: { type: "object", properties: { days: { type: "array", items: { type: "object", properties: { day: { type: "string" }, meals: { type: "array", items: { type: "object", properties: { mealType: { type: "string" }, name: { type: "string" }, ingredients: { type: "array", items: { type: "string" } }, calories: { type: "integer" }, protein: { type: "integer" }, carbs: { type: "integer" }, fat: { type: "integer" }, notes: { type: "string" } }, required: ["mealType", "name", "ingredients", "calories", "protein", "carbs", "fat", "notes"], additionalProperties: false } } }, required: ["day", "meals"], additionalProperties: false } } }, required: ["days"], additionalProperties: false },
                    },
                    required: ["title", "overview", "programDuration", "durationRationale", "phaseSummary", "progressTracking", "trainingPlan", "mealPlan"],
                    additionalProperties: false,
                  },
                },
                required: ["title", "summary", "suggestions", "caution", "program"],
                additionalProperties: false,
              },
            },
          },
        });
        const scan = parseProgramScan(llmResponse.choices[0]?.message.content);
        const importedPlan = normalizeImportedProgramPlan(llmResponse.choices[0]?.message.content, macros, input.fileName);
        if (!importedPlan) return { ...scan, imported: false as const, importMessage: "JIMMI reviewed the PDF, but could not find enough workout structure to save it as My Program yet." };
        const saved = await upsertJimmiProgram(ctx.user.id, {
          title: importedPlan.title || scan.title,
          macroCalories: macros.calories,
          macroProtein: macros.protein,
          macroCarbs: macros.carbs,
          macroFat: macros.fat,
          planJson: JSON.stringify(importedPlan),
          groceryListJson: null,
          exportText: buildImportedProgramExport(importedPlan),
        });
        return {
          ...scan,
          imported: true as const,
          importMessage: "JIMMI imported this PDF into My Program.",
          importedProgram: saved ? { id: saved.id, title: saved.title, route: "/my-program", trainingDayCount: importedPlan.trainingPlan.length } : null,
        };
      }

      const content = isImage
        ? [
            { type: "text" as const, text: `Review this uploaded program file named ${input.fileName}. Summarize training, recovery, nutrition, or wellness guidance and flag anything that should be adjusted for the user's goals.` },
            { type: "image_url" as const, image_url: { url: input.fileDataUrl, detail: "high" as const } },
          ]
        : `Review this uploaded program file named ${input.fileName}. File MIME type: ${input.mimeType}. Data URL payload begins: ${input.fileDataUrl.slice(0, 3500)}. Summarize what is useful and suggest practical adjustments for the user's onboarding goals.`;
      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}\n\nYou are scanning an existing program or supporting document. Keep the visible answer concise, practical, and limited to fitness, wellness, recovery, health, or nutrition.` },
          { role: "user", content },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "jimmi_program_file_scan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                suggestions: { type: "array", items: { type: "string" } },
                caution: { type: "string" },
              },
              required: ["title", "summary", "suggestions", "caution"],
              additionalProperties: false,
            },
          },
        },
      });
      return { ...parseProgramScan(llmResponse.choices[0]?.message.content), imported: false as const, importMessage: "JIMMI reviewed the upload without replacing My Program." };
    }),
    scanBarcode: protectedProcedure.input(barcodeScanInput).mutation(async ({ ctx, input }) => {
      const profile = await getJimmiProfile(ctx.user.id);
      if (!profile) throw new Error("Complete onboarding before using barcode guidance.");
      const product = await lookupOpenFoodFactsProduct(input.barcode);
      if (!product) return { found: false as const, barcode: input.barcode, message: "JIMMI could not find that barcode yet. Try another product or enter the macros manually." };
      const foodName = [product.brands, product.product_name].filter(Boolean).join(" — ") || product.product_name || "Scanned product";
      const macros = {
        calories: macroFromProduct(product, ["energy-kcal_serving", "energy-kcal_100g", "energy-kcal"], 5000),
        protein: macroFromProduct(product, ["proteins_serving", "proteins_100g", "proteins"], 500),
        carbs: macroFromProduct(product, ["carbohydrates_serving", "carbohydrates_100g", "carbohydrates"], 800),
        fat: macroFromProduct(product, ["fat_serving", "fat_100g", "fat"], 400),
      };
      const llmResponse = await invokeLLM({
        disableThinking: true,
        messages: [
          { role: "system", content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${buildProfileContext(profile)}\n\nUse the product nutrition, ingredients, allergens, and the user's onboarding context to give concise, personalized guidance. Flag allergy or diet concerns conservatively. Do not expose private profile details.` },
          { role: "user", content: `Barcode: ${input.barcode}\nProduct: ${foodName}\nQuantity: ${product.quantity ?? "unknown"}\nServing size: ${product.serving_size ?? "serving or 100g estimate"}\nIngredients: ${product.ingredients_text ?? "not listed"}\nAllergens: ${product.allergens_tags?.join(", ") || product.allergens || "not listed"}\nNutri-score: ${product.nutriscore_grade ?? "not listed"}\nMacros: ${JSON.stringify(macros)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "jimmi_barcode_guidance",
            strict: true,
            schema: {
              type: "object",
              properties: {
                guidance: { type: "string" },
                suggestion: { type: "string" },
                suggestedMealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack"] },
              },
              required: ["guidance", "suggestion", "suggestedMealType"],
              additionalProperties: false,
            },
          },
        },
      });
      const guidance = parseGuidance(llmResponse.choices[0]?.message.content);
      return { found: true as const, barcode: input.barcode, foodName, brand: product.brands ?? "", serving: product.serving_size || product.quantity || "serving estimate", ingredients: product.ingredients_text ?? "", macros, ...guidance };
    }),
    history: protectedProcedure.query(async ({ ctx }) => ({ messages: await listChatMessages(ctx.user.id), retentionDays: 7 })),
    saveMessage: protectedProcedure.input(chatMessageInput).mutation(async ({ ctx, input }) => ({ message: await createChatMessage(ctx.user.id, input), retentionDays: 7 })),
    transcribeVoice: protectedProcedure.input(jimmiVoiceTranscriptionInput).mutation(async ({ input }) => {
      return transcribeJimmiVoice(input.audioDataUrl, input.mimeType);
    }),
    speak: protectedProcedure.input(jimmiSpeechInput).mutation(async ({ ctx, input }) => {
      return synthesizeJimmiSpeech(String(ctx.user.id), input.text);
    }),
    send: protectedProcedure.input(z.object({ messages: z.array(chatMessageInput).min(1).max(20), clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })).mutation(async ({ ctx, input }) => {
      checkChatSendRateLimit(ctx.user.id); // throws TOO_MANY_REQUESTS if < 3s since last call

      // Save the user message immediately — before any async work that could fail —
      // so the transcript is always complete even if the LLM or DB calls error out later.
      const lastUserMessage = getLastUserMessage(input.messages);
      if (lastUserMessage) {
        try { await createChatMessage(ctx.user.id, { role: "user", content: lastUserMessage }); } catch { /* non-fatal */ }
      }

      try {
      const profile = await getJimmiProfile(ctx.user.id);
      if (!profile) {
        return {
          role: "assistant" as const,
          content: "Please complete onboarding first so I can personalize your JIMMI coaching baseline.",
        };
      }

      // Free tier: enforce daily chat message limit
      const settings = await getAccountSettings(ctx.user.id);
      const userTier = (settings.planTier ?? "free") as import("../shared/tiers").SubscriptionTier;
      if (!tierAtLeast(userTier, "core")) {
        const todayCount = await countTodayUserChatMessages(ctx.user.id);
        if (todayCount >= FREE_CHAT_DAILY_LIMIT) {
          return {
            role: "assistant" as const,
            content: `You've reached your ${FREE_CHAT_DAILY_LIMIT} daily message limit on the Free plan. Upgrade to Core or higher for unlimited coaching conversations.`,
            tierLimitReached: true as const,
          };
        }
      }

      const persistAssistantReply = async <T extends { role: "assistant"; content: string; videoEmbed?: ChatVideoEmbed; scanResult?: any }>(reply: T) => {
        await createChatMessage(ctx.user.id, { role: "assistant", content: reply.content });
        return reply;
      };

      const casualGreetingResponse = buildCasualGreetingResponse(input.messages, profile);
      if (casualGreetingResponse) {
        return persistAssistantReply({ role: "assistant" as const, content: casualGreetingResponse });
      }

      const helpDeclineResponse = buildHelpDeclineResponse(input.messages, profile);
      if (helpDeclineResponse) {
        return persistAssistantReply({ role: "assistant" as const, content: helpDeclineResponse });
      }

      const gratitudeResponse = buildGratitudeResponse(input.messages, profile);
      if (gratitudeResponse) {
        return persistAssistantReply({ role: "assistant" as const, content: gratitudeResponse });
      }

      const lowContentCheckInResponse = buildLowContentCheckInResponse(input.messages, profile);
      if (lowContentCheckInResponse) {
        return persistAssistantReply({ role: "assistant" as const, content: lowContentCheckInResponse });
      }

      const exerciseVideo = await buildExerciseDemoEmbed(input.messages);
      if (exerciseVideo) {
        return persistAssistantReply({
          role: "assistant" as const,
          content: `Here’s a video demo for **${exerciseVideo.exerciseName}**. Would you like a written explanation as well?`,
          videoEmbed: exerciseVideo,
        });
      }

      // Auto-detect food log intent and log the entry server-side
      const profileContext = buildProfileContext(profile);
      // Use the client's local date if provided — avoids UTC vs local timezone mismatch
      // where entries logged at night (e.g. 10pm EDT = 2am UTC next day) land on the wrong date.
      const todayDate = input.clientDate ?? new Date().toISOString().slice(0, 10);
      const foodLogIntent = await detectChatFoodLogIntent(input.messages, profileContext);
      if (foodLogIntent.action === "log") {
        await createFoodLogEntry({
          userId: ctx.user.id,
          logDate: todayDate,
          mealType: foodLogIntent.mealType,
          foodName: foodLogIntent.foodName,
          calories: foodLogIntent.calories,
          protein: foodLogIntent.protein,
          carbs: foodLogIntent.carbs,
          fat: foodLogIntent.fat,
          notes: null,
        });
        
        // Check if daily goals are now met after logging
        const dailyEntries = await listFoodLogEntries(ctx.user.id, todayDate);
        const dailyTotals = dailyEntries.reduce(
          (sum, entry) => ({
            calories: sum.calories + entry.calories,
            protein: sum.protein + entry.protein,
            carbs: sum.carbs + entry.carbs,
            fat: sum.fat + entry.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        
        // Calculate macro targets from profile
        const targets = calculateDailyMacroTargets(profile);
        const goalsMetAfterLogging = isGoalsMet(dailyTotals, targets);
        
        let confirmContent = foodLogIntent.confirmationNote;
        if (goalsMetAfterLogging) {
          const firstName = profile?.firstName || "there";
          confirmContent += `\n\nYou hit your targets today, ${firstName}. Solid day.`;
        }
        
        return persistAssistantReply({
          role: "assistant" as const,
          content: confirmContent,
          foodLogged: {
            foodName: foodLogIntent.foodName,
            mealType: foodLogIntent.mealType,
            calories: foodLogIntent.calories,
            protein: foodLogIntent.protein,
            carbs: foodLogIntent.carbs,
            fat: foodLogIntent.fat,
            logDate: todayDate,
          } as const,
        });
      }

      // Select LLM model based on user's subscription tier
      const llmModel = await getLLMModelForUser(ctx.user.id);
      
      const llmResponse = await invokeLLM({
        model: llmModel,
        messages: [
          {
            role: "system",
            content: `${jimmiCoachingSystemPrompt}\n\nUser onboarding profile:\n${profileContext}`,
          },
          ...input.messages.map((message) => ({ role: message.role, content: message.content } as const)),
        ],
      });

      let content = normalizeAssistantContent(llmResponse.choices[0]?.message.content);
      if (needsMedicalDisclaimer(input.messages, content) && !content.startsWith(medicalDisclaimer)) {
        content = `${medicalDisclaimer}\n\n${content}`;
      }

      return persistAssistantReply({ role: "assistant" as const, content });
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        console.error("[chat.send error]", msg, err?.stack);
        const errorReply = { role: "assistant" as const, content: "I couldn't complete that coaching response just now. Please try again in a moment." };
        // Best-effort: persist the error reply so the transcript stays complete on reload.
        try { await createChatMessage(ctx.user.id, { role: "assistant", content: errorReply.content }); } catch { /* non-fatal */ }
        return errorReply;
      }
    }),
  }),
  account: router({
    settings: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getAccountSettings(ctx.user.id);
      return {
        planTier: settings.planTier,
        subscriptionStatus: settings.subscriptionStatus,
        autoRenew: Boolean(settings.autoRenew),
      };
    }),
    wearableState: protectedProcedure.query(async ({ ctx }) => getWearableConnectionState(ctx.user.id)),
    ouraSetup: protectedProcedure.query(() => ({
      configured: isOuraConfigured(),
      redirectUri: OURA_REDIRECT_URI,
      scopes: [...OURA_SCOPES],
    })),
    startOuraConnection: protectedProcedure.mutation(async ({ ctx }) => ({
      authorizationUrl: createOuraAuthorizationUrl(ctx.user.id),
      redirectUri: OURA_REDIRECT_URI,
      scopes: [...OURA_SCOPES],
    })),
    disconnectOuraConnection: protectedProcedure.mutation(async ({ ctx }) => disconnectOuraConnection(ctx.user.id)),
    whoopSetup: protectedProcedure.query(() => ({
      configured: isWhoopConfigured(),
      redirectUri: WHOOP_REDIRECT_URI,
      webhookUrl: WHOOP_WEBHOOK_URL,
      scopes: [...WHOOP_SCOPES],
    })),
    startWhoopConnection: protectedProcedure.mutation(async ({ ctx }) => ({
      authorizationUrl: createWhoopAuthorizationUrl(ctx.user.id),
      redirectUri: WHOOP_REDIRECT_URI,
      webhookUrl: WHOOP_WEBHOOK_URL,
      scopes: [...WHOOP_SCOPES],
    })),
    disconnectWhoopConnection: protectedProcedure.mutation(async ({ ctx }) => disconnectWhoopConnection(ctx.user.id)),
    fitbitSetup: protectedProcedure.query(() => ({
      configured: isGoogleHealthConfigured(),
      redirectUri: GOOGLE_HEALTH_REDIRECT_URI,
      scopes: [...GOOGLE_HEALTH_SCOPES],
      beta: true,
    })),
    startFitbitConnection: protectedProcedure.mutation(async ({ ctx }) => ({
      authorizationUrl: buildGoogleHealthAuthUrl(ctx.user.id),
      redirectUri: GOOGLE_HEALTH_REDIRECT_URI,
      scopes: [...GOOGLE_HEALTH_SCOPES],
      beta: true,
    })),
    disconnectFitbitConnection: protectedProcedure.mutation(async ({ ctx }) => disconnectGoogleHealthConnection(ctx.user.id)),
    fitbitSyncStatus: protectedProcedure.query(async ({ ctx }) => {
      const state = await getWearableConnectionState(ctx.user.id);
      return {
        provider: state.provider,
        connected: state.connected && state.provider === "fitbit",
        status: state.status,
        lastSyncedAt: state.lastSyncedAt,
        readyForMetricSync: state.connected && state.provider === "fitbit",
        beta: true,
      };
    }),
    whoopSyncStatus: protectedProcedure.query(async ({ ctx }) => {
      const state = await getWearableConnectionState(ctx.user.id);
      return {
        provider: state.provider,
        connected: state.connected && state.provider === "whoop",
        status: state.status,
        lastSyncedAt: state.lastSyncedAt,
        readyForMetricSync: state.connected && state.provider === "whoop",
      };
    }),
    ouraSyncStatus: protectedProcedure.query(async ({ ctx }) => {
      const state = await getWearableConnectionState(ctx.user.id);
      return {
        provider: state.provider,
        connected: state.connected && state.provider === "oura",
        status: state.status,
        lastSyncedAt: state.lastSyncedAt,
        readyForMetricSync: state.connected && state.provider === "oura",
      };
    }),
    pauseSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await updateAccountSettings(ctx.user.id, { subscriptionStatus: "paused", autoRenew: false });
      return {
        planTier: settings.planTier,
        subscriptionStatus: settings.subscriptionStatus,
        autoRenew: Boolean(settings.autoRenew),
      };
    }),
    upgradeAccount: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await updateAccountSettings(ctx.user.id, { planTier: "core", subscriptionStatus: "active", autoRenew: true });
      return {
        planTier: settings.planTier,
        subscriptionStatus: settings.subscriptionStatus,
        autoRenew: Boolean(settings.autoRenew),
      };
    }),
    downgradeAccount: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await updateAccountSettings(ctx.user.id, { planTier: "free", subscriptionStatus: "active", autoRenew: false });
      return {
        planTier: settings.planTier,
        subscriptionStatus: settings.subscriptionStatus,
        autoRenew: Boolean(settings.autoRenew),
      };
    }),
    setAutoRenew: protectedProcedure.input(z.object({ autoRenew: z.boolean() })).mutation(async ({ ctx, input }) => {
      const settings = await updateAccountSettings(ctx.user.id, { autoRenew: input.autoRenew, subscriptionStatus: input.autoRenew ? "active" : undefined });
      return {
        planTier: settings.planTier,
        subscriptionStatus: settings.subscriptionStatus,
        autoRenew: Boolean(settings.autoRenew),
      };
    }),
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteUserAccountData(ctx.user.id);
      ctx.res.clearCookie(COOKIE_NAME, getSessionCookieOptions(ctx.req));
      return { success: true as const };
    }),
  }),
  rebuild: router({
    status: publicProcedure.query(() => ({
      brand: "JIMMI",
      phase: "onboarding-rebuild",
      message: "Clean rebuild foundation is active, with onboarding as the first rebuilt module.",
    })),
    protectedStatus: protectedProcedure.query(({ ctx }) => ({
      authenticated: true,
      userId: ctx.user.id,
      role: ctx.user.role,
    })),
  }),
  coach: router({
    listEliteUsers: adminProcedure.query(async () => ({ users: await listEliteUsersForCoach() })),
    getUserCalorieBalance: adminProcedure.input(adminResetTargetInput).query(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      const balance = await getCalorieBalanceRange(input.userId, 7);
      return { userId: input.userId, balance };
    }),
    getUserFoodLogs: adminProcedure.input(adminResetTargetInput).query(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      const entries = await listFoodLogEntriesForCoach(input.userId, 14);
      return { userId: input.userId, entries };
    }),
    getUserWorkoutLogs: adminProcedure.input(adminResetTargetInput).query(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      const entries = await listExerciseLogEntriesForCoach(input.userId, 30);
      return { userId: input.userId, entries };
    }),
    overrideMacros: adminProcedure
      .input(adminResetTargetInput.extend({
        calories: z.number().int().min(0).nullable(),
        protein: z.number().int().min(0).nullable(),
        carbs: z.number().int().min(0).nullable(),
        fat: z.number().int().min(0).nullable(),
        notes: z.string().max(2000).nullable(),
      }))
      .mutation(async ({ input }) => {
        const targetUser = await getUserById(input.userId);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        const program = await coachOverrideMacros(input.userId, { calories: input.calories, protein: input.protein, carbs: input.carbs, fat: input.fat, notes: input.notes });
        return { success: true, userId: input.userId, program };
      }),
    overrideProgram: adminProcedure
      .input(adminResetTargetInput.extend({
        title: z.string().min(1).max(180),
        planJson: z.string().min(2),
      }))
      .mutation(async ({ input }) => {
        const targetUser = await getUserById(input.userId);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        const program = await coachOverrideProgram(input.userId, input.planJson, input.title);
        if (!program) throw new TRPCError({ code: "NOT_FOUND", message: "No program found for this user. Ask them to generate one first." });
        return { success: true, userId: input.userId, program };
      }),
  }),
  admin: router({
    ping: adminProcedure.query(() => ({ ok: true, role: "admin" as const })),
    users: adminProcedure.query(async () => ({ users: await listUsersForAdminManagement() })),
    setPlanTier: adminProcedure.input(adminPlanTierInput).mutation(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "That user could not be found." });
      const settings = await updateUserPlanTier(input.userId, input.planTier);
      return { success: true, userId: input.userId, planTier: settings.planTier };
    }),
    setBetaWearableConnection: adminProcedure.input(adminWearableConnectionInput).mutation(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "That user could not be found." });
      const wearable = await setBetaWearableConnection(input.userId, input.connected);
      return { success: true, userId: input.userId, wearable };
    }),
    resetProgramGeneration: adminProcedure.input(adminResetTargetInput).mutation(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "That user could not be found." });
      await resetUserProgramGeneration(input.userId);
      return { success: true, reset: "program_generation" as const, userId: input.userId };
    }),
    resetOnboarding: adminProcedure.input(adminResetTargetInput).mutation(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "That user could not be found." });
      await resetUserOnboardingState(input.userId);
      return { success: true, reset: "onboarding" as const, userId: input.userId };
    }),
  }),
  subscription: router({
    getCurrentTier: protectedProcedure.query(async ({ ctx }) => {
      // Check if user has an active Stripe subscription
      const stripeSubscription = await getStripeSubscriptionByUserId(ctx.user.id);
      
      if (stripeSubscription && stripeSubscription.status === "active") {
        return { tier: stripeSubscription.tier, source: "stripe" as const };
      }
      
      // Fall back to user.tier (free or admin-granted access)
      return { tier: ctx.user.tier, source: "database" as const };
    }),
    
    getCheckoutUrl: protectedProcedure
      .input(z.object({ tier: z.enum(["starter", "pro", "elite"]) }))
      .mutation(async ({ ctx, input }) => {
        // Prevent downgrading via Stripe (admin override only)
        const currentTier = ctx.user.tier;
        const tierOrder: Record<string, number> = { free: 0, core: 1, starter: 1, pro: 2, elite: 3 };
        if (tierOrder[input.tier] <= tierOrder[currentTier]) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot downgrade via checkout. Contact support." });
        }
        
        // Get or create Stripe customer
        let stripeCustomerId = (await getStripeCustomerByUserId(ctx.user.id))?.stripeCustomerId;
        if (!stripeCustomerId) {
          // This would normally be created during checkout, but we'll create a placeholder
          stripeCustomerId = `cus_${ctx.user.id}_${Date.now()}`;
        }
        
        // TODO: Call Stripe API to create checkout session
        // For now, return a placeholder
        return { checkoutUrl: `/stripe/checkout?tier=${input.tier}&customerId=${stripeCustomerId}` };
      }),
    
    grantBetaAccess: adminProcedure
      .input(z.object({ userId: z.number().int(), tier: z.enum(["starter", "pro", "elite"]) }))
      .mutation(async ({ input }) => {
        const targetUser = await getUserById(input.userId);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        
        // Update user tier directly (admin override)
        await updateUserPlanTier(input.userId, input.tier as "free" | "core" | "pro" | "elite");
        
        return { success: true, userId: input.userId, tier: input.tier as "starter" | "pro" | "elite", grantedAt: new Date() };
      }),
  }),
  billing: router({
    getInvoiceHistory: protectedProcedure.query(async ({ ctx }) => {
      const invoices = await getStripeInvoicesByUserId(ctx.user.id);
      return invoices.map(invoice => ({
        id: invoice.stripeInvoiceId,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        paidAt: invoice.paidAt,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        invoiceUrl: invoice.invoiceUrl,
        createdAt: invoice.createdAt,
      }));
    }),
    
    getSubscriptionHistory: protectedProcedure.query(async ({ ctx }) => {
      const subscription = await getStripeSubscriptionByUserId(ctx.user.id);
      if (!subscription) {
        return {
          currentTier: ctx.user.tier,
          status: "none",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          canceledAt: null,
        };
      }
      
      return {
        currentTier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        canceledAt: subscription.canceledAt,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
