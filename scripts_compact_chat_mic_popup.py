from pathlib import Path

root = Path('/home/ubuntu/jimmi-fit-recovery')
chat = root / 'client/src/pages/Chat.tsx'
onboarding = root / 'client/src/pages/Onboarding.tsx'

chat_text = chat.read_text()
chat_text = chat_text.replace('import { Info, Loader2, Mic, Plus, Send, X } from "lucide-react";', 'import { Info, Loader2, Plus, Send } from "lucide-react";')
chat_text = chat_text.replace('type MicPromptStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "dismissed";', 'type MicPromptStatus = "idle" | "granted" | "denied" | "unsupported";')
chat_text = chat_text.replace('  const [micPromptStatus, setMicPromptStatus] = useState<MicPromptStatus>("idle");', '  const [, setMicPromptStatus] = useState<MicPromptStatus>("idle");')
start = chat_text.index('  const handleEnableMic = async () => {')
end = chat_text.index('\n\n  const handleOrbTap = useCallback(async () => {', start)
chat_text = chat_text[:start] + chat_text[end+2:]
chat_text = chat_text.replace('  const showMicPrompt = micPromptStatus === "idle" || micPromptStatus === "requesting" || micPromptStatus === "denied" || micPromptStatus === "unsupported";\n', '')
old_return = chat_text[chat_text.index('  return (\n    <main className="min-h-screen bg-background text-foreground">', chat_text.index('  return (')):chat_text.rindex('\n  );\n}')+6]
new_return = '''  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="container flex h-screen flex-col py-4 md:py-5">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <Link href="/" className="font-display text-xl font-light tracking-[0.24em] md:text-2xl">JIMMI</Link>
          <nav className="flex items-center gap-2 text-xs md:text-sm">
            <Link href="/training-plan" className="hidden rounded-full border border-white/10 px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-primary sm:inline-flex">Training</Link>
            <Link href="/meal-plan" className="hidden rounded-full border border-white/10 px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-primary sm:inline-flex">Meals</Link>
            <MemberMenu memberName={profile.firstName} isLocalFallback={isLocalFallback} />
          </nav>
        </header>

        <div className="mx-auto mt-3 flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-[1.85rem] border border-white/10 bg-black/84 px-3 py-3 shadow-2xl shadow-black/60 backdrop-blur md:mt-4 md:px-5 md:py-4">
          <section aria-label="JIMMI chat transcription" className="flex min-h-0 shrink basis-[31vh] flex-col rounded-[1.45rem] border border-white/[0.08] bg-white/[0.022] p-3 md:basis-[29vh] md:p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[0.56rem] uppercase tracking-[0.28em] text-white/38">Chat transcription</p>
                <h1 className="mt-1 truncate font-display text-2xl font-light uppercase tracking-[0.08em] text-white md:text-3xl">Hey {profile.firstName}</h1>
                <p className="mt-1 line-clamp-2 max-w-2xl text-[0.68rem] leading-5 text-white/38">Your profile details are stored in Profile from the member menu. Your detailed information stays in Profile while this page keeps the conversation focused and clean.</p>
              </div>
              <div className="hidden shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-white/45 sm:inline-flex">Online</div>
            </div>

            <ScrollArea className="min-h-0 flex-1 pr-2">
              <div className="space-y-2.5 pb-1">
                {displayMessages.length === 0 ? (
                  <div className="pt-1 text-xs leading-6 text-white/58">Ask JIMMI a fitness, wellness, health, or nutrition question.</div>
                ) : (
                  displayMessages.map((message, index) => (
                    <article key={`${message.role}-${index}`} className={`max-w-[94%] rounded-[1.1rem] border px-3 py-2 text-xs leading-5 md:max-w-[82%] ${message.role === "user" ? "ml-auto border-white/10 bg-white text-black" : "border-white/[0.08] bg-white/[0.045] text-white/78"}`}>
                      <p className="mb-1 font-mono text-[0.52rem] uppercase tracking-[0.22em] text-current opacity-45">{message.role === "user" ? "You" : "JIMMI"}</p>
                      {message.role === "assistant" ? <div className="prose prose-sm prose-invert max-w-none text-xs leading-5"><Streamdown>{message.content}</Streamdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
                    </article>
                  ))
                )}
                {isChatSending ? (
                  <article className="inline-flex items-center gap-2 rounded-[1.1rem] border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-xs text-white/62">
                    <Loader2 className="size-3.5 animate-spin" /> JIMMI is thinking...
                  </article>
                ) : null}
              </div>
            </ScrollArea>

            {displayMessages.length <= 1 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {["Simple workout plan", "Post-training meal", "Recovery this week"].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => handleSendMessage(prompt)} disabled={chatMutation.isPending} className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-left text-[0.65rem] leading-4 text-white/58 transition hover:border-white/20 hover:bg-white/[0.065] hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section aria-label="JIMMI voice visual" className="flex shrink-0 flex-col items-center px-2 py-3 md:py-4">
            <button
              type="button"
              onClick={handleOrbTap}
              onPointerDown={() => setOrbPressed(true)}
              onPointerUp={() => setOrbPressed(false)}
              onPointerLeave={() => setOrbPressed(false)}
              aria-label={`JIMMI original video particle visual. ${orbInstruction}.`}
              aria-pressed={orbVoiceState === "listening"}
              className={`group relative flex w-[min(58vw,15.5rem)] cursor-pointer items-center justify-center rounded-full bg-black outline-none transition duration-300 focus-visible:ring-2 focus-visible:ring-white/60 md:w-[min(34vh,17rem)] ${orbPressed ? "scale-95" : "scale-100"}`}
            >
              <span className="absolute inset-[-10%] rounded-full bg-white/[0.035] blur-3xl" />
              <JimmiOrb orbState={visualOrbState} lastMessageTopic={lastMessageTopic} size="hero" />
            </button>
            <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-[0.28em] text-white/52">{orbStateLabel}</p>
            <p className="mt-1 max-w-sm text-center text-[0.68rem] leading-5 text-white/38">{orbStatusText}</p>
            {voiceTranscript ? <p className="mt-2 max-w-md rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-center text-[0.68rem] text-white/70">“{voiceTranscript}”</p> : null}
          </section>

          {!profile.tourSeen ? (
            <div className="mb-2 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3">
              <div className="flex gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-white/50" />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-light tracking-tight text-white">Quick tour</h2>
                  <p className="mt-1 text-xs leading-5 text-white/48">Use Chat for concise coaching, Profile for your baseline, and plans for training or meals.</p>
                  <Button disabled={!isLocalFallback && markTourSeen.isPending} onClick={() => {
                    if (isLocalFallback) {
                      const nextProfile = { ...profile, tourSeen: true };
                      window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
                      setLocalProfile(nextProfile);
                      return;
                    }
                    markTourSeen.mutate();
                  }} className="mt-2 h-8 rounded-full bg-white px-4 text-xs text-black hover:bg-white/90">Got it</Button>
                </div>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleChatSubmit} className="flex shrink-0 items-end gap-2 rounded-full border border-white/10 bg-white/[0.055] p-1.5 pl-2.5 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
            <button type="button" aria-label="Add attachment" className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-black/50 text-white/50 transition hover:text-white">
              <Plus className="size-4" />
            </button>
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message JIMMI..."
              rows={1}
              className="min-h-9 flex-1 resize-none bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/34"
            />
            <Button type="submit" size="icon" disabled={!canSubmitChat} className="mb-0.5 size-9 shrink-0 rounded-full bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/35">
              {chatMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );'''
