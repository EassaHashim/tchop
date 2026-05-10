const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

export const config = {
  supabase: {
    url: required("SUPABASE_URL"),
    key: required("SUPABASE_SERVICE_KEY"),
  },
  firecrawl: {
    apiKey: required("FIRECRAWL_API_KEY"),
  },
  graphApi: {
    url: required("TCHOP_API_URL"),
    token: required("TCHOP_API_TOKEN"),
    org: required("TCHOP_ORG"),
  },
  worker: {
    pollIntervalMs: 60_000,
    maxConcurrency: 3,
    port: parseInt(process.env.PORT || "3000", 10),
  },
  apify: {
    token: process.env.APIFY_TOKEN || "",
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  },
};
