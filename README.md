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
- **Accounts & Short Links**: Sign in, claim a short fixed ID and serve it as
  `/api/s/<id>?token=...` with a rotatable token
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

#### Upload Subscription File

```
POST /api/upload
```

Upload a Clash/YAML config file and receive a public URL that can be used as the
`url` parameter of `/api/sub`. This is handy when you don't have a hosted
subscription link. Uploaded files are stored via **Vercel Blob** (currently the
only supported storage backend).

**Request:** `multipart/form-data` with a `file` field (or a raw YAML request body).

**Response:**

```json
{
  "url": "https://<store>.public.blob.vercel-storage.com/uploads/sub-xxxx.yaml",
  "pathname": "uploads/sub-xxxx.yaml",
  "size": 1234,
  "provider": "vercel"
}
```

**Example:**

```bash
curl -X POST -F "file=@config.yaml" http://localhost:3000/api/upload
```

**Configuration:** Connect a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
store to your deployment. This provides the `BLOB_READ_WRITE_TOKEN` environment
variable required for uploads. Without it, the endpoint returns `503`.

In the Web UI, use the **Upload YAML File** button under the subscription URL
field to upload a file directly; its URL is appended to the subscription list
automatically.

#### Get Version

```
GET /api/version
```

## Accounts & Short Subscription Links

Instead of handing your client a long `/api/sub?...` URL, sign in and claim a
short, fixed ID. The ID always stays the same — you can change what it points
to at any time, and rotate its token when a URL leaks.

```
GET /api/s/<id>?token=xxxxx
```

### Web UI

Open `/account` (**My Subscriptions** in the header):

1. Create an account (username + password) or sign in
2. Enter a short **ID** (3-32 characters, `a-z 0-9 - _`)
3. Paste the **mapped link** — it must be one of this service's own `/api/sub`
   links; generate it on the home page and press **Save as Short Link**
4. Copy the resulting `/api/s/<id>?token=...` URL into your client

From the same page you can edit the mapping, rotate the token (the old URL stops
working immediately) or delete the short link.

### API

All endpoints below use JSON and a `sc_session` cookie for authentication.

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | `{ username, password, code? }` — create an account and sign in |
| `POST /api/auth/login` | `{ username, password }` — sign in |
| `POST /api/auth/logout` | Sign out |
| `GET /api/auth/me` | Current session and server settings |
| `GET /api/links` | List your short links |
| `POST /api/links` | `{ id, link, name? }` — create a short link |
| `PATCH /api/links/<id>` | `{ link?, name? }` — update the mapping |
| `POST /api/links/<id>/token` | Rotate the token |
| `DELETE /api/links/<id>` | Delete the short link |
| `GET /api/s/<id>?token=…` | The subscription itself |

**Example:**

```bash
# Sign in
curl -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"my-password"}'

# Claim the ID "home" and map it to one of your own /api/sub links
curl -b jar.txt -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  -d '{"id":"home","link":"http://localhost:3000/api/sub?target=clash&url=https%3A%2F%2Fexample.com%2Fsub"}'
# => { "link": { "id": "home", "token": "…", "url": "http://localhost:3000/api/s/home?token=…" } }

# Rotate the token — the previous URL stops working right away
curl -b jar.txt -X POST http://localhost:3000/api/links/home/token
```

**Notes:**

- Only this service's own `/api/sub` links (or their bare query string) are
  accepted as the mapping target — arbitrary URLs are rejected, so the service
  cannot be used as an open proxy.
- Each account may hold up to 20 short links.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Yes | Provided by a connected [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store; accounts and links are stored there. Without it the account endpoints return `503`. |
| `AUTH_SECRET` | Recommended | Signs session cookies **and derives the storage pathnames**. Defaults to the Blob token. Set it once before creating accounts: changing it later signs everyone out and makes existing accounts and links unreachable. |
| `REGISTER_CODE` | No | When set, registration requires this invite code. |
| `DISABLE_REGISTER` | No | Set to `true` to close registration. |

Passwords are stored as scrypt hashes and subscription tokens are 128-bit random
values compared in constant time. Each record lives at an unguessable blob
pathname derived with HMAC-SHA256 from `AUTH_SECRET`, and listing a Blob store
requires its read-write token.

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
│   │   ├── auth/             # Register / login / logout / session
│   │   ├── links/            # Short link management
│   │   ├── s/[id]/route.ts   # Short subscription link
│   │   ├── sub/route.ts      # Subscription conversion API
│   │   ├── upload/route.ts   # YAML upload API
│   │   └── version/route.ts  # Version API
│   ├── account/page.tsx      # Account & short link UI
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Web UI
├── lib/
│   ├── api/                  # Shared route helpers
│   ├── auth/                 # Password hashing & session cookies
│   ├── store/                # User and short link records
│   ├── subconvert.ts         # Shared conversion pipeline
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
