import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const LANDING_LOGOUT_REDIRECT_KEY = "jimmi.logout.redirectLanding";
export const LANDING_LOGOUT_SUPPRESSION_MS = 15_000;

// After this many ms, if auth.me is still loading (e.g. cold-start hang), treat as unauthenticated
const AUTH_LOAD_TIMEOUT_MS = 12_000;

export const markLogoutRedirectToLanding = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LANDING_LOGOUT_REDIRECT_KEY, String(Date.now()));
};

export const redirectToLandingAfterLogout = () => {
  markLogoutRedirectToLanding();
  if (typeof window === "undefined") return;
  window.location.replace("/");
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  // Track whether the auth load timeout has fired — if so, stop showing the loading state
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    // Allow 1 retry with a 2s delay to handle transient cold-start failures
    retry: 1,
    retryDelay: 2000,
    refetchOnWindowFocus: false,
  });

  // Start a timeout when the query is first loading; clear it once it resolves
  useEffect(() => {
    if (!meQuery.isLoading) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setAuthTimedOut(false);
      return;
    }
    // Only set the timeout once
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      setAuthTimedOut(true);
    }, AUTH_LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [meQuery.isLoading]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    markLogoutRedirectToLanding();

    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      utils.auth.me.cancel();
    }
  }, [logoutMutation, utils]);

  // If the auth query timed out, treat loading as false so the app can proceed
  const effectivelyLoading = (meQuery.isLoading || logoutMutation.isPending) && !authTimedOut;

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: effectivelyLoading,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    effectivelyLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (effectivelyLoading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(LANDING_LOGOUT_REDIRECT_KEY)) return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    effectivelyLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
