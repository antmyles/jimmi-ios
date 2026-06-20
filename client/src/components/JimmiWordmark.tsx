import { Link, useLocation } from "wouter";
import { getMobileAwareChatEntryPath } from "@/lib/chatTransition";

/**
 * JIMMI wordmark with context-aware routing:
 * - Landing page (/): inactive — no navigation, just the brand image.
 * - Onboarding (/onboarding): routes back to landing page (/) so users can exit.
 * - All authenticated member pages: routes to /chat via the mobile-aware entry path.
 *
 * Pass `variant="member"` on any authenticated page.
 * Pass `variant="onboarding"` on the onboarding page.
 * Omit (or pass `variant="landing"`) on the landing page.
 */
type WordmarkVariant = "landing" | "onboarding" | "member";

type JimmiWordmarkProps = {
  variant?: WordmarkVariant;
  className?: string;
};

const WORDMARK_IMG = (
  <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" data-official-jimmi-wordmark="true" className="jimmi-wordmark block h-[1.45rem] w-auto md:h-[1.65rem]" />
);

export function JimmiWordmark({ variant = "landing", className = "jimmi-wordmark text-2xl" }: JimmiWordmarkProps) {
  const [location] = useLocation();

  // Determine effective variant from current path when not explicitly supplied
  const effectiveVariant: WordmarkVariant =
    variant !== "landing"
      ? variant
      : location === "/"
      ? "landing"
      : location.startsWith("/onboarding")
      ? "onboarding"
      : "member";

  if (effectiveVariant === "landing") {
    // Inactive on the landing page — no anchor, no navigation
    return (
      <span className={className} aria-label="JIMMI" data-wordmark-variant="landing">
        {WORDMARK_IMG}
      </span>
    );
  }

  if (effectiveVariant === "onboarding") {
    return (
      <Link href="/" className={className} aria-label="JIMMI home" data-wordmark-variant="onboarding">
        {WORDMARK_IMG}
      </Link>
    );
  }

  // member: route to chat via mobile-aware transition
  const chatHref = getMobileAwareChatEntryPath({ reason: "auth" });
  return (
    <Link href={chatHref} className={className} aria-label="Go to JIMMI Chat" data-wordmark-variant="member">
      {WORDMARK_IMG}
    </Link>
  );
}
