/**
 * Clash/Mihomo YAML format generator
 */

import { Proxy, ProxyType } from '../types/proxy';
import { ClashBaseConfig, DEFAULT_CLASH_BASE } from '../types/config';
import { ClashProxyGroup, formatProxyGroupsForClash } from './proxygroup';
import YAML from 'yaml';

export interface ClashGeneratorOptions {
  appendType?: boolean;
  udp?: boolean;
  tfo?: boolean;
  skipCertVerify?: boolean;
  clashR?: boolean;
}

export interface FullClashConfig {
  baseConfig?: ClashBaseConfig;
  proxyGroups?: ClashProxyGroup[];
  rules?: string[];
}

interface ClashProxy {
  name: string;
  type: string;
  server: string;
  port: number;
  [key: string]: unknown;
}

/**
 * Convert proxies to Clash YAML format (simple, proxies only)
 */
export function generateClash(
  nodes: Proxy[],
  options: ClashGeneratorOptions = {}
): string {
  const proxies: ClashProxy[] = [];
  const remarks = new Set<string>();

  for (const node of nodes) {
    const proxy = nodeToClashProxy(node, options, remarks);
    if (proxy) {
      proxies.push(proxy);
      remarks.add(proxy.name);
    }
  }

  const config = {
    proxies,
  };

  // Create YAML document for custom formatting
  const doc = new YAML.Document(config);
  
  // Set proxies items to flow style (single line)
  const proxiesNode = doc.get('proxies', true);
  if (proxiesNode && YAML.isSeq(proxiesNode)) {
    proxiesNode.items.forEach((item) => {
      if (YAML.isMap(item)) {
        item.flow = true;
      }
    });
  }

  return doc.toString({
    indent: 2,
    lineWidth: 0,
  });
}

/**
 * Generate full Clash configuration with proxy groups and rules
 */
export function generateFullClashConfig(
  nodes: Proxy[],
  fullConfig: FullClashConfig,
  options: ClashGeneratorOptions = {}
): string {
  const proxies: ClashProxy[] = [];
  const remarks = new Set<string>();

  for (const node of nodes) {
    const proxy = nodeToClashProxy(node, options, remarks);
    if (proxy) {
      proxies.push(proxy);
      remarks.add(proxy.name);
    }
  }

  // Build the full config object with explicit key ordering
  const baseConfig = fullConfig.baseConfig || {};
  const config = new Map<string, unknown>();
  
  // Add base config first (in order)
  config.set('mixed-port', baseConfig['mixed-port'] ?? DEFAULT_CLASH_BASE['mixed-port']);
  config.set('allow-lan', baseConfig['allow-lan'] ?? DEFAULT_CLASH_BASE['allow-lan']);
  config.set('mode', baseConfig.mode ?? DEFAULT_CLASH_BASE.mode);
  config.set('log-level', baseConfig['log-level'] ?? DEFAULT_CLASH_BASE['log-level']);
  config.set('external-controller', baseConfig['external-controller'] ?? DEFAULT_CLASH_BASE['external-controller']);

  // Add proxies
  config.set('proxies', proxies);

  // Add proxy groups
  if (fullConfig.proxyGroups && fullConfig.proxyGroups.length > 0) {
    config.set('proxy-groups', formatProxyGroupsForClash(fullConfig.proxyGroups));
  }

  // Add rules
  if (fullConfig.rules && fullConfig.rules.length > 0) {
    config.set('rules', fullConfig.rules);
  }

  // Convert Map to object for YAML serialization
  const configObj: Record<string, unknown> = {};
  config.forEach((value, key) => {
    configObj[key] = value;
  });

  // Create YAML document for custom formatting
  const doc = new YAML.Document(configObj);
  
  // Set proxies items to flow style (single line)
  const proxiesNode = doc.get('proxies', true);
  if (proxiesNode && YAML.isSeq(proxiesNode)) {
    proxiesNode.items.forEach((item) => {
      if (YAML.isMap(item)) {
        item.flow = true;
      }
    });
  }

  return doc.toString({
    indent: 2,
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'PLAIN',
  });
}

/**
 * Extract proxy names from nodes
 */
export function getProxyNames(
  nodes: Proxy[],
  options: ClashGeneratorOptions = {}
): string[] {
  const names: string[] = [];
  const remarks = new Set<string>();

  for (const node of nodes) {
    let name = node.remark;
    if (options.appendType) {
      const typeName = getTypeName(node.type);
      name = `[${typeName}] ${name}`;
    }
    name = ensureUniqueName(name, remarks);
    names.push(name);
    remarks.add(name);
  }

  return names;
}

