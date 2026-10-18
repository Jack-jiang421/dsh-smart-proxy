# dsh-smart-proxy

English | [中文](README.md)

> Switchable proxy modes, connectivity self-check and SSE timeout protection for DeepSeek Harness desktop — fixes `Transport Failed` and TLS interception.

## The problem

On restricted networks the DSH desktop app often fails like this:

- every request ends with `Transport Failed`, while curl to the same host succeeds;
- corporate gateways or antivirus software intercept HTTPS, so TLS verification fails;
- long streaming answers from reasoning models get cut off halfway.

This plugin chains proxy selection, connectivity verification and keep-alive together, and exposes the current network state as agent tools so you can ask the agent what is wrong.

## Features

- **Three proxy modes**: `system` / `manual` / `direct`
- **Startup probe**: tests DeepSeek API connectivity on boot and logs the concrete failure
- **Timeout tuning**: a separate, larger SSE stream timeout (10 minutes by default)
- **Hot reload**: config changes apply without restarting DSH
- **Diagnostics**: `smart-proxy.status` and `smart-proxy.switch-mode` agent tools

## Install

```bash
dsh plugin add dsh-smart-proxy
```

Restart `dsh web` afterwards and check that `smart-proxy` is enabled under **Settings → Plugins**.

From a local checkout:

```bash
git clone https://github.com/Jack-jiang421/dsh-smart-proxy.git
dsh plugin add /absolute/path/to/dsh-smart-proxy
```

## Configuration

Override the `smart-proxy` entry in `~/.dsh/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: smart-proxy
  config:
    mode: manual
    proxyUrl: "http://127.0.0.1:7890"
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `mode` | `string` | `system` | `system` / `manual` / `direct` |
| `proxyUrl` | `string` | `http://127.0.0.1:7890` | Proxy used in `manual` mode |
| `streamTimeout` | `number` | `600000` | SSE stream timeout in ms |
| `connectTimeout` | `number` | `30000` | TCP connect timeout in ms |
| `keepAlive` | `boolean` | `true` | Enable TCP keep-alive |
| `retryOnTransportError` | `boolean` | `true` | Retry transport errors |
| `maxRetries` | `number` | `3` | Maximum retries |
| `ignoreTlsErrors` | `boolean` | `false` | Skip TLS verification (only for self-signed / interception setups) |
| `bypassDomains` | `string[]` | `["localhost", "127.0.0.1", "::1"]` | Hosts that skip the proxy |
| `autoTest` | `boolean` | `true` | Probe connectivity on startup |

> `ignoreTlsErrors` weakens security. Enable it only when you know TLS is being intercepted.

## Agent tools

| Ask | Tool |
| --- | --- |
| "Show the proxy status and test connectivity" | `smart-proxy.status` |
| "Switch to direct mode" | `smart-proxy.switch-mode` |

`status` reports the current mode, proxy URL, TLS exemption, connectivity result and latency. `switch-mode` accepts `direct` / `manual` / `system` plus an optional new `proxyUrl`.

## Troubleshooting

1. Set `mode` to `direct` to confirm whether the proxy is the cause;
2. Check that `proxyUrl` matches your local proxy port (7890 for Clash, 10809 for V2Ray);
3. Add a `DIRECT` rule for `api.deepseek.com` in your proxy config;
4. Temporarily disable HTTPS scanning in antivirus software;
5. Search the DSH log for `[dsh-smart-proxy]` for the full diagnosis.

## Compatibility

- DSH `>=0.2.0`
- Cordis `^4.0.1`

## License

MIT
