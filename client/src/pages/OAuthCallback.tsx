import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  const utils = trpc.useUtils();

  const exchangeCode = trpc.auth.exchangeCode.useMutation({
    onSuccess: async (data) => {
      // Seed the auth.me cache with the user returned from the server.
      // This means Chat will mount with loading=false and user already populated —
      // no second auth.me round-trip to the server is needed after login.
      if (data.user) {
        utils.auth.me.setData(undefined, data.user);
      } else {
        await utils.auth.me.invalidate();
      }

      // Also seed the onboarding.get cache with the profile returned from the server.
      // This eliminates the profileQuery cold-start wait that was causing the 26-second
      // black screen: Chat's condition `loading || (Boolean(user) && profileQuery.isLoading)`
      // was staying true for the entire cold-start duration because profileQuery was
      // making a fresh server call even though auth.me was already seeded.
      if (data.profile !== undefined) {
        utils.onboarding.get.setData(undefined, data.profile);
      }

      // Seed the chat.history cache so messages load instantly on re-login
      // without a cold-start round-trip to the server.
      if (data.chatHistory !== undefined) {
        utils.chat.history.setData(undefined, data.chatHistory);
      }

      // Navigate using replace so /auth/callback is NOT added to the browser back stack
      setLocation(data.returnPath, { replace: true });
    },
    onError: (err) => {
      setError(err.message || "Authentication failed. Please try again.");
    },
  });

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      setError("Missing authentication parameters. Please try logging in again.");
      return;
    }

    exchangeCode.mutate({ code, state });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" className="block h-[1.45rem] w-auto md:h-[1.65rem]" />
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-400 mb-2">Login Failed</p>
            <p className="text-sm text-white/70">{error}</p>
          </div>
          <a
            href="/"
            className="rounded-full border border-white/20 px-6 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white/60 hover:border-white/40 hover:text-white/90 transition"
          >
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white" aria-label="Signing in to JIMMI">
      <div className="flex flex-col items-center gap-4">
        <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" className="block h-[1.45rem] w-auto md:h-[1.65rem]" />
        <div className="h-0.5 w-12 animate-pulse rounded-full bg-white/40" />
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-white/50">Signing you in</span>
      </div>
    </main>
  );
}
