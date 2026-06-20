export const JIMMI_MOBILE_TRANSITION_VIDEO_SRC = "/manus-storage/jimmi-mobile-chat-transition-v2_ef9ae025.mov";
export const CHAT_TRANSITION_ROUTE = "/chat-transition";
export const CHAT_ROUTE = "/chat";

export type ChatTransitionReason = "auth" | "onboarding";

type ChatEntryOptions = {
  destination?: string;
  reason?: ChatTransitionReason;
};

const MOBILE_TRANSITION_BREAKPOINT = 768;

/**
 * localStorage key that records whether the intro video has been shown at least once.
 * Once set, the video is never replayed — even on subsequent onboarding completions.
 */
export const INTRO_VIDEO_SHOWN_KEY = "jimmi.introVideoShown";

export function hasIntroVideoBeenShown(): boolean {
  try {
    return localStorage.getItem(INTRO_VIDEO_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroVideoShown(): void {
  try {
    localStorage.setItem(INTRO_VIDEO_SHOWN_KEY, "1");
  } catch {
    // ignore storage errors (private browsing, quota exceeded)
  }
}

export function isMobileViewportForChatTransition() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_TRANSITION_BREAKPOINT;
}

export function prefersReducedMotionForChatTransition() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function normalizeChatDestination(destination = CHAT_ROUTE) {
  if (destination === CHAT_ROUTE || destination === `${CHAT_ROUTE}?localOnboarding=1`) {
    return destination;
  }
  return CHAT_ROUTE;
}

export function buildChatTransitionPath({ destination = CHAT_ROUTE, reason = "auth" }: ChatEntryOptions = {}) {
  const params = new URLSearchParams({
    next: normalizeChatDestination(destination),
    reason,
  });
  return `${CHAT_TRANSITION_ROUTE}?${params.toString()}`;
}

/**
 * Returns the path to navigate to when entering chat.
 *
 * The video transition is only shown when ALL of the following are true:
 * 1. The user is on a mobile viewport.
 * 2. The user has not set prefers-reduced-motion.
 * 3. The reason is "onboarding" (i.e. the user just completed onboarding for the first time).
 * 4. The intro video has not been shown before (localStorage flag not set).
 *
 * For wordmark clicks (reason="auth") and any non-onboarding navigation,
 * the user goes directly to /chat with no video interstitial.
 */
export function getMobileAwareChatEntryPath(options: ChatEntryOptions = {}) {
  const destination = normalizeChatDestination(options.destination);
  const reason = options.reason ?? "auth";

  // Only show the video for first-time onboarding completion on mobile
  const shouldShowVideo =
    reason === "onboarding" &&
    isMobileViewportForChatTransition() &&
    !prefersReducedMotionForChatTransition() &&
    !hasIntroVideoBeenShown();

  if (!shouldShowVideo) return destination;
  return buildChatTransitionPath({ ...options, destination });
}

export function getChatDestinationFromTransitionSearch(search: string) {
  const params = new URLSearchParams(search);
  const next = normalizeChatDestination(params.get("next") ?? CHAT_ROUTE);
  if (params.get("localOnboarding") === "1" && next === CHAT_ROUTE) {
    return `${CHAT_ROUTE}?localOnboarding=1`;
  }
  return next;
}

export function getReasonFromTransitionSearch(search: string): ChatTransitionReason {
  const params = new URLSearchParams(search);
  const reason = params.get("reason");
  return reason === "onboarding" ? "onboarding" : "auth";
}
