const foodLogIntentTriggerPattern = /\b(just had|just ate|just drank|i had|i ate|i drank|had a|had some|ate a|ate some|drank a|drank some|log (?:this|that|my|a|an)|please log|can you log|add (?:this|that|my) to|save (?:this|that) to|record (?:this|that)|track (?:this|that))\b/i;
const foodLogQuestionPrefixPattern = /^\s*(?:what|how|can|could|should|would|why|when|where|who|which|is|are|do|does|did|will|give me|suggest|recommend|tell me|help me|show me)/i;

const tests = [
  ['What should I have for lunch', false],
  ['What should I have for lunch?', false],
  ['what should i have for lunch', false],
  ['What should I eat for lunch', false],
  ['Can you suggest a meal plan', false],
  ['How many calories should I eat', false],
  ['Should I eat more protein', false],
  ['What is a good pre-workout meal', false],
  ['I had chicken wings for dinner', true],
  ['I ate a protein bar', true],
  ['just had a shake', true],
  ['had a burger for lunch', true],
  ['log this meal', true],
  ['please log my breakfast', true],
  ['I just had oatmeal', true],
  ['ate some rice and chicken', true],
  ['drank a protein shake', true],
];

let pass = 0, fail = 0;
for (const [msg, expected] of tests) {
  const triggerFires = foodLogIntentTriggerPattern.test(msg);
  const questionSkip = foodLogQuestionPrefixPattern.test(msg);
  const wouldCallLLM = triggerFires && (questionSkip === false);
  const ok = wouldCallLLM === expected;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(msg), '->', wouldCallLLM, '(expected:', expected + ')');
  if (ok) pass++; else fail++;
}
console.log('\n' + pass + ' pass, ' + fail + ' fail');
