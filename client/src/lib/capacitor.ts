/**
 * Capacitor platform utilities.
 * Safe to import in web builds — all Capacitor imports are dynamic
 * so the web bundle is not affected.
 */

/**
 * Returns true when the app is running inside a Capacitor native shell
 * (iOS or Android), false when running as a plain web app.
 */
export function isNative(): boolean {
  return typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform === "function"
    && (window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor.isNativePlatform();
}

/**
 * Returns "ios" | "android" | "web"
 */
export function getPlatform(): "ios" | "android" | "web" {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  if (!cap?.getPlatform) return "web";
  const p = cap.getPlatform();
  if (p === "ios" || p === "android") return p;
  return "web";
}
