# Calorie Burn and Sleep Quality API Recommendation for JIMMI

**Date:** May 11, 2026  
**Scope:** Active calories burned, total calories burned, and optional sleep quality data from wearable or health-platform providers only. Food, barcode, nutrition, and restaurant APIs are intentionally excluded from this recommendation.

## Executive Recommendation

For JIMMI’s current web app, the strongest low-cost first provider is **Oura API V2**. It is the cleanest match because its official V2 API exposes the exact fields JIMMI needs: `active_calories`, `total_calories`, a daily activity `score`, and a daily sleep `score` with contributor breakdowns through web-accessible OAuth endpoints.[^oura-docs] Oura also allows OAuth applications with a default ten-user limit before broader approval, which is useful for a beta-sized validation phase.[^oura-start]

The best secondary path is **Fitbit now, with Google Health API migration planning from day one**. Fitbit’s Daily Activity Summary endpoint exposes `summary.activityCalories` and `summary.caloriesOut`, which map directly to JIMMI’s active-calorie and total-calorie needs.[^fitbit-activity] Fitbit also has sleep endpoints, but its legacy Fitbit Web API is being deprecated in September 2026, and Google positions the **Google Health API** as the next-generation Fitbit Web API infrastructure.[^fitbit-web][^google-health]

Terra should be treated as a later **paid aggregator** option if JIMMI needs broad multi-device coverage across many brands. Garmin is strong from a data standpoint, but it requires approval and commercial licensing for production use. Apple HealthKit and Android Health Connect are excellent long-term mobile-app paths, but they are native platform APIs rather than simple server-side web APIs. WHOOP provides high-quality sleep and recovery scores, and cycle energy in kilojoules, but it is less direct than Oura or Fitbit for active calories and total daily calories.

## Provider Comparison

| Provider | Low-cost fit for beta | Active calories | Total calories | Sleep quality | Web-app compatibility | Main drawback | Recommendation |
|---|---:|---:|---:|---:|---:|---|---|
| **Oura API V2** | **High** | **Yes: `active_calories`** | **Yes: `total_calories`** | **Yes: daily sleep `score` + contributors** | **High: OAuth2 web API** | Default OAuth app limit is 10 users until approval; users need Oura Ring accounts. | **Implement first if user wants the most direct calorie/sleep provider.** |
| **Fitbit Web API / Google Health API** | **Medium to high** | **Yes: `activityCalories`** | **Yes: `caloriesOut`** | Yes: sleep API family | **High now; migration required** | Legacy Fitbit Web API deprecates September 2026, so new work must account for Google Health API migration. | **Good second provider, but design with migration in mind.** |
| **Terra** | Medium | Likely yes through normalized activity data | Likely yes through normalized daily data | Yes, across supported sources | **High: aggregator web API** | Paid subscription/credit model; may be premature before beta demand is proven. | **Defer until JIMMI needs multi-device coverage.** |
| **Garmin Health API** | Low to medium | Yes, Garmin lists calories | Yes, Garmin lists calories | Yes, Garmin lists sleep | Medium: REST API after approval | Commercial use requires license fee payment; approval process. | **Do not start here unless Garmin users are the core audience.** |
| **Apple HealthKit** | High for iOS app, low for current web app | Yes through HealthKit data types/activity summaries | Yes through HealthKit data types/activity summaries | Yes through HealthKit sleep-related data | **Low for current web-only app** | Native Apple framework, not a simple backend API. | **Plan for later iOS/native companion app.** |
| **Android Health Connect** | High for Android app, low for current web app | Yes through Android health data types | Yes through Android health data types | Yes: sleep sessions/data | **Low for current web-only app** | Native Android API, not a simple backend API. | **Plan for later Android/native companion app.** |
| **WHOOP API** | Medium | Not direct in viewed model | Cycle exposes `kilojoule`, which can be converted to kcal but is not the same as a direct total-calorie field | **Yes: sleep performance, consistency, efficiency; recovery score** | High: OAuth2 web API | Better for recovery/sleep than direct calorie accounting; membership/device audience is narrower. | **Consider later for recovery premium insights, not the first calorie provider.** |

## Why Oura Should Be First

Oura is the best match because it minimizes both product ambiguity and engineering ambiguity. JIMMI needs active calories, total calories, and sleep quality. Oura’s Daily Activity and Daily Sleep routes expose those concepts almost exactly as JIMMI would store and display them, so the implementation can remain simple: connect the user’s Oura account, request consent, fetch recent daily activity and daily sleep documents, store normalized records, and show calorie-balance plus recovery-context insights.

This also reduces early cost risk. Instead of paying for an aggregator immediately, JIMMI can validate whether users actually connect wearable data and whether calorie-out plus sleep quality improves coaching engagement. If beta users respond positively and ask for additional devices, Terra or a broader provider layer becomes easier to justify.

