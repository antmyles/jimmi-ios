/**
 * useBarcodeScanner
 *
 * Unified barcode scanning hook.
 * - On Capacitor (iOS/Android): uses @capacitor-mlkit/barcode-scanning
 *   for instant native camera release and reliable scanning.
 * - On web: delegates to the existing web-based scanner in Chat.tsx
 *   (BarcodeDetector API or ZXing fallback).
 */

import { isNative } from "@/lib/capacitor";

export interface BarcodeScanResult {
  rawValue: string;
  format: string;
}

/**
 * Scan a single barcode using the native MLKit scanner.
 * Opens the native camera sheet, resolves with the first barcode found,
 * and automatically stops the camera.
 *
 * Only call this when isNative() === true.
 */
export async function scanBarcodeNative(): Promise<BarcodeScanResult | null> {
  if (!isNative()) return null;

  try {
    // Dynamic import so the web bundle is not affected
    const { BarcodeScanner, BarcodeFormat } = await import(
      "@capacitor-mlkit/barcode-scanning"
    );

    // Check / request camera permission
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera === "denied") {
      await BarcodeScanner.requestPermissions();
    }

    // Scan — opens the native camera UI and resolves on first detection
    const { barcodes } = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
        BarcodeFormat.QrCode,
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
        BarcodeFormat.DataMatrix,
      ],
    });

    if (barcodes.length === 0) return null;

    const first = barcodes[0];
    if (!first.rawValue) return null;

    return {
      rawValue: first.rawValue,
      format: first.format ?? "UNKNOWN",
    };
  } catch (err) {
    console.error("[BarcodeScanner] Native scan error:", err);
    return null;
  }
}

export { isNative };
