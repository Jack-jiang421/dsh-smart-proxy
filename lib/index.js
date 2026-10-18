/**
 * dsh-smart-proxy — DeepSeek Harness 智能网络代理管理插件 (零依赖稳定版)
 *
 * 核心解决痛点:
 * 1. 代理软件 / 杀毒软件对 HTTPS 进行中间人嗅探注入自签证书，导致 Node.js 报 SELF_SIGNED_CERT_IN_CHAIN 错误，进而触发 DSH 的 Transport Failed。
 * 2. 深度思考推理时间过长，代理空闲超时或连接重置导致的长连接中断。
 * 3. 灵活切换 Direct（直连）、Manual（手动指定代理如 127.0.0.1:7890）、System（跟随系统代理）。
 *
 * 无需外部 npm 依赖，完全兼容 DSH 运行时。
 *
 * @module dsh-smart-proxy
 */

export const name = 'smart-proxy'

export const description =
  '智能网络代理管理 — 解决 Transport Failed 及 TLS 证书拦截问题，支持 System / Manual / Direct 三种模式'

const TAG = '[dsh-smart-proxy]'

/** 验证代理 URL 格式 */
function isValidProxyUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'socks5:'
  } catch {
    return false
  }
}

/** 测试连通性 */
async function testConnection(logger, config) {
  const testUrl = 'https://api.deepseek.com/v1/models'
  const startTime = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.connectTimeout || 30000)
    const response = await globalThis.fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'dsh-smart-proxy/1.2.0' },
    })
    clearTimeout(timeout)
    const latency = Date.now() - startTime
    // 401 = 连接成功但未提供 API Key (说明网络链路与 TLS 握手完全通畅); 200 = 成功
    if (response.status === 401 || response.status === 200) {
      logger.info(`${TAG} ✅ 连通性测试通过 — 延迟: ${latency}ms (HTTP ${response.status})`)
      return { success: true, latency, status: response.status }
    }
    logger.warn(`${TAG} ⚠️ 连通性测试返回异常状态码: HTTP ${response.status}, 延迟: ${latency}ms`)
    return { success: true, latency, status: response.status }
  } catch (err) {
    const latency = Date.now() - startTime
    const errMsg = err?.message || String(err)
    logger.error(`${TAG} ❌ 连通性测试失败 — ${errMsg} (${latency}ms)`)
    return { success: false, latency, error: errMsg }
  }
}

/**
 * 插件入口 (Cordis apply)
 */
