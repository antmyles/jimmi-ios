import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * GoogleComplete — frontend cache seeder for Google Sign-In.
 *
 * After the server-side Google OAuth callback sets the session cookie and
 * redirects here, this page calls auth.googleComplete (a protectedProcedure)
 * to fetch the user, profile, and chat history in one round-trip. It then
 * seeds the tRPC cache so Chat and Onboarding mount instantly without a
 * cold-start black screen.
 *
 * This mirrors the OAuthCallback pattern used for Manus OAuth.
 */
export default function GoogleComplete() {
  const [, setLocation] = useLocation();
  const calledRef = useRef(false);
  const utils = trpc.useUtils();

  const googleComplete = trpc.auth.googleComplete.useQuery(undefined, {
    enabled: false, // We trigger manually via refetch
    retry: 1,
    retryDelay: 1500,
  });

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    googleComplete.refetch().then((result) => {
      if (!result.data) return;
      const { user, profile, chatHistory, returnPath } = result.data;

      // Seed auth.me cache
      if (user) {
        utils.auth.me.setData(undefined, user);
      } else {
        void utils.auth.me.invalidate();
      }

      // Seed onboarding.get cache
      if (profile !== undefined) {
        utils.onboarding.get.setData(undefined, profile);
      }

      // Seed chat.history cache
      if (chatHistory !== undefined) {
        utils.chat.history.setData(undefined, chatHistory);
      }

      // Navigate using replace so /auth/google-complete is NOT in the back stack
      setLocation(returnPath, { replace: true });
    }).catch(() => {
      // On error fall back to login
      setLocation("/login?error=google_session_failed", { replace: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-black text-white"
      aria-label="Completing Google Sign-In"
    >
      <div className="flex flex-col items-center gap-4">
        <img
          src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png"
          alt="JIMMI"
          className="block h-[1.45rem] w-auto md:h-[1.65rem]"
        />
        <div className="h-0.5 w-12 animate-pulse rounded-full bg-white/40" />
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-white/50">
          Signing you in
        </span>
      </div>
    </main>
  );
}
