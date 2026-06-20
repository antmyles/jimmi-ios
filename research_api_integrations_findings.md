# Free and Inexpensive API Integration Findings for JIMMI Fit Recovery

## Working assumptions

This research prioritizes APIs that are free, have usable free tiers, or are inexpensive enough to support a pre-launch or early-stage health and fitness product. The most relevant product needs are food logging, macro lookup, barcode scanning, exercise recommendations, recovery guidance, restaurant nutrition lookup, and low-cost messaging or notifications.

## Initial official-source findings

| API or source | Cost/access signal | Useful JIMMI use case | Key constraints |
|---|---|---|---|
| USDA FoodData Central API | Public API; requires a data.gov API key; default rate limit is 1,000 requests per hour per IP; data is public domain under CC0. | Nutrition lookup for generic foods, branded foods, and macro data search. | Key must be kept server-side; stronger for search and nutrient details than barcode-first scanning. |
| Open Food Facts API | Open food product database; read operations do not require auth except identifying custom User-Agent; product read limits include 15 product requests/min/IP and 10 search requests/min/IP. | Barcode-based packaged food lookup, ingredients, allergens, nutrition facts, Nutri-Score, NOVA, additives, vegan/vegetarian flags, and product photos. | Data is community-contributed, so completeness and accuracy vary; write operations require authentication; attribution and license handling are needed. |

## Source URLs captured

1. USDA FoodData Central API Guide: https://fdc.nal.usda.gov/api-guide
2. Open Food Facts API documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/

## Exercise and workout API findings

| API or source | Cost/access signal | Useful JIMMI use case | Key constraints |
|---|---|---|---|
| API Ninjas Exercises API | Requires account API key. The documentation lists more than 3,000 exercises and endpoints for search by name, type, muscle group, difficulty, and equipment. The pricing page shows paid tiers beginning at the Developer tier shown in the captured page; pricing should be verified during account setup because the page uses dynamic plan tables. | Lightweight exercise search, instructions, difficulty, equipment matching, and safety cues. | No media-rich exercise demos in the extracted documentation; API key must be server-side; commercial and caching terms depend on plan. |
| Your Move Exercise API | Pricing page lists paid plans starting at $19/month with a 7-day free trial and includes exercise videos, workout/program generation, nutrition/recipe API, and limited AI form/food photo analysis by tier. | Higher-polish exercise library with videos, program generation, and possible nutrition add-ons. | Paid from early use; video licensing restrictions; watermarked videos on the lowest tier. |
| ExerciseDB / AscendAPI | GitHub page describes 11,000+ exercises, videos, images, GIFs, instructions, equipment, muscles, variations, and related exercises; repository is public with AGPL-3.0 license, while API documentation and pricing are linked externally. | Rich exercise library and workout recommender source if licensing and pricing fit. | Must review pricing and terms carefully; AGPL/public repo status does not mean hosted API is free for production. |

## Additional source URLs captured

3. API Ninjas Exercises API: https://api-ninjas.com/api/exercises
4. API Ninjas Pricing: https://api-ninjas.com/pricing
5. Your Move Exercise API pricing: https://ymove.app/exercise-api/pricing
6. ExerciseDB GitHub repository: https://github.com/exercisedb/exercisedb-api

## Additional nutrition API findings

| API or source | Cost/access signal | Useful JIMMI use case | Key constraints |
|---|---|---|---|
| FatSecret Platform API | Official editions page lists a self-sign-up Basic tier that is free with 5,000 API calls/day, US-only dataset, and attribution. A Premier Free tier is available for verified startups/non-profits/students with unlimited calls, US-only data, and optional paid add-ons. | Food/exercise tracker, recipe and nutrition analysis, barcode scanning, autocomplete, verified branded foods, and food diary support. | Attribution required for lower/free tiers; Premier Free requires application/verification; advanced add-ons such as image recognition and NLP are billed separately by usage. |
| Nutritionix API | Official page emphasizes verified data, natural language, autocomplete, common foods, branded foods, restaurant foods, and >92% UPC match rate, but says non-commercial free trials are no longer offered and upgraded access requires annual plan/contact. | High-quality restaurant/branded food coverage if the app later needs premium verified data. | Not a free/inexpensive first choice; pricing is contact-based/annual and likely better for later stage. |
| CalorieNinjas | Site says it is being turned down/migrated to API Ninjas; the historical service advertised a free key, natural language nutrition lookup, image text, and recipes. | Not recommended as a new direct integration because migration is underway; relevant feature set now maps to API Ninjas Nutrition/Recipe APIs. | Use API Ninjas instead of CalorieNinjas for new work. |