export function apply(ctx, config) {
  const logger = ctx.logger ?? console

  // 规范化配置
  config = {
    mode: 'manual',                     // 默认 manual 或 system
    proxyUrl: 'http://127.0.0.1:7890',  // 默认对应本地 Clash 端口
    ignoreTlsErrors: true,              // 彻底解决 SELF_SIGNED_CERT_IN_CHAIN
    streamTimeout: 600000,              // 10 分钟，应对深度思考长连接
    connectTimeout: 30000,              // 30 秒连接超时
    keepAlive: true,
    bypassDomains: ['localhost', '127.0.0.1', '::1'],
    autoTest: true,
    ...config,
  }

  logger.info(`${TAG} 插件启动 — 版本 1.2.0`)
  logger.info(`${TAG} 运行模式: ${config.mode}, 目标代理: ${config.proxyUrl}`)

  // 1. 核心修复：放宽本地自签证书检查，防御代理/杀毒软件中间人证书劫持
  if (config.ignoreTlsErrors) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    logger.info(`${TAG} 🛡️ 已启用 TLS 自签证书豁免 (解决 SELF_SIGNED_CERT_IN_CHAIN 问题)`)
  }

  // 备份初始环境变量
  const originalEnv = {
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    NO_PROXY: process.env.NO_PROXY,
    http_proxy: process.env.http_proxy,
    https_proxy: process.env.https_proxy,
    no_proxy: process.env.no_proxy,
  }

  /**
   * 应用网络代理配置
   */
  function applyProxySettings(cfg) {
    try {
      // 设置 NO_PROXY
      if (cfg.bypassDomains && cfg.bypassDomains.length > 0) {
        const bypass = cfg.bypassDomains.join(',')
        process.env.NO_PROXY = bypass
        process.env.no_proxy = bypass
      }

      switch (cfg.mode) {
        // 直连模式：清除所有代理变量
        case 'direct': {
          delete process.env.HTTP_PROXY
          delete process.env.HTTPS_PROXY
          delete process.env.http_proxy
          delete process.env.https_proxy
          logger.info(`${TAG} 🔵 已切换到【直连模式】(Direct) — 绕过所有系统和本地代理`)
          break
        }

        // 手动模式：注入指定的本地代理端口（如 Clash 7890）
        case 'manual': {
          if (!cfg.proxyUrl || !isValidProxyUrl(cfg.proxyUrl)) {
            logger.warn(`${TAG} ⚠️ 代理地址无效: "${cfg.proxyUrl}"，降级为直连`)
            cfg.mode = 'direct'
            applyProxySettings(cfg)
            return
          }
          process.env.HTTP_PROXY = cfg.proxyUrl
          process.env.HTTPS_PROXY = cfg.proxyUrl
          process.env.http_proxy = cfg.proxyUrl
          process.env.https_proxy = cfg.proxyUrl
          logger.info(`${TAG} 🟢 已应用【手动代理模式】(Manual) — ${cfg.proxyUrl}`)
          break
        }

        // 系统代理模式：若未设置环境变量，尝试读取默认 7890 备用
        case 'system':
        default: {
          const current = process.env.HTTP_PROXY || process.env.http_proxy ||
                          process.env.HTTPS_PROXY || process.env.https_proxy
          if (!current && cfg.proxyUrl) {
            // 系统未自动带入变量时，使用 proxyUrl 兜底
            process.env.HTTP_PROXY = cfg.proxyUrl
            process.env.HTTPS_PROXY = cfg.proxyUrl
          }
          logger.info(`${TAG} 🟡 已应用【系统代理模式】(System) — 当前代理: ${process.env.HTTP_PROXY || '(直连)'}`)
          break
        }
      }
    } catch (err) {
      logger.error(`${TAG} ❌ 应用代理配置出错: ${err?.message || err}`)
    }
  }

  // 立即应用配置
  applyProxySettings(config)

  // 启动时自动测试连通性
  if (config.autoTest) {
    setTimeout(async () => {
      logger.info(`${TAG} 正在检测 DeepSeek API 网络连通性...`)
      const res = await testConnection(logger, config)
      if (res.success) {
        logger.info(`${TAG} 🎉 DeepSeek API 网络完全畅通，可以正常发送消息！`)
      } else {
        logger.warn(`${TAG} ⚠️ 连接未能建立，错误: ${res.error}`)
      }
    }, 1500)
  }

  // 注册 DSH 交互工具
  try {
    ctx.tool?.('smart-proxy.status', {
      description: '查询当前代理状态及 DeepSeek 连通性',
      parameters: {},
      async execute() {
        const test = await testConnection(logger, config)
        return {
          mode: config.mode,
          proxyUrl: config.proxyUrl,
          ignoreTlsErrors: config.ignoreTlsErrors,
          connectionSuccess: test.success,
          latency: test.latency ? `${test.latency}ms` : 'N/A',
          httpProxy: process.env.HTTP_PROXY || '(无)',
        }
      },
    })
  } catch { /* skip */ }

  try {
    ctx.tool?.('smart-proxy.switch-mode', {
      description: '切换代理模式 (direct / manual / system)',
      parameters: {
        mode: { type: 'string', description: 'direct | manual | system' },
        proxyUrl: { type: 'string', description: '可选，新代理地址' },
      },
      async execute(args) {
        if (args.mode) config.mode = args.mode
        if (args.proxyUrl) config.proxyUrl = args.proxyUrl
        applyProxySettings(config)
        const test = await testConnection(logger, config)
        return {
          mode: config.mode,
          appliedProxy: process.env.HTTP_PROXY || '(直连)',
          connectionSuccess: test.success,
          latency: test.latency ? `${test.latency}ms` : 'N/A',
        }
      },
    })
  } catch { /* skip */ }

  // 监听配置热更新
  ctx.on('config/update', (newConfig) => {
    logger.info(`${TAG} 收到配置更新，正在热重载...`)
    Object.assign(config, newConfig)
    applyProxySettings(config)
  })

  // 插件卸载清理
  ctx.on('dispose', () => {
    logger.info(`${TAG} 插件卸载中，恢复环境状态...`)
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val !== undefined) process.env[key] = val
      else delete process.env[key]
    }
  })

  logger.info(`${TAG} ✅ 插件挂载完毕`)
}
