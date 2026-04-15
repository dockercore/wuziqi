# 五子棋游戏 - Cloudflare Pages 部署

这是一个在线五子棋游戏，支持人机对战和双人对战模式。

## 在线访问

- GitHub Pages: https://dockercore.github.io/wuziqi/
- Cloudflare Pages: 部署后自动生成

## 部署到 Cloudflare Pages

### 方法一：通过 Cloudflare Dashboard（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** -> **Create application** -> **Pages**
3. 选择 **Connect to Git**
4. 授权并选择 `dockercore/wuziqi` 仓库
5. 构建设置：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`（或 `.`）
6. 点击 **Save and Deploy**

### 方法二：通过 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name=wuziqi
```

## 功能

- 黑白棋双人对战
- 人机对战（AI）模式
- 悔棋功能
- 计分板

## 技术栈

- HTML5 Canvas
- 原生 JavaScript
- CSS3
