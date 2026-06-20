# JIMMI Fit Recovery Notes

This recovery build reconstructs the major app experience from the available description and recovered feature details. The original source was not present in the sandbox and the live root URL returned `404`, so this version is a rebuilt implementation rather than a byte-for-byte restoration.

| Recovered area | Current implementation |
|---|---|
| Brand and app shell | Dark energetic **JIMMI Fit** interface with neon green and pink accents, bold typography, landing page, protected dashboard, and mobile navigation. |
| Authentication | Manus OAuth remains the authentication layer, with protected tRPC routes and an admin-only ping contract. |
| Workout logging | Users can log workouts with exercise, sets, reps, weight, duration, and see history with calculated volume. |
| Meal logging | Users can log meals and macros, track daily totals, and use barcode lookup as a recovered food-intelligence path. |
| Progress | Recharts visualizations show macro trends and workout volume/minutes over recent history. |
| Profile/preferences | Users can set timezone, preferred UTC reminder hour, independent reminder toggles, and macro targets. Email delivery is marked deferred because you clarified it was not a core feature. |
| JIMMI chat | Chat answers fitness and nutrition questions using the user's logged meals, workouts, profile, and macro targets. |
| Scanner/camera/photo access | The chat includes camera/photo upload for food macro estimation and a scanner affordance; the meal page includes barcode lookup. |

## Recovered Dropdown Navigation Reference

The uploaded screen recording shows a **top-right circular avatar trigger** that opens a dark dropdown panel beneath the global header. The menu header displays the user's name, email, and a neon yellow-green **BETA** badge. The recovered menu items are **My Profile** with the subtitle "View & update fitness data," **Chat with JIMMI** with "Start a coaching session," **Food Log** with "Track your daily macros," **My Program** with "Training program & workout log," **Account Settings** with "Membership & settings," and **Sign out**. Each navigation item uses a thin white outline icon on the left, a white title, and smaller gray subtitle text. The dropdown should close after selecting a route and remain consistent across authenticated app pages.

Photo and video references can still improve layout fidelity, exact wording, original navigation order, icon placement, and any interaction details from the deleted app.

