export class AiProviderError extends Error {
  constructor(provider, message, options = {}) {
    super(message);
    this.name = "AiProviderError";
    this.provider = provider;
    this.statusCode = options.statusCode ?? null;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

export function isRetryableStatusCode(statusCode) {
  return statusCode === 408 || statusCode === 409 || statusCode === 425 || statusCode === 429 || statusCode >= 500;
}
