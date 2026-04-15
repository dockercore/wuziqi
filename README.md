<h1 align="center">♟ 五子棋</h1>

<p align="center">
  <strong>在线五子棋游戏 — 支持双人对战 & 人机对战</strong>
</p>

<p align="center">
  <a href="https://dockercore.github.io/wuziqi/" target="_blank">
    <img src="https://img.shields.io/badge/在线体验-GitHub Pages-blue?logo=github" alt="GitHub Pages">
  </a>
  <a href="https://wuziqi-b2y.pages.dev" target="_blank">
    <img src="https://img.shields.io/badge/在线体验-Cloudflare Pages-orange?logo=cloudflare" alt="Cloudflare Pages">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5" alt="HTML5">
</p>

---

## 在线访问

| 平台 | 链接 | 说明 |
|------|------|------|
| GitHub Pages | [dockercore.github.io/wuziqi](https://dockercore.github.io/wuziqi/) | GitHub 托管 |
| Cloudflare Pages | [wuziqi-b2y.pages.dev](https://wuziqi-b2y.pages.dev) | 国内访问友好 |

## 游戏功能

- ♟ 黑白棋双人对战
- 🤖 人机对战（AI）模式
- ↩ 悔棋功能
- 🏆 计分板

## 技术栈

- HTML5 Canvas
- 原生 JavaScript
- CSS3

## 部署到 Cloudflare Pages

### 方法一：Dashboard（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create** → **Pages**
3. **Connect to Git** → 选择 `dockercore/wuziqi`
4. 构建设置：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`
5. 点击 **Save and Deploy**

### 方法二：Wrangler CLI

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name=wuziqi
```

## License

[MIT](./LICENSE) © 2026 dockercore
