from pathlib import Path

path = Path('/home/ubuntu/jimmi-fit-recovery/client/src/pages/Chat.tsx')
text = path.read_text()

if 'BrowserMultiFormatReader' not in text:
    text = text.replace(
        'import { Link, useLocation } from "wouter";\n',
        'import { Link, useLocation } from "wouter";\nimport { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";\nimport { BarcodeFormat, DecodeHintType } from "@zxing/library";\n'
    )

text = text.replace(
    'const supportedBarcodeFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"] as const;\n',
    'const supportedBarcodeFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"] as const;\nconst zxingBarcodeFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF];\n'
)

text = text.replace(
    '  const barcodeScanFrameRef = useRef<number | null>(null);\n  const hasBarcodeScanCompletedRef = useRef(false);\n',
    '  const barcodeScanFrameRef = useRef<number | null>(null);\n  const barcodeScannerControlsRef = useRef<IScannerControls | null>(null);\n  const hasBarcodeScanCompletedRef = useRef(false);\n'
)

old_stop = '''  const stopBarcodeScanner = useCallback(() => {
    if (barcodeScanFrameRef.current !== null) {
      window.cancelAnimationFrame(barcodeScanFrameRef.current);
      barcodeScanFrameRef.current = null;
    }
    barcodeScannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    barcodeScannerStreamRef.current = null;
    const video = barcodeVideoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);
'''
new_stop = '''  const stopBarcodeScanner = useCallback(() => {
    if (barcodeScanFrameRef.current !== null) {
      window.cancelAnimationFrame(barcodeScanFrameRef.current);
      barcodeScanFrameRef.current = null;
    }
    barcodeScannerControlsRef.current?.stop();
    barcodeScannerControlsRef.current = null;
    barcodeScannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    barcodeScannerStreamRef.current = null;
    const video = barcodeVideoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);
'''
text = text.replace(old_stop, new_stop)

insert_after_close = '''  const closeBarcodeScanner = useCallback(() => {
    stopBarcodeScanner();
    hasBarcodeScanCompletedRef.current = false;
    setIsBarcodeScannerOpen(false);
    setBarcodeScannerStatus("");
  }, [stopBarcodeScanner]);
'''
handle_detected = '''  const handleDetectedBarcode = useCallback((rawValue?: string) => {
    const rawBarcode = rawValue?.replace(/\D/g, "");
    if (!rawBarcode || hasBarcodeScanCompletedRef.current) return;
    hasBarcodeScanCompletedRef.current = true;
    setBarcodeScannerStatus("Barcode captured. JIMMI is checking the product now...");
    barcodeScanMutation.mutate({ barcode: rawBarcode });
    window.setTimeout(() => closeBarcodeScanner(), 180);
  }, [barcodeScanMutation, closeBarcodeScanner]);
'''
if 'const handleDetectedBarcode = useCallback' not in text:
    text = text.replace(insert_after_close, insert_after_close + '\n' + handle_detected)

old_effect = '''  useEffect(() => {
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
new_effect = '''  useEffect(() => {
    if (!isBarcodeScannerOpen) return;

    let isCancelled = false;

    const startBarcodeScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setBarcodeScannerStatus("Live camera barcode scanning is not supported in this browser. Describe the product or label details to JIMMI instead.");
        return;
      }

      const video = barcodeVideoRef.current;
      if (!video) {
        setBarcodeScannerStatus("Scanner view is loading. Try opening the scanner again if it does not start.");
        return;
      }
      video.setAttribute("playsinline", "true");

      const BarcodeDetectorConstructor = (window as BrowserWithBarcodeDetector).BarcodeDetector;
      if (BarcodeDetectorConstructor) {
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
          video.srcObject = stream;
          await video.play();

          if (isCancelled) return;

          setBarcodeScannerStatus("Center the barcode inside the rectangle and hold steady.");
          const detector = new BarcodeDetectorConstructor({ formats: [...supportedBarcodeFormats] });
          const scanFrame = async () => {
            if (isCancelled || hasBarcodeScanCompletedRef.current || !barcodeVideoRef.current) return;
            try {
              const detectedCodes = await detector.detect(barcodeVideoRef.current);
              handleDetectedBarcode(detectedCodes[0]?.rawValue);
            } catch {
              setBarcodeScannerStatus("Keep the barcode centered and steady.");
            }
            if (!hasBarcodeScanCompletedRef.current) barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
          };
          barcodeScanFrameRef.current = window.requestAnimationFrame(scanFrame);
          return;
        } catch {
          stopBarcodeScanner();
          if (isCancelled) return;
        }
      }

      try {
        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, zxingBarcodeFormats);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 500 });
        setBarcodeScannerStatus("Center the barcode inside the rectangle and hold steady.");
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video,
          (result, _error, controlsFromCallback) => {
            barcodeScannerControlsRef.current = controlsFromCallback;
            if (isCancelled || hasBarcodeScanCompletedRef.current) return;
            const text = result?.getText?.();
            if (text) {
              controlsFromCallback.stop();
              handleDetectedBarcode(text);
            }
          },
        );
        barcodeScannerControlsRef.current = controls;
      } catch {
        if (isCancelled) return;
        stopBarcodeScanner();
        hasBarcodeScanCompletedRef.current = false;
        setIsBarcodeScannerOpen(false);
        setBarcodeScannerStatus("");
        setScanStatusText(isEmbeddedPreviewContext() ? "Camera access may be blocked in preview. Open the site directly and try scanning again." : "Camera access was not enabled or barcode scanning could not start. Try again, or describe the product and nutrition label to JIMMI.");
      }
    };

    void startBarcodeScanner();

    return () => {
      isCancelled = true;
      stopBarcodeScanner();
    };
  }, [handleDetectedBarcode, isBarcodeScannerOpen, stopBarcodeScanner]);
'''
if old_effect not in text:
    raise SystemExit('Expected scanner effect block not found')
text = text.replace(old_effect, new_effect)

old_overlay = '''                  <div className="pointer-events-none absolute inset-8 rounded-2xl border border-primary/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                  <span className="pointer-events-none absolute left-10 right-10 top-1/2 h-px bg-primary/85 shadow-[0_0_18px_rgba(232,255,0,0.55)]" />
'''
new_overlay = '''                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_24%,rgba(0,0,0,0.34)_64%)]" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-primary/90 bg-black/10 shadow-[0_0_0_999px_rgba(0,0,0,0.26),0_0_28px_rgba(232,255,0,0.32)]" data-barcode-placement-guide="rectangle">
                    <span className="absolute -left-1 -top-1 size-7 rounded-tl-xl border-l-4 border-t-4 border-white" />
                    <span className="absolute -right-1 -top-1 size-7 rounded-tr-xl border-r-4 border-t-4 border-white" />
                    <span className="absolute -bottom-1 -left-1 size-7 rounded-bl-xl border-b-4 border-l-4 border-white" />
                    <span className="absolute -bottom-1 -right-1 size-7 rounded-br-xl border-b-4 border-r-4 border-white" />
                    <span className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-primary/90 shadow-[0_0_18px_rgba(232,255,0,0.65)]" />
                  </div>
                  <p className="pointer-events-none absolute bottom-4 left-6 right-6 rounded-full bg-black/52 px-3 py-2 text-center text-[0.62rem] uppercase tracking-[0.24em] text-white/72">Align barcode inside rectangle</p>
'''
if old_overlay not in text:
    raise SystemExit('Expected barcode overlay guide block not found')
text = text.replace(old_overlay, new_overlay)

path.write_text(text)