chat_text = chat_text.replace(old_return, new_return)
chat.write_text(chat_text)

onb_text = onboarding.read_text()
onb_text = onb_text.replace('import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";', 'import { ArrowLeft, ArrowRight, Loader2, Mic } from "lucide-react";')
onb_text = onb_text.replace('import { Button } from "@/components/ui/button";\n', 'import { Button } from "@/components/ui/button";\nimport { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";\n')
onb_text = onb_text.replace('type OnboardingForm = {', 'type MicSetupStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";\n\ntype OnboardingForm = {')
onb_text = onb_text.replace('  const [pendingAuthSubmit, setPendingAuthSubmit] = useState(() => localStorage.getItem(PENDING_SUBMIT_KEY) === "true");', '  const [pendingAuthSubmit, setPendingAuthSubmit] = useState(() => localStorage.getItem(PENDING_SUBMIT_KEY) === "true");\n  const [showMicSetup, setShowMicSetup] = useState(false);\n  const [micSetupStatus, setMicSetupStatus] = useState<MicSetupStatus>("idle");')
onb_text = onb_text.replace('      setLocation("/chat");', '      setShowMicSetup(true);')
onb_text = onb_text.replace('      setLocation("/chat?localOnboarding=1");\n      return;', '      setShowMicSetup(true);\n      return;')
onb_text = onb_text.replace('      setLocation("/chat?localOnboarding=1");', '      setShowMicSetup(true);')
insert_after = '''  useEffect(() => {
    if (!draftLoaded || !pendingAuthSubmit || loading || user || completeMutation.isPending) return;
    const fallbackTimer = window.setTimeout(() => {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(buildLocalProfile(form)));
      localStorage.removeItem(PENDING_SUBMIT_KEY);
      setPendingAuthSubmit(false);
      setShowMicSetup(true);
    }, 1200);
    return () => window.clearTimeout(fallbackTimer);
  }, [completeMutation.isPending, draftLoaded, form, loading, pendingAuthSubmit, setLocation, user]);
'''
if insert_after not in onb_text:
    raise SystemExit('Expected fallback useEffect not found after replacements')
