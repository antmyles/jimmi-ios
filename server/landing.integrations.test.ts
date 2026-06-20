import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const homeSource = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const wearableArraySource = homeSource.slice(
  homeSource.indexOf("const wearableIntegrations = ["),
  homeSource.indexOf("];", homeSource.indexOf("const wearableIntegrations = [")) + 2,
);

describe("landing page wearable integration section", () => {
  it("shows only Oura, Fitbit, and WHOOP as planned compatible integrations", () => {
    expect(wearableArraySource).toContain('label: "Oura"');
    expect(wearableArraySource).toContain('label: "Fitbit"');
    expect(wearableArraySource).toContain('label: "WHOOP"');
    expect(wearableArraySource).not.toContain('label: "Apple Health"');
    expect(wearableArraySource).not.toContain('label: "Garmin"');
    expect(wearableArraySource).not.toContain('label: "Strava"');
    expect(wearableArraySource).not.toContain('Google Fit / Health Connect');
    expect(wearableArraySource).not.toContain('Samsung Health');
  });

  it("keeps the original integrations copy while using the narrowed three-provider grid", () => {
    expect(homeSource).toContain("Coaching starts with context.");
    expect(homeSource).toContain("We work with the brands that already know you for better insights.");
    expect(homeSource).not.toContain("Calorie balance starts with context.");
    expect(homeSource).not.toContain("lose weight, build muscle");
    expect(homeSource).toContain('aria-label="Planned wearable calorie and sleep integrations"');
    expect(homeSource).toContain("sm:grid-cols-3");
  });
});
