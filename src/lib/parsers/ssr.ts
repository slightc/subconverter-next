/**
 * ShadowsocksR (SSR) protocol parser
 */

import { Proxy, ProxyType, DEFAULT_GROUPS, createProxy } from '../types/proxy';
import { urlSafeBase64Decode } from '../utils/base64';
import { parseQueryString } from '../utils/string';

// SS ciphers that can be used without SSR-specific features
const SS_CIPHERS = [
  'rc4-md5', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm',
  'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb',
  'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
  'camellia-128-cfb', 'camellia-192-cfb', 'camellia-256-cfb',
  'bf-cfb', 'chacha20-ietf-poly1305', 'xchacha20-ietf-poly1305',
  'salsa20', 'chacha20', 'chacha20-ietf',
  '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm',
  '2022-blake3-chacha20-poly1305'
];

/**
 * Parse ShadowsocksR URI
 * 
 * Format: ssr://BASE64(server:port:protocol:method:obfs:password_base64/?params)
 */
export function parseSSR(uri: string): Proxy | null {
  if (!uri.startsWith('ssr://')) {
    return null;
  }

  try {
    let ssr = uri.slice(6).replace(/\r/g, '');
    ssr = urlSafeBase64Decode(ssr);

    let remarks = '';
    let group: string = DEFAULT_GROUPS.SSR;
    let obfsParam = '';
    let protoParam = '';

    // Extract query parameters
    const queryIndex = ssr.indexOf('/?');
    if (queryIndex !== -1) {
      const query = ssr.slice(queryIndex + 2);
      ssr = ssr.slice(0, queryIndex);
      
      const params = parseQueryString(query);
      
      if (params.group) {
        group = urlSafeBase64Decode(params.group);
      }
      if (params.remarks) {
        remarks = urlSafeBase64Decode(params.remarks);
      }
      if (params.obfsparam) {
        obfsParam = urlSafeBase64Decode(params.obfsparam).replace(/\s/g, '');
      }
      if (params.protoparam) {
        protoParam = urlSafeBase64Decode(params.protoparam).replace(/\s/g, '');
      }
    }

    // Parse main part: server:port:protocol:method:obfs:password_base64
    const match = ssr.match(/^(.+):(\d+):(.+?):(.+?):(.+?):(.+)$/);
    if (!match) {
      return null;
    }

    const [, server, portStr, protocol, method, obfs, passwordBase64] = match;
    const port = parseInt(portStr, 10);
    const password = urlSafeBase64Decode(passwordBase64);

    if (!server || !port || port <= 0 || port > 65535) {
      return null;
    }

    if (!group) {
      group = DEFAULT_GROUPS.SSR;
    }
    if (!remarks) {
      remarks = `${server}:${port}`;
    }

    // Check if it's actually a plain SS (origin protocol, plain obfs, and SS cipher)
    const isPlainSS = SS_CIPHERS.includes(method) &&
      (!obfs || obfs === 'plain') &&
      (!protocol || protocol === 'origin');

    if (isPlainSS) {
      return createProxy({
        type: ProxyType.Shadowsocks,
        remark: remarks,
        hostname: server,
        port,
        password,
        encryptMethod: method,
        group,
      });
    }

    return createProxy({
      type: ProxyType.ShadowsocksR,
      remark: remarks,
      hostname: server,
      port,
      password,
      encryptMethod: method,
      protocol,
      protocolParam: protoParam || undefined,
      obfs,
      obfsParam: obfsParam || undefined,
      group,
    });
  } catch {
    return null;
  }
}
