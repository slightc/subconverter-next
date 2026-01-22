# Subconverter Next

A subscription converter service built with Next.js, ported from the original C++ [subconverter](https://github.com/tindy2013/subconverter) project.

[中文文档](./README-CN.md)

## Features

- **Protocol Support**: SS, SSR, VMess, Trojan, Hysteria2
- **Output Formats**: Clash, ClashR, Mixed (Base64)
- **Remote Config**: Support ACL4SSR-style INI configuration files
- **Proxy Groups**: Auto-generate proxy groups based on config
- **Rules**: Load and parse rulesets from remote URLs
- **Web UI**: User-friendly interface for generating conversion links
- **Serverless Ready**: Designed for Vercel/Serverless deployment

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/slightc/subconverter-next.git
cd subconverter-next

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm run start
```

### Docker (Coming Soon)

```bash
docker run -p 3000:3000 slightc/subconverter-next
```

## Usage

### Web UI

Visit `http://localhost:3000` to access the web interface.

1. Enter your subscription URL
2. Select target format (Clash/Mixed)
3. Choose a remote config (optional)
4. Click "Generate Link"
5. Copy the generated URL or open it directly

### API

#### Convert Subscription

```
GET /api/sub
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | Subscription URL (multiple URLs separated by `\|`) |
| `target` | Yes | Target format: `clash`, `clashr`, `mixed` |
| `config` | No | Remote config URL (ACL4SSR format) |
| `include` | No | Include nodes matching regex |
| `exclude` | No | Exclude nodes matching regex |
| `filename` | No | Download filename |

**Example:**

```bash
# Simple conversion
curl "http://localhost:3000/api/sub?target=clash&url=https://example.com/sub"

# With remote config
curl "http://localhost:3000/api/sub?target=clash&url=https://example.com/sub&config=https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini"
```

#### Get Version

```
GET /api/version
```

## Remote Config

Supports ACL4SSR-style INI configuration files for generating proxy groups and rules.

**Supported directives:**

- `ruleset` - Define rulesets
- `custom_proxy_group` - Define custom proxy groups
- `enable_rule_generator` - Enable/disable rule generation
- `overwrite_original_rules` - Overwrite original rules

**Example config:**

```ini
[custom]
ruleset=🎯 Direct,rules/ACL4SSR/Clash/LocalAreaNetwork.list
ruleset=🚀 Proxy,rules/ACL4SSR/Clash/ProxyLite.list
ruleset=🎯 Direct,[]GEOIP,CN
ruleset=🐟 Final,[]FINAL

custom_proxy_group=🚀 Proxy`select`.*
custom_proxy_group=🎯 Direct`select`[]DIRECT`[]🚀 Proxy
custom_proxy_group=🐟 Final`select`[]🚀 Proxy`[]🎯 Direct

enable_rule_generator=true
overwrite_original_rules=true
```

## Deployment

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/slightc/subconverter-next)

1. Click the button above or import from GitHub
2. Deploy with default settings
3. Access your deployment URL

### Self-hosted

```bash
# Build
npm run build

# Start production server
npm run start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── sub/route.ts      # Subscription conversion API
│   │   └── version/route.ts  # Version API
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Web UI
├── lib/
│   ├── generators/           # Output format generators
│   │   ├── clash.ts          # Clash YAML generator
│   │   ├── mixed.ts          # Mixed Base64 generator
│   │   └── proxygroup.ts     # Proxy group generator
│   ├── parsers/              # Protocol parsers
│   │   ├── ss.ts             # Shadowsocks parser
│   │   ├── ssr.ts            # ShadowsocksR parser
│   │   ├── vmess.ts          # VMess parser
│   │   ├── trojan.ts         # Trojan parser
│   │   ├── hysteria2.ts      # Hysteria2 parser
│   │   ├── config.ts         # INI config parser
│   │   └── ruleset.ts        # Ruleset loader
│   ├── types/                # TypeScript types
│   └── utils/                # Utility functions
```

## License

MIT License

## Acknowledgments

- [tindy2013/subconverter](https://github.com/tindy2013/subconverter) - Original C++ implementation
- [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) - Rule and config resources
