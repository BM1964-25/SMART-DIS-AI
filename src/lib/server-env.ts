const requiredServerEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DOCUMENTS_BUCKET",
  "BUILTSMART_BOOTSTRAP_ORGANIZATION_ID"
] as const;

type RequiredServerEnvKey = (typeof requiredServerEnvKeys)[number];

export type ServerEnv = Record<RequiredServerEnvKey, string>;

export function getServerEnv(): ServerEnv {
  const entries = requiredServerEnvKeys.map((key) => [key, process.env[key]] as const);
  const missing = entries.filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required server environment variables: ${missing.join(", ")}`);
  }

  return Object.fromEntries(entries) as ServerEnv;
}

export function getOpenAiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing required server environment variable: OPENAI_API_KEY");
  }

  return apiKey;
}
