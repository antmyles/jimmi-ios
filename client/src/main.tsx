import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { LANDING_LOGOUT_REDIRECT_KEY, LANDING_LOGOUT_SUPPRESSION_MS } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const getCurrentReturnPath = () => {
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return path.startsWith("/") ? path : "/";
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  const isLocalChatFallback = window.location.pathname === "/chat" && new URLSearchParams(window.location.search).get("localOnboarding") === "1";
  const logoutRedirectStartedAt = Number(window.sessionStorage.getItem(LANDING_LOGOUT_REDIRECT_KEY) ?? "0");
  const isIntentionalLogout = logoutRedirectStartedAt > 0 && Date.now() - logoutRedirectStartedAt < LANDING_LOGOUT_SUPPRESSION_MS;

  if (!isUnauthorized || isLocalChatFallback) return;

  if (isIntentionalLogout) {
    if (window.location.pathname !== "/") {
      window.location.replace("/");
    }
    return;
  }

  window.sessionStorage.removeItem(LANDING_LOGOUT_REDIRECT_KEY);
  window.location.href = getLoginUrl(getCurrentReturnPath());
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// chat.send is a long-running LLM call — send it unbatched so it never gets
// grouped with other requests and never hits a batch-level timeout or error.
const UNBATCHED_PROCEDURES = new Set(["chat.send"]);

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => UNBATCHED_PROCEDURES.has(op.path),
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
      false: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
