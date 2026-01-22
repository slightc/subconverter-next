/**
 * Proxy node type definitions
 * Ported from src/parser/config/proxy.h
 */

export enum ProxyType {
  Unknown = 'unknown',
  Shadowsocks = 'ss',
  ShadowsocksR = 'ssr',
  VMess = 'vmess',
  Trojan = 'trojan',
  Snell = 'snell',
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS5 = 'socks5',
  WireGuard = 'wireguard',
  Hysteria = 'hysteria',
  Hysteria2 = 'hysteria2',
}

export function getProxyTypeName(type: ProxyType): string {
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

/**
 * Tribool type for optional boolean values
 * undefined = not set, true/false = explicitly set
 */
export type Tribool = boolean | undefined;

/**
 * Unified proxy node interface
 */
export interface Proxy {
  type: ProxyType;
  id?: number;
  groupId?: number;
  group?: string;
  remark: string;
  hostname: string;
  port: number;

  // Authentication
  username?: string;
  password?: string;

  // Shadowsocks / ShadowsocksR
  encryptMethod?: string;
  plugin?: string;
  pluginOption?: string;
  protocol?: string;       // SSR only
  protocolParam?: string;  // SSR only
  obfs?: string;           // SSR only
  obfsParam?: string;      // SSR only

  // VMess
  userId?: string;         // UUID
  alterId?: number;
  transferProtocol?: string;  // tcp, ws, h2, grpc, etc.
  fakeType?: string;       // none, http, srtp, etc.
  tlsSecure?: boolean;

  // Transport settings
  host?: string;           // HTTP host / WS host
  path?: string;           // WS path / H2 path / gRPC serviceName
  edge?: string;

  // QUIC
  quicSecure?: string;
  quicSecret?: string;

  // Common options
  udp?: Tribool;
  tcpFastOpen?: Tribool;
  allowInsecure?: Tribool;   // Skip certificate verify
  tls13?: Tribool;

  underlyingProxy?: string;

  // Snell
  snellVersion?: number;
  serverName?: string;       // SNI

  // WireGuard
  selfIP?: string;
  selfIPv6?: string;
  publicKey?: string;
  privateKey?: string;
  preSharedKey?: string;
  dnsServers?: string[];
  mtu?: number;
  allowedIPs?: string;
  keepAlive?: number;
  testUrl?: string;
  clientId?: string;

  // Hysteria / Hysteria2
  ports?: string;            // Port hopping
  up?: string;               // Upload bandwidth
  upSpeed?: number;
  down?: string;             // Download bandwidth
  downSpeed?: number;
  authStr?: string;
  sni?: string;
  fingerprint?: string;
  ca?: string;
  caStr?: string;
  recvWindowConn?: number;
  recvWindow?: number;
  disableMtuDiscovery?: Tribool;
  hopInterval?: number;
  alpn?: string[];
  cwnd?: number;

  // Hysteria2 specific
  obfsPassword?: string;
}

// Default group names
export const DEFAULT_GROUPS = {
  SS: 'SSProvider',
  SSR: 'SSRProvider',
  VMess: 'V2RayProvider',
  SOCKS: 'SocksProvider',
  HTTP: 'HTTPProvider',
  Trojan: 'TrojanProvider',
  Snell: 'SnellProvider',
  WireGuard: 'WireGuardProvider',
  Hysteria: 'HysteriaProvider',
  Hysteria2: 'Hysteria2Provider',
} as const;

/**
 * Create a new empty proxy with default values
 */
export function createProxy(partial: Partial<Proxy> = {}): Proxy {
  return {
    type: ProxyType.Unknown,
    remark: '',
    hostname: '',
    port: 0,
    ...partial,
  };
}

/**
 * Check if a proxy is valid (has required fields)
 */
export function isValidProxy(proxy: Proxy): boolean {
  return (
    proxy.type !== ProxyType.Unknown &&
    proxy.hostname !== '' &&
    proxy.port > 0 &&
    proxy.port <= 65535
  );
}
