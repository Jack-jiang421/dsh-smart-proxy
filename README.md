# dsh-smart-proxy

[English](README.en.md) | 中文

> 为 DeepSeek Harness 桌面版提供可切换的代理模式、连通性自检和 SSE 超时保护，专治 `Transport Failed` 与 TLS 证书拦截。

## 解决什么问题

国内网络环境下，DSH 桌面版经常出现以下症状：

- 对话请求报 `Transport Failed`，但浏览器/curl 访问同一域名正常；
- 公司网络或杀毒软件做 HTTPS 中间人，导致 TLS 证书校验失败；
- 深度思考模型流式输出中途断连，前功尽弃。

本插件把「代理选择 → 连通性验证 → 长连接保活」串成一条链路，并把当前网络状态暴露成 Agent 工具，出问题时能直接问出来。

## 功能

- **三种代理模式**：`system`（跟随系统） / `manual`（手动指定） / `direct`（强制直连）
- **启动自检**：启动时探测 DeepSeek API 连通性，失败时在日志中给出明确原因
- **超时保护**：单独放大 SSE 流式超时（默认 10 分钟），避免长回答被截断
- **热重载**：修改配置后即时生效，无需重启 DSH
- **诊断工具**：在对话中调用 `smart-proxy.status` / `smart-proxy.switch-mode`

## 安装

```bash
dsh plugin add dsh-smart-proxy
```

安装后重启 `dsh web`，在「设置 → 插件」中确认 `smart-proxy` 已启用。

本地开发时也可以直接从目录安装：

```bash
git clone https://github.com/Jack-jiang421/dsh-smart-proxy.git
dsh plugin add /absolute/path/to/dsh-smart-proxy
```

## 配置

在 `~/.dsh/profiles/<profile>/cordis.patch.yml` 中覆盖 `smart-proxy` 的配置：

```yaml
- id: smart-proxy
  config:
    mode: manual
    proxyUrl: "http://127.0.0.1:7890"
```

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `mode` | `string` | `system` | 代理模式：`system` / `manual` / `direct` |
| `proxyUrl` | `string` | `http://127.0.0.1:7890` | `manual` 模式使用的代理地址 |
| `streamTimeout` | `number` | `600000` | SSE 流式超时（毫秒） |
| `connectTimeout` | `number` | `30000` | TCP 连接超时（毫秒） |
| `keepAlive` | `boolean` | `true` | 启用 TCP Keep-Alive |
| `retryOnTransportError` | `boolean` | `true` | 传输层错误自动重试 |
| `maxRetries` | `number` | `3` | 最大重试次数 |
| `ignoreTlsErrors` | `boolean` | `false` | 忽略 TLS 证书错误（仅在自签/中间人环境开启） |
| `bypassDomains` | `string[]` | `["localhost", "127.0.0.1", "::1"]` | 不走代理的域名 |
| `autoTest` | `boolean` | `true` | 启动时自动测试连通性 |

> `ignoreTlsErrors` 会降低安全性，只在明确知道证书被拦截时临时开启。

## 在对话中使用

插件注册了三个 Agent 工具，直接用自然语言触发即可：

| 说法 | 工具 |
| --- | --- |
| 「看一下当前代理状态，顺便测下连通性」 | `smart-proxy.status` |
| 「切换到直连模式」 | `smart-proxy.switch-mode` |

`status` 返回当前模式、代理地址、TLS 豁免状态、连通性结果与延迟；`switch-mode` 支持 `direct` / `manual` / `system`，可同时传入新的 `proxyUrl`。

## 排查 Transport Failed

1. 先把 `mode` 改为 `direct`，确认问题是否由代理引起；
2. 核对 `proxyUrl` 端口与本机代理软件一致（Clash 常见 7890，V2Ray 常见 10809）；
3. 在代理规则里把 `api.deepseek.com` 设为 `DIRECT`，排除规则误判；
4. 临时关闭杀毒软件的 HTTPS 流量扫描（卡巴斯基、火绒等）；
5. 日志中搜索 `[dsh-smart-proxy]` 获取完整诊断。

## 兼容性

- DSH `>=0.2.0`（`engines.dsh`）
- Cordis `^4.0.1`

## License

MIT
