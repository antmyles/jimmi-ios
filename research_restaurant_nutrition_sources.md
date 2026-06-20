# Restaurant Nutrition Data Source Findings

Nutritionix is the strongest fit for US restaurant and franchise menu nutrition because its official API page states that its database includes more than 1M grocery foods with barcodes and 203K restaurant foods, and its database licensing page/search result describes roughly 202,837 restaurant items across 860 restaurants. Nutritionix v2 endpoints include natural-language nutrient parsing, instant search, and search-item lookup, but all endpoints require authentication. Current public pricing indicates a business trial up to 2 monthly active users and paid annual plans starting at $499/month.

FatSecret Platform API is another strong commercial source. Its official platform page states that it covers more than 2.3 million verified foods/products across 58+ countries, including generic, branded, supermarket, and restaurant foods. It offers nutrition, serving options, allergen data, barcode coverage, natural-language processing, and daily updates. It has a free Basic evaluation path and Premier commercial capabilities, but production restaurant coverage likely depends on edition/access.

Open Food Facts remains useful for barcode/package product lookup and is already present in JIMMI. Its documentation describes an open product database with ingredients and nutrition values but explicitly warns there are no assurances that volunteer-contributed data is accurate, complete, or reliable. It also imposes search/product rate limits and is not positioned as a comprehensive US restaurant-chain menu database.

Spoonacular advertises access to chain restaurant menu items and nutrition through its food API, but the public page extraction was blocked/incomplete in this environment. It may be an alternative if Nutritionix/FatSecret pricing or licensing is not acceptable.

Implementation implication: JIMMI cannot honestly claim access to “all” US restaurant/franchise nutrition data. The production-grade path is to integrate a licensed restaurant nutrition API, preferably Nutritionix, and expose a graceful fallback that asks clarifying questions and provides clearly labeled estimates when exact menu-item data is unavailable. Since no Nutritionix/FatSecret credentials are currently configured for this project, the immediate implementation should support credentials via environment variables and provide deterministic internal examples/tests plus LLM-assisted estimation with clear confidence/clarification fields until credentials are supplied.

References:
1. https://www.nutritionix.com/api
2. https://developer.nutritionix.com/docs/v2
3. https://docx.syndigo.com/developers/docs/nutritionix-api-guide
4. https://platform.fatsecret.com/platform-api
5. https://openfoodfacts.github.io/openfoodfacts-server/api/
