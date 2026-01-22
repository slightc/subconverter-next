/**
 * Proxy group generator
 * Generates Clash proxy-groups based on configuration
 */

import { Proxy } from '../types/proxy';
import { ProxyGroupConfig } from '../types/config';
import { sanitizeProxyName } from '../utils/string';

/**
 * Generated proxy group for Clash
 */
export interface ClashProxyGroup {
  name: string;
  type: string;
  proxies: string[];
  url?: string;
  interval?: number;
  tolerance?: number;
  strategy?: string;
}

/**
 * Special proxy names that should always be available
 */
const SPECIAL_PROXIES = ['DIRECT', 'REJECT'];

/**
 * Generate proxy groups from configuration
 */
export function generateProxyGroups(
  configs: ProxyGroupConfig[],
  proxies: Proxy[]
): ClashProxyGroup[] {
  const proxyNames = proxies.map(p => sanitizeProxyName(p.remark));
  const generatedGroups: ClashProxyGroup[] = [];
  const groupNames = new Set<string>();

  // First pass: collect all group names
  for (const config of configs) {
    groupNames.add(config.name);
  }

  // Second pass: generate groups
  for (const config of configs) {
    const group = generateSingleProxyGroup(config, proxyNames, groupNames);
    if (group && group.proxies.length > 0) {
      generatedGroups.push(group);
    }
  }

  return generatedGroups;
}

/**
 * Generate a single proxy group
 */
function generateSingleProxyGroup(
  config: ProxyGroupConfig,
  allProxyNames: string[],
  allGroupNames: Set<string>
): ClashProxyGroup | null {
  const { name, type, proxies: configProxies, url, interval, tolerance, strategy } = config;

  const resolvedProxies: string[] = [];
  const seen = new Set<string>();
  
  // Helper to add proxy while avoiding duplicates and preserving order
  const addProxy = (proxyName: string) => {
    if (!seen.has(proxyName)) {
      seen.add(proxyName);
      resolvedProxies.push(proxyName);
    }
  };
  
  // Helper to add multiple proxies
  const addProxies = (proxyNames: string[]) => {
    for (const p of proxyNames) {
      addProxy(p);
    }
  };

  // Process proxies in order as defined in config
  for (const proxy of configProxies) {
    if (SPECIAL_PROXIES.includes(proxy)) {
      // Special proxy (DIRECT, REJECT)
      addProxy(proxy);
    } else if (allGroupNames.has(proxy)) {
      // Reference to another group
      addProxy(proxy);
    } else if (proxy === '.*' || proxy === '.+') {
      // All proxies wildcard - add all proxy names
      addProxies(allProxyNames);
    } else if (proxy.startsWith('!!')) {
      // Negative regex filter
      const pattern = proxy.substring(2);
      try {
        const regex = new RegExp(pattern, 'i');
        const filtered = allProxyNames.filter(n => !regex.test(n));
        addProxies(filtered);
      } catch (e) {
        console.error(`Invalid negative regex: ${pattern}`, e);
      }
    } else if (isRegexPattern(proxy)) {
      // Regex pattern
      try {
        const regex = new RegExp(proxy, 'i');
        const filtered = allProxyNames.filter(n => regex.test(n));
        addProxies(filtered);
      } catch (e) {
        // Treat as literal name
        if (allProxyNames.includes(proxy)) {
          addProxy(proxy);
        }
      }
    } else {
      // Literal proxy name or group name
      if (allProxyNames.includes(proxy)) {
        addProxy(proxy);
      } else if (allGroupNames.has(proxy)) {
        addProxy(proxy);
      }
    }
  }
  
  // For select type, if no proxies but has groups, that's fine
  // For auto types, need actual proxies
  if (resolvedProxies.length === 0) {
    // Add all proxies as fallback for url-test and fallback types
    if (type === 'url-test' || type === 'fallback') {
      addProxies(allProxyNames);
    }
  }

  if (resolvedProxies.length === 0) {
    return null;
  }

  const group: ClashProxyGroup = {
    name,
    type,
    proxies: resolvedProxies,
  };

  // Add optional fields
  if (url && (type === 'url-test' || type === 'fallback' || type === 'load-balance')) {
    group.url = url;
  }

  if (interval && (type === 'url-test' || type === 'fallback' || type === 'load-balance')) {
    group.interval = interval;
  }

  if (tolerance && type === 'url-test') {
    group.tolerance = tolerance;
  }

  if (strategy && type === 'load-balance') {
    group.strategy = strategy;
  }

  return group;
}

/**
 * Check if string looks like a regex pattern
 */
function isRegexPattern(str: string): boolean {
  // Common regex metacharacters
  const regexChars = ['*', '+', '?', '[', ']', '(', ')', '|', '^', '$', '.', '\\'];
  return regexChars.some(char => str.includes(char));
}

/**
 * Generate default proxy groups if no config provided
 */
export function generateDefaultProxyGroups(proxies: Proxy[]): ClashProxyGroup[] {
  const proxyNames = proxies.map(p => sanitizeProxyName(p.remark));

  if (proxyNames.length === 0) {
    return [];
  }

  return [
    {
      name: '🚀 节点选择',
      type: 'select',
      proxies: [...proxyNames, 'DIRECT'],
    },
    {
      name: '🎯 全球直连',
      type: 'select',
      proxies: ['DIRECT', '🚀 节点选择'],
    },
    {
      name: '🐟 漏网之鱼',
      type: 'select',
      proxies: ['🚀 节点选择', '🎯 全球直连', ...proxyNames],
    },
  ];
}

/**
 * Format proxy groups for Clash YAML output
 */
export function formatProxyGroupsForClash(groups: ClashProxyGroup[]): object[] {
  return groups.map(group => {
    const formatted: Record<string, unknown> = {
      name: group.name,
      type: group.type,
      proxies: group.proxies,
    };

    if (group.url) {
      formatted.url = group.url;
    }

    if (group.interval) {
      formatted.interval = group.interval;
    }

    if (group.tolerance) {
      formatted.tolerance = group.tolerance;
    }

    if (group.strategy) {
      formatted.strategy = group.strategy;
    }

    return formatted;
  });
}
