# Strava API notes for JIMMI

Sources reviewed on 2026-05-11:

- Strava Getting Started: https://developers.strava.com/docs/getting-started/
- Strava Authentication: https://developers.strava.com/docs/authentication/
- Strava Webhooks: https://developers.strava.com/docs/webhooks/
- Strava API Reference: https://developers.strava.com/docs/reference/
- Strava Rate Limits: https://developers.strava.com/docs/rate-limits/
- Strava API Agreement: https://www.strava.com/legal/api

Key findings:

1. Strava states that the REST API includes data on athletes, segments, routes, clubs, and gear, and that it is free to use.
2. Strava requires OAuth 2.0 for access to athlete data. Users authorize scopes, and apps receive short-lived access tokens plus refresh tokens.
3. Default rate limits are 200 requests per 15 minutes and 2,000 requests per day overall. The default non-upload read limit is 100 requests per 15 minutes and 1,000 requests per day.
4. Newly created apps start in “Single Player Mode” with athlete capacity of 1; apps that intend to expand to the Strava athlete community must submit for review via the Developer Program form before authenticating more athletes.
5. Strava webhooks support athlete deauthorization and activity create, update, and delete events. Webhooks notify the app of changes, but the app may need to fetch full activity details afterward.
6. Strava webhook POST requests include an X-Strava-Signature header and must be acknowledged with 200 OK within two seconds. Longer processing should be asynchronous.
7. Strava activity data can include activity-specific metrics such as sport type, moving time, elapsed time, distance, elevation, speed, heart-rate availability, calories, route/map data, and related activity details depending on scopes and the underlying activity.
8. Strava is not a general wearable-health aggregator. It is strong for workout/activity data and weaker for daily recovery data such as sleep, HRV readiness, continuous vitals, body composition, or nutrition.
9. Strava API Agreement highlights include respecting user privacy, not replicating Strava functionality, complying with volume limits and use restrictions, protecting data, and displaying required Strava/brand attribution where Strava data is used.

Preliminary conclusion:

Strava is a good low-cost beta integration for workout context in JIMMI, especially runs, rides, hikes, walks, activity history, distance, duration, pace/speed, elevation, calories, and sometimes heart-rate fields. It should not be treated as a Terra replacement for comprehensive wearable, sleep, HRV, recovery, body composition, and broad device data.
