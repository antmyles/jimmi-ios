from pathlib import Path

path = Path('/home/ubuntu/jimmi-fit-recovery/client/src/pages/Chat.tsx')
text = path.read_text()

replacements = [
    (
        '  const suppressRecognitionErrorRef = useRef(false);\n  const recognitionEndedAfterRecoverableErrorRef = useRef(false);\n',
        '  const suppressRecognitionErrorRef = useRef(false);\n  const recognitionEndedAfterRecoverableErrorRef = useRef(false);\n  const [isComposerDictating, setIsComposerDictating] = useState(false);\n  const composerDictationRecognitionRef = useRef<SpeechRecognitionLike | null>(null);\n  const composerDictationFinalRef = useRef("");\n  const composerDictationInterimRef = useRef("");\n  const composerDictationShouldListenRef = useRef(false);\n  const composerDictationRestartTimerRef = useRef<number | null>(null);\n',
    ),
    (
        '  const clearVoiceFallbackSubmitTimer = useCallback(() => {\n    if (voiceFallbackSubmitTimerRef.current) {\n      window.clearTimeout(voiceFallbackSubmitTimerRef.current);\n      voiceFallbackSubmitTimerRef.current = null;\n    }\n  }, []);\n\n',
        '  const clearVoiceFallbackSubmitTimer = useCallback(() => {\n    if (voiceFallbackSubmitTimerRef.current) {\n      window.clearTimeout(voiceFallbackSubmitTimerRef.current);\n      voiceFallbackSubmitTimerRef.current = null;\n    }\n  }, []);\n\n  const clearComposerDictationRestartTimer = useCallback(() => {\n    if (composerDictationRestartTimerRef.current) {\n      window.clearTimeout(composerDictationRestartTimerRef.current);\n      composerDictationRestartTimerRef.current = null;\n    }\n  }, []);\n\n',
    ),
    (
        '  const scrollToChatBottom = useCallback((behavior: ScrollBehavior = "smooth") => {\n    if (typeof window === "undefined") return;\n    window.requestAnimationFrame(() => {\n      const viewport = chatScrollRef.current?.querySelector<HTMLElement>(\'[data-radix-scroll-area-viewport], [data-slot="scroll-area-viewport"]\');\n      if (!viewport) return;\n      viewport.scrollTo({ top: viewport.scrollHeight, behavior });\n    });\n  }, []);\n\n',
        '  const scrollToChatBottom = useCallback((behavior: ScrollBehavior = "smooth") => {\n    if (typeof window === "undefined") return;\n    window.requestAnimationFrame(() => {\n      const viewport = chatScrollRef.current?.querySelector<HTMLElement>(\'[data-radix-scroll-area-viewport], [data-slot="scroll-area-viewport"]\');\n      if (!viewport) return;\n      viewport.scrollTo({ top: viewport.scrollHeight, behavior });\n    });\n  }, []);\n\n  const stopComposerDictation = useCallback(() => {\n    composerDictationShouldListenRef.current = false;\n    clearComposerDictationRestartTimer();\n    const activeComposerRecognition = composerDictationRecognitionRef.current;\n    composerDictationRecognitionRef.current = null;\n    if (activeComposerRecognition) {\n      activeComposerRecognition.onerror = null;\n      activeComposerRecognition.onend = null;\n      activeComposerRecognition.onresult = null;\n      try {\n        activeComposerRecognition.abort?.();\n      } catch {\n        // Intentional composer dictation stops should not surface browser-specific recognition errors.\n      }\n      try {\n        activeComposerRecognition.stop();\n      } catch {\n        // Some browsers throw when stop follows abort; the local dictation state is already controlled.\n      }\n    }\n    composerDictationFinalRef.current = "";\n    composerDictationInterimRef.current = "";\n    setIsComposerDictating(false);\n  }, [clearComposerDictationRestartTimer]);\n\n  const startComposerDictation = useCallback(() => {\n    const SpeechRecognition = getSpeechRecognitionConstructor();\n    if (!SpeechRecognition) {\n      setMicPromptStatus("unsupported");\n      setOrbStatusText("Speech-to-text dictation is not supported in this browser. You can keep typing in the message box.");\n      return;\n    }\n\n    stopComposerDictation();\n    const recognition = new SpeechRecognition();\n    recognition.continuous = true;\n    recognition.interimResults = true;\n    recognition.lang = "en-US";\n    composerDictationRecognitionRef.current = recognition;\n    composerDictationFinalRef.current = chatInput.trim();\n    composerDictationInterimRef.current = "";\n    composerDictationShouldListenRef.current = true;\n    setIsComposerDictating(true);\n    setMicPromptStatus("granted");\n    setOrbStatusText("Composer dictation is active. This only fills the message box; tap the orb for two-way voice with JIMMI.");\n\n    const restartComposerDictation = (delayMs: number) => {\n      clearComposerDictationRestartTimer();\n      composerDictationRestartTimerRef.current = window.setTimeout(() => {\n        if (!isChatVoiceMountedRef.current || !composerDictationShouldListenRef.current || composerDictationRecognitionRef.current !== recognition) return;\n        try {\n          recognition.start();\n        } catch {\n          composerDictationShouldListenRef.current = false;\n          composerDictationRecognitionRef.current = null;\n          setIsComposerDictating(false);\n          setOrbStatusText("Composer dictation paused. Tap the message mic to try again, or tap the orb for two-way voice.");\n        }\n      }, delayMs);\n    };\n\n    recognition.onresult = (event) => {\n      let interimTranscript = "";\n      for (let index = event.resultIndex; index < event.results.length; index += 1) {\n        const result = event.results[index];\n        const transcript = result[0]?.transcript ?? "";\n        if (result.isFinal) {\n          composerDictationFinalRef.current = `${composerDictationFinalRef.current} ${transcript}`.trim();\n        } else {\n          interimTranscript = `${interimTranscript} ${transcript}`.trim();\n        }\n      }\n      composerDictationInterimRef.current = interimTranscript;\n      setChatInput(`${composerDictationFinalRef.current} ${composerDictationInterimRef.current}`.trim());\n    };\n    recognition.onerror = (event) => {\n      if (isNonFatalRecognitionError(event.error) && composerDictationShouldListenRef.current) {\n        restartComposerDictation(160);\n        return;\n      }\n      composerDictationShouldListenRef.current = false;\n      composerDictationRecognitionRef.current = null;\n      setIsComposerDictating(false);\n      setMicPromptStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "idle");\n      setOrbStatusText(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone permission was blocked for message dictation." : "Composer dictation paused. Tap the message mic to try again.");\n    };\n    recognition.onend = () => {\n      if (composerDictationShouldListenRef.current && composerDictationRecognitionRef.current === recognition) {\n        restartComposerDictation(120);\n        return;\n      }\n      if (composerDictationRecognitionRef.current === recognition) composerDictationRecognitionRef.current = null;\n      setIsComposerDictating(false);\n    };\n\n    try {\n      recognition.start();\n    } catch {\n      composerDictationShouldListenRef.current = false;\n      composerDictationRecognitionRef.current = null;\n      setIsComposerDictating(false);\n      setOrbStatusText("Composer dictation could not start. Tap the orb only when you want two-way voice conversation.");\n    }\n  }, [chatInput, clearComposerDictationRestartTimer, stopComposerDictation]);\n\n',
    ),
    (
        '  const handleOrbTap = useCallback(async () => {\n    triggerOrbHapticFeedback();\n    primeJimmiAudioPlayback();\n',
        '  const handleOrbTap = useCallback(async () => {\n    triggerOrbHapticFeedback();\n    primeJimmiAudioPlayback();\n    stopComposerDictation();\n',
    ),
    (
        '  }, [chatMutation.isPending, isResponseInterrupted, jimmiSpeechMutation.isPending, orbVoiceState, primeJimmiAudioPlayback, startVoiceListeningSession, stopJimmiAudioPlayback, stopServerBackedVoiceRecording, stopVoiceCapture]);\n',
        '  }, [chatMutation.isPending, isResponseInterrupted, jimmiSpeechMutation.isPending, orbVoiceState, primeJimmiAudioPlayback, startVoiceListeningSession, stopComposerDictation, stopJimmiAudioPlayback, stopServerBackedVoiceRecording, stopVoiceCapture]);\n',
    ),
    (
        '  const handleComposerMicPress = useCallback(() => {\n    primeJimmiAudioPlayback();\n    if (chatMutation.isPending) return;\n    if (orbVoiceState === "listening") {\n      if (stopServerBackedVoiceRecording()) return;\n      stopVoiceCapture("idle", "Listening stopped.");\n      return;\n    }\n    void handleOrbTap();\n  }, [chatMutation.isPending, handleOrbTap, orbVoiceState, primeJimmiAudioPlayback, stopServerBackedVoiceRecording, stopVoiceCapture]);\n',
        '  const handleComposerMicPress = useCallback(() => {\n    if (chatMutation.isPending || orbVoiceState === "listening" || orbVoiceState === "speaking" || jimmiSpeechMutation.isPending || voiceTranscriptionMutation.isPending) return;\n    if (isComposerDictating) {\n      stopComposerDictation();\n      setOrbStatusText("Composer dictation stopped. Tap send when your message is ready, or tap the orb for two-way voice.");\n      return;\n    }\n    startComposerDictation();\n  }, [chatMutation.isPending, isComposerDictating, jimmiSpeechMutation.isPending, orbVoiceState, startComposerDictation, stopComposerDictation, voiceTranscriptionMutation.isPending]);\n',
    ),
    (
        '    if (!isOnChatRoute) {\n      stopVoiceCapture("idle", "Voice capture stopped because you left JIMMI Chat.");\n    }\n  }, [location, stopVoiceCapture]);\n',
        '    if (!isOnChatRoute) {\n      stopComposerDictation();\n      stopVoiceCapture("idle", "Voice capture stopped because you left JIMMI Chat.");\n    }\n  }, [location, stopComposerDictation, stopVoiceCapture]);\n',
    ),
    (
        '      stopVoiceActivityDetector();\n      const activeRecognition = recognitionRef.current;\n',
        '      stopVoiceActivityDetector();\n      stopComposerDictation();\n      const activeRecognition = recognitionRef.current;\n',
    ),
    (
        '  }, [clearSilenceTimer, stopActiveMicTracks, stopBarcodeScanner, stopJimmiAudioPlayback, stopVoiceActivityDetector]);\n',
        '  }, [clearSilenceTimer, stopActiveMicTracks, stopBarcodeScanner, stopComposerDictation, stopJimmiAudioPlayback, stopVoiceActivityDetector]);\n',
    ),
    (
        '  const isComposerMicActive = orbVoiceState === "listening";\n  const isComposerMicDisabled = chatMutation.isPending;\n  const canSubmitChat = chatInput.trim().length > 0 && !chatMutation.isPending;\n',
        '  const isComposerMicActive = isComposerDictating;\n  const isTwoWayVoiceActive = orbVoiceState === "listening" || orbVoiceState === "speaking" || jimmiSpeechMutation.isPending || voiceTranscriptionMutation.isPending;\n  const isComposerMicDisabled = chatMutation.isPending || isTwoWayVoiceActive;\n  const canSubmitChat = chatInput.trim().length > 0 && !chatMutation.isPending;\n',
    ),
    (
        '              aria-label={isComposerMicActive ? "Stop JIMMI dictation" : "Start JIMMI dictation"}\n',
        '              aria-label={isComposerMicActive ? "Stop message-box dictation" : "Start message-box dictation"}\n',
    ),
    (
        '              data-chat-composer-mic="minimal-dictation"\n              data-chat-composer-mic-state={isComposerMicActive ? "listening" : "idle"}\n              data-chat-composer-mic-auto-send-delay-ms="600"\n',
        '              data-chat-composer-mic="message-box-dictation-only"\n              data-chat-composer-mic-state={isComposerMicActive ? "dictating" : "idle"}\n              data-chat-composer-mic-independent-from-orb="true"\n',
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Missing expected block:\n{old[:240]}')
    text = text.replace(old, new, 1)

path.write_text(text)
print('patched Chat.tsx voice control separation')
