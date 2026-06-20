import { describe, it, expect } from "vitest";
import { getSportSpecificPrompt, generalFitnessPrompt, fiveKPrompt, tenKPrompt, marathonPrompt, triathlonPrompt, hyroxPrompt } from "./sport-specific-prompts";

describe("Sport-Specific Prompt Selection", () => {
  it("returns general fitness prompt when eventType is null", () => {
    const prompt = getSportSpecificPrompt(null);
    expect(prompt).toBe(generalFitnessPrompt);
  });

  it("returns general fitness prompt when eventType is undefined", () => {
    const prompt = getSportSpecificPrompt(undefined);
    expect(prompt).toBe(generalFitnessPrompt);
  });

  it("returns general fitness prompt when eventType is empty string", () => {
    const prompt = getSportSpecificPrompt("");
    expect(prompt).toBe(generalFitnessPrompt);
  });

  it("returns 5K prompt for '5k' (lowercase)", () => {
    const prompt = getSportSpecificPrompt("5k");
    expect(prompt).toBe(fiveKPrompt);
  });

  it("returns 5K prompt for '5K' (uppercase)", () => {
    const prompt = getSportSpecificPrompt("5K");
    expect(prompt).toBe(fiveKPrompt);
  });

  it("returns 10K prompt for '10k' (lowercase)", () => {
    const prompt = getSportSpecificPrompt("10k");
    expect(prompt).toBe(tenKPrompt);
  });

  it("returns 10K prompt for '10K' (uppercase)", () => {
    const prompt = getSportSpecificPrompt("10K");
    expect(prompt).toBe(tenKPrompt);
  });

  it("returns marathon prompt for 'marathon'", () => {
    const prompt = getSportSpecificPrompt("marathon");
    expect(prompt).toBe(marathonPrompt);
  });

  it("returns marathon prompt for 'Marathon' (mixed case)", () => {
    const prompt = getSportSpecificPrompt("Marathon");
    expect(prompt).toBe(marathonPrompt);
  });

  it("returns marathon prompt for 'half marathon'", () => {
    const prompt = getSportSpecificPrompt("half marathon");
    expect(prompt).toBe(marathonPrompt);
  });

  it("returns marathon prompt for 'half-marathon' (hyphenated)", () => {
    const prompt = getSportSpecificPrompt("half-marathon");
    expect(prompt).toBe(marathonPrompt);
  });

  it("returns triathlon prompt for 'triathlon'", () => {
    const prompt = getSportSpecificPrompt("triathlon");
    expect(prompt).toBe(triathlonPrompt);
  });

  it("returns triathlon prompt for 'Triathlon' (mixed case)", () => {
    const prompt = getSportSpecificPrompt("Triathlon");
    expect(prompt).toBe(triathlonPrompt);
  });

  it("returns hyrox prompt for 'hyrox'", () => {
    const prompt = getSportSpecificPrompt("hyrox");
    expect(prompt).toBe(hyroxPrompt);
  });

  it("returns hyrox prompt for 'Hyrox' (mixed case)", () => {
    const prompt = getSportSpecificPrompt("Hyrox");
    expect(prompt).toBe(hyroxPrompt);
  });

  it("returns general fitness prompt for unknown event type", () => {
    const prompt = getSportSpecificPrompt("unknown-sport");
    expect(prompt).toBe(generalFitnessPrompt);
  });

  it("returns general fitness prompt for 'general'", () => {
    const prompt = getSportSpecificPrompt("general");
    expect(prompt).toBe(generalFitnessPrompt);
  });

  it("handles whitespace in event type", () => {
    const prompt = getSportSpecificPrompt("  5k  ");
    expect(prompt).toBe(fiveKPrompt);
  });

  it("all prompts contain medical disclaimer", () => {
    const prompts = [
      generalFitnessPrompt,
      fiveKPrompt,
      tenKPrompt,
      marathonPrompt,
      triathlonPrompt,
      hyroxPrompt,
    ];
    const medicalDisclaimer = "JIMMI is not a medical professional";
    prompts.forEach((prompt) => {
      expect(prompt).toContain(medicalDisclaimer);
    });
  });

  it("5K prompt contains 5K-specific training principles", () => {
    expect(fiveKPrompt).toContain("lactate threshold");
    expect(fiveKPrompt).toContain("aerobic capacity");
    expect(fiveKPrompt).toContain("8-12 weeks");
  });

  it("10K prompt contains 10K-specific training principles", () => {
    expect(tenKPrompt).toContain("sustained aerobic power");
    expect(tenKPrompt).toContain("10-14 weeks");
    expect(tenKPrompt).toContain("long runs");
  });

  it("marathon prompt contains marathon-specific training principles", () => {
    expect(marathonPrompt).toContain("16-20 weeks");
    expect(marathonPrompt).toContain("mental toughness");
    expect(marathonPrompt).toContain("18-20 miles");
  });

  it("triathlon prompt contains triathlon-specific training principles", () => {
    expect(triathlonPrompt).toContain("swim");
    expect(triathlonPrompt).toContain("bike");
    expect(triathlonPrompt).toContain("run");
    expect(triathlonPrompt).toContain("brick workouts");
  });

  it("hyrox prompt contains hyrox-specific training principles", () => {
    expect(hyroxPrompt).toContain("SkiErg");
    expect(hyroxPrompt).toContain("sled push");
    expect(hyroxPrompt).toContain("rope climb");
    expect(hyroxPrompt).toContain("8km");
  });

  it("general fitness prompt contains general principles", () => {
    expect(generalFitnessPrompt).toContain("sustainable habit formation");
    expect(generalFitnessPrompt).toContain("progressive overload");
    expect(generalFitnessPrompt).toContain("variety");
  });
});
