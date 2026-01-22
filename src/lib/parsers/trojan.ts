/**
 * Trojan protocol parser
 */

import { Proxy, ProxyType, DEFAULT_GROUPS, createProxy } from '../types/proxy';
import { urlDecode, parseQueryString } from '../utils/string';

/**
 * Parse Trojan URI
 * 
 * Format: trojan://password@server:port?params#name
 */
export function parseTrojan(uri: string): Proxy | null {
  if (!uri.startsWith('trojan://')) {
    return null;
  }

  try {
    let trojan = uri.slice(9);
    let remark = '';
    let group: string = DEFAULT_GROUPS.Trojan;

    // Extract fragment (node name)
    const hashIndex = trojan.lastIndexOf('#');
    if (hashIndex !== -1) {
      remark = urlDecode(trojan.slice(hashIndex + 1));
      trojan = trojan.slice(0, hashIndex);
    }

    // Extract query parameters
    let params: Record<string, string> = {};
    const queryIndex = trojan.indexOf('?');
    if (queryIndex !== -1) {
      params = parseQueryString(trojan.slice(queryIndex + 1));
      trojan = trojan.slice(0, queryIndex);
    }

    // Parse password@server:port
    const match = trojan.match(/^(.+)@(.+):(\d+)$/);
    if (!match) {
      return null;
    }

    const [, password, server, portStr] = match;
    const port = parseInt(portStr, 10);

    if (!server || !port || port <= 0 || port > 65535) {
      return null;
    }

    // Parse additional parameters
    let host = params.sni || params.peer || '';
    const tfo = params.tfo === '1' || params.tfo === 'true';
    const scv = params.allowInsecure === '1' || params.allowInsecure === 'true';
    
    if (params.group) {
      group = urlDecode(params.group);
    }

    // Check for WebSocket transport
    let network = 'tcp';
    let path = '';
    
    if (params.ws === '1') {
      network = 'ws';
      path = params.wspath || '';
    } else if (params.type === 'ws') {
      network = 'ws';
      path = params.path || '';
      // URL decode path if needed
      if (path.startsWith('%2F')) {
        path = urlDecode(path);
      }
    }

    if (!remark) {
      remark = `${server}:${port}`;
    }

    return createProxy({
      type: ProxyType.Trojan,
      remark,
      hostname: server,
      port,
      password,
      transferProtocol: network,
      host: host || undefined,
      path: path || undefined,
      tlsSecure: true, // Trojan always uses TLS
      tcpFastOpen: tfo || undefined,
      allowInsecure: scv || undefined,
      group,
    });
  } catch {
    return null;
  }
}
