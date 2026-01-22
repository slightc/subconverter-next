/**
 * HTTP fetch utilities with timeout and error handling
 */

export interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
}

const DEFAULT_TIMEOUT = 15000; // 15 seconds
const DEFAULT_USER_AGENT = 'subconverter-next/0.1.0';

/**
 * Fetch URL with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, headers = {}, userAgent } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent || DEFAULT_USER_AGENT,
        ...headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch URL and return text content
 */
export async function fetchText(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const response = await fetchWithTimeout(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Fetch subscription content from URL
 * Handles multiple URLs separated by |
 */
export async function fetchSubscription(
  urls: string | string[],
  options: FetchOptions = {}
): Promise<string> {
  const urlList = Array.isArray(urls) 
    ? urls 
    : urls.split('|').map(u => u.trim()).filter(Boolean);
  
  const results: string[] = [];
  
  for (const url of urlList) {
    try {
      const content = await fetchText(url, options);
      if (content) {
        results.push(content);
      }
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      // Continue with other URLs
    }
  }
  
  return results.join('\n');
}

/**
 * Extract subscription info from response headers
 */
export function parseSubscriptionInfo(headers: Headers): Record<string, string> {
  const info: Record<string, string> = {};
  
  const userInfo = headers.get('subscription-userinfo');
  if (userInfo) {
    // Parse format: upload=123; download=456; total=789; expire=1234567890
    userInfo.split(';').forEach(part => {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value) {
        info[key] = value;
      }
    });
  }
  
  return info;
}
