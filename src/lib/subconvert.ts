/**
 * Shared subscription conversion pipeline
 *
 * Extracted from the /api/sub route so that both the public converter
 * (/api/sub?...) and user short links (/api/s/<id>?token=...) run exactly
 * the same code path.
 */

import { NextResponse } from 'next/server';
import {
  parseSubscription,
  filterNodes,
  deduplicateNodes,
  parseConfig,
  loadAllRulesets,
  clearRulesetCache,
} from '@/lib/parsers';
import {
  generate,
  generateFullClashConfig,
  generateProxyGroups,
  generateDefaultProxyGroups,
  getContentType,
  TargetFormat,
} from '@/lib/generators';
import { fetchSubscription, fetchText } from '@/lib/utils/fetch';
import { urlDecode } from '@/lib/utils/string';
import { Proxy } from '@/lib/types/proxy';

/** Supported target formats */
export const SUPPORTED_TARGETS = ['clash', 'clashr', 'mixed'];

/**
 * Query parameters accepted by /api/sub. Short links may only store
 * these parameters ("只支持自己的 /api/sub 的格式").
 */
export const SUB_PARAM_KEYS = [
  'url',
  'target',
  'config',
  'include',
  'exclude',
  'filename',
  'append_type',
  'udp',
  'tfo',
  'scv',
] as const;

export type SubParamKey = (typeof SUB_PARAM_KEYS)[number];

/** A plain record of /api/sub parameters */
export type SubParams = Partial<Record<SubParamKey, string>>;

/**
 * Extract the known /api/sub parameters from a query string.
 * Unknown parameters are dropped.
 */
export function pickSubParams(search: URLSearchParams): SubParams {
  const params: SubParams = {};
  for (const key of SUB_PARAM_KEYS) {
    const value = search.get(key);
    if (value !== null && value !== '') {
      params[key] = value;
    }
  }
  return params;
}

/** Convert a SubParams record back into a query string */
export function subParamsToQuery(params: SubParams): string {
  const search = new URLSearchParams();
  for (const key of SUB_PARAM_KEYS) {
    const value = params[key];
    if (value) search.set(key, value);
  }
  return search.toString();
}

/**
 * Validate /api/sub parameters.
 * Returns an error message, or null when the parameters are valid.
 */
export function validateSubParams(params: SubParams): string | null {
  if (!params.url) {
    return 'Missing required parameter: url';
  }

  if (!params.target) {
    return 'Missing required parameter: target';
  }

  if (!SUPPORTED_TARGETS.includes(params.target)) {
    return `Invalid target: ${params.target}. Supported targets: ${SUPPORTED_TARGETS.join(', ')}`;
  }

  return null;
}

/** Maximum length of a stored subscription link (query string) */
const MAX_LINK_LENGTH = 4000;

/**
 * Parse a user supplied subscription link into /api/sub parameters.
 *
 * Only this service's own /api/sub format is accepted, so the following
 * inputs are valid:
 * - `https://example.com/api/sub?target=clash&url=...`
 * - `/api/sub?target=clash&url=...`
 * - `target=clash&url=...` (bare query string)
 *
 * Throws an Error with a user facing message when the link is invalid.
 */
export function parseSubLink(input: string): SubParams {
  const raw = input.trim();

  if (!raw) {
    throw new Error('Subscription link is required');
  }

  if (raw.length > MAX_LINK_LENGTH) {
    throw new Error(`Subscription link is too long (max ${MAX_LINK_LENGTH} characters)`);
  }

  let query: string;

  if (/^https?:\/\//i.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error('Invalid subscription link');
    }
    if (parsed.pathname.replace(/\/+$/, '') !== '/api/sub') {
      throw new Error('Only this service\'s own /api/sub links are supported');
    }
    query = parsed.search.slice(1);
  } else if (raw.startsWith('/')) {
    const [path, search = ''] = splitOnce(raw, '?');
    if (path.replace(/\/+$/, '') !== '/api/sub') {
      throw new Error('Only this service\'s own /api/sub links are supported');
    }
    query = search;
  } else {
    query = raw.startsWith('?') ? raw.slice(1) : raw;
  }

  const params = pickSubParams(new URLSearchParams(query));

  const validationError = validateSubParams(params);
  if (validationError) {
    throw new Error(validationError);
  }

  // Only http(s) upstream subscriptions are allowed.
  const urls = urlDecode(params.url as string)
    .split('|')
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    throw new Error('Missing required parameter: url');
  }

  for (const url of urls) {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`Invalid subscription url: ${url}`);
    }
  }

  if (params.config && !/^https?:\/\//i.test(urlDecode(params.config))) {
    throw new Error('Invalid config url, it must start with http(s)://');
  }

  return params;
}

function splitOnce(value: string, separator: string): [string, string?] {
  const index = value.indexOf(separator);
  if (index === -1) return [value];
  return [value.slice(0, index), value.slice(index + 1)];
}

export interface ConvertOptions {
  /** User-Agent forwarded to the upstream subscription server */
  userAgent?: string;
}

