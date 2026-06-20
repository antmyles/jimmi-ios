import { invokeLLM } from "./_core/llm";

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export type RestaurantMacroCandidate = {
  source: "restaurant";
  status: "estimate";
  restaurantName: string;
  menuItemName: string;
  foodName: string;
  serving: string;
  portion: string;
  portionMultiplier: number;
  confidence: "high" | "medium" | "low";
  dataSource: string;
  sourceNote: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  guidance: string;
  suggestion: string;
  suggestedMealType: MealType;
  clarifyingQuestions: string[];
};

export type RestaurantMacroClarification = {
  source: "restaurant";
  status: "needs_clarification";
  restaurantName?: string;
  menuItemName?: string;
  foodName: string;
  portion: string;
  confidence: "low";
  clarifyingQuestions: string[];
  guidance: string;
};

export type RestaurantMacroResult = RestaurantMacroCandidate | RestaurantMacroClarification;

type RestaurantCatalogItem = {
  restaurantName: string;
  menuItemName: string;
  aliases: string[];
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  dataSource: string;
  sourceNote: string;
  suggestedMealType: MealType;
};

const restaurantCatalog: RestaurantCatalogItem[] = [
  {
    restaurantName: "Chipotle",
    menuItemName: "Chicken Burrito",
    aliases: ["chipotle chicken burrito", "chicken burrito", "burrito with chicken"],
    serving: "1 standard chicken burrito estimate with rice, beans, cheese, salsa, and tortilla",
    calories: 945,
    protein: 57,
    carbs: 108,
    fat: 32,
    dataSource: "JIMMI restaurant starter catalog",
    sourceNote: "Representative estimate assembled for restaurant-portion math until a licensed restaurant nutrition API is connected.",
    suggestedMealType: "Lunch",
  },
  {
    restaurantName: "Chipotle",
    menuItemName: "Chicken Bowl",
    aliases: ["chipotle chicken bowl", "chicken bowl", "burrito bowl with chicken"],
    serving: "1 standard chicken bowl estimate with rice, beans, salsa, and cheese",
    calories: 700,
    protein: 54,
    carbs: 73,
    fat: 23,
    dataSource: "JIMMI restaurant starter catalog",
    sourceNote: "Representative estimate assembled for restaurant-portion math until a licensed restaurant nutrition API is connected.",
    suggestedMealType: "Lunch",
  },
  {
    restaurantName: "McDonald's",
    menuItemName: "Big Mac",
    aliases: ["mcdonalds big mac", "mcdonald's big mac", "big mac"],
    serving: "1 sandwich",
    calories: 590,
    protein: 25,
    carbs: 46,
    fat: 34,
    dataSource: "JIMMI restaurant starter catalog",
    sourceNote: "Representative restaurant-menu estimate for editable logging.",
    suggestedMealType: "Lunch",
  },
  {
    restaurantName: "Subway",
    menuItemName: "6-inch Oven Roasted Turkey Sandwich",
    aliases: ["subway turkey sandwich", "6 inch turkey subway", "six inch turkey subway", "oven roasted turkey sandwich"],
    serving: "1 6-inch sandwich estimate",
    calories: 320,
    protein: 23,
    carbs: 45,
    fat: 5,
    dataSource: "JIMMI restaurant starter catalog",
    sourceNote: "Representative restaurant-menu estimate for editable logging.",
    suggestedMealType: "Lunch",
  },
];

const restaurantNames = ["chipotle", "mcdonald", "mcdonalds", "mcdonald's", "subway", "taco bell", "wendy", "starbucks", "panera", "chick-fil-a", "chick fil a", "burger king"];
const vagueFoodWords = new Set(["food", "meal", "order", "item", "combo", "stuff", "something", "lunch", "dinner"]);

