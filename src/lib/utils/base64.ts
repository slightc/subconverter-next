/**
 * Base64 encoding/decoding utilities
 * Supports standard Base64 and URL-safe Base64
 */

/**
 * Encode string to Base64
 */
export function base64Encode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  ));
}

/**
 * Decode Base64 to string
 */
export function base64Decode(str: string): string {
  // Handle URL-safe Base64 (replace - with + and _ with /)
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf-8');
    }
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return '';
  }
}

/**
 * Encode string to URL-safe Base64
 */
export function urlSafeBase64Encode(str: string): string {
  return base64Encode(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode URL-safe Base64 to string
 */
export function urlSafeBase64Decode(str: string): string {
  return base64Decode(str);
}

/**
 * Check if a string is valid Base64
 */
export function isBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  
  // URL-safe base64 pattern
  const base64Regex = /^[A-Za-z0-9+/\-_]*={0,2}$/;
  if (!base64Regex.test(str)) return false;
  
  try {
    base64Decode(str);
    return true;
  } catch {
    return false;
  }
}
