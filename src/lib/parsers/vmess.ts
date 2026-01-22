/**
 * VMess protocol parser
 * Supports v2rayN JSON format and standard VMess URI
 */

import { Proxy, ProxyType, DEFAULT_GROUPS, createProxy } from '../types/proxy';
import { urlSafeBase64Decode } from '../utils/base64';
import { urlDecode, parseQueryString } from '../utils/string';

interface V2rayNConfig {
  v?: string;
  ps?: string;
  add?: string;
  port?: string | number;
  id?: string;
  aid?: string | number;
  net?: string;
  type?: string;
  host?: string;
  path?: string;
  tls?: string;
  sni?: string;
  scy?: string;
}

/**
 * Parse VMess URI
 * 
 * Formats supported:
 * - v2rayN: vmess://BASE64(JSON)
 * - Standard: vmess://uuid@server:port?params#name
 * - Shadowrocket: vmess://BASE64(method:uuid)@server:port?params#name
 */
export function parseVMess(uri: string): Proxy | null {
  if (!uri.startsWith('vmess://') && !uri.startsWith('vmess1://')) {
    return null;
  }

  try {
    // Check for Shadowrocket style: vmess://BASE64?params
    if (/vmess:\/\/[A-Za-z0-9\-_]+\?/.test(uri)) {
      return parseShadowrocketVMess(uri);
    }

    // Check for standard style: vmess://uuid@server:port
    if (/vmess:\/\/.*?@/.test(uri)) {
      return parseStandardVMess(uri);
    }

    // v2rayN style: vmess://BASE64(JSON)
    const base64Part = uri.replace(/^vmess1?:\/\//, '');
    const decoded = urlSafeBase64Decode(base64Part);
    
    // Check if it's Quantumult format (contains "=")
    if (decoded.includes(' = ')) {
      return parseQuantumultVMess(decoded);
    }

    // Parse as JSON
    let config: V2rayNConfig;
    try {
      config = JSON.parse(decoded);
    } catch {
      return null;
    }

    const version = config.v || '1';
    const ps = config.ps || '';
    const add = (config.add || '').trim();
    const port = parseInt(String(config.port || 0), 10);
    const id = config.id || '00000000-0000-0000-0000-000000000000';
    const aid = parseInt(String(config.aid || 0), 10);
    const net = config.net || 'tcp';
    const type = config.type || '';
    const tls = config.tls || '';
    const sni = config.sni || '';
    const cipher = config.scy || 'auto';

    let host = config.host || '';
    let path = config.path || '';

    // Handle version 1 format (host contains "host;path")
    if (version === '1' && host && host.includes(';')) {
      const parts = host.split(';');
      host = parts[0];
      path = parts[1] || path;
    }

    if (!add || !port || port <= 0 || port > 65535) {
      return null;
    }

    const remark = ps || `${add}:${port}`;

    return createProxy({
      type: ProxyType.VMess,
      remark,
      hostname: add,
      port,
      userId: id,
      alterId: aid,
      encryptMethod: cipher,
      transferProtocol: net || 'tcp',
      fakeType: type || undefined,
      host: host || undefined,
      path: path || '/',
      tlsSecure: tls === 'tls',
      serverName: sni || undefined,
      group: DEFAULT_GROUPS.VMess,
    });
  } catch {
    return null;
  }
}

/**
 * Parse standard VMess URI format
 * Format: vmess://uuid@server:port?params#name
 */
function parseStandardVMess(uri: string): Proxy | null {
  try {
    let vmess = uri.slice(8);
    let remark = '';

    // Extract fragment
    const hashIndex = vmess.lastIndexOf('#');
    if (hashIndex !== -1) {
      remark = urlDecode(vmess.slice(hashIndex + 1));
      vmess = vmess.slice(0, hashIndex);
    }

    // Parse: net+tls:uuid-aid@server:port?params
    const stdPattern = /^([a-z]+)(?:\+([a-z]+))?:([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})-(\d+)@(.+):(\d+)(?:\/?\?(.*))?$/i;
    const match = vmess.match(stdPattern);
    if (!match) {
      return null;
    }

    const [, net, tls, id, aidStr, add, portStr, query] = match;
    const aid = parseInt(aidStr, 10);
    const port = parseInt(portStr, 10);

    if (!add || !port || port <= 0 || port > 65535) {
      return null;
    }

    const params = query ? parseQueryString(query) : {};
    let type = '';
    let host = '';
    let path = '';

    switch (net) {
      case 'tcp':
      case 'kcp':
        type = params.type || '';
        break;
      case 'http':
      case 'ws':
        host = params.host || '';
        path = params.path || '';
        break;
      case 'quic':
        type = params.security || '';
        host = params.type || '';
        path = params.key || '';
        break;
    }

    if (!remark) {
      remark = `${add}:${port}`;
    }

    return createProxy({
      type: ProxyType.VMess,
      remark,
      hostname: add,
      port,
      userId: id,
      alterId: aid,
      encryptMethod: 'auto',
      transferProtocol: net,
      fakeType: type || undefined,
      host: host || undefined,
      path: path || '/',
      tlsSecure: tls === 'tls',
      group: DEFAULT_GROUPS.VMess,
    });
  } catch {
    return null;
  }
}

/**
 * Parse Shadowrocket VMess URI format
 */
function parseShadowrocketVMess(uri: string): Proxy | null {
  try {
    let rocket = uri.slice(8);
    
    const queryIndex = rocket.indexOf('?');
    const query = rocket.slice(queryIndex + 1);
    rocket = rocket.slice(0, queryIndex);

    const decoded = urlSafeBase64Decode(rocket);
    const match = decoded.match(/^(.+?):(.+)@(.+):(\d+)$/);
    if (!match) {
      return null;
    }

    const [, cipher, id, add, portStr] = match;
    const port = parseInt(portStr, 10);

    if (!port || port <= 0 || port > 65535) {
      return null;
    }

    const params = parseQueryString(query);
    let remark = params.remarks ? urlDecode(params.remarks) : '';
    let net = 'tcp';
    let host = '';
    let path = '';
    const tls = params.tls === '1' ? 'tls' : '';
    const aid = parseInt(params.aid || '0', 10);

    const obfs = params.obfs || '';
    if (obfs === 'websocket') {
      net = 'ws';
      host = params.obfsParam || '';
      path = params.path || '';
    } else if (params.network) {
      net = params.network;
      host = params.wsHost || '';
      path = params.wspath || '';
    }

    if (!remark) {
      remark = `${add}:${port}`;
    }

    return createProxy({
      type: ProxyType.VMess,
      remark,
      hostname: add,
      port,
      userId: id,
      alterId: aid,
      encryptMethod: cipher,
      transferProtocol: net,
      host: host || undefined,
      path: path || '/',
      tlsSecure: tls === 'tls',
      group: DEFAULT_GROUPS.VMess,
    });
  } catch {
    return null;
  }
}

/**
 * Parse Quantumult VMess format
 */
function parseQuantumultVMess(quan: string): Proxy | null {
  try {
    // Format: name = vmess, server, port, cipher, "uuid", ...
    const parts = quan.split(',').map(s => s.trim());
    if (parts.length < 6 || !parts[1].includes('vmess')) {
      return null;
    }

    const remark = parts[0].split('=')[0].trim();
    const add = parts[2];
    const port = parseInt(parts[3], 10);
    const cipher = parts[4];
    const id = parts[5].replace(/"/g, '');

    if (!add || !port || port <= 0 || port > 65535) {
      return null;
    }

    let net = 'tcp';
    let tls = '';
    let host = '';
    let path = '/';

    // Parse additional options
    for (let i = 6; i < parts.length; i++) {
      const [key, value] = parts[i].split('=').map(s => s.trim());
      switch (key) {
        case 'over-tls':
          tls = value === 'true' ? 'tls' : '';
          break;
        case 'tls-host':
          host = value;
          break;
        case 'obfs-path':
          path = value.replace(/"/g, '');
          break;
        case 'obfs':
          if (value === 'ws') net = 'ws';
          break;
      }
    }

    return createProxy({
      type: ProxyType.VMess,
      remark,
      hostname: add,
      port,
      userId: id,
      alterId: 0,
      encryptMethod: cipher,
      transferProtocol: net,
      host: host || undefined,
      path,
      tlsSecure: tls === 'tls',
      group: DEFAULT_GROUPS.VMess,
    });
  } catch {
    return null;
  }
}
