# Oura Developer App Setup Notes

Source reviewed: https://cloud.ouraring.com/docs/authentication, accessed May 11, 2026.

Oura uses OAuth 2.0 for user-authorized access. The official authorization endpoint is `https://cloud.ouraring.com/oauth/authorize`, and the access-token endpoint is `https://api.ouraring.com/oauth/token`.

For JIMMI, use the server-side OAuth authorization-code flow. The authorization request should use `response_type=code`, the Oura developer app `client_id`, the exact configured `redirect_uri`, a CSRF-protective `state`, and only the required scopes. For calorie and sleep needs, the key scope is `daily`, because Oura documents this as daily summaries of sleep, activity, and readiness. Optional supporting scopes are `email` for account matching and `personal` if height/weight context is required later.

Recommended production redirect URL for the Oura developer app: `https://askjimmi.com/api/oura/callback`.

Recommended development redirect URL if Oura allows more than one redirect URI: use the current Manus dev preview callback, but production should remain `https://askjimmi.com/api/oura/callback`.

Oura redirects back to the configured redirect URI with `code`, `scope`, and `state` when the user grants access. If denied, Oura returns `error=access_denied` and `state`.

The token exchange is a `POST` to `https://api.ouraring.com/oauth/token` with `grant_type=authorization_code`, the returned `code`, the same `redirect_uri`, and either HTTP Basic auth or `client_id` plus `client_secret` in the form body. The response includes a bearer access token, expiration, and a single-use refresh token. Refresh-token rotation must be handled safely.

The client secret must never be exposed in browser code. JIMMI should store Oura client credentials as environment secrets and store user tokens only server-side.
