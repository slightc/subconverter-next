# Upstream Reference

This document tracks the upstream [tindy2013/subconverter](https://github.com/tindy2013/subconverter) reference and sync status.

## Current Reference

| Field | Value |
|-------|-------|
| **Upstream Repo** | https://github.com/tindy2013/subconverter |
| **Reference Commit** | [`6d312fe`](https://github.com/tindy2013/subconverter/commit/6d312fe52cf05a76e06038feef6011d3c9b77e4f) |
| **Reference Date** | 2024-01-XX |
| **Last Sync Check** | 2026-01-22 |

## Implemented Features

### Parsers
- [x] VMess (vmess://)
- [x] Shadowsocks (ss://)
- [x] ShadowsocksR (ssr://)
- [x] Trojan (trojan://)
- [x] Hysteria2 (hysteria2://, hy2://)
- [ ] VLESS (vless://)
- [ ] Hysteria (hysteria://)
- [ ] TUIC
- [ ] WireGuard
- [ ] Snell
- [ ] HTTP/HTTPS Proxy
- [ ] SOCKS5 Proxy

### Generators
- [x] Clash (YAML format)
- [x] ClashR (with SSR support)
- [x] Mixed (Base64 encoded)
- [ ] Surge
- [ ] Quantumult
- [ ] Quantumult X
- [ ] Loon
- [ ] Surfboard
- [ ] ShadowsocksD
- [ ] ShadowsocksR (SSD)

### Config Features
- [x] Remote config parsing (ACL4SSR format .ini)
- [x] Proxy group generation
- [x] Ruleset loading and parsing
- [x] Node filtering (include/exclude regex)
- [x] Node deduplication
- [ ] Custom remark/rename
- [ ] Emoji addition
- [ ] Sort nodes
- [ ] Append proxy type to name
- [ ] UDP/TFO/scv flags

### API Features
- [x] GET /api/sub - Subscription conversion
- [x] GET /api/version - Version info
- [x] Multiple URL support (separated by |)
- [ ] POST support
- [ ] Short URL generation
- [ ] Cache mechanism

## Update Plan

When syncing with upstream:

1. **Check upstream changes**
   ```bash
   # View commits since last reference
   # https://github.com/tindy2013/subconverter/compare/6d312fe...master
   ```

2. **Priority updates**
   - Security fixes (HIGH)
   - Parser bug fixes (HIGH)
   - New protocol support (MEDIUM)
   - New target format support (MEDIUM)
   - Performance improvements (LOW)

3. **Update process**
   - Review upstream diff
   - Implement changes in TypeScript
   - Update this document with new reference commit
   - Test thoroughly before release

## Changelog

### 2026-01-22
- Initial reference established at commit `6d312fe`
- Implemented basic parsers: VMess, SS, SSR, Trojan, Hysteria2
- Implemented generators: Clash, ClashR, Mixed
- Added remote config support (ACL4SSR format)
- Added Web UI with multiple URL input support

---

## How to Update Reference

After syncing with upstream, update the reference:

```bash
# Update UPSTREAM.md with new commit hash
# Then commit:
git add UPSTREAM.md
git commit -m "chore: sync upstream reference to <new-commit-hash>"
```
