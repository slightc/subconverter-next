/**
 * Shadowsocks (SS) protocol parser
 * Supports both legacy and SIP002 URI formats
 */

import { Proxy, ProxyType, DEFAULT_GROUPS, createProxy } from '../types/proxy';
import { base64Decode, urlSafeBase64Decode } from '../utils/base64';
import { urlDecode, parseQueryString } from '../utils/string';

/**
 * Parse Shadowsocks URI
 * 
 * Formats supported:
 * - Legacy: ss://BASE64(method:password)@server:port#name
 * - SIP002: ss://BASE64(method:password)@server:port/?plugin=xxx#name
 * - Alternative: ss://BASE64(method:password@server:port)#name
 */
export function parseSS(uri: string): Proxy | null {
  if (!uri.startsWith('ss://')) {
    return null;
  }

  try {
    let ss = uri.slice(5).replace('/?', '?');
    let remark = '';
    let group: string = DEFAULT_GROUPS.SS;
    let plugin = '';
    let pluginOpts = '';

    // Extract fragment (node name)
    const hashIndex = ss.indexOf('#');
    if (hashIndex !== -1) {
      remark = urlDecode(ss.slice(hashIndex + 1));
      ss = ss.slice(0, hashIndex);
    }

    // Extract query parameters (plugin settings)
    const queryIndex = ss.indexOf('?');
    if (queryIndex !== -1) {
      const query = ss.slice(queryIndex + 1);
      ss = ss.slice(0, queryIndex);
      
      const params = parseQueryString(query);
      
      // Parse plugin
      if (params.plugin) {
        const pluginStr = urlDecode(params.plugin);
        const semicolonIndex = pluginStr.indexOf(';');
        if (semicolonIndex !== -1) {
          plugin = pluginStr.slice(0, semicolonIndex);
          pluginOpts = pluginStr.slice(semicolonIndex + 1);
        } else {
          plugin = pluginStr;
        }
      }
      
      // Parse group
      if (params.group) {
        group = urlSafeBase64Decode(params.group);
      }
    }

    let server = '';
    let port = 0;
    let method = '';
    let password = '';

    // Try SIP002 format: BASE64(method:password)@server:port
    if (ss.includes('@')) {
      const atIndex = ss.lastIndexOf('@');
      const userInfo = ss.slice(0, atIndex);
      const serverInfo = ss.slice(atIndex + 1);
      
      // Parse server:port
      const colonIndex = serverInfo.lastIndexOf(':');
      if (colonIndex === -1) {
        return null;
      }
      server = serverInfo.slice(0, colonIndex);
      port = parseInt(serverInfo.slice(colonIndex + 1), 10);
      
      // Decode userinfo
      const decoded = urlSafeBase64Decode(userInfo);
      const methodColonIndex = decoded.indexOf(':');
      if (methodColonIndex === -1) {
        return null;
      }
      method = decoded.slice(0, methodColonIndex);
      password = decoded.slice(methodColonIndex + 1);
    } else {
      // Legacy format: BASE64(method:password@server:port)
      const decoded = urlSafeBase64Decode(ss);
      const match = decoded.match(/^(.+?):(.+)@(.+):(\d+)$/);
      if (!match) {
        return null;
      }
      [, method, password, server, port] = match as unknown as [string, string, string, string, number];
      port = parseInt(match[4], 10);
    }

    if (!server || !port || port <= 0 || port > 65535) {
      return null;
    }

    if (!remark) {
      remark = `${server}:${port}`;
    }

    return createProxy({
      type: ProxyType.Shadowsocks,
      remark,
      hostname: server,
      port,
      password,
      encryptMethod: method,
      plugin: plugin || undefined,
      pluginOption: pluginOpts || undefined,
      group,
    });
  } catch {
    return null;
  }
}
