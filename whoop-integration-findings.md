# WHOOP Integration Findings

Official WHOOP developer documentation confirms that user data access requires OAuth 2.0 authorization. The authorization URL is `https://api.prod.whoop.com/oauth/oauth2/auth`, and the token URL is `https://api.prod.whoop.com/oauth/oauth2/token`.

WHOOP requires a registered redirect URL in the developer dashboard, and the OAuth authorization request redirect URI must match the registered dashboard value. WHOOP supports HTTPS redirect URLs and custom app-scheme redirect URLs.

WHOOP recommends using a `state` parameter to protect against CSRF. The documentation notes that if generating it manually, the state parameter must be eight characters long.

WHOOP access tokens are short-lived and include `expires_in`. Refresh tokens are only returned when the app requests the `offline` scope. Token refresh invalidates the previous refresh token, so the app must persist the newest refresh token from each refresh response.

WHOOP API scopes listed in the official API docs include `read:recovery`, `read:cycles`, `read:workout`, `read:sleep`, `read:profile`, and `read:body_measurement`. Recovery includes recovery score, HRV, resting heart rate, SpO2, and skin temperature. Cycle data includes day strain, kilojoules, average heart rate, and max heart rate. Sleep data includes sleep performance, consistency, efficiency, stage durations, respiratory rate, and sleep need. Workout data includes workout activity metrics.

Key official references:
- https://developer.whoop.com/docs/developing/oauth/
- https://developer.whoop.com/api/

Official Getting Started page details: developers must create an App in the WHOOP Developer Dashboard, sign in with a WHOOP account, create a Team if needed, and select at least one scope before the app can be created. WHOOP allows up to 5 apps by default. Each app must include at least one redirect URL, and the redirect URI sent in the OAuth authorization request must match a Developer Dashboard redirect URL. The app provides a Client ID and Client Secret after creation. WHOOP explicitly warns that the Client Secret should never be logged, shared, or exposed in client, web, or mobile application code; it should only be used server-side.

Additional official reference:
- https://developer.whoop.com/docs/developing/getting-started/

## JIMMI Implementation Map

For JIMMI, the likely production redirect URI should be `https://askjimmi.com/api/whoop/callback`, matching the existing Oura pattern and keeping provider callbacks under `/api/{provider}/callback`.

The first WHOOP app should request only the scopes needed for launch: `read:profile`, `read:body_measurement`, `read:recovery`, `read:cycles`, `read:sleep`, and `offline` for refresh tokens. `read:workout` can be included at launch if JIMMI will immediately use workout strain and activity records; otherwise it can be added later to reduce consent friction. Server-side code must store Client ID and Client Secret as environment secrets, never in frontend code.

The implementation should mirror the Oura connection foundation: add WHOOP token metadata columns or provider-compatible rows, create signed state generation and verification, register the Express callback route, add protected tRPC procedures for setup metadata, authorization URL generation, connection status, disconnect, and sync readiness, and add account settings UI controls for connect/disconnect. Future sync work should normalize WHOOP recovery, sleep, cycle, body measurement, and optional workout data into JIMMI's wearable metrics tables.
