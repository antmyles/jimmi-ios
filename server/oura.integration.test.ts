import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createOuraAuthorizationUrl, isOuraConfigured, OURA_REDIRECT_URI, OURA_SCOPES, verifyOuraState } from "./oura";

const root = process.cwd();
const accountSettingsSource = fs.readFileSync(path.join(root, "client/src/pages/AccountSettings.tsx"), "utf8");
const integrationsSource = fs.readFileSync(path.join(root, "client/src/pages/Integrations.tsx"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "server/_core/index.ts"), "utf8");
const schemaSource = fs.readFileSync(path.join(root, "drizzle/schema.ts"), "utf8");

describe("Oura OAuth foundation", () => {
  it("uses the production askjimmi.com redirect URI and minimal requested scopes", () => {
    expect(OURA_REDIRECT_URI).toBe("https://askjimmi.com/api/oura/callback");
    expect(OURA_SCOPES).toEqual(["personal", "daily"]);
  });

  it("builds an authorization URL without exposing the client secret", () => {
    expect(isOuraConfigured()).toBe(true);
    const url = new URL(createOuraAuthorizationUrl(42));
    expect(url.origin + url.pathname).toBe("https://cloud.ouraring.com/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(process.env.OURA_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(OURA_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe("personal daily");
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(url.toString()).not.toContain(process.env.OURA_CLIENT_SECRET ?? "__missing_secret__");

    const verified = verifyOuraState(url.searchParams.get("state") ?? "");
    expect(verified.userId).toBe(42);
    expect(() => verifyOuraState(`${url.searchParams.get("state") ?? ""}tampered`)).toThrow();
  });

  it("registers Oura backend procedures, callback route, and token persistence fields", () => {
    expect(routerSource).toContain("ouraSetup: protectedProcedure.query");
    expect(routerSource).toContain("startOuraConnection: protectedProcedure.mutation");
    expect(routerSource).toContain("disconnectOuraConnection: protectedProcedure.mutation");
    expect(routerSource).toContain("ouraSyncStatus: protectedProcedure.query");
    expect(bootstrapSource).toContain("registerOuraRoutes(app)");
    expect(schemaSource).toContain('accessToken: text("accessToken")');
    expect(schemaSource).toContain('refreshToken: text("refreshToken")');
    expect(schemaSource).toContain('tokenExpiresAt: timestamp("tokenExpiresAt")');
  });

  it("keeps the visible Oura entry point on the dedicated integrations page", () => {
    expect(accountSettingsSource).not.toContain("Oura connection");
    expect(accountSettingsSource).not.toContain("trpc.account.startOuraConnection.useMutation");
    expect(integrationsSource).toContain('id: "oura"');
    expect(integrationsSource).toContain("trpc.account.startOuraConnection.useMutation");
    expect(integrationsSource).toContain("trpc.account.disconnectOuraConnection.useMutation");
    expect(integrationsSource).toContain('data-integration-connect-provider={selectedProvider.id}');
    expect(integrationsSource).toContain('data-integration-disconnect-provider={selectedProvider.id}');
    expect(integrationsSource).toContain('data-integration-connected-state={selectedProvider.id}');
  });
});
