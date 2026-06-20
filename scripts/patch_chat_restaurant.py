from pathlib import Path

path = Path('/home/ubuntu/jimmi-fit-recovery/client/src/pages/Chat.tsx')
text = path.read_text()

def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'Missing patch target: {label}')
    text = text.replace(old, new, 1)

replace_once('import { Button } from "@/components/ui/button";\n', '''import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
''', 'ui imports')

replace_once('''type SmartFoodScanResult = {
  source: "camera" | "barcode";
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
};
''', '''type SmartFoodScanResult = {
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
''', 'scan result type')

replace_once('''function scanResultMessage(result: SmartFoodScanResult) {
  const context = result.source === "camera" ? "from your photo" : "from that barcode";
  return `I identified **${result.foodName}** ${context}. Here are the estimated macros and guidance. You can keep chatting with me below, or save it to your Food Log if it looks right.`;
}
''', '''function scanResultMessage(result: SmartFoodScanResult) {
  const context = result.source === "camera" ? "from your photo" : result.source === "barcode" ? "from that barcode" : "from your restaurant description";
  return `I identified **${result.foodName}** ${context}. Here are the estimated macros and guidance. Review and edit the numbers before saving it to your Food Log.`;
}

function isLikelyRestaurantMacroRequest(content: string) {
  const normalized = content.toLowerCase();
  const hasRestaurantName = /\\b(chipotle|mcdonald|mcdonalds|mcdonald[’']s|subway|taco bell|wendy[’']s|wendys|starbucks|panera|chick-fil-a|chick fil a|burger king|restaurant|franchise)\\b/.test(normalized);
  const hasEatingIntent = /\\b(ate|had|ordered|got|food|meal|burrito|bowl|sandwich|burger|wrap|salad|pizza|taco|breakfast|lunch|dinner|snack|calorie|macro|protein|carbs|fat)\\b/.test(normalized);
  return hasRestaurantName && hasEatingIntent;
}

function toPositiveIntInput(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}
''', 'scan result message helper')

replace_once('''  const [scanStatusText, setScanStatusText] = useState("");
  const [saveScanStatusText, setSaveScanStatusText] = useState("");
''', '''  const [scanStatusText, setScanStatusText] = useState("");
  const [saveScanStatusText, setSaveScanStatusText] = useState("");
  const [foodLogReviewDraft, setFoodLogReviewDraft] = useState<FoodLogReviewDraft | null>(null);
''', 'review draft state')

barcode_block = '''  const barcodeScanMutation = trpc.chat.scanBarcode.useMutation({
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
        setMessages((current) => [...current, { role: "assistant", content: fallbackMessage }]);
        return;
      }
      const nextResult: SmartFoodScanResult = { source: "barcode", foodName: result.foodName, serving: result.serving, calories: result.macros.calories, protein: result.macros.protein, carbs: result.macros.carbs, fat: result.macros.fat, guidance: result.guidance, suggestion: result.suggestion, suggestedMealType: result.suggestedMealType };
      setActiveFoodScan(nextResult);
      setProgramScanResult(null);
      setScanStatusText("Product identified. JIMMI found relevant macro information and personalized guidance for your goals.");
      setMessages((current) => [...current, { role: "assistant", content: scanResultMessage(nextResult), scanResult: nextResult }]);
    },
    onError: (error) => {
      setOrbVoiceState("idle");
      setActiveFoodScan(null);
      setScanStatusText(`JIMMI could not read that barcode. Explain the food or nutrition label details for macro and fitness insights. ${error.message}`);
      setMessages((current) => [...current, { role: "assistant", content: `I could not identify that barcode yet. Tell me the product name, serving size, and nutrition label details, and I can still calculate macros with fitness insights. ${error.message}` }]);
    },
  });
'''
restaurant_block = barcode_block + '''
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
      if (result.status === "needs_clarification") {
        const questions = result.clarifyingQuestions.map((question) => `- ${question}`).join("\\n");
        setScanStatusText("JIMMI needs a few details before estimating that restaurant meal.");
        setMessages((current) => [...current, { role: "assistant", content: `${result.guidance}\\n\\n${questions}` }]);
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
      setMessages((current) => [...current, { role: "assistant", content: scanResultMessage(nextResult), scanResult: nextResult }]);
    },
    onError: (error) => {
      setOrbVoiceState("idle");
      setScanStatusText(`JIMMI could not estimate that restaurant meal yet. ${error.message}`);
      setMessages((current) => [...current, { role: "assistant", content: `I could not estimate that restaurant meal yet. Tell me the restaurant, exact menu item, portion eaten, and any major customizations, and I’ll try again. ${error.message}` }]);
    },
  });
'''
replace_once(barcode_block, restaurant_block, 'restaurant mutation')

