/**
 * Mixed format generator (Base64 encoded links)
 * Outputs all nodes as their native URI format, then Base64 encodes the result
 */

import { Proxy, ProxyType } from '../types/proxy';
import { base64Encode, urlSafeBase64Encode } from '../utils/base64';
import { urlEncode } from '../utils/string';

export interface MixedGeneratorOptions {
  // Type filter: 1=SS, 2=SSR, 4=VMess, 8=Trojan, 16=Hysteria2
  // Use bitwise OR to combine, e.g., 15 = SS|SSR|VMess|Trojan
  types?: number;
}

// Type flags
const TYPE_SS = 1;
const TYPE_SSR = 2;
const TYPE_VMESS = 4;
const TYPE_TROJAN = 8;
const TYPE_HYSTERIA2 = 16;
const TYPE_ALL = TYPE_SS | TYPE_SSR | TYPE_VMESS | TYPE_TROJAN | TYPE_HYSTERIA2;

/**
 * Generate mixed format (Base64 encoded subscription)
 */
export function generateMixed(
  nodes: Proxy[],
  options: MixedGeneratorOptions = {}
): string {
  const types = options.types ?? TYPE_ALL;
  const links: string[] = [];

  for (const node of nodes) {
    const link = nodeToLink(node, types);
    if (link) {
      links.push(link);
    }
  }

  // Join with newlines and encode to Base64
  return base64Encode(links.join('\n'));
}

/**
 * Convert a proxy node to its URI format
 */
function nodeToLink(node: Proxy, types: number): string | null {
  switch (node.type) {
    case ProxyType.Shadowsocks:
      if (!(types & TYPE_SS)) return null;
      return nodeToSSLink(node);
    case ProxyType.ShadowsocksR:
      if (!(types & TYPE_SSR)) return null;
      return nodeToSSRLink(node);
    case ProxyType.VMess:
      if (!(types & TYPE_VMESS)) return null;
      return nodeToVMessLink(node);
    case ProxyType.Trojan:
      if (!(types & TYPE_TROJAN)) return null;
      return nodeToTrojanLink(node);
    case ProxyType.Hysteria2:
      if (!(types & TYPE_HYSTERIA2)) return null;
      return nodeToHysteria2Link(node);
    default:
      return null;
  }
}

/**
 * Convert to Shadowsocks URI (SIP002 format)
 * Format: ss://BASE64(method:password)@server:port#name
 */
function nodeToSSLink(node: Proxy): string {
  const userinfo = urlSafeBase64Encode(`${node.encryptMethod}:${node.password}`);
  let link = `ss://${userinfo}@${node.hostname}:${node.port}`;
  
  // Add plugin if present
  if (node.plugin) {
    let pluginStr = node.plugin;
    if (node.pluginOption) {
      pluginStr += ';' + node.pluginOption;
    }
    link += `?plugin=${urlEncode(pluginStr)}`;
  }
  
  // Add name
  link += `#${urlEncode(node.remark)}`;
  
  return link;
}

/**
 * Convert to ShadowsocksR URI
 * Format: ssr://BASE64(server:port:protocol:method:obfs:password_base64/?params)
 */
function nodeToSSRLink(node: Proxy): string {
  const password = urlSafeBase64Encode(node.password || '');
  
  let ssr = `${node.hostname}:${node.port}:${node.protocol || 'origin'}:${node.encryptMethod}:${node.obfs || 'plain'}:${password}`;
  
  // Add params
  const params: string[] = [];
  if (node.obfsParam) {
    params.push(`obfsparam=${urlSafeBase64Encode(node.obfsParam)}`);
  }
  if (node.protocolParam) {
    params.push(`protoparam=${urlSafeBase64Encode(node.protocolParam)}`);
  }
  params.push(`remarks=${urlSafeBase64Encode(node.remark)}`);
  if (node.group) {
    params.push(`group=${urlSafeBase64Encode(node.group)}`);
  }
  
  if (params.length > 0) {
    ssr += '/?' + params.join('&');
  }
  
  return `ssr://${urlSafeBase64Encode(ssr)}`;
}

/**
 * Convert to VMess URI (v2rayN format)
 * Format: vmess://BASE64(JSON)
 */
function nodeToVMessLink(node: Proxy): string {
  const config = {
    v: '2',
    ps: node.remark,
    add: node.hostname,
    port: String(node.port),
    id: node.userId || '',
    aid: String(node.alterId || 0),
    scy: node.encryptMethod || 'auto',
    net: node.transferProtocol || 'tcp',
    type: node.fakeType || 'none',
    host: node.host || '',
    path: node.path || '',
    tls: node.tlsSecure ? 'tls' : '',
    sni: node.serverName || '',
  };
  
  return `vmess://${base64Encode(JSON.stringify(config))}`;
}

/**
 * Convert to Trojan URI
 * Format: trojan://password@server:port?params#name
 */
function nodeToTrojanLink(node: Proxy): string {
  let link = `trojan://${urlEncode(node.password || '')}@${node.hostname}:${node.port}`;
  
  // Build query params
  const params: string[] = [];
  
  if (node.host) {
    params.push(`sni=${urlEncode(node.host)}`);
  }
  
  const network = node.transferProtocol || 'tcp';
  if (network === 'ws') {
    params.push('type=ws');
    if (node.path) {
      params.push(`path=${urlEncode(node.path)}`);
    }
  } else if (network === 'grpc') {
    params.push('type=grpc');
    if (node.path) {
      params.push(`serviceName=${urlEncode(node.path)}`);
    }
  }
  
  if (node.allowInsecure) {
    params.push('allowInsecure=1');
  }
  
  if (params.length > 0) {
    link += '?' + params.join('&');
  }
  
  link += `#${urlEncode(node.remark)}`;
  
  return link;
}

/**
 * Convert to Hysteria2 URI
 * Format: hysteria2://auth@server:port?params#name
 */
function nodeToHysteria2Link(node: Proxy): string {
  let link = `hysteria2://${urlEncode(node.password || '')}@${node.hostname}:${node.port}`;
  
  // Build query params
  const params: string[] = [];
  
  if (node.sni) {
    params.push(`sni=${urlEncode(node.sni)}`);
  }
  
  if (node.obfs) {
    params.push(`obfs=${urlEncode(node.obfs)}`);
    if (node.obfsPassword) {
      params.push(`obfs-password=${urlEncode(node.obfsPassword)}`);
    }
  }
  
  if (node.up) {
    params.push(`up=${urlEncode(node.up)}`);
  }
  
  if (node.down) {
    params.push(`down=${urlEncode(node.down)}`);
  }
  
  if (node.allowInsecure) {
    params.push('insecure=1');
  }
  
  if (node.fingerprint) {
    params.push(`pinSHA256=${urlEncode(node.fingerprint)}`);
  }
  
  if (params.length > 0) {
    link += '?' + params.join('&');
  }
  
  link += `#${urlEncode(node.remark)}`;
  
  return link;
}
