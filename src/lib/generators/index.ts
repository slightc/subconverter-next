/**
 * Format generator dispatcher
 */

import { Proxy } from '../types/proxy';
import { generateClash, generateFullClashConfig, getProxyNames } from './clash';
import type { ClashGeneratorOptions, FullClashConfig } from './clash';
import { generateMixed } from './mixed';
import type { MixedGeneratorOptions } from './mixed';

export { generateClash, generateFullClashConfig, getProxyNames } from './clash';
export type { ClashGeneratorOptions, FullClashConfig } from './clash';
export { generateMixed } from './mixed';
export type { MixedGeneratorOptions } from './mixed';
export { generateProxyGroups, generateDefaultProxyGroups, formatProxyGroupsForClash } from './proxygroup';
export type { ClashProxyGroup } from './proxygroup';

export type TargetFormat = 'clash' | 'clashr' | 'mixed';

export interface GeneratorOptions {
  target: TargetFormat;
  // Common options
  appendType?: boolean;
  udp?: boolean;
  tfo?: boolean;
  skipCertVerify?: boolean;
}

/**
 * Generate output based on target format
 */
export function generate(nodes: Proxy[], options: GeneratorOptions): string {
  const { target, ...commonOptions } = options;

  switch (target) {
    case 'clash':
      return generateClash(nodes, {
        ...commonOptions,
        clashR: false,
      });
    case 'clashr':
      return generateClash(nodes, {
        ...commonOptions,
        clashR: true,
      });
    case 'mixed':
      return generateMixed(nodes);
    default:
      throw new Error(`Unsupported target format: ${target}`);
  }
}

/**
 * Get content type for target format
 */
export function getContentType(target: TargetFormat): string {
  switch (target) {
    case 'clash':
    case 'clashr':
      return 'text/yaml; charset=utf-8';
    case 'mixed':
      return 'text/plain; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
}

/**
 * Get file extension for target format
 */
export function getFileExtension(target: TargetFormat): string {
  switch (target) {
    case 'clash':
    case 'clashr':
      return '.yaml';
    case 'mixed':
      return '.txt';
    default:
      return '.txt';
  }
}
