from pathlib import Path

path = Path('/home/ubuntu/jimmi-fit-recovery/client/src/pages/Chat.tsx')
text = path.read_text()

anchor = '''  const stopVoiceCapture = useCallback((nextState: OrbVoiceState, statusText: string) => {\n'''
helper = '''  const stopOrbSpeechRecognition = useCallback(() => {\n    ignoreRecognitionEndRef.current = true;\n    suppressRecognitionErrorRef.current = true;\n    recognitionEndedAfterRecoverableErrorRef.current = false;\n    const activeRecognition = recognitionRef.current;\n    recognitionRef.current = null;\n    if (activeRecognition) {\n      activeRecognition.onerror = null;\n      activeRecognition.onend = null;\n      activeRecognition.onresult = null;\n      try {\n        activeRecognition.abort?.();\n      } catch {\n        // Releasing browser speech recognition should never block the recorder handoff.\n      }\n      try {\n        activeRecognition.stop();\n      } catch {\n        // Some browsers throw when stop follows abort; the intended state is already local.\n      }\n    }\n    window.setTimeout(() => {\n      suppressRecognitionErrorRef.current = false;\n    }, 250);\n  }, []);\n\n'''
if helper.strip() not in text:
    if anchor not in text:
        raise SystemExit('stopVoiceCapture anchor not found')
    text = text.replace(anchor, helper + anchor, 1)

old = '''    const activeRecognition = recognitionRef.current;\n    recognitionRef.current = null;\n    if (activeRecognition) {\n      activeRecognition.onerror = null;\n      activeRecognition.onend = null;\n      activeRecognition.onresult = null;\n      try {\n        activeRecognition.abort?.();\n      } catch {\n        // Intentional user stops should never surface as voice errors.\n      }\n      try {\n        activeRecognition.stop();\n      } catch {\n        // Some browsers throw when stop follows abort; the desired state is already controlled locally.\n      }\n    }\n'''
if old in text:
    text = text.replace(old, '''    stopOrbSpeechRecognition();\n''', 1)

text = text.replace('''  }, [clearSilenceTimer, clearVoiceFallbackSubmitTimer, stopActiveMicTracks]);\n''', '''  }, [clearSilenceTimer, clearVoiceFallbackSubmitTimer, stopActiveMicTracks, stopOrbSpeechRecognition]);\n''', 1)

for old_block, new_block in [
    ('''          shouldKeepListeningRef.current = false;\n          setOrbVoiceState("thinking");\n          setOrbStatusText("I heard you. JIMMI is thinking now.");\n          try {\n            recorder.requestData?.();\n''', '''          shouldKeepListeningRef.current = false;\n          stopOrbSpeechRecognition();\n          setOrbVoiceState("thinking");\n          setOrbStatusText("I heard you. JIMMI is thinking now.");\n          try {\n            recorder.requestData?.();\n'''),
    ('''      mediaRecorderRef.current = null;\n      stopActiveMicTracks();\n      const recordedByteSize = chunks.reduce((total, chunk) => total + chunk.size, 0);\n''', '''      mediaRecorderRef.current = null;\n      stopOrbSpeechRecognition();\n      stopActiveMicTracks();\n      const recordedByteSize = chunks.reduce((total, chunk) => total + chunk.size, 0);\n'''),
    ('''        shouldKeepListeningRef.current = false;\n        hasDetectedSpeechRef.current = true;\n        setOrbVoiceState("thinking");\n        setOrbStatusText("I heard you. JIMMI is thinking now.");\n        try {\n          recorder.requestData?.();\n''', '''        shouldKeepListeningRef.current = false;\n        hasDetectedSpeechRef.current = true;\n        stopOrbSpeechRecognition();\n        setOrbVoiceState("thinking");\n        setOrbStatusText("I heard you. JIMMI is thinking now.");\n        try {\n          recorder.requestData?.();\n'''),
    ('''    shouldKeepListeningRef.current = false;\n    setOrbVoiceState("thinking");\n    setOrbStatusText("I heard you. JIMMI is thinking now.");\n    try {\n      recorder.stop();\n''', '''    shouldKeepListeningRef.current = false;\n    stopOrbSpeechRecognition();\n    setOrbVoiceState("thinking");\n    setOrbStatusText("I heard you. JIMMI is thinking now.");\n    try {\n      recorder.stop();\n'''),
]:
    if old_block not in text:
        raise SystemExit(f'target not found:\n{old_block}')
    text = text.replace(old_block, new_block, 1)

text = text.replace('''  }, [clearVoiceFallbackSubmitTimer, startVoiceActivityDetector, stopActiveMicTracks, voiceTranscriptionMutation]);\n''', '''  }, [clearVoiceFallbackSubmitTimer, startVoiceActivityDetector, stopActiveMicTracks, stopOrbSpeechRecognition, voiceTranscriptionMutation]);\n''', 1)

start = text.find('  const stopServerBackedVoiceRecording = useCallback')
if start == -1:
    raise SystemExit('stopServerBackedVoiceRecording not found')
old_dep = '''  }, [stopActiveMicTracks]);\n'''
idx = text.find(old_dep, start)
if idx == -1:
    raise SystemExit('stopServerBackedVoiceRecording dependency block not found')
text = text[:idx] + '''  }, [stopActiveMicTracks, stopOrbSpeechRecognition]);\n''' + text[idx + len(old_dep):]

path.write_text(text)
print('patched native mic cleanup')
