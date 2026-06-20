from pathlib import Path

root = Path('/home/ubuntu/jimmi-fit-recovery')
chat_path = root / 'client/src/pages/Chat.tsx'
app_path = root / 'client/src/App.tsx'

chat = chat_path.read_text()

chat = chat.replace('import { Streamdown } from "streamdown";\n', 'import { Streamdown } from "streamdown";\nimport { toast } from "sonner";\n')

chat = chat.replace(
'''  const saveScanToFoodLogMutation = trpc.foodLog.add.useMutation({
    onSuccess: (_entry, input) => {
      utils.foodLog.daily.invalidate({ logDate: input.logDate });
      setSaveScanStatusText("Saved to Food Log.");
      setMessages((current) => [...current, { role: "assistant", content: `Saved **${input.foodName}** to today’s Food Log.` }]);
    },
    onError: (error) => setSaveScanStatusText(`Could not save to Food Log. ${error.message}`),
  });
''',
'''  const saveScanToFoodLogMutation = trpc.foodLog.add.useMutation({
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
      setMessages((current) => [...current, { role: "assistant", content: `Saved **${input.foodName}** to today’s Food Log.` }]);
    },
    onError: (error) => {
      setSaveScanStatusText(`Could not save to Food Log. ${error.message}`);
      toast.error("Could not save to Food Log", {
        description: error.message,
        duration: 3200,
      });
    },
  });
''')

chat = chat.replace(
'''    if (!user) {
      setSaveScanStatusText("Sign in to save scanned foods to your Food Log.");
      return;
    }
''',
'''    if (!user) {
      setSaveScanStatusText("Sign in to save scanned foods to your Food Log.");
      toast("Sign in required", {
        description: "Sign in to save scanned foods to your Food Log.",
        duration: 2600,
      });
      return;
    }
''')

chat = chat.replace(
'''            <div ref={chatScrollRef} data-chat-auto-scroll="true" className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-2">
                <div className="space-y-2.5 pb-1">
''',
'''            <div ref={chatScrollRef} data-chat-auto-scroll="true" data-chat-scroll-touch-enabled="true" className="min-h-0 flex-1 overflow-hidden touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
              <ScrollArea className="h-full pr-2 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
                <div className="space-y-2.5 pb-4 touch-pan-y">
''')

chat = chat.replace(
'''                    <article key={`${message.role}-${index}`} className={`max-w-[94%] rounded-[1.1rem] border px-3 py-2 text-xs leading-5 md:max-w-[82%] ${message.role === "user" ? "ml-auto border-white/10 bg-white text-black" : "border-white/[0.08] bg-white/[0.045] text-white/78"}`}>
''',
'''                    <article key={`${message.role}-${index}`} data-chat-message-card={message.role === "assistant" ? "jimmi-response-scroll-readable" : "user-message"} className={`max-w-[94%] rounded-[1.1rem] border px-3 py-2 text-xs leading-5 break-words md:max-w-[82%] ${message.role === "user" ? "ml-auto border-white/10 bg-white text-black" : "border-white/[0.08] bg-white/[0.045] text-white/78"}`}>
''')

chat = chat.replace(
'''                      {message.role === "assistant" ? <div className="prose prose-sm prose-invert max-w-none text-xs leading-5"><Streamdown>{message.content}</Streamdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
''',
'''                      {message.role === "assistant" ? <div data-chat-assistant-response-body="scroll-readable" className="prose prose-sm prose-invert max-w-none overflow-visible break-words text-xs leading-5 [&_*]:break-words"><Streamdown>{message.content}</Streamdown></div> : <p className="whitespace-pre-wrap break-words">{message.content}</p>}
''')

