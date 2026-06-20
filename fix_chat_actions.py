from pathlib import Path

path = Path('/home/ubuntu/jimmi-fit-recovery/client/src/pages/Chat.tsx')
text = path.read_text()

old = '''  const handleOpenBarcodeScanner = useCallback(async () => {
    if (!user) {
      setScanStatusText("Sign in to scan food barcodes and save macros.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatusText("Live camera barcode scanning is not supported in this browser. Describe the product or label details to JIMMI instead.");
      return;
    }
    const BarcodeDetectorConstructor = (window as BrowserWithBarcodeDetector).BarcodeDetector;
    if (!BarcodeDetectorConstructor) {
      setScanStatusText("Live barcode detection is not available in this browser yet. Try Chrome or Edge, or describe the product and nutrition label to JIMMI.");
      return;
    }

    setIsPlusPanelOpen(false);
    setIsBarcodeScannerOpen(true);
    setBarcodeScannerStatus("Point the camera at the product barcode.");
    hasBarcodeScanCompletedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      barcodeScannerStreamRef.current = stream;

      const video = barcodeVideoRef.current;
      if (!video) throw new Error("Scanner view did not initialize.");
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      const detector = new BarcodeDetectorConstructor({ formats: [...supportedBarcodeFormats] });
      const scanFrame = async () => {
        if (hasBarcodeScanCompletedRef.current || !barcodeVideoRef.current) return;
        try {
          const detectedCodes = await detector.detect(barcodeVideoRef.current);
          const rawBarcode = detectedCodes[0]?.rawValue?.replace(/\D/g, "");
          if (rawBarcode) {
            hasBarcodeScanCompletedRef.current = true;
            setBarcodeScannerStatus("Barcode captured. JIMMI is checking the product now...");
            barcodeScanMutation.mutate({ barcode: rawBarcode });
            window.setTimeout(() => closeBarcodeScanner(), 180);
            return;
          }
        } catch {
          setBarcodeScannerStatus("Keep the barcode centered and steady.");
        }
        barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
      };
      barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
    } catch {
      stopBarcodeScanner();
      hasBarcodeScanCompletedRef.current = false;
      setIsBarcodeScannerOpen(false);
      setBarcodeScannerStatus("");
      setScanStatusText(isEmbeddedPreviewContext() ? "Camera access may be blocked in preview. Open the site directly and try scanning again." : "Camera access was not enabled. Try again or describe the product and nutrition label to JIMMI.");
    }
  }, [barcodeScanMutation, closeBarcodeScanner, stopBarcodeScanner, user]);
'''
new = '''  const handleOpenBarcodeScanner = useCallback(() => {
    setIsPlusPanelOpen(false);
    setScanStatusText("");
    setBarcodeScannerStatus("Point the camera at the product barcode.");
    hasBarcodeScanCompletedRef.current = false;
    setIsBarcodeScannerOpen(true);
  }, []);
'''
if old not in text:
    raise SystemExit('Old barcode handler block not found')
text = text.replace(old, new)

anchor = '''  const handleSaveFoodScanToLog = useCallback(() => {
    if (!activeFoodScan) return;
'''
effect = '''  useEffect(() => {
    if (!isBarcodeScannerOpen) return;

    let isCancelled = false;

    const startBarcodeScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setBarcodeScannerStatus("Live camera barcode scanning is not supported in this browser. Describe the product or label details to JIMMI instead.");
        return;
      }

      const BarcodeDetectorConstructor = (window as BrowserWithBarcodeDetector).BarcodeDetector;
      if (!BarcodeDetectorConstructor) {
        setBarcodeScannerStatus("Live barcode detection is not available in this browser yet. Try Chrome or Edge, or describe the product and nutrition label to JIMMI.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        barcodeScannerStreamRef.current = stream;
        const video = barcodeVideoRef.current;
        if (!video) throw new Error("Scanner view did not initialize.");
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();

        if (isCancelled) return;

        const detector = new BarcodeDetectorConstructor({ formats: [...supportedBarcodeFormats] });
        const scanFrame = async () => {
          if (isCancelled || hasBarcodeScanCompletedRef.current || !barcodeVideoRef.current) return;
          try {
            const detectedCodes = await detector.detect(barcodeVideoRef.current);
            const rawBarcode = detectedCodes[0]?.rawValue?.replace(/\D/g, "");
            if (rawBarcode) {
              hasBarcodeScanCompletedRef.current = true;
              setBarcodeScannerStatus("Barcode captured. JIMMI is checking the product now...");
              barcodeScanMutation.mutate({ barcode: rawBarcode });
              window.setTimeout(() => closeBarcodeScanner(), 180);
              return;
            }
          } catch {
            setBarcodeScannerStatus("Keep the barcode centered and steady.");
          }
          barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
        };
        barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
      } catch {
        if (isCancelled) return;
        stopBarcodeScanner();
        hasBarcodeScanCompletedRef.current = false;
        setIsBarcodeScannerOpen(false);
        setBarcodeScannerStatus("");
        setScanStatusText(isEmbeddedPreviewContext() ? "Camera access may be blocked in preview. Open the site directly and try scanning again." : "Camera access was not enabled. Try again or describe the product and nutrition label to JIMMI.");
      }
    };

    void startBarcodeScanner();

    return () => {
      isCancelled = true;
    };
  }, [barcodeScanMutation, closeBarcodeScanner, isBarcodeScannerOpen, stopBarcodeScanner]);

'''
if anchor not in text:
    raise SystemExit('Insertion anchor not found')
text = text.replace(anchor, effect + anchor)

text = text.replace('''          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" data-chat-camera-food-input="true" onChange={(event) => { void handleCameraFoodFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          <input ref={programFileInputRef} type="file" accept="image/*,application/pdf,.txt,.md,.csv" className="hidden" data-chat-program-file-input="true" onChange={(event) => { void handleProgramFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
''', '''          <input id="chat-camera-food-input" ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" data-chat-camera-food-input="true" onChange={(event) => { void handleCameraFoodFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          <input id="chat-program-file-input" ref={programFileInputRef} type="file" accept="image/*,application/pdf,.txt,.md,.csv" className="sr-only" data-chat-program-file-input="true" onChange={(event) => { void handleProgramFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
''')

text = text.replace('''                <button type="button" data-chat-add-files-option="program-scan" onClick={() => programFileInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/74"><FileUp className="size-4" /></span>
                  <span className="block min-w-0 flex-1 text-sm font-medium text-white/88">Add files</span>
                </button>
''', '''                <label htmlFor="chat-program-file-input" role="button" tabIndex={0} data-chat-add-files-option="direct-file-picker" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") programFileInputRef.current?.click(); }} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/74"><FileUp className="size-4" /></span>
                  <span className="block min-w-0 flex-1 text-sm font-medium text-white/88">Add files</span>
                </label>
''')

path.write_text(text)
