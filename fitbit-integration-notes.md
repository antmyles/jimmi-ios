# Fitbit Integration Planning Notes

Official Fitbit documentation reviewed on 2026-05-11:

- Fitbit Web API Authorization: https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/
- Fitbit Web API Application Design: https://dev.fitbit.com/build/reference/web-api/developer-guide/application-design/

Key findings:

1. Fitbit Web API uses OAuth 2.0. The recommended flow is Authorization Code Grant with PKCE.
2. A server application type should use a client secret securely on the backend. Client secrets must not be exposed in browser code.
3. Authorization requests require client_id, scope, code_challenge, code_challenge_method=S256, and response_type=code.
4. Token exchange requires client_id, authorization code, code_verifier, and grant_type=authorization_code. Server apps authenticate with a Basic authorization header based on client_id:client_secret.
5. The token response includes access_token, refresh_token, expires_in, scope, token_type, and user_id. Refresh tokens must be stored because losing them requires the user to reauthorize.
6. Fitbit users choose which scopes to share; the app cannot force all scopes or break if a user grants only a subset.
7. Redirect URLs must be registered in Fitbit developer settings, and the redirect_uri sent during authorization must exactly match a registered redirect URL.
8. Fitbit Web API data availability depends on device/app sync. Device sync may happen periodically, and API rate limits are 150 requests per user per hour.
9. Fitbit’s legacy Web API is documented as moving toward Google Health API infrastructure with deprecation noted for September 2026, so implementation should be designed with future migration in mind.

Current JIMMI project findings:

- Oura and WHOOP integration helpers exist in server/oura.ts and server/whoop.ts.
- The Integrations page already has a Fitbit placeholder with copy and a disabled/coming-soon connection state.
- Environment typing currently includes OURA_CLIENT_ID, OURA_CLIENT_SECRET, WHOOP_CLIENT_ID, and WHOOP_CLIENT_SECRET but not Fitbit credentials.
- A Fitbit implementation should add typed FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET support, a backend OAuth helper, callback route, database helpers using the existing wearableConnections pattern, tRPC setup/connect/disconnect/status procedures, detail-page UI enablement, and Vitest coverage.

## Google Health API Decision Update

Official Google guidance indicates that the Google Health API is the forward-looking API for querying Fitbit user data. The migration guide states that Google Health API supports Google OAuth 2.0, a new console registration flow, new scopes, new data types, a new endpoint schema, and a new response format. It also states that new users should default to Google Health API rather than legacy Fitbit OAuth during a dual-library migration.

For JIMMI, there are no existing Fitbit Web API users to migrate. Therefore, there is little product value in building against the legacy Fitbit Web API first and then forcing a second migration/re-consent process before September 2026. The preferred path is to implement the Fitbit row as a Google Health API-powered connection, while labeling it in the UI as Fitbit / Google Health to make the user-facing purpose clear.

Implementation implications:

- Replace the prior Fitbit Client ID / Client Secret requirement with Google Cloud OAuth credentials for a Google Health API web application.
- Enable Google Health API in Google Cloud.
- Configure OAuth consent for external users and health-related scopes.
- Use scopes such as profile.readonly, activity_and_fitness.readonly, health_metrics_and_measurements.readonly, sleep.readonly, and possibly nutrition.readonly later.
- Add backend Google OAuth flow, callback, token storage, refresh logic, disconnect flow, and health data adapter under the existing wearable integration architecture.
- Keep an abstraction named health provider or wearable adapter so Oura, WHOOP, and Google Health can feed JIMMI’s coaching layer consistently.
