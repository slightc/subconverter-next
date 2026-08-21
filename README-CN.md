# Subconverter Next

基于 Next.js 构建的订阅转换服务，从原始 C++ [subconverter](https://github.com/tindy2013/subconverter) 项目移植而来。

[English](./README.md)

## 功能特性

- **协议支持**：SS、SSR、VMess、Trojan、Hysteria2
- **输出格式**：Clash、ClashR、Mixed (Base64)
- **远程配置**：支持 ACL4SSR 风格的 INI 配置文件
- **代理分组**：根据配置自动生成代理分组
- **规则加载**：从远程 URL 加载和解析规则集
- **Web UI**：友好的用户界面，方便生成转换链接
- **账号与短链接**：登录后申请固定的短 ID，通过 `/api/s/<id>?token=...` 获取订阅，token 可随时轮换
- **Serverless**：专为 Vercel/Serverless 部署设计

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/slightc/subconverter-next.git
cd subconverter-next

# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 构建生产版本
npm run build
npm run start
```

### Docker（即将推出）

```bash
docker run -p 3000:3000 slightc/subconverter-next
```

## 使用方法

### Web UI

访问 `http://localhost:3000` 打开 Web 界面。

1. 输入订阅链接
2. 选择目标格式（Clash/Mixed）
3. 选择远程配置（可选）
4. 点击"Generate Link"生成链接
5. 复制生成的链接或直接打开

### API 接口

#### 订阅转换

```
GET /api/sub
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `url` | 是 | 订阅链接（多个链接用 `\|` 分隔） |
| `target` | 是 | 目标格式：`clash`、`clashr`、`mixed` |
| `config` | 否 | 远程配置链接（ACL4SSR 格式） |
| `include` | 否 | 包含匹配正则的节点 |
| `exclude` | 否 | 排除匹配正则的节点 |
| `filename` | 否 | 下载文件名 |

**示例：**

```bash
# 简单转换
curl "http://localhost:3000/api/sub?target=clash&url=https://example.com/sub"

# 使用远程配置
curl "http://localhost:3000/api/sub?target=clash&url=https://example.com/sub&config=https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini"
```

#### 上传订阅文件

```
POST /api/upload
```

上传 Clash/YAML 配置文件，返回一个可公开访问的 URL，可作为 `/api/sub` 的 `url`
参数使用。当你没有现成的订阅链接时非常方便。上传的文件通过 **Vercel Blob**
存储（目前仅支持该存储后端）。

**请求：** `multipart/form-data`，字段名为 `file`（也支持直接以 YAML 作为请求体）。

**响应：**

```json
{
  "url": "https://<store>.public.blob.vercel-storage.com/uploads/sub-xxxx.yaml",
  "pathname": "uploads/sub-xxxx.yaml",
  "size": 1234,
  "provider": "vercel"
}
```

**示例：**

```bash
curl -X POST -F "file=@config.yaml" http://localhost:3000/api/upload
```

**配置：** 为你的部署连接 [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
存储。它会提供上传所需的 `BLOB_READ_WRITE_TOKEN` 环境变量。若未配置，该接口将返回
`503`。

在 Web UI 中，可使用订阅 URL 下方的 **Upload YAML File** 按钮直接上传文件，其 URL
会自动追加到订阅列表中。

#### 获取版本

```
GET /api/version
```

## 账号与订阅短链接

不用再把又长又难记的 `/api/sub?...` 链接丢给客户端：登录后申请一个固定的短 ID，
ID 永远不变，映射的内容可以随时修改，链接泄露时轮换 token 即可。

```
GET /api/s/<id>?token=xxxxx
```

### 网页操作

打开 `/account`（首页顶部的 **My Subscriptions**）：

1. 注册账号（用户名 + 密码）或登录
2. 填写短 **ID**（3-32 位，支持 `a-z 0-9 - _`）
3. 粘贴**映射链接**：只支持本服务自己的 `/api/sub` 链接，可在首页生成后点击
   **Save as Short Link** 自动带入
4. 复制生成的 `/api/s/<id>?token=...` 填进客户端

在同一页面还可以修改映射、轮换 token（旧链接立即失效）或删除短链接。

### API 接口

以下接口均使用 JSON，登录状态保存在 `sc_session` Cookie 中。

| 接口 | 说明 |
|------|------|
| `POST /api/auth/register` | `{ username, password, code? }` 注册并登录 |
| `POST /api/auth/login` | `{ username, password }` 登录 |
| `POST /api/auth/logout` | 退出登录 |
| `GET /api/auth/me` | 当前登录状态与服务端设置 |
| `GET /api/links` | 列出自己的短链接 |
| `POST /api/links` | `{ id, link, name? }` 创建短链接 |
| `PATCH /api/links/<id>` | `{ link?, name? }` 修改映射 |
| `POST /api/links/<id>/token` | 轮换 token |
| `DELETE /api/links/<id>` | 删除短链接 |
| `GET /api/s/<id>?token=…` | 获取订阅内容 |

**示例：**

```bash
# 登录
curl -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"my-password"}'

