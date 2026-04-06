export const DEFAULT_GEMINI_TEXT_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image-preview";

function readEnvValue(env, key) {
  return `${env[key] || ""}`.trim();
}

export function getGeminiConfig(env = process.env) {
  const apiKey = readEnvValue(env, "GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return {
    apiKey,
    textModel: readEnvValue(env, "GEMINI_TEXT_MODEL") || DEFAULT_GEMINI_TEXT_MODEL,
    imageModel: readEnvValue(env, "GEMINI_IMAGE_MODEL") || DEFAULT_GEMINI_IMAGE_MODEL,
  };
}