export function parseRestaurantPortion(description: string) {
  const text = description.toLowerCase();
  const compact = text.replace(/[–—]/g, "-");
  const percent = compact.match(/(?:ate\s+)?(\d{1,3})\s*%/);
  if (percent) return clampPortion(Number(percent[1]) / 100);
  if (/\b(?:one and a half|1\.5|1 1\/2)\b/.test(compact)) return 1.5;
  const fraction = compact.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (fraction && Number(fraction[2]) > 0) return clampPortion(Number(fraction[1]) / Number(fraction[2]));
  if (/\b(?:half|halve)\b/.test(compact)) return 0.5;
  if (/\b(?:quarter|one fourth|one-fourth)\b/.test(compact)) return 0.25;
  if (/\b(?:three quarters|three-quarters|3 quarters|3\/4)\b/.test(compact)) return 0.75;
  if (/\b(?:two thirds|two-thirds|2 thirds|2\/3)\b/.test(compact)) return 0.67;
  if (/\b(?:one third|one-third|1 third|1\/3)\b/.test(compact)) return 0.33;
  const multiplier = compact.match(/\b(?:ate\s+)?(?:about\s+)?(\d+(?:\.\d+)?)\s*(?:x|times|servings?|orders?|pieces?)\b/);
  if (multiplier) return clampPortion(Number(multiplier[1]));
  return 1;
}

function clampPortion(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(Math.max(Math.round(value * 100) / 100, 0.05), 5);
}

function roundMacro(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), max);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function inferRestaurantName(description: string) {
  const normalized = normalize(description);
  const match = restaurantNames.find((name) => normalized.includes(normalize(name)));
  if (!match) return "";
  if (match.startsWith("mcdonald")) return "McDonald's";
  if (match === "chick fil a") return "Chick-fil-A";
  return match.split(" ").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function isLikelyVague(description: string) {
  const tokens = normalize(description).split(" ").filter(Boolean);
  const meaningfulTokens = tokens.filter((token) => !restaurantNames.map(normalize).includes(token) && !vagueFoodWords.has(token) && !/^(ate|had|from|a|an|the|of|my|at|for|and|with|half)$/.test(token));
  return meaningfulTokens.length < 2;
}

function findCatalogItem(description: string) {
  const normalized = normalize(description);
  return restaurantCatalog.find((item) => item.aliases.some((alias) => normalized.includes(normalize(alias)))) ?? null;
}

function buildCandidate(item: RestaurantCatalogItem, description: string): RestaurantMacroCandidate {
  const portionMultiplier = parseRestaurantPortion(description);
  const portion = portionMultiplier === 1 ? "1 standard serving" : `${portionMultiplier} of a standard serving`;
  return {
    source: "restaurant",
    status: "estimate",
    restaurantName: item.restaurantName,
    menuItemName: item.menuItemName,
    foodName: `${item.restaurantName} — ${item.menuItemName}`,
    serving: item.serving,
    portion,
    portionMultiplier,
    confidence: portionMultiplier === 1 ? "medium" : "medium",
    dataSource: item.dataSource,
    sourceNote: item.sourceNote,
    calories: roundMacro(item.calories * portionMultiplier, 5000),
    protein: roundMacro(item.protein * portionMultiplier, 500),
    carbs: roundMacro(item.carbs * portionMultiplier, 800),
    fat: roundMacro(item.fat * portionMultiplier, 400),
    guidance: `I estimated this from a standard ${item.menuItemName} and adjusted it for ${portion}. Review the macros before logging.`,
    suggestion: "If your order had extras, sauces, double protein, or removed ingredients, edit the numbers before saving.",
    suggestedMealType: item.suggestedMealType,
    clarifyingQuestions: [],
  };
}

function buildClarification(description: string): RestaurantMacroClarification {
  const restaurantName = inferRestaurantName(description);
  const questions = [
    restaurantName ? "What exact menu item did you order?" : "Which restaurant or franchise was this from?",
    "How much of the item did you eat, such as all, half, one quarter, or two servings?",
    "Any major additions or removals, like double protein, cheese, sauces, rice, beans, or dressing?",
  ];
  return {
    source: "restaurant",
    status: "needs_clarification",
    restaurantName: restaurantName || undefined,
    menuItemName: undefined,
    foodName: description,
    portion: "needs portion details",
    confidence: "low",
    clarifyingQuestions: questions,
    guidance: `I need a bit more detail before I can give you a useful restaurant macro estimate. ${questions.join(" ")}`,
  };
}

function parseLlmRestaurantEstimate(content: unknown, description: string): RestaurantMacroResult {
  const raw = typeof content === "string" ? content : JSON.stringify(content ?? {});
  let parsed: Record<string, any> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, any>;
  } catch {
    return buildClarification(description);
  }
  const questions = Array.isArray(parsed.clarifyingQuestions) ? parsed.clarifyingQuestions.map((item) => String(item).trim()).filter(Boolean).slice(0, 3) : [];
  const restaurantName = typeof parsed.restaurantName === "string" ? parsed.restaurantName.trim().slice(0, 120) : inferRestaurantName(description);
  const menuItemName = typeof parsed.menuItemName === "string" ? parsed.menuItemName.trim().slice(0, 160) : "Restaurant meal";
  if (questions.length || !restaurantName || isLikelyVague(description)) return { ...buildClarification(description), clarifyingQuestions: questions.length ? questions : buildClarification(description).clarifyingQuestions };
  const portionMultiplier = clampPortion(Number(parsed.portionMultiplier) || parseRestaurantPortion(description));
  const macros = typeof parsed.macros === "object" && parsed.macros ? parsed.macros : parsed;
  return {
    source: "restaurant",
    status: "estimate",
    restaurantName,
    menuItemName,
    foodName: `${restaurantName} — ${menuItemName}`,
    serving: typeof parsed.serving === "string" ? parsed.serving.trim().slice(0, 180) : "1 standard restaurant serving estimate",
    portion: typeof parsed.portion === "string" ? parsed.portion.trim().slice(0, 120) : `${portionMultiplier} of a standard serving`,
    portionMultiplier,
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    dataSource: "JIMMI AI restaurant estimate",
    sourceNote: "Estimated from restaurant/menu context because no licensed restaurant nutrition API credentials are connected yet.",
    calories: roundMacro(Number(macros.calories), 5000),
    protein: roundMacro(Number(macros.protein), 500),
    carbs: roundMacro(Number(macros.carbs), 800),
    fat: roundMacro(Number(macros.fat), 400),
    guidance: typeof parsed.guidance === "string" ? parsed.guidance.trim().slice(0, 700) : "Review and edit this estimate before logging it.",
    suggestion: typeof parsed.suggestion === "string" ? parsed.suggestion.trim().slice(0, 500) : "Edit the macros if your portion or ingredients were different.",
    suggestedMealType: ["Breakfast", "Lunch", "Dinner", "Snack"].includes(parsed.suggestedMealType) ? parsed.suggestedMealType : "Lunch",
    clarifyingQuestions: [],
  };
}

