/**
 * Subscription converter API route
 * 
 * GET /api/sub
 * 
 * Query parameters:
 * - url: Subscription URL (required, multiple URLs separated by |)
 * - target: Target format - clash, clashr, mixed (required)
 * - config: Remote config URL (optional, enables full config generation)
 * - include: Include nodes matching regex
 * - exclude: Exclude nodes matching regex
 * - filename: Download filename
 * - append_type: Append proxy type to node name
 * - udp: Enable UDP
 * - tfo: Enable TCP Fast Open
 * - scv: Skip certificate verify
 * - insert: Insert custom nodes (not implemented yet)
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseSubscription, filterNodes, deduplicateNodes, parseConfig, loadAllRulesets, clearRulesetCache } from '@/lib/parsers';
import { generate, generateFullClashConfig, generateProxyGroups, generateDefaultProxyGroups, getContentType, TargetFormat } from '@/lib/generators';
import { fetchSubscription, fetchText } from '@/lib/utils/fetch';
import { urlDecode } from '@/lib/utils/string';
import { Proxy } from '@/lib/types/proxy';

// Supported target formats
const SUPPORTED_TARGETS = ['clash', 'clashr', 'mixed'];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Get required parameters
  const url = searchParams.get('url');
  const target = searchParams.get('target');

  // Validate required parameters
  if (!url) {
    return NextResponse.json(
      { error: 'Missing required parameter: url' },
      { status: 400 }
    );
  }

  if (!target) {
    return NextResponse.json(
      { error: 'Missing required parameter: target' },
      { status: 400 }
    );
  }

  if (!SUPPORTED_TARGETS.includes(target)) {
    return NextResponse.json(
      { error: `Invalid target: ${target}. Supported targets: ${SUPPORTED_TARGETS.join(', ')}` },
      { status: 400 }
    );
  }

  // Get optional parameters
  const configUrl = searchParams.get('config') || undefined;
  const include = searchParams.get('include') || undefined;
  const exclude = searchParams.get('exclude') || undefined;
  const filename = searchParams.get('filename') || undefined;
  const appendType = searchParams.get('append_type') === 'true';
  const udp = parseTriBool(searchParams.get('udp'));
  const tfo = parseTriBool(searchParams.get('tfo'));
  const scv = parseTriBool(searchParams.get('scv'));

  try {
    // Decode URL if needed
    const decodedUrl = urlDecode(url);
    
    // Fetch subscription content
    const content = await fetchSubscription(decodedUrl, {
      timeout: 15000,
      userAgent: request.headers.get('user-agent') || 'subconverter-next/0.1.0',
    });

    if (!content) {
      return NextResponse.json(
        { error: 'Failed to fetch subscription content' },
        { status: 400 }
      );
    }

    // Parse nodes from subscription
    let nodes = parseSubscription(content);

    if (nodes.length === 0) {
      return NextResponse.json(
        { error: 'No valid nodes found in subscription' },
        { status: 400 }
      );
    }

    // Apply filters
    nodes = filterNodes(nodes, { include, exclude });

    if (nodes.length === 0) {
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
    if (configUrl && (target === 'clash' || target === 'clashr')) {
      output = await generateWithConfig(nodes, configUrl, generatorOptions);
    } else {
      // Simple generation without config
      output = generate(nodes, {
        target: target as TargetFormat,
        ...generatorOptions,
      });
    }

    // Build response headers
    const headers: HeadersInit = {
      'Content-Type': getContentType(target as TargetFormat),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    // Add Content-Disposition if filename is specified
    if (filename) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"; filename*=utf-8''${encodeURIComponent(filename)}`;
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

  // Fetch and parse config
  const decodedConfigUrl = urlDecode(configUrl);
  const configContent = await fetchText(decodedConfigUrl, { timeout: 10000 });
  
  if (!configContent) {
    throw new Error('Failed to fetch config file');
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
    if (!rules.some(r => r.startsWith('MATCH,'))) {
      // Find the catch-all group name (usually 漏网之鱼 or similar)
      const catchAllGroup = proxyGroups.find(g => 
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

// Also support HEAD requests for subscription checks
export async function HEAD(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const target = searchParams.get('target');

  if (!url || !target || !SUPPORTED_TARGETS.includes(target)) {
    return new NextResponse(null, { status: 400 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': getContentType(target as TargetFormat),
    },
  });
}

/**
 * Parse tribool from string
 * Returns undefined if not specified, boolean otherwise
 */
function parseTriBool(value: string | null): boolean | undefined {
  if (value === null || value === '') {
    return undefined;
  }
  return value === 'true' || value === '1';
}
