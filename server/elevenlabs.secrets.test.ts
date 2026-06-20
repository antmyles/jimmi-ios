import { describe, expect, it } from "vitest";

const ELEVENLABS_USER_ENDPOINT = "https://api.elevenlabs.io/v1/user";
const ELEVENLABS_VOICE_ENDPOINT = "https://api.elevenlabs.io/v1/voices";

describe("ElevenLabs secrets", () => {
  it("validates the configured ElevenLabs API key against the lightweight user endpoint", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    expect(apiKey, "ELEVENLABS_API_KEY must be configured").toBeTruthy();
    expect(apiKey?.startsWith("sk_"), "ELEVENLABS_API_KEY should look like an ElevenLabs secret key").toBe(true);

    const response = await fetch(ELEVENLABS_USER_ENDPOINT, {
      headers: {
        "xi-api-key": apiKey as string,
      },
    });

    expect(response.status, `ElevenLabs API key validation failed with HTTP ${response.status}`).toBe(200);

    const payload = (await response.json()) as { subscription?: unknown; is_new_user?: boolean };
    expect(payload).toEqual(expect.objectContaining({ subscription: expect.anything() }));
  }, 15_000);

  it("validates the configured ElevenLabs Voice ID is accessible with the API key", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    expect(apiKey, "ELEVENLABS_API_KEY must be configured").toBeTruthy();
    expect(voiceId, "ELEVENLABS_VOICE_ID must be configured").toBeTruthy();
    expect(voiceId).toMatch(/^[A-Za-z0-9_-]{10,}$/);

    const response = await fetch(`${ELEVENLABS_VOICE_ENDPOINT}/${voiceId}`, {
      headers: {
        "xi-api-key": apiKey as string,
      },
    });

    expect(response.status, `ElevenLabs Voice ID validation failed with HTTP ${response.status}`).toBe(200);

    const payload = (await response.json()) as { voice_id?: string; name?: string };
    expect(payload.voice_id).toBe(voiceId);
    expect(payload.name).toEqual(expect.any(String));
  }, 15_000);
});