/**
 * Convert a single proxy node to Clash proxy format
 */
function nodeToClashProxy(
  node: Proxy,
  options: ClashGeneratorOptions,
  existingRemarks: Set<string>
): ClashProxy | null {
  // Generate unique name
  let name = node.remark;
  if (options.appendType) {
    const typeName = getTypeName(node.type);
    name = `[${typeName}] ${name}`;
  }
  name = ensureUniqueName(name, existingRemarks);

  const baseProxy: ClashProxy = {
    name,
    type: '',
    server: node.hostname,
    port: node.port,
  };

  // Apply common options
  if (options.udp !== undefined || node.udp !== undefined) {
    baseProxy.udp = node.udp ?? options.udp;
  }

  switch (node.type) {
    case ProxyType.Shadowsocks:
      return buildSSProxy(node, baseProxy, options);
    case ProxyType.ShadowsocksR:
      return buildSSRProxy(node, baseProxy, options);
    case ProxyType.VMess:
      return buildVMessProxy(node, baseProxy, options);
    case ProxyType.Trojan:
      return buildTrojanProxy(node, baseProxy, options);
    case ProxyType.Hysteria2:
      return buildHysteria2Proxy(node, baseProxy, options);
    default:
      return null;
  }
}

function buildSSProxy(
  node: Proxy,
  base: ClashProxy,
  options: ClashGeneratorOptions
): ClashProxy {
  const proxy: ClashProxy = {
    ...base,
    type: 'ss',
    cipher: node.encryptMethod || 'aes-256-gcm',
    password: node.password || '',
  };

  // Handle plugins
  if (node.plugin) {
    const pluginOpts = parsePluginOpts(node.pluginOption || '');
    
    switch (node.plugin) {
      case 'simple-obfs':
      case 'obfs-local':
        proxy.plugin = 'obfs';
        proxy['plugin-opts'] = {
          mode: pluginOpts.obfs || 'http',
          host: pluginOpts['obfs-host'] || '',
        };
        break;
      case 'v2ray-plugin':
        proxy.plugin = 'v2ray-plugin';
        proxy['plugin-opts'] = {
          mode: pluginOpts.mode || 'websocket',
          host: pluginOpts.host || '',
          path: pluginOpts.path || '',
          tls: pluginOpts.tls === 'true' || node.pluginOption?.includes('tls'),
          mux: pluginOpts.mux === 'true',
        };
        if (options.skipCertVerify !== undefined) {
          (proxy['plugin-opts'] as Record<string, unknown>)['skip-cert-verify'] = options.skipCertVerify;
        }
        break;
    }
  }

  return proxy;
}

function buildSSRProxy(
  node: Proxy,
  base: ClashProxy,
  options: ClashGeneratorOptions
): ClashProxy {
  const proxy: ClashProxy = {
    ...base,
    type: 'ssr',
    cipher: node.encryptMethod === 'none' ? 'dummy' : (node.encryptMethod || 'aes-256-cfb'),
    password: node.password || '',
    protocol: node.protocol || 'origin',
    obfs: node.obfs || 'plain',
    'protocol-param': node.protocolParam || '',
    'obfs-param': node.obfsParam || '',
  };

  return proxy;
}

function buildVMessProxy(
  node: Proxy,
  base: ClashProxy,
  options: ClashGeneratorOptions
): ClashProxy {
  const proxy: ClashProxy = {
    ...base,
    type: 'vmess',
    uuid: node.userId || '',
    alterId: node.alterId || 0,
    cipher: node.encryptMethod || 'auto',
    tls: node.tlsSecure || false,
  };

  if (options.skipCertVerify !== undefined || node.allowInsecure !== undefined) {
    proxy['skip-cert-verify'] = node.allowInsecure ?? options.skipCertVerify;
  }

  if (node.serverName) {
    proxy.servername = node.serverName;
  }

  const network = node.transferProtocol || 'tcp';
  
  switch (network) {
    case 'ws':
      proxy.network = 'ws';
      proxy['ws-opts'] = {
        path: node.path || '/',
        headers: {},
      };
      if (node.host) {
        (proxy['ws-opts'] as Record<string, unknown>).headers = { Host: node.host };
      }
      break;
    case 'h2':
      proxy.network = 'h2';
      proxy['h2-opts'] = {
        path: node.path || '/',
        host: node.host ? [node.host] : [],
      };
      break;
    case 'grpc':
      proxy.network = 'grpc';
      proxy['grpc-opts'] = {
        'grpc-service-name': node.path || '',
      };
      if (node.host) {
        proxy.servername = node.host;
      }
      break;
    case 'http':
      proxy.network = 'http';
      proxy['http-opts'] = {
        method: 'GET',
        path: [node.path || '/'],
        headers: node.host ? { Host: [node.host] } : {},
      };
      break;
    case 'tcp':
    default:
      // No additional config needed for TCP
      break;
  }

  return proxy;
}

