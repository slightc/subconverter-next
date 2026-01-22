/**
 * Ruleset loader and parser
 * Loads rulesets from URLs and parses them into Clash rule format
 */

import { fetchText } from '../utils/fetch';
import { ClashRule, ClashRuleType, RulesetConfig } from '../types/config';

/**
 * Rule type mapping from list format to Clash format
 */
const RULE_TYPE_MAP: Record<string, ClashRuleType> = {
  'DOMAIN': 'DOMAIN',
  'DOMAIN-SUFFIX': 'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD': 'DOMAIN-KEYWORD',
  'IP-CIDR': 'IP-CIDR',
  'IP-CIDR6': 'IP-CIDR6',
  'SRC-IP-CIDR': 'SRC-IP-CIDR',
  'SRC-PORT': 'SRC-PORT',
  'DST-PORT': 'DST-PORT',
  'GEOIP': 'GEOIP',
  'MATCH': 'MATCH',
  'FINAL': 'MATCH',
  'PROCESS-NAME': 'PROCESS-NAME',
  'USER-AGENT': 'DOMAIN-KEYWORD', // Convert USER-AGENT to DOMAIN-KEYWORD as fallback
  'URL-REGEX': 'DOMAIN-KEYWORD', // Convert URL-REGEX to DOMAIN-KEYWORD as fallback
};

/**
 * Cache for loaded rulesets to avoid duplicate fetches
 */
const rulesetCache = new Map<string, string>();

/**
 * Load ruleset content from URL with caching
 */
export async function loadRuleset(url: string): Promise<string> {
  // Check cache first
  if (rulesetCache.has(url)) {
    return rulesetCache.get(url)!;
  }

  try {
    const content = await fetchText(url, { timeout: 10000 });
    rulesetCache.set(url, content);
    return content;
  } catch (error) {
    console.error(`Failed to load ruleset from ${url}:`, error);
    return '';
  }
}

/**
 * Clear ruleset cache
 */
export function clearRulesetCache(): void {
  rulesetCache.clear();
}

/**
 * Parse ruleset content into Clash rules
 */
export function parseRulesetContent(
  content: string,
  targetGroup: string
): string[] {
  const rules: string[] = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('//')) {
      continue;
    }

    // Skip payload header (for Clash format rulesets)
    if (line === 'payload:' || line.startsWith('payload:')) {
      continue;
    }

    // Handle YAML list format (- prefix)
    let ruleLine = line;
    if (line.startsWith('- ')) {
      ruleLine = line.substring(2).trim();
      // Remove quotes if present
      if ((ruleLine.startsWith("'") && ruleLine.endsWith("'")) ||
          (ruleLine.startsWith('"') && ruleLine.endsWith('"'))) {
        ruleLine = ruleLine.slice(1, -1);
      }
    }

    // Parse rule
    const rule = parseRuleLine(ruleLine, targetGroup);
    if (rule) {
      rules.push(rule);
    }
  }

  return rules;
}

/**
 * Parse a single rule line
 */
function parseRuleLine(line: string, targetGroup: string): string | null {
  // Handle simple domain format (just a domain without type prefix)
  if (!line.includes(',') && isValidDomain(line)) {
    return `DOMAIN-SUFFIX,${line},${targetGroup}`;
  }

  // Handle full rule format: TYPE,VALUE or TYPE,VALUE,OPTIONS
  const parts = line.split(',').map(p => p.trim());
  if (parts.length < 2) return null;

  const ruleType = parts[0].toUpperCase();
  const mappedType = RULE_TYPE_MAP[ruleType];

  if (!mappedType) {
    // Unknown rule type, skip
    return null;
  }

  const value = parts[1];
  if (!value) return null;

  // Filter out port rules with protocol suffix (e.g., 443/udp, 80/tcp)
  // These are not supported by Clash
  if ((mappedType === 'DST-PORT' || mappedType === 'SRC-PORT') && 
      value.includes('/')) {
    return null;
  }

  // Build rule string
  let rule = `${mappedType},${value},${targetGroup}`;

  // Add no-resolve option for IP rules if specified
  if (parts.length > 2) {
    const options = parts.slice(2).join(',');
    if (options && !options.includes('no-resolve')) {
      // Check if original has no-resolve for IP rules
      if ((mappedType === 'IP-CIDR' || mappedType === 'IP-CIDR6' || mappedType === 'GEOIP') &&
          line.toLowerCase().includes('no-resolve')) {
        rule += ',no-resolve';
      }
    } else if (options) {
      rule += `,${options}`;
    }
  } else {
    // Add no-resolve for IP rules by default
    if (mappedType === 'IP-CIDR' || mappedType === 'IP-CIDR6') {
      rule += ',no-resolve';
    }
  }

  return rule;
}

