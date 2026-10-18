# 发布清单（dsh-smart-proxy）

按顺序执行即可，全程 10 分钟左右。文件名与仓库一致，直接覆盖到插件目录就能用。

## 1. 打包自检

```bash
npm pack --dry-run
```

确认 `lib/`、`cordis.patch.yml`、`README.md`、`README.en.md` 都在列表里，且没有把 `src/`、`node_modules/` 打进去。

## 2. 发布到 npm

```bash
npm login
npm publish --access public
```

发布后确认能拉到：

```bash
npm view dsh-smart-proxy version
```

## 3. 本地验收

在一个干净 profile 里安装，确认插件能加载、工具能调用：

```bash
dsh plugin add dsh-smart-proxy
dsh plugin list
```

## 4. 建 GitHub 仓库并打 topic

```bash
cd dsh-smart-proxy
git init
git add package.json README.md README.en.md cordis.patch.yml lib src tsconfig.json index.json
git commit -m "feat: dsh-smart-proxy 1.2.0"
git remote add origin https://github.com/Jack-jiang421/dsh-smart-proxy.git
git push -u origin main
```

然后在仓库页面 **About → Topics** 里加 `dsh-plugin`（这是 DSH Plugin Hub 自动发现的关键），建议再加 `deepseek-harness`、`cordis`。

## 5. 提交收录

- **DSH Plugin Hub**：打开 <https://dsh-plugin.org/zh/submit>，填 npm 包名 `dsh-smart-proxy` 和仓库地址，等待人工审核。
- **awesome-dsh-plugin**：向 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> 提 PR，在合适分类下加一行。
- **自建索引**：把本目录的 `index.json` 推到仓库根目录或 GitHub Pages，然后
  `设置 → 插件 → 发现 → 添加索引源`，填该文件的 HTTPS 地址即可本地验证索引是否可用。

## 6. 发布后

- 改 `version` 后重新 `npm publish`；
- 同步更新 `index.json` 里的 `versions` 数组和 `publishTimestamp`（Unix 秒）；
- 索引有 `cacheTtlMs` 缓存（默认 10 分钟），改完等几分钟再刷新。

## 校验索引格式

```bash
npx -y -p @deepseek-ai/dsh-plugin-market-index node -e "
import('@deepseek-ai/dsh-plugin-market-index').then(async (m) => {
  const fs = await import('node:fs/promises');
  const raw = await fs.readFile('index.json', 'utf8');
  const parsed = m.parseMarketIndex(JSON.parse(raw), 'https://example.com/index.json');
  console.log('OK', parsed.plugins.length, 'plugin(s)');
});
"
```

报 `MarketIndexError` 时会给出具体 JSON 路径，按提示改即可。