function buildTrojanProxy(
  node: Proxy,
  base: ClashProxy,
  options: ClashGeneratorOptions
): ClashProxy {
  const proxy: ClashProxy = {
    ...base,
    type: 'trojan',
    password: node.password || '',
  };

  if (node.host) {
    proxy.sni = node.host;
  }

  if (options.skipCertVerify !== undefined || node.allowInsecure !== undefined) {
    proxy['skip-cert-verify'] = node.allowInsecure ?? options.skipCertVerify;
  }

  const network = node.transferProtocol || 'tcp';
  
  switch (network) {
    case 'ws':
      proxy.network = 'ws';
      proxy['ws-opts'] = {
        path: node.path || '/',
      };
      if (node.host) {
        (proxy['ws-opts'] as Record<string, unknown>).headers = { Host: node.host };
      }
      break;
    case 'grpc':
      proxy.network = 'grpc';
      if (node.path) {
        proxy['grpc-opts'] = {
          'grpc-service-name': node.path,
        };
      }
      break;
  }

  return proxy;
}

function buildHysteria2Proxy(
  node: Proxy,
  base: ClashProxy,
  options: ClashGeneratorOptions
): ClashProxy {
  const proxy: ClashProxy = {
    ...base,
    type: 'hysteria2',
    password: node.password || '',
  };

  if (node.ports) {
    proxy.ports = node.ports;
  }

  if (node.up) {
    proxy.up = node.up;
  }

  if (node.down) {
    proxy.down = node.down;
  }

  if (node.obfs) {
    proxy.obfs = node.obfs;
    if (node.obfsPassword) {
      proxy['obfs-password'] = node.obfsPassword;
    }
  }

  if (node.sni) {
    proxy.sni = node.sni;
  }

  if (node.fingerprint) {
    proxy.fingerprint = node.fingerprint;
  }

  if (node.alpn && node.alpn.length > 0) {
    proxy.alpn = node.alpn;
  }

  if (options.skipCertVerify !== undefined || node.allowInsecure !== undefined) {
    proxy['skip-cert-verify'] = node.allowInsecure ?? options.skipCertVerify;
  }

  return proxy;
}

function getTypeName(type: ProxyType): string {
  const names: Record<ProxyType, string> = {
    [ProxyType.Unknown]: 'Unknown',
    [ProxyType.Shadowsocks]: 'SS',
    [ProxyType.ShadowsocksR]: 'SSR',
    [ProxyType.VMess]: 'VMess',
    [ProxyType.Trojan]: 'Trojan',
    [ProxyType.Snell]: 'Snell',
    [ProxyType.HTTP]: 'HTTP',
    [ProxyType.HTTPS]: 'HTTPS',
    [ProxyType.SOCKS5]: 'SOCKS5',
    [ProxyType.WireGuard]: 'WireGuard',
    [ProxyType.Hysteria]: 'Hysteria',
    [ProxyType.Hysteria2]: 'Hysteria2',
  };
  return names[type] || 'Unknown';
}

function ensureUniqueName(name: string, existing: Set<string>): string {
  // Replace '=' with '-' to avoid parse errors
  let safeName = name.replace(/=/g, '-');
  
  // Replace unsupported emoji flags (🇹🇼 doesn't display properly on some devices)
  safeName = safeName.replace(/🇹🇼/g, '🇨🇳');
  
  if (!existing.has(safeName)) {
    return safeName;
  }

  let counter = 2;
  let newName = `${safeName} ${counter}`;
  while (existing.has(newName)) {
    counter++;
    newName = `${safeName} ${counter}`;
  }
  return newName;
}

function parsePluginOpts(opts: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = opts.replace(/;/g, '&').split('&');
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value !== undefined) {
      result[key.trim()] = value.trim();
    }
  }
  
  return result;
}
