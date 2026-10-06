# SYK 的博客

一个 **免费**、自带后台的个人博客：前端跑在 GitHub Pages，后端跑在 Supabase（免费云服务）。你可以在网页后台登录后直接**发布文章**、**上传软件/文件**，全部免费、无需服务器。

- 博客地址：`https://syk1411119.github.io/blog/`
- 后台地址：`https://syk1411119.github.io/blog/admin.html`

## 架构

| 部分 | 用什么 | 作用 |
|------|--------|------|
| 前端 | 静态 HTML/CSS/JS | 首页、文章页、下载页、后台，托管在 GitHub Pages |
| 后端 | Supabase（Postgres + Storage + Auth） | 存文章、存文件、后台登录 |
| 本地预览 | Node.js | `server.js` 起一个本地服务器 |

---

## 一、本地预览

```bash
npm run dev        # 或 node server.js
```

浏览器打开 `http://localhost:3000`。此时页面会提示「后端尚未配置」，先按下面步骤配好 Supabase 就能看到内容了。

## 二、配置后端 Supabase（只需一次）

1. 打开 https://supabase.com → 用 **GitHub 账号登录**（不用重新注册密码）。
2. 新建一个项目（Organization 选默认的即可，地区选离你近的，比如 `Southeast Asia`）。
3. 进入项目后，左侧 **SQL Editor** → New query，把仓库里 `supabase/schema.sql` 的内容**全部粘贴**进去 → 点 **Run**。
   - 想预置几篇示例文章，再运行 `supabase/seed.sql`。
4. 左侧 **Authentication → Users → Add user**，创建一个管理员账号（邮箱 + 密码），这是你后台的登录账号。
5. 左侧 **Authentication → Sign In / Providers → Email**，把 **"Allow new users to sign up" 关掉**，防止别人注册。
6. 左侧 **Project Settings → API**，复制两个值：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` 密钥（`anon` / `publishable` key，形如 `eyJhbGci...`）
7. 把这两个值填进 `assets/config.js` 的 `url` 和 `anonKey`。

> ⚠️ `anonKey` 是「公开密钥」，配合 RLS 策略是安全的；**不要**把 `service_role` 密钥填进来。

## 三、部署到 GitHub Pages

把 `config.js` 填好后，提交并推送即可自动部署：

```bash
git add -A
git commit -m "配置后端"
git push
```

GitHub Actions 会自动把网站发布到 `https://syk1411119.github.io/blog/`（首次部署约 1 分钟）。

## 四、后台使用

1. 打开 `admin.html`（或点页面右上角「管理」）。
2. 用第 2 步创建的管理员账号登录。
3. **发布文章**：填标题、选分类、写正文（支持 Markdown），可传封面图。
4. **上传软件/文件**：填名称、选文件，上传后自动出现在「下载」页。

## 五、常见问题

- **页面一直显示「后端尚未配置」**：`config.js` 没填，或填了之后没 `git push` 重新部署。
- **登录失败**：确认账号是在 Supabase → Authentication → Users 里创建的那一个。
- **上传大文件失败**：Supabase 免费额度 Storage 1GB，单文件建议 ≤ 100MB。
- **改了代码但线上没变**：`git push` 后等 Actions 跑完（仓库 → Actions 页可看进度）。

## 目录结构

```
index.html        首页（文章列表 + 分类筛选）
post.html         文章详情页
downloads.html    软件下载页
admin.html        后台管理
assets/           样式、脚本、图标、config.js
supabase/         schema.sql（建表）、seed.sql（示例数据）
server.js         本地预览服务器
.github/workflows/pages.yml   GitHub Pages 自动部署
```