/**
 * Run the full conversion pipeline and build the HTTP response.
 */
export async function convertSubscription(
  params: SubParams,
  options: ConvertOptions = {}
): Promise<NextResponse> {
  const validationError = validateSubParams(params);
  if (validationError) {
    console.error(validationError);
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const target = params.target as TargetFormat;
  const appendType = params.append_type === 'true';
  const udp = parseTriBool(params.udp);
  const tfo = parseTriBool(params.tfo);
  const scv = parseTriBool(params.scv);

  try {
    // Decode URL if needed
    const decodedUrl = urlDecode(params.url as string);

    // Fetch subscription content with longer timeout
    const contents = await fetchSubscription(decodedUrl, {
      timeout: 30000,
      userAgent: options.userAgent || 'subconverter-next/0.1.0',
    });

    if (contents.length === 0) {
      console.error('Subscription fetch returned empty content for URL:', decodedUrl);
      return NextResponse.json(
        { error: 'Failed to fetch subscription content' },
        { status: 400 }
      );
    }

    // Parse nodes from each subscription content
    let nodes: Proxy[] = [];
    for (const content of contents) {
      const parsed = parseSubscription(content);
      nodes.push(...parsed);
    }

    if (nodes.length === 0) {
      console.error('No valid nodes found in subscription');
      return NextResponse.json(
        { error: 'No valid nodes found in subscription' },
        { status: 400 }
      );
    }

    // Apply filters
    nodes = filterNodes(nodes, { include: params.include, exclude: params.exclude });

    if (nodes.length === 0) {
      console.error('No nodes remaining after filtering');
      return NextResponse.json(
        { error: 'No nodes remaining after filtering' },
        { status: 400 }
      );
    }

    // Deduplicate nodes
    nodes = deduplicateNodes(nodes);

    // Generate options
    const generatorOptions = {
      appendType,
      udp,
      tfo,
      skipCertVerify: scv,
    };

    let output: string;

    // Check if config URL is provided for full config generation
    if (params.config && (target === 'clash' || target === 'clashr')) {
      output = await generateWithConfig(nodes, params.config, generatorOptions);
    } else {
      // Simple generation without config
      output = generate(nodes, {
        target,
        ...generatorOptions,
      });
    }

    // Build response headers
    const headers: HeadersInit = {
      'Content-Type': getContentType(target),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    // Add Content-Disposition if filename is specified
    if (params.filename) {
      headers['Content-Disposition'] =
        `attachment; filename="${params.filename}"; filename*=utf-8''${encodeURIComponent(params.filename)}`;
    }

    // Add profile update interval for Clash
    if (target === 'clash' || target === 'clashr') {
      headers['profile-update-interval'] = '24'; // 24 hours
    }

    return new NextResponse(output, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Subscription conversion error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Conversion failed: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Generate full Clash config with remote config file
 */
async function generateWithConfig(
  nodes: Proxy[],
  configUrl: string,
  options: {
    appendType?: boolean;
    udp?: boolean;
    tfo?: boolean;
    skipCertVerify?: boolean;
  }
): Promise<string> {
  // Clear ruleset cache for fresh fetch
  clearRulesetCache();

  // Fetch and parse config with longer timeout
  const decodedConfigUrl = urlDecode(configUrl);
  const configContent = await fetchText(decodedConfigUrl, { timeout: 30000 });

  if (!configContent) {
    throw new Error(`Failed to fetch config file from: ${decodedConfigUrl}`);
  }

  const parsedConfig = parseConfig(configContent);

  // Generate proxy groups
  let proxyGroups = generateProxyGroups(parsedConfig.proxyGroups, nodes);

  // If no proxy groups defined in config, use defaults
  if (proxyGroups.length === 0) {
    proxyGroups = generateDefaultProxyGroups(nodes);
  }

  // Load all rulesets
  let rules: string[] = [];
  if (parsedConfig.enableRuleGenerator && parsedConfig.rulesets.length > 0) {
    rules = await loadAllRulesets(parsedConfig.rulesets, decodedConfigUrl);

    // Ensure MATCH rule exists at the end
    if (!rules.some((r) => r.startsWith('MATCH,'))) {
      // Find the catch-all group name (usually 漏网之鱼 or similar)
      const catchAllGroup = proxyGroups.find(
        (g) =>
          g.name.includes('漏网之鱼') ||
          g.name.includes('其他') ||
          g.name.includes('Final')
      );
      rules.push(`MATCH,${catchAllGroup?.name || '🐟 漏网之鱼'}`);
    }
  }

  // Generate full config
  return generateFullClashConfig(
    nodes,
    {
      proxyGroups,
      rules,
    },
    options
  );
}

/**
 * Parse tribool from string
 * Returns undefined if not specified, boolean otherwise
 */
export function parseTriBool(value: string | null | undefined): boolean | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return value === 'true' || value === '1';
}

/** Content type helper re-export for routes */
export { getContentType };
export type { TargetFormat };