chat = chat.replace(
'''          {(scanStatusText || activeFoodScan || programScanResult) ? (
            <section data-chat-smart-scan-results="food-program-barcode" className="mt-2 shrink-0 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-3 text-xs text-white/70">
              {scanStatusText ? <p className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary" />{scanStatusText}</p> : null}
              {activeFoodScan ? (
                <div data-chat-save-scan-to-food-log="available" className="mt-2 rounded-2xl bg-black/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{activeFoodScan.foodName}</p><p className="mt-1 text-white/50">{activeFoodScan.serving ?? activeFoodScan.portion ?? "Estimated serving"} · {activeFoodScan.confidence ?? "estimated"}</p></div><Button type="button" size="sm" onClick={handleSaveFoodScanToLog} disabled={saveScanToFoodLogMutation.isPending} className="rounded-full bg-primary text-primary-foreground"><Save className="mr-1.5 size-3.5" /> Save to Food Log</Button></div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5 text-center"><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.calories}<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Cal</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.protein}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Protein</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.carbs}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Carbs</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.fat}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Fat</b></span></div>
                  <p className="mt-2 text-white/58">{activeFoodScan.guidance}</p>{activeFoodScan.suggestion ? <p className="mt-1 text-white/58">{activeFoodScan.suggestion}</p> : null}{saveScanStatusText ? <p className="mt-2 font-medium text-primary">{saveScanStatusText}</p> : null}
                </div>
              ) : null}
              {programScanResult ? <div className="mt-2 rounded-2xl bg-black/30 p-3"><p className="font-medium text-white">{programScanResult.title}</p><p className="mt-1 text-white/58">{programScanResult.summary}</p>{programScanResult.suggestions.length ? <ul className="mt-2 list-disc space-y-1 pl-4">{programScanResult.suggestions.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div> : null}
            </section>
          ) : null}
''',
'''          {(scanStatusText || activeFoodScan || programScanResult) ? (
            <section data-chat-smart-scan-results="food-program-barcode" data-chat-scan-result-scrollable="true" className="mt-2 max-h-[32svh] shrink-0 overflow-y-auto overscroll-contain rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-3 text-xs text-white/70 touch-pan-y [-webkit-overflow-scrolling:touch] md:max-h-[38svh]" tabIndex={0} aria-label="JIMMI scan result details">
              {scanStatusText ? <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{scanStatusText}</p> : null}
              {activeFoodScan ? (
                <div data-chat-save-scan-to-food-log="available" className="mt-2 rounded-2xl bg-black/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium text-white">{activeFoodScan.foodName}</p><p className="mt-1 break-words text-white/50">{activeFoodScan.serving ?? activeFoodScan.portion ?? "Estimated serving"} · {activeFoodScan.confidence ?? "estimated"}</p></div><Button type="button" size="sm" onClick={handleSaveFoodScanToLog} disabled={saveScanToFoodLogMutation.isPending} data-save-food-log-success-popup="sonner" className="rounded-full bg-primary text-primary-foreground"><Save className="mr-1.5 size-3.5" /> {saveScanToFoodLogMutation.isPending ? "Saving..." : "Save to Food Log"}</Button></div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5 text-center"><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.calories}<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Cal</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.protein}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Protein</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.carbs}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Carbs</b></span><span className="rounded-xl bg-white/[0.055] px-2 py-1.5">{activeFoodScan.fat}g<br /><b className="font-mono text-[0.52rem] uppercase text-white/40">Fat</b></span></div>
                  <div data-chat-scan-guidance-scroll-readable="true" className="mt-2 max-h-[9.5rem] overflow-y-auto overscroll-contain pr-1 text-white/58 touch-pan-y [-webkit-overflow-scrolling:touch]"><p className="break-words">{activeFoodScan.guidance}</p>{activeFoodScan.suggestion ? <p className="mt-1 break-words">{activeFoodScan.suggestion}</p> : null}</div>{saveScanStatusText ? <p className="mt-2 font-medium text-primary" role="status">{saveScanStatusText}</p> : null}
                </div>
              ) : null}
              {programScanResult ? <div className="mt-2 rounded-2xl bg-black/30 p-3"><p className="font-medium text-white">{programScanResult.title}</p><p className="mt-1 text-white/58">{programScanResult.summary}</p>{programScanResult.suggestions.length ? <ul className="mt-2 list-disc space-y-1 pl-4">{programScanResult.suggestions.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div> : null}
            </section>
          ) : null}
''')

chat_path.write_text(chat)

app = app_path.read_text()
app = app.replace('import FoodLog from "@/pages/FoodLog";\n', 'import FoodLog from "@/pages/FoodLog";\nimport { Toaster } from "@/components/ui/sonner";\n')
app = app.replace(
'''    <ThemeProvider defaultTheme="dark">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/chat" component={Chat} />
        <Route path="/profile" component={Profile} />
        <Route path="/training-plan" component={TrainingPlan} />
        <Route path="/meal-plan" component={MealPlan} />
        <Route path="/food-log" component={FoodLog} />
        <Route component={NotFound} />
      </Switch>
    </ThemeProvider>
''',
'''    <ThemeProvider defaultTheme="dark">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/chat" component={Chat} />
        <Route path="/profile" component={Profile} />
        <Route path="/training-plan" component={TrainingPlan} />
        <Route path="/meal-plan" component={MealPlan} />
        <Route path="/food-log" component={FoodLog} />
        <Route component={NotFound} />
      </Switch>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
''')
app_path.write_text(app)
