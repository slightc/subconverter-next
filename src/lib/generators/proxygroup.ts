/**
 * Proxy group generator
 * Generates Clash proxy-groups based on configuration
 */

import { Proxy } from '../types/proxy';
import { ProxyGroupConfig } from '../types/config';

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
  const proxyNames = proxies.map(p => p.remark);
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
  const { name, type, proxies: configProxies, url, interval, tolerance, strategy, useRegexFilter, regexFilter } = config;

  let resolvedProxies: string[] = [];

  // First, apply regex filter if present
  if (useRegexFilter && regexFilter) {
    try {
      const regex = new RegExp(regexFilter, 'i');
      const filtered = allProxyNames.filter(proxyName => regex.test(proxyName));
      resolvedProxies.push(...filtered);
    } catch (e) {
      console.error(`Invalid regex filter: ${regexFilter}`, e);
      // Fallback: use all proxies
      resolvedProxies.push(...allProxyNames);
    }
  }

  // Then, also process explicit proxy references
  for (const proxy of configProxies) {
    if (SPECIAL_PROXIES.includes(proxy)) {
      // Special proxy (DIRECT, REJECT)
      resolvedProxies.push(proxy);
    } else if (allGroupNames.has(proxy)) {
      // Reference to another group
      resolvedProxies.push(proxy);
    } else if (proxy === '.*' || proxy === '.+') {
      // All proxies wildcard - add all proxy names
      resolvedProxies.push(...allProxyNames);
    } else if (proxy.startsWith('!!')) {
      // Negative regex filter
      const pattern = proxy.substring(2);
      try {
        const regex = new RegExp(pattern, 'i');
        const filtered = allProxyNames.filter(n => !regex.test(n));
        resolvedProxies.push(...filtered);
      } catch (e) {
        console.error(`Invalid negative regex: ${pattern}`, e);
      }
    } else if (isRegexPattern(proxy)) {
      // Regex pattern
      try {
        const regex = new RegExp(proxy, 'i');
        const filtered = allProxyNames.filter(n => regex.test(n));
        resolvedProxies.push(...filtered);
      } catch (e) {
        // Treat as literal name
        if (allProxyNames.includes(proxy)) {
          resolvedProxies.push(proxy);
        }
      }
    } else {
      // Literal proxy name or group name
      if (allProxyNames.includes(proxy)) {
        resolvedProxies.push(proxy);
      } else if (allGroupNames.has(proxy)) {
        resolvedProxies.push(proxy);
      }
    }
  }

  // Remove duplicates while preserving order
  resolvedProxies = [...new Set(resolvedProxies)];

  // For select type, if no proxies but has groups, that's fine
  // For auto types, need actual proxies
  if (resolvedProxies.length === 0) {
    // Add all proxies as fallback for url-test and fallback types
    if (type === 'url-test' || type === 'fallback') {
      resolvedProxies = [...allProxyNames];
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
  const proxyNames = proxies.map(p => p.remark);

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
