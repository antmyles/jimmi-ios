import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const integrationsSource = readFileSync(join(process.cwd(), "client/src/pages/Integrations.tsx"), "utf8");
const accountSettingsSource = readFileSync(join(process.cwd(), "client/src/pages/AccountSettings.tsx"), "utf8");
const appSource = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf8");
const memberMenuSource = readFileSync(join(process.cwd(), "client/src/components/MemberMenu.tsx"), "utf8");
const routerSource = readFileSync(join(process.cwd(), "server/routers.ts"), "utf8");
const ouraSource = readFileSync(join(process.cwd(), "server/oura.ts"), "utf8");
const whoopSource = readFileSync(join(process.cwd(), "server/whoop.ts"), "utf8");
const googleHealthSource = readFileSync(join(process.cwd(), "server/google-health.ts"), "utf8");

describe("premium-ready integrations experience", () => {
  it("registers overview and detail routes for the dedicated integrations page", () => {
    expect(appSource).toContain('import Integrations from "@/pages/Integrations";');
    expect(appSource).toContain('<Route path="/integrations" component={Integrations} />');
    expect(appSource).toContain('<Route path="/integrations/:provider" component={Integrations} />');
  });

  it("adds Integrations inside the existing member dropdown navigation", () => {
    expect(memberMenuSource).toContain('data-member-menu-integrations-link="true"');
    expect(memberMenuSource).toContain('<Link href="/integrations"><PlugZap className="size-4" /> Integrations</Link>');
  });

  it("uses the provided mobile reference structure for overview rows", () => {
    expect(integrationsSource).toContain('data-integrations-route="overview"');
    expect(integrationsSource).toContain('data-integrations-list="reference-grouped-rows"');
    expect(integrationsSource).toContain('Wearable platforms');
    expect(integrationsSource).toContain('rounded-[1.2rem] bg-[#242424]');
    expect(integrationsSource).toContain('data-integrations-header="mobile-reference"');
  });

  it("shows Oura, WHOOP, and Fitbit company logo rows with detail links", () => {
    expect(integrationsSource).toContain('id: "oura"');
    expect(integrationsSource).toContain('id: "whoop"');
    expect(integrationsSource).toContain('id: "fitbit"');
    expect(integrationsSource).toContain('data-integration-row={provider.id}');
    expect(integrationsSource).toContain('href={`/integrations/${provider.id}`}');
    expect(integrationsSource).toContain('data-integration-logo={provider.id}');
  });

  it("provides integration detail copy, connect actions, and premium-ready gating markers", () => {
    expect(integrationsSource).toContain('data-integrations-route="detail"');
    expect(integrationsSource).toContain('data-integration-detail-provider={selectedProvider.id}');
    expect(integrationsSource).toContain('data-integration-connect-provider={selectedProvider.id}');
    expect(integrationsSource).toContain('startOuraConnection.mutate()');
    expect(integrationsSource).toContain('startWhoopConnection.mutate()');
    expect(integrationsSource).toContain('startFitbitConnection.mutate()');
    expect(integrationsSource).toContain('Connect Fitbit via Google Health');
    expect(integrationsSource).toContain('data-premium-ready-integrations="true"');
    expect(integrationsSource).toContain('data-integrations-premium-ready-note="true"');
  });

  it("keeps integration connect and disconnect ownership on the dedicated integrations detail pages", () => {
    expect(accountSettingsSource).not.toContain('data-integration-connect-provider');
    expect(accountSettingsSource).not.toContain('startOuraConnection');
    expect(accountSettingsSource).not.toContain('startWhoopConnection');
    expect(accountSettingsSource).not.toContain('startFitbitConnection');
    expect(integrationsSource).toContain('data-integration-connect-provider={selectedProvider.id}');
    expect(integrationsSource).toContain('data-integration-disconnect-provider={selectedProvider.id}');
    expect(integrationsSource).toContain('data-integration-connected-state={selectedProvider.id}');
    expect(integrationsSource).toContain('disconnectOuraConnection.mutate()');
    expect(integrationsSource).toContain('disconnectWhoopConnection.mutate()');
    expect(integrationsSource).toContain('disconnectFitbitConnection.mutate()');
  });

  it("returns OAuth callback statuses to the corresponding integration detail page", () => {
    expect(ouraSource).toContain('res.redirect(303, `/integrations/oura?oura=${status}`);');
    expect(whoopSource).toContain('res.redirect(303, `/integrations/whoop?whoop=${status}`);');
    expect(googleHealthSource).toContain('res.redirect(303, `/integrations/fitbit?fitbit=${status}`);');
    expect(ouraSource).not.toContain('/account-settings?oura=');
    expect(whoopSource).not.toContain('/account-settings?whoop=');
    expect(googleHealthSource).not.toContain('/account-settings?fitbit=');
  });

  it("shows a downgrade account button only for non-free tiers and maps downgrade to the free internal tier", () => {
    expect(accountSettingsSource).toContain('const canDowngradeAccount = settings.planTier !== "free";');
    expect(accountSettingsSource).toContain('data-downgrade-account-button="non-free-only"');
    expect(accountSettingsSource).toContain('trpc.account.downgradeAccount.useMutation');
    expect(routerSource).toContain('downgradeAccount: protectedProcedure.mutation');
    expect(routerSource).toContain('planTier: "free", subscriptionStatus: "active", autoRenew: false');
  });
});
