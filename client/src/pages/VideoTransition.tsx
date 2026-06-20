import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";
import {
  getChatDestinationFromTransitionSearch,
  getReasonFromTransitionSearch,
  hasIntroVideoBeenShown,
  markIntroVideoShown,
  JIMMI_MOBILE_TRANSITION_VIDEO_SRC,
  prefersReducedMotionForChatTransition,
} from "@/lib/chatTransition";

export default function VideoTransition() {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const advancedRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const shouldReduceMotion = useMemo(() => prefersReducedMotionForChatTransition(), []);

  const destination = useMemo(() => {
    if (typeof window === "undefined") return "/chat";
    return getChatDestinationFromTransitionSearch(window.location.search);
  }, []);

  // Only play the video when reason=onboarding AND the video has never been shown before.
  // For reason=auth (wordmark click, post-login redirect) always skip straight to chat.
  const reason = useMemo(() => {
    if (typeof window === "undefined") return "auth";
    return getReasonFromTransitionSearch(window.location.search);
  }, []);

  const shouldPlayVideo = useMemo(
    () => reason === "onboarding" && !hasIntroVideoBeenShown(),
    [reason],
  );

  const enterChat = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    // Use replace so /chat-transition is NOT added to the back stack
    setLocation(destination, { replace: true });
  }, [destination, setLocation]);

  useEffect(() => {
    // Skip video if: desktop, reduced motion, reason is not onboarding, or video already shown
    if (!isMobile || shouldReduceMotion || !shouldPlayVideo) enterChat();
  }, [enterChat, isMobile, shouldReduceMotion, shouldPlayVideo]);

  if (!isMobile || shouldReduceMotion || !shouldPlayVideo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white" aria-label="Opening JIMMI Chat">
        <div className="flex flex-col items-center gap-4">
          <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" className="block h-[1.45rem] w-auto md:h-[1.65rem]" />
          <div className="h-0.5 w-12 animate-pulse rounded-full bg-white/40" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-white/50">Opening your coaching room</span>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-black text-white" data-mobile-chat-transition="true" aria-label="JIMMI Chat transition video">
      <video
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${videoReady ? "opacity-100" : "opacity-0"}`}
        src={JIMMI_MOBILE_TRANSITION_VIDEO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
        onCanPlay={() => setVideoReady(true)}
        onEnded={() => {
          markIntroVideoShown();
          enterChat();
        }}
        onError={() => setVideoUnavailable(true)}
        aria-label="JIMMI introduction before Chat opens"
      />
      {/* Black gradient overlays at all four edges to mask the video's slightly-off-black background */}
      <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black to-transparent" />
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black to-transparent" />
      </div>

      {!videoReady && (
        <section className="absolute inset-0 flex items-center justify-center px-8 text-center">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] px-6 py-5 backdrop-blur-md">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-white/45">Preparing JIMMI</p>
            <p className="mt-3 font-display text-2xl font-light tracking-[-0.03em] text-white/86">Opening your coaching space.</p>
          </div>
        </section>
      )}

      {videoUnavailable && (
        <section className="absolute inset-x-4 bottom-24 rounded-[1.5rem] border border-white/10 bg-black/65 p-4 text-center backdrop-blur-md">
          <p className="text-sm leading-6 text-white/66">The transition clip could not load on this connection. You can continue straight to Chat.</p>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          markIntroVideoShown();
          enterChat();
        }}
        className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 rounded-full border border-white/10 bg-black/20 px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.28em] text-white/48 backdrop-blur-md transition hover:border-white/30 hover:bg-white/8 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
        aria-label="Skip transition and open JIMMI Chat"
        data-mobile-transition-skip="true"
      >
        Skip
      </button>
    </main>
  );
}
