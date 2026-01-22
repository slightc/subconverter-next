/**
 * Hysteria2 protocol parser
 */

import { Proxy, ProxyType, DEFAULT_GROUPS, createProxy } from '../types/proxy';
import { urlDecode, parseQueryString } from '../utils/string';

/**
 * Parse Hysteria2 URI
 * 
 * Formats:
 * - hysteria2://auth@server:port?params#name
 * - hy2://auth@server:port?params#name
 */
export function parseHysteria2(uri: string): Proxy | null {
  // Normalize protocol prefix
  let hysteria2 = uri
    .replace(/^hy2:\/\//, 'hysteria2://')
    .replace(/\/\?/, '?'); // Replace /? with ?

  if (!hysteria2.startsWith('hysteria2://')) {
    return null;
  }

  try {
    hysteria2 = hysteria2.slice(12);
    let remark = '';

    // Extract fragment (node name)
    const hashIndex = hysteria2.lastIndexOf('#');
    if (hashIndex !== -1) {
      remark = urlDecode(hysteria2.slice(hashIndex + 1));
      hysteria2 = hysteria2.slice(0, hashIndex);
    }

    // Extract query parameters
    let params: Record<string, string> = {};
    const queryIndex = hysteria2.indexOf('?');
    if (queryIndex !== -1) {
      params = parseQueryString(hysteria2.slice(queryIndex + 1));
      hysteria2 = hysteria2.slice(0, queryIndex);
    }

    let server = '';
    let port = 0;
    let password = '';

    // Parse auth@server:port or server:port (with password in params)
    if (hysteria2.includes('@')) {
      const match = hysteria2.match(/^(.+)@(.+):(\d+)$/);
      if (!match) {
        return null;
      }
      [, password, server, port] = match as unknown as [string, string, string, number];
      port = parseInt(match[3], 10);
    } else {
      // Password might be in query params
      password = params.password || '';
      if (!password) {
        return null;
      }

      const match = hysteria2.match(/^(.+):(\d+)$/);
      if (!match) {
        return null;
      }
      [, server, port] = match as unknown as [string, string, number];
      port = parseInt(match[2], 10);
    }

    if (!server || !port || port <= 0 || port > 65535) {
      return null;
    }

    // Parse additional parameters
    const scv = params.insecure === '1' || params.insecure === 'true';
    const up = params.up || '';
    const down = params.down || '';
    const alpn = params.alpn || '';
    const obfs = params.obfs || '';
    const obfsPassword = params['obfs-password'] || '';
    const sni = params.sni || '';
    const fingerprint = params.pinSHA256 || '';

    if (!remark) {
      remark = `${server}:${port}`;
    }

    return createProxy({
      type: ProxyType.Hysteria2,
      remark,
      hostname: server,
      port,
      password,
      ports: port.toString(),
      up: up || undefined,
      down: down || undefined,
      obfs: obfs || undefined,
      obfsPassword: obfsPassword || undefined,
      sni: sni || undefined,
      fingerprint: fingerprint || undefined,
      alpn: alpn ? [alpn] : undefined,
      allowInsecure: scv || undefined,
      group: DEFAULT_GROUPS.Hysteria2,
    });
  } catch {
    return null;
  }
}
