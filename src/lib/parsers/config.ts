/**
 * Configuration file parser
 * Parses ACL4SSR-style INI configuration files
 */

import {
  ParsedConfig,
  RulesetConfig,
  ProxyGroupConfig,
  ProxyGroupType,
} from '../types/config';

/**
 * Parse INI configuration content
 */
export function parseConfig(content: string): ParsedConfig {
  const config: ParsedConfig = {
    rulesets: [],
    proxyGroups: [],
    enableRuleGenerator: true,
    overwriteOriginalRules: true,
  };

  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    // Parse key=value pairs
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.substring(0, eqIndex).trim().toLowerCase();
    const value = line.substring(eqIndex + 1).trim();

    switch (key) {
      case 'ruleset':
        const ruleset = parseRuleset(value);
        if (ruleset) {
          config.rulesets.push(ruleset);
        }
        break;

      case 'custom_proxy_group':
        const proxyGroup = parseProxyGroup(value);
        if (proxyGroup) {
          config.proxyGroups.push(proxyGroup);
        }
        break;

      case 'clash_rule_base':
        config.clashRuleBase = value;
        break;

      case 'enable_rule_generator':
        config.enableRuleGenerator = value.toLowerCase() === 'true';
        break;

      case 'overwrite_original_rules':
        config.overwriteOriginalRules = value.toLowerCase() === 'true';
        break;

      case 'add_emoji':
        config.addEmoji = value.toLowerCase() === 'true';
        break;

      case 'remove_old_emoji':
        config.removeOldEmoji = value.toLowerCase() === 'true';
        break;
    }
  }

  return config;
}

/**
 * Parse ruleset line
 * Format: group,url or group,[]RULE-TYPE,value
 */
function parseRuleset(value: string): RulesetConfig | null {
  const commaIndex = value.indexOf(',');
  if (commaIndex === -1) return null;

  const group = value.substring(0, commaIndex).trim();
  const ruleset = value.substring(commaIndex + 1).trim();

  if (!group || !ruleset) return null;

  return { group, ruleset };
}

/**
 * Parse custom proxy group line
 * Format: name`type`proxies/filter...
 * 
 * Examples:
 * - 🚀 节点选择`select`.*`[]DIRECT
 * - ✨ Gemini`select`[]🚀 节点选择`[]🎯 全球直连`.*
 * - ♻️ 自动选择`url-test`.*`http://www.gstatic.com/generate_204`300,,50
 * - 🇭🇰 香港节点`select`(港|HK|Hong Kong)`[]DIRECT
 */
function parseProxyGroup(value: string): ProxyGroupConfig | null {
  const parts = value.split('`');
  if (parts.length < 3) return null;

  const name = parts[0].trim();
  const type = parts[1].trim().toLowerCase() as ProxyGroupType;

  if (!name || !isValidProxyGroupType(type)) return null;

  const proxyGroup: ProxyGroupConfig = {
    name,
    type,
    proxies: [],
    useRegexFilter: false,
  };

  // Process all parts starting from index 2
  // Parts can be:
  // - []ProxyName - explicit proxy reference
  // - .* or regex pattern - regex filter
  // - http://... - test URL
  // - 300,,50 - interval and tolerance
  for (let i = 2; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (part.startsWith('[]')) {
      // Explicit proxy reference
      proxyGroup.proxies.push(part.substring(2));
    } else if (part.startsWith('http://') || part.startsWith('https://')) {
      // Test URL
      proxyGroup.url = part;
    } else if (/^\d+/.test(part)) {
      // Interval/tolerance: "300,,50" or "300"
      const nums = part.split(',');
      if (nums[0]) proxyGroup.interval = parseInt(nums[0], 10);
      // Handle format "300,,50" where middle value is empty
      if (nums.length >= 3 && nums[2]) {
        proxyGroup.tolerance = parseInt(nums[2], 10);
      } else if (nums.length === 2 && nums[1]) {
        proxyGroup.tolerance = parseInt(nums[1], 10);
      }
    } else if (isRegexPattern(part)) {
      // Regex filter pattern - add to proxies array to preserve order
      proxyGroup.proxies.push(part);
      proxyGroup.useRegexFilter = true;
      proxyGroup.regexFilter = part;
    }
  }

  // Set default URL for url-test and fallback
  if ((type === 'url-test' || type === 'fallback') && !proxyGroup.url) {
    proxyGroup.url = 'http://www.gstatic.com/generate_204';
  }

  // Set default interval
  if ((type === 'url-test' || type === 'fallback') && !proxyGroup.interval) {
    proxyGroup.interval = 300;
  }

  return proxyGroup;
}

/**
 * Check if string looks like a regex pattern
 */
function isRegexPattern(str: string): boolean {
  // Common regex patterns: .*, .+, (xxx|yyy), etc.
  if (str === '.*' || str === '.+') return true;
  if (str.includes('|') && (str.startsWith('(') || str.includes('['))) return true;
  if (str.includes('\\')) return true;
  // Check for regex metacharacters that are unlikely in normal proxy names
  const regexOnlyChars = ['^', '$', '\\d', '\\w', '\\s', '+', '?'];
  return regexOnlyChars.some(char => str.includes(char));
}

/**
 * Check if type is a valid proxy group type
 */
function isValidProxyGroupType(type: string): type is ProxyGroupType {
  return ['select', 'url-test', 'fallback', 'load-balance', 'relay'].includes(type);
}

/**
 * Parse rename rules from config
 * Format: OldName@NewName
 */
export function parseRenameRules(value: string): Record<string, string> {
  const rules: Record<string, string> = {};
  const parts = value.split('`');
  
  for (const part of parts) {
    const atIndex = part.indexOf('@');
    if (atIndex > 0) {
      const oldName = part.substring(0, atIndex).trim();
      const newName = part.substring(atIndex + 1).trim();
      if (oldName && newName) {
        rules[oldName] = newName;
      }
    }
  }
  
  return rules;
}
