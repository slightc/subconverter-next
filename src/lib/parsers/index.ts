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
 * Parse Clash YAML format (basic support)
 * This is a simplified parser - full Clash support would require a YAML library
 */
function parseClashYaml(content: string): Proxy[] {
  const nodes: Proxy[] = [];
  
  // This is a basic implementation
  // For full support, we'd need to use the yaml library to parse the content
  // For now, we'll just return an empty array and let the caller handle Clash format differently
  
  // TODO: Implement full Clash YAML parsing using the yaml library
  // This would involve:
  // 1. Parsing the YAML content
  // 2. Extracting the proxies/Proxy section
  // 3. Converting each proxy object to our Proxy interface
  
  return nodes;
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
