import { describe, expect, it } from "vitest";
import { estimateRestaurantMacros, parseRestaurantPortion } from "./restaurantNutrition";

describe("restaurant nutrition estimation", () => {
  it("parses common restaurant portion phrases", () => {
    expect(parseRestaurantPortion("I had half of a Chipotle chicken burrito")).toBe(0.5);
    expect(parseRestaurantPortion("I ate 25% of a Big Mac")).toBe(0.25);
    expect(parseRestaurantPortion("I had 1 1/2 Subway turkey sandwiches")).toBe(1.5);
    expect(parseRestaurantPortion("I ate 2 orders of tacos")).toBe(2);
  });

  it("scales catalog macros for half of a Chipotle chicken burrito", async () => {
    const result = await estimateRestaurantMacros("I had half of a Chipotle chicken burrito");

    expect(result.status).toBe("estimate");
    if (result.status !== "estimate") throw new Error("Expected an estimate");
    expect(result.restaurantName).toBe("Chipotle");
    expect(result.menuItemName).toBe("Chicken Burrito");
    expect(result.portionMultiplier).toBe(0.5);
    expect(result.calories).toBe(473);
    expect(result.protein).toBe(29);
    expect(result.carbs).toBe(54);
    expect(result.fat).toBe(16);
    expect(result.guidance).toContain("adjusted");
  });

  it("asks clarifying questions when a restaurant meal is too vague", async () => {
    const result = await estimateRestaurantMacros("I had food from Chipotle");

    expect(result.status).toBe("needs_clarification");
    expect(result.confidence).toBe("low");
    expect(result.clarifyingQuestions).toEqual(expect.arrayContaining(["What exact menu item did you order?"]));
    expect(result.clarifyingQuestions.length).toBeGreaterThanOrEqual(3);
  });
});
