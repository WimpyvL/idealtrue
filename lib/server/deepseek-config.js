export const DEFAULT_DEEPSEEK_TEXT_MODEL = "deepseek-chat";
export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

function readEnvValue(env, key) {
  return `${env[key] || ""}`.trim();
}

export function hasDeepSeekConfig(env = process.env) {
  return Boolean(readEnvValue(env, "DEEPSEEK_API_KEY"));
}

export function getDeepSeekConfig(env = process.env) {
  const apiKey = readEnvValue(env, "DEEPSEEK_API_KEY");
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  return {
    apiKey,
    textModel: readEnvValue(env, "DEEPSEEK_TEXT_MODEL") || DEFAULT_DEEPSEEK_TEXT_MODEL,
    baseUrl: readEnvValue(env, "DEEPSEEK_BASE_URL") || DEFAULT_DEEPSEEK_BASE_URL,
  };
}
