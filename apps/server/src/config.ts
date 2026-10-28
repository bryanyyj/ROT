import "dotenv/config";

/** Server configuration from environment (secrets stay server-side). */
export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    baseUrl: "https://openrouter.ai/api/v1",
    // Any model from https://openrouter.ai/models. Slugs ending in ":free" are free-tier.
    model: process.env.OPENROUTER_MODEL ?? "poolside/laguna-s-2.1:free",
    // Cost guard: only call $0 models unless explicitly allowed. Keeps spend at zero.
    freeOnly: process.env.OPENROUTER_ALLOW_PAID !== "true",
    // Defensive cap on output tokens (also limits any accidental spend).
    maxTokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 1200),
  },

  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.STRAVA_REDIRECT_URI ?? "http://localhost:8787/api/strava/callback",
  },
};

export const hasOpenRouter = () => config.openRouter.apiKey.length > 0;
export const isFreeModel = (model = config.openRouter.model) => model.trim().endsWith(":free");

/** Throws if the configured model could incur cost while free-only mode is on. */
export function assertNoCost(): void {
  if (config.openRouter.freeOnly && !isFreeModel()) {
    throw new Error(
      `Cost guard: "${config.openRouter.model}" is not a free model. ` +
        `Use a ":free" model, or set OPENROUTER_ALLOW_PAID=true to allow paid models.`,
    );
  }
}
export const hasStrava = () =>
  config.strava.clientId.length > 0 && config.strava.clientSecret.length > 0;
