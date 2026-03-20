/**
 * Utility to retry asynchronous operations with exponential backoff.
 * Primarily used to handle transient NetworkErrors or cold-start timeouts.
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  backoffFactor?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, backoffFactor = 2 } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      
      const e = err as Record<string, unknown>;
      const message = typeof e?.message === 'string' ? e.message : '';
      
      const isNetworkError = 
        message.includes('NetworkError') || 
        message.includes('fetch') ||
        message.includes('Failed to fetch') ||
        e?.name === 'TypeError' ||
        e?.status === 0;

      if (!isNetworkError || attempt === maxRetries) {
        throw err;
      }

      console.warn(`[Resilience] Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }

  throw lastError;
}
