/**
 * Protocol parser dispatcher
 */

import { Proxy, ProxyType, isValidProxy } from '../types/proxy';
import { base64Decode, urlSafeBase64Decode, isBase64 } from '../utils/base64';
import { splitLines } from '../utils/string';
import { parseSS } from './ss';
import { parseSSR } from './ssr';
import { parseVMess } from './vmess';
import { parseTrojan } from './trojan';
import { parseHysteria2 } from './hysteria2';
import YAML from 'yaml';

export { parseSS } from './ss';
export { parseSSR } from './ssr';
export { parseVMess } from './vmess';
export { parseTrojan } from './trojan';
export { parseHysteria2 } from './hysteria2';
export { parseConfig, parseRenameRules } from './config';
export { loadRuleset, loadAllRulesets, parseRulesetContent, rulesToClashFormat, clearRulesetCache } from './ruleset';

/**
 * Parse a single proxy link
 */
export function parseLink(link: string): Proxy | null {
  const trimmedLink = link.trim();
  
  if (!trimmedLink) {
    return null;
  }

  // Try each parser based on protocol prefix
  if (trimmedLink.startsWith('ss://')) {
    return parseSS(trimmedLink);
  }
  
  if (trimmedLink.startsWith('ssr://')) {
    return parseSSR(trimmedLink);
  }
  
  if (trimmedLink.startsWith('vmess://') || trimmedLink.startsWith('vmess1://')) {
    return parseVMess(trimmedLink);
  }
  
  if (trimmedLink.startsWith('trojan://')) {
    return parseTrojan(trimmedLink);
  }
  
  if (trimmedLink.startsWith('hysteria2://') || trimmedLink.startsWith('hy2://')) {
    return parseHysteria2(trimmedLink);
  }

  return null;
}

/**
 * Parse subscription content (multiple links)
 * Supports:
 * - Base64 encoded content
 * - Plain text with one link per line
 * - Clash YAML format (proxies section)
 */