# 申请短 ID "home"，映射到自己的 /api/sub 链接
curl -b jar.txt -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  -d '{"id":"home","link":"http://localhost:3000/api/sub?target=clash&url=https%3A%2F%2Fexample.com%2Fsub"}'
# => { "link": { "id": "home", "token": "…", "url": "http://localhost:3000/api/s/home?token=…" } }

# 轮换 token，旧链接立刻失效
curl -b jar.txt -X POST http://localhost:3000/api/links/home/token
```

**说明：**

- 映射目标只接受本服务自己的 `/api/sub` 链接（或其查询字符串），任意外部 URL 会被
  拒绝，避免服务被当作开放代理滥用。
- 每个账号最多 20 个短链接。

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `BLOB_READ_WRITE_TOKEN` | 是 | 连接 [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) 存储后自动提供；账号与短链接以 **private** blob 形式存放。未配置时账号相关接口返回 `503`。 |
| `AUTH_SECRET` | 建议 | 用于签名会话 Cookie，默认回退到 Blob token；修改后所有人需要重新登录。 |
| `REGISTER_CODE` | 否 | 设置后注册需要填写该邀请码。 |
| `DISABLE_REGISTER` | 否 | 设为 `true` 关闭注册。 |

密码使用 scrypt 加盐哈希存储，订阅 token 为 128 位随机值并使用常数时间比较。

## 远程配置

支持 ACL4SSR 风格的 INI 配置文件，用于生成代理分组和规则。

**支持的指令：**

- `ruleset` - 定义规则集
- `custom_proxy_group` - 定义自定义代理分组
- `enable_rule_generator` - 启用/禁用规则生成
- `overwrite_original_rules` - 覆盖原有规则

**配置示例：**

```ini
[custom]
ruleset=🎯 全球直连,rules/ACL4SSR/Clash/LocalAreaNetwork.list
ruleset=🚀 节点选择,rules/ACL4SSR/Clash/ProxyLite.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择`select`.*
custom_proxy_group=🎯 全球直连`select`[]DIRECT`[]🚀 节点选择
custom_proxy_group=🐟 漏网之鱼`select`[]🚀 节点选择`[]🎯 全球直连

enable_rule_generator=true
overwrite_original_rules=true
```

## 部署

### Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/slightc/subconverter-next)

1. 点击上方按钮或从 GitHub 导入
2. 使用默认设置部署
3. 访问部署后的 URL

### 自托管

```bash
# 构建
npm run build

# 启动生产服务器
npm run start
```

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── auth/             # 注册 / 登录 / 退出 / 会话
│   │   ├── links/            # 短链接管理
│   │   ├── s/[id]/route.ts   # 订阅短链接
│   │   ├── sub/route.ts      # 订阅转换 API
│   │   ├── upload/route.ts   # YAML 上传 API
│   │   └── version/route.ts  # 版本 API
│   ├── account/page.tsx      # 账号与短链接页面
│   ├── layout.tsx            # 根布局
│   └── page.tsx              # Web UI
├── lib/
│   ├── api/                  # 路由公共辅助函数
│   ├── auth/                 # 密码哈希与会话 Cookie
│   ├── store/                # 用户与短链接数据
│   ├── subconvert.ts         # 共享的转换流程
│   ├── generators/           # 输出格式生成器
│   │   ├── clash.ts          # Clash YAML 生成器
│   │   ├── mixed.ts          # Mixed Base64 生成器
│   │   └── proxygroup.ts     # 代理分组生成器
│   ├── parsers/              # 协议解析器
│   │   ├── ss.ts             # Shadowsocks 解析器
│   │   ├── ssr.ts            # ShadowsocksR 解析器
│   │   ├── vmess.ts          # VMess 解析器
│   │   ├── trojan.ts         # Trojan 解析器
│   │   ├── hysteria2.ts      # Hysteria2 解析器
│   │   ├── config.ts         # INI 配置解析器
│   │   └── ruleset.ts        # 规则集加载器
│   ├── types/                # TypeScript 类型定义
│   └── utils/                # 工具函数
```

## 开源协议

MIT License

## 致谢

- [tindy2013/subconverter](https://github.com/tindy2013/subconverter) - 原始 C++ 实现
- [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) - 规则和配置资源
