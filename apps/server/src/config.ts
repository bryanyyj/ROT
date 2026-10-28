import "dotenv/config";

/** Server configuration from environment (secrets stay server-side). */
export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    baseUrl: "https://openrouter.ai/api/v1",
    // Any model from https://openrouter.ai/models. Slugs ending in ":free" are free-tier.
    model: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
  },

  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.STRAVA_REDIRECT_URI ?? "http://localhost:8787/api/strava/callback",
  },
};

export const hasOpenRouter = () => config.openRouter.apiKey.length > 0;
export const hasStrava = () =>
  config.strava.clientId.length > 0 && config.strava.clientSecret.length > 0;