export async function estimateRestaurantMacros(description: string, profileContext?: string): Promise<RestaurantMacroResult> {
  const cleaned = description.trim();
  if (isLikelyVague(cleaned)) return buildClarification(cleaned);
  const catalogMatch = findCatalogItem(cleaned);
  if (catalogMatch) return buildCandidate(catalogMatch, cleaned);

  const llmResponse = await invokeLLM({
    disableThinking: true,
    messages: [
      {
        role: "system",
        content: `You estimate macros for US franchise and restaurant-chain meals for editable food logging. Return JSON only. If restaurant, exact item, portion, or major ingredients are ambiguous, return clarifyingQuestions instead of guessing. Do not claim exact coverage. Use the user's profile only to keep guidance concise and safe.\n\nUser profile context:\n${profileContext || "No profile context supplied."}`,
      },
      { role: "user", content: `Restaurant meal description: ${cleaned}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "jimmi_restaurant_macro_estimate",
        strict: true,
        schema: {
          type: "object",
          properties: {
            restaurantName: { type: "string" },
            menuItemName: { type: "string" },
            serving: { type: "string" },
            portion: { type: "string" },
            portionMultiplier: { type: "number" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
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
            suggestion: { type: "string" },
            suggestedMealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack"] },
            clarifyingQuestions: { type: "array", items: { type: "string" } },
          },
          required: ["restaurantName", "menuItemName", "serving", "portion", "portionMultiplier", "confidence", "macros", "guidance", "suggestion", "suggestedMealType", "clarifyingQuestions"],
          additionalProperties: false,
        },
      },
    },
  });

  return parseLlmRestaurantEstimate(llmResponse.choices[0]?.message.content, cleaned);
}
