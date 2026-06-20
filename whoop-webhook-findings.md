# WHOOP Webhook Findings for JIMMI

WHOOP webhooks notify an application when events occur for users who have authenticated with that app. This lets JIMMI react to updated WHOOP data rather than constantly polling the API.

Recommended JIMMI webhook URL: `https://askjimmi.com/api/whoop/webhook`.

Implementation notes from WHOOP documentation:

- The webhook endpoint must be an HTTPS URL that accepts POST requests.
- The request body includes `user_id`, `id`, `type`, and `trace_id`.
- WHOOP supports v2 webhooks by default. v2 uses UUID identifiers aligned with v2 API endpoints.
- Supported event types are `workout.updated`, `workout.deleted`, `sleep.updated`, `sleep.deleted`, `recovery.updated`, and `recovery.deleted`.
- All webhook event types are sent to each configured webhook URL; if JIMMI does not need a specific event, it should still return a 2XX response.
- Security verification uses headers `X-WHOOP-Signature` and `X-WHOOP-Signature-Timestamp`.
- Signature validation formula: base64Encode(HMACSHA256(timestamp_header + raw_http_request_body, client_secret)).
- WHOOP retries failed deliveries five times over about one hour. Failure includes any non-2XX response or timeout.
- WHOOP recommends returning a 2XX within one second and processing expensive work asynchronously, such as by queueing a sync request.
- WHOOP recommends a reconciliation job even when webhooks are used, because webhook delivery is not retried indefinitely.

Recommendation: If the WHOOP app form allows saving a webhook URL without actively testing the endpoint, add `https://askjimmi.com/api/whoop/webhook` now and select v2/default. If the dashboard requires a live responding endpoint during setup, leave webhook blank temporarily and add it after JIMMI has deployed the webhook route.

Sources:

- https://developer.whoop.com/docs/developing/webhooks/