/**
 * Check if string is a valid domain
 */
function isValidDomain(str: string): boolean {
  // Simple domain validation
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(str) ||
         /^\+\.[a-zA-Z0-9]([a-zA-Z0-9-]*\.)*[a-zA-Z]{2,}$/.test(str); // +.domain format
}

/**
 * Default base URL for ACL4SSR rulesets
 */
const ACL4SSR_BASE_URL = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/';

/**
 * Resolve ruleset URL, handling relative paths
 */
function resolveRulesetUrl(ruleset: string, baseUrl?: string): string {
  // Already a full URL
  if (ruleset.startsWith('http://') || ruleset.startsWith('https://')) {
    return ruleset;
  }
  
  // Relative path starting with rules/
  if (ruleset.startsWith('rules/')) {
    // Common patterns:
    // rules/ACL4SSR/Clash/xxx.list -> https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/xxx.list
    const match = ruleset.match(/^rules\/ACL4SSR\/Clash\/(.+)$/i);
    if (match) {
      return `${ACL4SSR_BASE_URL}${match[1]}`;
    }
    
    // If base URL is provided, resolve relative to it
    if (baseUrl) {
      // Remove filename from base URL to get directory
      const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
      // Remove 'rules/' prefix and resolve
      const relativePath = ruleset.replace(/^rules\//, '');
      return new URL(relativePath, baseDir).href;
    }
    
    // Fallback: try ACL4SSR base
    return `${ACL4SSR_BASE_URL}${ruleset.replace(/^rules\/ACL4SSR\/Clash\//i, '')}`;
  }
  
  // Other relative paths
  if (baseUrl) {
    return new URL(ruleset, baseUrl).href;
  }
  
  return ruleset;
}

/**
 * Load and parse all rulesets from config
 */
export async function loadAllRulesets(
  rulesets: RulesetConfig[],
  configUrl?: string
): Promise<string[]> {
  const allRules: string[] = [];
  
  for (const config of rulesets) {
    const { group, ruleset } = config;

    // Check if it's an inline rule or URL
    if (ruleset.startsWith('[]')) {
      // Inline rule: []RULE-TYPE,value
      const inlineRule = ruleset.substring(2);
      const rule = parseRuleLine(inlineRule, group);
      if (rule) {
        allRules.push(rule);
      }
    } else {
      // Resolve URL (handle relative paths)
      const resolvedUrl = resolveRulesetUrl(ruleset, configUrl);
      
      // URL - load and parse
      const content = await loadRuleset(resolvedUrl);
      if (content) {
        const rules = parseRulesetContent(content, group);
        allRules.push(...rules);
      }
    }
  }

  return allRules;
}

/**
 * Convert rules to Clash YAML format string
 */
export function rulesToClashFormat(rules: string[]): string[] {
  // Add MATCH rule at the end if not present
  const hasMatch = rules.some(r => r.startsWith('MATCH,'));
  const finalRules = [...rules];
  
  if (!hasMatch) {
    finalRules.push('MATCH,🐟 漏网之鱼');
  }

  return finalRules;
}