## Additional source URLs captured

7. FatSecret Platform API editions: https://platform.fatsecret.com/api-editions
8. Nutritionix API: https://www.nutritionix.com/api
9. CalorieNinjas migration notice: https://calorieninjas.com/

## Wearable, activity, and recovery API findings

| API or source | Cost/access signal | Useful JIMMI use case | Key constraints |
|---|---|---|---|
| Terra Health & Fitness API | Official pricing documentation says the Quick Start plan includes 100,000 monthly credits, with usage-based pricing beyond that. Credits are consumed by active authentications and events; an active authentication costs 200 credits/month, and the first 400 events per active authentication are free. | Unified wearable integration for activity, sleep, workouts, HR, and recovery-style metrics across multiple sources without building every provider separately. | Requires subscription/account setup and careful usage monitoring; health data privacy and consent flows must be designed carefully. Best after core app flows are stable. |
| Strava API | Official developer docs state the API is free to use, OAuth 2.0 is required, default limits are 200 requests per 15 minutes and 2,000 requests per day per application, and app review is needed to connect the broader athlete community beyond personal/testing use. | Low-cost first activity import for runs, rides, walks, and workout history; useful for recovery recommendations based on training load signals. | Requires OAuth app setup and user consent; not a general wearable/health data source; production community access may require app review. |

## Additional source URLs captured

10. Terra Health & Fitness API pricing: https://docs.tryterra.co/health-and-fitness-api/pricing
11. Strava getting started: https://developers.strava.com/docs/getting-started/

## Platform health data API findings

| API or source | Cost/access signal | Useful JIMMI use case | Key constraints |
|---|---|---|---|
| Android Health Connect | Official Android documentation positions Health Connect as an on-device platform for apps to read and write user-permissioned health and fitness data. It supports Android SDK 28+ and includes data such as heart rate, step count, sleep, exercise sessions, routes, skin temperature, mindfulness, and medical records. | Strong long-term Android pathway for recovery context because it can aggregate health data from multiple apps on a user’s device without paying a third-party aggregator for every connection. | It is primarily a native Android integration, not a simple web API for the current web app. It would require a companion Android app or mobile wrapper strategy and careful permission review. Google Fit APIs are transitioning away starting in 2026, making Health Connect the preferred Android path. |
| Fitbit Web API / Google Health API transition | Official Fitbit Web API documentation states developers may retrieve user-consented Fitbit data and lists activity, sleep, heart rate, HRV, SpO2, temperature, breathing rate, cardio fitness, nutrition, devices, and subscriptions/webhooks. The page also notes Fitbit Web APIs are moving to a new scalable infrastructure and the legacy Fitbit Web API will be deprecated in September 2026. | Valuable low-cost wearable import candidate for sleep, HRV, resting heart rate, recovery, and activity signals if a sufficient number of JIMMI users wear Fitbit devices. | Requires OAuth/user consent and attention to Fitbit/Google migration requirements. Because of the 2026 deprecation notice, a new integration should be planned around the Google Health API direction rather than relying heavily on legacy endpoints. |

## Additional source URLs captured

12. Android Health Connect overview: https://developer.android.com/health-and-fitness/guides/health-connect
13. Fitbit Web API reference: https://dev.fitbit.com/build/reference/web-api/

## Environmental context API findings

| API or source | Cost/access signal | Useful JIMMI use case | Key constraints |
|---|---|---|---|
| Open-Meteo | Official pricing states the free API is available for non-commercial use without service guarantees, while commercial paid plans begin at €29/month for 1 million monthly API calls and include weather forecast, air quality, marine, flood, and elevation APIs. Attribution is required because the underlying open data is licensed under CC BY 4.0. | Low-cost environmental context for recovery recommendations, such as heat, cold, air quality, training conditions, hydration prompts, outdoor-workout risk, and weather-aware recovery guidance. | Free tier is not positioned for production commercial use; attribution is required; commercial usage should use API key customer endpoints. |

## Additional source URLs captured

14. Open-Meteo pricing: https://open-meteo.com/en/pricing
15. Open-Meteo API docs: https://open-meteo.com/en/docs