## Why Fitbit Is Second, Not First

Fitbit is attractive because it has strong consumer awareness and its activity summary provides the two calorie values JIMMI wants: `activityCalories` and `caloriesOut`.[^fitbit-activity] However, the deprecation notice matters. Fitbit states that the legacy Web API is moving to a new infrastructure and will be deprecated in September 2026.[^fitbit-web] Google now describes the Google Health API as the next generation of the Fitbit Web API, using Google OAuth 2.0 and consolidating health data into a unified infrastructure.[^google-health]

For that reason, Fitbit is still useful, but it should be implemented behind a clean internal provider adapter so JIMMI can migrate from legacy Fitbit endpoints to Google Health API endpoints without rewriting the user experience.

## Suggested Implementation Order After User Confirmation

| Step | Provider | Deliverable | Why it comes here |
|---:|---|---|---|
| 1 | **Oura** | OAuth connection, token storage, daily activity sync, daily sleep sync, normalized database records, and premium calorie/sleep insight cards. | Fastest path to exact active-calorie, total-calorie, and sleep-score coverage. |
| 2 | **Fitbit / Google Health-ready adapter** | Provider adapter interface plus Fitbit connection if desired, with clear migration notes. | Adds broader consumer wearable coverage but avoids locking JIMMI to a soon-to-deprecate legacy API shape. |
| 3 | **Terra evaluation** | Cost and usage test once beta demand is proven. | Aggregator cost becomes worthwhile only when users ask for many device brands. |
| 4 | **Apple HealthKit / Android Health Connect** | Native mobile companion planning, not web-only implementation. | Best long-term route for Apple Watch, iPhone, Android, Samsung, and multi-app health data, but requires native app work. |
| 5 | **WHOOP** | Recovery-focused premium insights if JIMMI has WHOOP-heavy users. | Excellent recovery/sleep data, less direct for total daily calorie accounting. |

## Implementation Guardrails

JIMMI should not begin coding until the provider choice is confirmed. Once the provider is selected, all OAuth client IDs and secrets should be managed through the project’s secure secret workflow rather than committed to code. Wearable tokens should be stored server-side only, and all third-party responses should be normalized into JIMMI’s own internal fields: provider, provider user ID, source date, active calories, total calories, sleep score, sleep contributors, sync status, and fetched timestamp.

The first version should also include a clear user-facing consent explanation: JIMMI is reading calorie burn and sleep/recovery metrics to personalize coaching, not to sell or expose health data. This is important because calorie and sleep metrics are sensitive wellness data even when they are not formal medical records.

## Decision Needed

Please choose which implementation path you want first:

| Option | What it means | Best for |
|---|---|---|
| **Option A: Oura first** | Build the most direct active calories + total calories + sleep score integration first. | Fastest precise beta implementation. |
| **Option B: Fitbit first** | Build Fitbit now but design carefully around the Google Health API migration. | Larger consumer familiarity, but more migration risk. |
| **Option C: Oura + Fitbit adapter plan** | Build Oura first and structure the code so Fitbit can be added next. | Best long-term technical path without taking on both integrations immediately. |
| **Option D: Terra later** | Do not build direct providers yet; wait until broad wearable coverage is worth a paid aggregator. | Teams that want many device brands with less custom integration work later. |

My recommendation is **Option C: build Oura first, using a provider-adapter structure that makes Fitbit/Google Health the next add-on**.

## References

[^oura-docs]: [Oura API V2 documentation](https://cloud.ouraring.com/v2/docs).  
[^oura-start]: [Oura API getting started documentation](https://cloud.ouraring.com/docs/).  
[^fitbit-activity]: [Fitbit Get Daily Activity Summary endpoint](https://dev.fitbit.com/build/reference/web-api/activity/get-daily-activity-summary/).  
[^fitbit-web]: [Fitbit Web API reference and deprecation notice](https://dev.fitbit.com/build/reference/web-api/).  
[^google-health]: [Google Health API overview](https://developers.google.com/health).  
[^terra-pricing]: [Terra Health & Fitness API pricing](https://docs.tryterra.co/health-and-fitness-api/pricing).  
[^garmin-health]: [Garmin Health API overview](https://developer.garmin.com/gc-developer-program/health-api/).  
[^apple-healthkit]: [Apple HealthKit documentation](https://developer.apple.com/documentation/healthkit).  
[^health-connect]: [Android Health Connect documentation](https://developer.android.com/health-and-fitness/health-connect).  
[^whoop-sleep]: [WHOOP Sleep data model](https://developer.whoop.com/docs/developing/user-data/sleep/).  
[^whoop-cycle]: [WHOOP Cycle data model](https://developer.whoop.com/docs/developing/user-data/cycle/).  
[^whoop-recovery]: [WHOOP Recovery data model](https://developer.whoop.com/docs/developing/user-data/recovery/).  
