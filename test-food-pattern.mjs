const foodLogIntentTriggerPattern = /\b(ate|had|eat|eaten|eating|drank|drink|drinking|just had|just ate|just drank|for breakfast|for lunch|for dinner|for a snack|log (?:this|that|my|a|an)|please log|can you log|add (?:this|that|my) to|save (?:this|that) to|record (?:this|that)|track (?:this|that)|i had|i ate|i drank)\b/i;

const msgs = [
  'What should I have for lunch',
  'What should I have for lunch?',
  'what should i have for lunch',
  'What should I eat for lunch',
  'Lunch ideas',
  'What is a good lunch',
  'give me a meal plan',
  'suggest a meal',
  'I had chicken wings for dinner',
  'I ate a protein bar',
];

for (const msg of msgs) {
  const match = msg.match(foodLogIntentTriggerPattern);
  console.log(JSON.stringify(msg), '->', foodLogIntentTriggerPattern.test(msg), match ? `(matched: "${match[0]}")` : '');
}
