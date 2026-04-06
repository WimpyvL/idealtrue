export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message) {
      return 'An unknown error occurred';
    }

    try {
      const parsed = JSON.parse(message) as { message?: string };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
    } catch {
      // Fall back to the raw message when the error is not JSON payload.
    }

    return message;
  }
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}