export function parseSubscription(content: string): Proxy[] {
  const nodes: Proxy[] = [];
  let processedContent = content.trim();

  // Try to detect and parse Clash YAML format
  if (processedContent.includes('proxies:') || processedContent.includes('Proxy:')) {
    const clashNodes = parseClashYaml(processedContent);
    console.error(`clashNodes: ${clashNodes.length}`);
    if (clashNodes.length > 0) {
      return clashNodes;
    }
  }

  // Try to decode as Base64
  if (isBase64(processedContent) && !processedContent.includes('://')) {
    try {
      const decoded = urlSafeBase64Decode(processedContent);
      if (decoded && decoded.length > 0) {
        processedContent = decoded;
      }
    } catch {
      // Not valid Base64, continue with original content
    }
  }

  // Parse as line-separated links
  const lines = splitLines(processedContent);
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
      continue;
    }

    const node = parseLink(trimmedLine);
    if (node && isValidProxy(node)) {
      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * Parse Clash YAML format
 * Supports ss, ssr, vmess, trojan, hysteria2 proxy types
 */
function parseClashYaml(content: string): Proxy[] {
  const nodes: Proxy[] = [];
  
  try {
    const doc = YAML.parse(content);
    
    // Get proxies array (support both 'proxies' and 'Proxy' keys)
    const proxies = doc?.proxies || doc?.Proxy || [];
    
    if (!Array.isArray(proxies)) {
      return nodes;
    }
    
    for (const proxy of proxies) {
      const node = parseClashProxy(proxy);
      if (node && isValidProxy(node)) {
        nodes.push(node);
      }
    }
  } catch (error) {
    console.error('Failed to parse Clash YAML:', error);
  }
  
  return nodes;
}

/**
 * Parse a single Clash proxy object to our Proxy interface
 */
function parseClashProxy(proxy: Record<string, unknown>): Proxy | null {
  if (!proxy || typeof proxy !== 'object') {
    return null;
  }
  
  const type = String(proxy.type || '').toLowerCase();
  const name = String(proxy.name || '');
  const server = String(proxy.server || '');
  const port = Number(proxy.port) || 0;
  
  if (!server || !port) {
    return null;
  }
  
  const baseProxy: Proxy = {
    type: ProxyType.Unknown,
    remark: name,
    hostname: server,
    port,
    udp: proxy.udp as boolean | undefined,
  };
  
  switch (type) {
    case 'ss':
      return parseClashSS(proxy, baseProxy);
    case 'ssr':
      return parseClashSSR(proxy, baseProxy);
    case 'vmess':
      return parseClashVMess(proxy, baseProxy);
    case 'trojan':
      return parseClashTrojan(proxy, baseProxy);
    case 'hysteria2':
    case 'hy2':
      return parseClashHysteria2(proxy, baseProxy);
    default:
      return null;
  }
}

/**
 * Parse Clash SS proxy
 */
function parseClashSS(proxy: Record<string, unknown>, base: Proxy): Proxy {
  const node: Proxy = {
    ...base,
    type: ProxyType.Shadowsocks,
    encryptMethod: String(proxy.cipher || 'aes-256-gcm'),
    password: String(proxy.password || ''),
  };
  
  // Handle plugin
  if (proxy.plugin) {
    node.plugin = String(proxy.plugin);
    const pluginOpts = proxy['plugin-opts'] as Record<string, unknown> | undefined;
    if (pluginOpts) {
      const opts: string[] = [];
      if (pluginOpts.mode) opts.push(`obfs=${pluginOpts.mode}`);
      if (pluginOpts.host) opts.push(`obfs-host=${pluginOpts.host}`);
      if (pluginOpts.path) opts.push(`path=${pluginOpts.path}`);
      if (pluginOpts.tls) opts.push('tls');
      if (pluginOpts.mux) opts.push(`mux=${pluginOpts.mux}`);
      node.pluginOption = opts.join(';');
    }
  }
  
  return node;
}

/**
 * Parse Clash SSR proxy
 */
function parseClashSSR(proxy: Record<string, unknown>, base: Proxy): Proxy {
  return {
    ...base,
    type: ProxyType.ShadowsocksR,
    encryptMethod: String(proxy.cipher || 'aes-256-cfb'),
    password: String(proxy.password || ''),
    protocol: String(proxy.protocol || 'origin'),
    protocolParam: String(proxy['protocol-param'] || ''),
    obfs: String(proxy.obfs || 'plain'),
    obfsParam: String(proxy['obfs-param'] || ''),
  };
}

/**
 * Parse Clash VMess proxy
 */
function parseClashVMess(proxy: Record<string, unknown>, base: Proxy): Proxy {
  const node: Proxy = {
    ...base,
    type: ProxyType.VMess,
    userId: String(proxy.uuid || ''),
    alterId: Number(proxy.alterId) || 0,
    encryptMethod: String(proxy.cipher || 'auto'),
    tlsSecure: Boolean(proxy.tls),
    serverName: String(proxy.servername || ''),
    allowInsecure: Boolean(proxy['skip-cert-verify']),
  };
  
  // Handle network/transport
  const network = String(proxy.network || 'tcp');
  node.transferProtocol = network;
  
  switch (network) {
    case 'ws': {
      const wsOpts = proxy['ws-opts'] as Record<string, unknown> | undefined;
      if (wsOpts) {
        node.path = String(wsOpts.path || '/');
        const headers = wsOpts.headers as Record<string, unknown> | undefined;
        if (headers?.Host) {
          node.host = String(headers.Host);
        }
      }
      break;
    }
    case 'h2': {
      const h2Opts = proxy['h2-opts'] as Record<string, unknown> | undefined;
      if (h2Opts) {
        node.path = String(h2Opts.path || '/');
        const hosts = h2Opts.host as string[] | undefined;
        if (hosts && hosts.length > 0) {
          node.host = hosts[0];
        }
      }
      break;
    }
    case 'grpc': {
      const grpcOpts = proxy['grpc-opts'] as Record<string, unknown> | undefined;
      if (grpcOpts) {
        node.path = String(grpcOpts['grpc-service-name'] || '');
      }
      break;
    }
    case 'http': {
      const httpOpts = proxy['http-opts'] as Record<string, unknown> | undefined;
      if (httpOpts) {
        const paths = httpOpts.path as string[] | undefined;
        if (paths && paths.length > 0) {
          node.path = paths[0];
        }
        const headers = httpOpts.headers as Record<string, string[]> | undefined;
        if (headers?.Host && headers.Host.length > 0) {
          node.host = headers.Host[0];
        }
      }
      break;
    }
  }
  
  return node;
}

/**
 * Parse Clash Trojan proxy
 */
function parseClashTrojan(proxy: Record<string, unknown>, base: Proxy): Proxy {
  const node: Proxy = {
    ...base,
    type: ProxyType.Trojan,
    password: String(proxy.password || ''),
    host: String(proxy.sni || ''),
    allowInsecure: Boolean(proxy['skip-cert-verify']),
  };
  
  // Handle network/transport
  const network = String(proxy.network || 'tcp');
  node.transferProtocol = network;
  
  switch (network) {
    case 'ws': {
      const wsOpts = proxy['ws-opts'] as Record<string, unknown> | undefined;
      if (wsOpts) {
        node.path = String(wsOpts.path || '/');
        const headers = wsOpts.headers as Record<string, unknown> | undefined;
        if (headers?.Host) {
          node.host = String(headers.Host);
        }
      }
      break;
    }
    case 'grpc': {
      const grpcOpts = proxy['grpc-opts'] as Record<string, unknown> | undefined;
      if (grpcOpts) {
        node.path = String(grpcOpts['grpc-service-name'] || '');
      }
      break;
    }
  }
  
  return node;
}

/**
 * Parse Clash Hysteria2 proxy
 */
function parseClashHysteria2(proxy: Record<string, unknown>, base: Proxy): Proxy {
  const node: Proxy = {
    ...base,
    type: ProxyType.Hysteria2,
    password: String(proxy.password || ''),
    sni: String(proxy.sni || ''),
    allowInsecure: Boolean(proxy['skip-cert-verify']),
  };
  
  if (proxy.ports) {
    node.ports = String(proxy.ports);
  }
  
  if (proxy.up) {
    node.up = String(proxy.up);
  }
  
  if (proxy.down) {
    node.down = String(proxy.down);
  }
  
  if (proxy.obfs) {
    node.obfs = String(proxy.obfs);
    if (proxy['obfs-password']) {
      node.obfsPassword = String(proxy['obfs-password']);
    }
  }
  
  if (proxy.fingerprint) {
    node.fingerprint = String(proxy.fingerprint);
  }
  
  if (proxy.alpn) {
    node.alpn = Array.isArray(proxy.alpn) ? proxy.alpn.map(String) : [String(proxy.alpn)];
  }
  
  return node;
}

/**
 * Filter nodes by include/exclude patterns
 */
export function filterNodes(
  nodes: Proxy[],
  options: {
    include?: string;
    exclude?: string;
  } = {}
): Proxy[] {
  let filtered = [...nodes];

  // Apply include filter
  if (options.include) {
    try {
      const includeRegex = new RegExp(options.include);
      filtered = filtered.filter(node => includeRegex.test(node.remark));
    } catch {
      // Invalid regex, skip filter
    }
  }

  // Apply exclude filter
  if (options.exclude) {
    try {
      const excludeRegex = new RegExp(options.exclude);
      filtered = filtered.filter(node => !excludeRegex.test(node.remark));
    } catch {
      // Invalid regex, skip filter
    }
  }

  return filtered;
}

/**
 * Deduplicate nodes by server:port
 */
export function deduplicateNodes(nodes: Proxy[]): Proxy[] {
  const seen = new Set<string>();
  return nodes.filter(node => {
    const key = `${node.hostname}:${node.port}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
