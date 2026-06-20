import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appSource = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf8");
const homeSource = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const privacySource = readFileSync(join(process.cwd(), "client/src/pages/PrivacyPolicy.tsx"), "utf8");
const termsSource = readFileSync(join(process.cwd(), "client/src/pages/TermsOfService.tsx"), "utf8");

const ouraRedirectUri = "https://askjimmi.com/api/oura/callback";

describe("public legal pages for wearable developer registration", () => {
  it("registers public Privacy Policy and Terms of Service routes", () => {
    expect(appSource).toContain('import PrivacyPolicy from "@/pages/PrivacyPolicy";');
    expect(appSource).toContain('import TermsOfService from "@/pages/TermsOfService";');
    expect(appSource).toContain('<Route path="/privacy" component={PrivacyPolicy} />');
    expect(appSource).toContain('<Route path="/terms" component={TermsOfService} />');
  });

  it("makes legal pages discoverable from the landing page footer", () => {
    expect(homeSource).toContain('aria-label="JIMMI legal links"');
    expect(homeSource).toContain('href="/privacy"');
    expect(homeSource).toContain('Privacy Policy');
    expect(homeSource).toContain('href="/terms"');
    expect(homeSource).toContain('Terms of Service');
  });

  it("includes wearable health data and supported integration coverage in the Privacy Policy", () => {
    expect(privacySource).toContain("Wearable and health-related data");
    expect(privacySource).toContain("active calories");
    expect(privacySource).toContain("total calories");
    expect(privacySource).toContain("sleep quality");
    expect(privacySource).toContain("Oura, Fitbit, and WHOOP");
    expect(privacySource).toContain("support@askjimmi.com");
  });

  it("includes wearable authorization and health disclaimer coverage in the Terms of Service", () => {
    expect(termsSource).toContain("Health and fitness disclaimer");
    expect(termsSource).toContain("Wearable integrations");
    expect(termsSource).toContain("Oura, Fitbit, WHOOP");
    expect(termsSource).toContain("does not provide medical advice");
    expect(termsSource).toContain("support@askjimmi.com");
  });

  it("documents the Oura OAuth redirect URI expected for production registration", () => {
    expect(ouraRedirectUri).toBe("https://askjimmi.com/api/oura/callback");
  });
});
