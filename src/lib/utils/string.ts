/**
 * String manipulation utilities
 */

/**
 * URL encode a string
 */
export function urlEncode(str: string): string {
  return encodeURIComponent(str);
}

/**
 * URL decode a string
 */
export function urlDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Trim whitespace from string
 */
export function trim(str: string): string {
  return str.trim();
}

/**
 * Check if string starts with prefix
 */
export function startsWith(str: string, prefix: string): boolean {
  return str.startsWith(prefix);
}

/**
 * Check if string contains substring
 */
export function contains(str: string, substr: string): boolean {
  return str.includes(substr);
}

/**
 * Split string by delimiter
 */
export function split(str: string, delimiter: string): string[] {
  return str.split(delimiter);
}

/**
 * Replace all occurrences of search with replace
 */
export function replaceAll(str: string, search: string, replace: string): string {
  return str.split(search).join(replace);
}

/**
 * Parse query string to object
 */
export function parseQueryString(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  
  if (!query) return params;
  
  // Remove leading ? if present
  const cleanQuery = query.startsWith('?') ? query.slice(1) : query;
  
  cleanQuery.split('&').forEach(part => {
    const [key, value] = part.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  });
  
  return params;
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  
  return parts.join('&');
}

/**
 * Get line break character used in content
 */
export function getLineBreak(content: string): string {
  if (content.includes('\r\n')) return '\r\n';
  if (content.includes('\r')) return '\r';
  return '\n';
}

/**
 * Split content into lines
 */
export function splitLines(content: string): string[] {
  return content.split(/\r\n|\r|\n/);
}

/**
 * Check if a string matches a regex pattern
 */
export function regexMatch(str: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(str);
  } catch {
    return false;
  }
}

/**
 * Extract match from string using regex
 */
export function regexExtract(str: string, pattern: string, group: number = 0): string | null {
  try {
    const regex = new RegExp(pattern);
    const match = str.match(regex);
    if (match && match[group] !== undefined) {
      return match[group];
    }
  } catch {
    // Invalid regex
  }
  return null;
}

/**
 * Check if a value is a valid port number
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Parse port from string
 */
export function parsePort(str: string): number {
  const port = parseInt(str, 10);
  return isNaN(port) ? 0 : port;
}

/**
 * Check if string is a valid IP address
 */
export function isIPAddress(str: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(str)) {
    const parts = str.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  }
  
  // IPv6 (simplified check)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(str);
}

/**
 * Escape special characters for use in regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
