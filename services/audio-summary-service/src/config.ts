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
  graphApi: {
    url: required("TCHOP_API_URL"),
    token: required("TCHOP_API_TOKEN"),
  },
  claude: {
    apiKey: required("ANTHROPIC_API_KEY"),
  },
  elevenlabs: {
    apiKey: required("ELEVENLABS_API_KEY"),
  },
  worker: {
    pollIntervalMs: 60_000,
    maxConcurrency: 3,
    port: parseInt(process.env.PORT || "3001", 10),
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  },
};