helpers = '''
  const enterChatAfterMicSetup = () => {
    setShowMicSetup(false);
    setLocation(user ? "/chat" : "/chat?localOnboarding=1");
  };

  const requestMicrophoneAndEnterChat = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicSetupStatus("unsupported");
      return;
    }

    setMicSetupStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicSetupStatus("granted");
      window.setTimeout(enterChatAfterMicSetup, 450);
    } catch {
      setMicSetupStatus("denied");
    }
  };
'''
onb_text = onb_text.replace(insert_after, insert_after + helpers)
onb_text = onb_text.replace('  if (loading || pendingAuthSubmit || completeMutation.isPending) {', '  if (loading || (pendingAuthSubmit && !showMicSetup) || completeMutation.isPending) {')
return_start = onb_text.index('  return (\n    <main className="min-h-screen bg-background text-foreground">', onb_text.index('  if (loading'))
return_end = onb_text.rindex('\n  );\n}') + 6
old_onb_return = onb_text[return_start:return_end]
new_onb_return = old_onb_return[:-4] + '''
      <AlertDialog open={showMicSetup} onOpenChange={setShowMicSetup}>
        <AlertDialogContent className="border-white/10 bg-black text-white shadow-2xl shadow-black/70">
          <AlertDialogHeader>
            <div className="mb-3 grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
              {micSetupStatus === "requesting" ? <Loader2 className="size-5 animate-spin text-white" /> : <Mic className="size-5 text-white" />}
            </div>
            <AlertDialogTitle className="font-display text-3xl font-light tracking-tight text-white">Enable voice for JIMMI?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-white/58">
              Allow microphone access once after onboarding so voice is ready when you enter Chat. You can still use text if you skip or if the browser blocks access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {micSetupStatus === "denied" ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">Microphone access was not enabled. You can continue with text and update browser permissions later.</p> : null}
          {micSetupStatus === "unsupported" ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">This browser does not support microphone setup here. Text chat will still work.</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={enterChatAfterMicSetup} className="rounded-full border-white/10 bg-transparent text-white/62 hover:bg-white/[0.06] hover:text-white">Skip for now</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void requestMicrophoneAndEnterChat(); }} disabled={micSetupStatus === "requesting"} className="rounded-full bg-white text-black hover:bg-white/90">
              {micSetupStatus === "requesting" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mic className="mr-2 size-4" />}
              Enable microphone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );'''
onb_text = onb_text[:return_start] + new_onb_return + onb_text[return_end:]
onboarding.write_text(onb_text)
print('Updated Chat and Onboarding for compact layout and post-onboarding mic popup.')
