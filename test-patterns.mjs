const casualGreetingPattern = /^(hi|hello|hey|yo|good\s*morning|good\s*afternoon|good\s*evening|what's up|whats up|sup)(?:[\s,]+(?:jimmi|jimmy|coach|there))?[.!\s]*$/i;
const lowContentCheckInPattern = /^(?:just\s+)?(?:test|testing|checking|check|test message|this is a test)(?:[\s,]+(?:jimmi|jimmy|coach|there))?[.!\s]*$/i;
const gratitudeOnlyPattern = /^(?:(?:ok(?:ay)?\s+)?(?:thanks|thank\s+you|thank\s+u|appreciate\s+(?:it|you)|much\s+appreciated|perfect\s+thanks|cool\s+thanks|great\s+thanks|sounds\s+good\s+thanks|got\s+it\s+thanks|alright\s+thanks|all\s+good\s+thanks)(?:[\s,]+(?:jimmi|jimmy|coach|man|bro|sir|there))?|(?:thanks|thank\s+you)[\s,]+(?:jimmi|jimmy|coach))(?:[.!\s]*)$/i;
const helpDeclinePattern = /^(?:(?:no|nope|nah)(?:\s+(?:thanks|thank\s+you|thank\s+u))?|(?:no|nope|nah)\s+(?:(?:that's|thats)|that\s+is)\s+(?:it|all)(?:\s+(?:thanks|thank\s+you|thank\s+u))?|(?:nothing(?:\s+(?:else|more|right\s+now|at\s+(?:the\s+)?moment|for\s+now|today))?|not\s+right\s+now|right\s+now|all\s+set|i(?:'|\s+a)?m\s+good|im\s+good|(?:that's|thats)\s+(?:it|all)|that\s+is\s+(?:it|all))(?:\s+(?:thanks|thank\s+you|thank\s+u))?)(?:\s+(?:jimmi|jimmy|coach|man|bro|sir|there))?$/i;

const allowedTopicPattern = /\b(fitness|fit|workout|training|train|exercise|strength|cardio|conditioning|mobility|stretch|flexibility|warmup|cooldown|recovery|recover|wellness|health|healthy|nutrition|nutrient|macro|macros|protein|carb|fat|calorie|calories|meal|diet|food|foods|allergy|allergies|hydration|water|sleep|stress|weight|muscle|body|injury|pain|soreness|heart|blood|diabetes|cholesterol|vitamin|supplement|steps|walking|running|run|gym|lift|lifting|program|routine|habit|energy|motivation|consistency|goal|goals|plateau|metabolism|fasting|meal prep|posture|log|logged|logging|track|tracked|tracking|ate|eaten|eat|eating|had|drink|drank|drinking|breakfast|lunch|dinner|snack|snacks|chicken|beef|fish|rice|pasta|bread|salad|fruit|vegetable|vegetables|burger|pizza|wings|fries|sandwich|wrap|smoothie|shake|coffee|juice|soda|water|milk|yogurt|oats|eggs|steak|turkey|pork|lamb|shrimp|salmon|tuna|avocado|nuts|beans|lentils|soup|bowl|plate|portion|serving|ounce|oz|gram|grams|cup|cups|slice|piece|pieces|can|can you log|please log|add to my log|add this to|save this|record this|i had|i ate|i drank|i just had|just ate|just had|for breakfast|for lunch|for dinner|for a snack)\b/i;

const msgs = [
  'What should I have for lunch',
  'What should I have for lunch?',
  'what should i have for lunch',
  'What should I eat for lunch',
  'Lunch ideas',
  'What is a good lunch',
  'give me a meal plan',
  'suggest a meal',
];

for (const msg of msgs) {
  console.log('MSG:', JSON.stringify(msg));
  console.log('  casual greeting:', casualGreetingPattern.test(msg));
  console.log('  low content:', lowContentCheckInPattern.test(msg));
  console.log('  gratitude:', gratitudeOnlyPattern.test(msg));
  console.log('  help decline:', helpDeclinePattern.test(msg));
  console.log('  allowed topic:', allowedTopicPattern.test(msg));
  console.log();
}