replace_once('''    if (!trimmedContent || chatMutation.isPending) return;

    const nextMessages: ChatThreadMessage[] = [...messages, { role: "user", content: trimmedContent }];
''', '''    if (!trimmedContent || chatMutation.isPending || restaurantMealEstimateMutation.isPending) return;

    const nextMessages: ChatThreadMessage[] = [...messages, { role: "user", content: trimmedContent }];
''', 'send pending guard')

replace_once('''    if (isLocalFallback && profile) {
''', '''    if (user && isLikelyRestaurantMacroRequest(trimmedContent)) {
      textThinkingStartedAtRef.current = Date.now();
      setOrbVoiceState("thinking");
      setOrbStatusText("JIMMI is checking restaurant macros and portion math.");
      restaurantMealEstimateMutation.mutate({ description: trimmedContent });
      return;
    }

    if (isLocalFallback && profile) {
''', 'restaurant routing')

replace_once('''  }, [chatMutation, isLocalFallback, messages, profile, speakJimmiResponse, user]);
''', '''  }, [chatMutation, isLocalFallback, messages, profile, restaurantMealEstimateMutation, speakJimmiResponse, user]);
''', 'send deps')

replace_once('''  const handleSaveFoodScanToLog = useCallback((scanResult = activeFoodScan) => {
    if (!scanResult) return;
    if (!user) {
      setSaveScanStatusText("Sign in to save scanned foods to your Food Log.");
      toast("Sign in required", {
        description: "Sign in to save scanned foods to your Food Log.",
        duration: 2600,
      });
      return;
    }
    saveScanToFoodLogMutation.mutate({
      logDate: todayLocalDate(),
      mealType: scanResult.suggestedMealType ?? "Snack",
      foodName: scanResult.foodName,
      calories: scanResult.calories,
      protein: scanResult.protein,
      carbs: scanResult.carbs,
      fat: scanResult.fat,
      notes: `Added from JIMMI ${scanResult.source} scan. Serving: ${scanResult.serving ?? scanResult.portion ?? "estimated"}.`,
    });
  }, [activeFoodScan, saveScanToFoodLogMutation, user]);
''', '''  const handleReviewFoodScanBeforeLog = useCallback((scanResult = activeFoodScan) => {
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
''', 'review handlers')

replace_once('onClick={() => handleSaveFoodScanToLog(message.scanResult)} disabled={saveScanToFoodLogMutation.isPending}', 'onClick={() => handleReviewFoodScanBeforeLog(message.scanResult)} disabled={saveScanToFoodLogMutation.isPending}', 'review button handler')
replace_once('{saveScanToFoodLogMutation.isPending ? "Saving..." : "Save to Food Log"}', '{saveScanToFoodLogMutation.isPending ? "Saving..." : "Review & save"}', 'review button label')
replace_once('{message.scanResult.suggestion ? <p className="mt-1 break-words">{message.scanResult.suggestion}</p> : null}</div>', '{message.scanResult.suggestion ? <p className="mt-1 break-words">{message.scanResult.suggestion}</p> : null}{message.scanResult.sourceNote ? <p className="mt-1 break-words text-white/42">{message.scanResult.sourceNote}</p> : null}</div>', 'source note display')
replace_once('disabled={!canSubmitChat}', 'disabled={!canSubmitChat || restaurantMealEstimateMutation.isPending}', 'submit disabled')

dialog = '''
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
'''
replace_once('''          <form onSubmit={handleChatSubmit}''', dialog + '\n          <form onSubmit={handleChatSubmit}', 'review dialog')

path.write_text(text)
print('patched Chat.tsx restaurant review flow')
