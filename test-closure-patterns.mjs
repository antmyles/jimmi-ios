// Reproduce the exact patterns from routers.ts
const normalizeUserMessageForRouting = (msg) => {
  return msg.toLowerCase().replace(/[^\w\s']/g, "").trim();
};

const casualGreetingPattern = /^(hey|hi|hello|yo|sup|what'?s up|howdy|hiya|greetings|good morning|good afternoon|good evening|morning|afternoon|evening|good day)[\s,!.]*$/i;
const helpDeclinePattern = /^(no|nah|nope|not really|no thanks|no thank you|nothing|nothing else|nothing for now|that'?s (all|it|good|fine|everything)|i'?m (good|fine|all set|done|okay|ok)|all good|all set|i'?m set|no more|no need|i'?m done|done for now|that'?s all i needed|i think (that'?s all|i'?m good)|thanks? (that'?s all|i'?m good)|no i'?m good|no i'?m fine|i'?m okay|i'?m alright|that will do|that'?ll do|i'?m satisfied|no more questions|no further questions|that covers it|that'?s enough|enough for now|i'?m set for now|we'?re good|we'?re done|i think (we'?re|that'?s) (good|done|all)|i'?m (all done|all good|all set))[\s,!.]*$/i;
const gratitudePattern = /^(thanks?|thank you|thx|ty|cheers|appreciate it|much appreciated|thanks? (a lot|so much|very much|a bunch|a ton|a million|for (that|this|everything|the help|your help|the info|the information|the advice|the tip|the tips|the suggestion|the suggestions|the recommendation|the recommendations))|thank you (so much|very much|for (that|this|everything|the help|your help|the info|the information|the advice|the tip|the tips|the suggestion|the suggestions|the recommendation|the recommendations)))([\s,!.]*|[\s,!.]*(jimmi|coach)[\s,!.]*)$/i;

// Also check the allowedTopicPattern
const allowedTopicPattern = /train|workout|exercise|lift|gym|cardio|run|jog|walk|swim|sport|athlet|fitness|strength|muscle|weight|fat|calor|protein|carb|macro|nutri|meal|food|eat|diet|sleep|recover|rest|stress|hydrat|water|supplement|vitamin|mineral|health|wellness|body|physi|perform|endur|flex|mobil|stretch|injury|pain|soreness|energy|stamina|progress|goal|program|plan|schedule|routine|set|rep|interval|hiit|yoga|pilates|crossfit|powerl|bodybuild|marathon|triathlon|cycling|rowing|jump|sprint|warm.?up|cool.?down|form|technique|posture|breath|heart.?rate|vo2|bmi|tdee|bmr|deficit|surplus|bulk|cut|lean|tone|shred|gain|lose|drop|increase|improve|track|log|record|measure|weigh|scan|barcode|food.?log|meal.?log|workout.?log|exercise.?log|coach|coaching|advice|tip|suggest|recommend|help|support|motivat|accountab|habit|consist|disciplin|mindset|mental|focus|concentrat|stress|anxiety|depress|mood|emotion|feel|energy|fatigue|tired|exhaust|recover|heal|rehab|injury|pain|ache|sore|tight|stiff|cramp|spasm|inflam|swell|bruise|strain|sprain|tear|fracture|surgery|medical|doctor|physician|therapist|dietitian|nutritionist|personal.?trainer|coach|mentor|guide|plan|program|routine|schedule|workout|session|class|group|team|partner|buddy|friend|family|community|support|motivat|inspir|challeng|goal|target|milestone|achievement|progress|result|outcome|success|fail|setback|plateau|break|rest|recover|deload|taper|peak|compete|race|event|game|match|tournament|championship|record|personal.?best|pb|pr|max|1rm|rep.?max|bench|squat|deadlift|press|pull|push|row|curl|extension|fly|raise|lunge|step|jump|box|sled|band|cable|dumbbell|barbell|kettlebell|machine|free.?weight|bodyweight|resistance|load|volume|intensity|frequency|density|tempo|speed|pace|distance|time|duration|minute|hour|day|week|month|year|season|cycle|phase|block|period|mesocycle|macrocycle|microcycle|periodiz|progress|overload|adapt|plateau|deload|taper|peak|supercompensation|recovery|regeneration|restoration|repair|rebuild|remodel|adapt|grow|develop|improve|enhance|optimize|maximize|minimize|reduce|increase|maintain|sustain|preserve|protect|prevent|avoid|manage|control|monitor|track|measure|assess|evaluate|test|screen|diagnose|treat|rehabilitat|recover|heal|restore|rebuild|strengthen|stabilize|mobilize|activate|engage|contract|relax|stretch|lengthen|shorten|flex|extend|rotate|abduct|adduct|pronate|supinate|dorsiflex|plantarflex|invert|evert|circumduct|note|remember|save|record|log|track|remind|memo|jot|write down/i;

const testMessages = [
  "Note this.",
  "Nothing, that's it.",
  "Nothing, that's it",
  "Note this",
  "No that's it",
  "No thank you",
  "I'm done",
  "That's all",
  "No more",
  "I'm good",
];

for (const msg of testMessages) {
  const normalized = normalizeUserMessageForRouting(msg);
  const casualGreeting = casualGreetingPattern.test(normalized);
  const helpDecline = helpDeclinePattern.test(normalized);
  const gratitude = gratitudePattern.test(normalized);
  const allowedTopic = allowedTopicPattern.test(normalized);
  
  // Simulate the routing logic
  let result = "→ GOES TO LLM";
  if (casualGreeting) result = "→ CASUAL GREETING SHORT-CIRCUIT";
  else if (helpDecline) result = "→ HELP DECLINE SHORT-CIRCUIT";
  else if (gratitude) result = "→ GRATITUDE SHORT-CIRCUIT";
  else if (!allowedTopic) result = "→ OFF-TOPIC SCOPE REDIRECT (BUG!)";
  
  console.log(`"${msg}" ${result}`);
  if (!allowedTopic && !casualGreeting && !helpDecline && !gratitude) {
    console.log(`  normalized: "${normalized}"`);
  }
}
