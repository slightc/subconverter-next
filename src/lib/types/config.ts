/**
 * Configuration types for subconverter
 * Supports ACL4SSR-style INI configuration files
 */

/**
 * Ruleset definition
 */
export interface RulesetConfig {
  /** Target proxy group name */
  group: string;
  /** Ruleset URL or inline rules */
  ruleset: string;
  /** Prepend flag */
  prepend?: boolean;
}

/**
 * Proxy group types supported by Clash
 */
export type ProxyGroupType = 
  | 'select'
  | 'url-test'
  | 'fallback'
  | 'load-balance'
  | 'relay';

/**
 * Custom proxy group definition
 */
export interface ProxyGroupConfig {
  /** Group name */
  name: string;
  /** Group type */
  type: ProxyGroupType;
  /** Regex filter or proxy names (prefixed with []) */
  proxies: string[];
  /** Test URL for auto groups */
  url?: string;
  /** Test interval in seconds */
  interval?: number;
  /** Tolerance for url-test */
  tolerance?: number;
  /** Strategy for load-balance */
  strategy?: 'consistent-hashing' | 'round-robin';
  /** Whether to use regex filter */
  useRegexFilter?: boolean;
  /** Regex filter pattern */
  regexFilter?: string;
}

/**
 * Clash base configuration
 */
export interface ClashBaseConfig {
  'mixed-port'?: number;
  'allow-lan'?: boolean;
  mode?: 'Rule' | 'Global' | 'Direct';
  'log-level'?: 'info' | 'warning' | 'error' | 'debug' | 'silent';
  'external-controller'?: string;
  secret?: string;
  dns?: {
    enable?: boolean;
    listen?: string;
    'enhanced-mode'?: 'fake-ip' | 'redir-host';
    nameserver?: string[];
    fallback?: string[];
  };
}

/**
 * Parsed configuration from INI file
 */
export interface ParsedConfig {
  /** Ruleset definitions */
  rulesets: RulesetConfig[];
  /** Custom proxy group definitions */
  proxyGroups: ProxyGroupConfig[];
  /** Clash base config URL */
  clashRuleBase?: string;
  /** Enable rule generator */
  enableRuleGenerator: boolean;
  /** Overwrite original rules */
  overwriteOriginalRules: boolean;
  /** Rename rules */
  rename?: Record<string, string>;
  /** Emoji rules */
  emoji?: Record<string, string>;
  /** Add emoji flag */
  addEmoji?: boolean;
  /** Remove old emoji flag */
  removeOldEmoji?: boolean;
}

/**
 * Default Clash base configuration
 */
export const DEFAULT_CLASH_BASE: ClashBaseConfig = {
  'mixed-port': 7890,
  'allow-lan': true,
  mode: 'Rule',
  'log-level': 'info',
  'external-controller': ':9090',
};

/**
 * Clash rule types
 */
export type ClashRuleType =
  | 'DOMAIN'
  | 'DOMAIN-SUFFIX'
  | 'DOMAIN-KEYWORD'
  | 'IP-CIDR'
  | 'IP-CIDR6'
  | 'SRC-IP-CIDR'
  | 'SRC-PORT'
  | 'DST-PORT'
  | 'GEOIP'
  | 'MATCH'
  | 'PROCESS-NAME';

/**
 * Parsed rule entry
 */
export interface ClashRule {
  type: ClashRuleType;
  value: string;
  target: string;
  options?: string;
}
