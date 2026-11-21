# 📦 黑盒造神：Sol / Luna / Terra / Astra（v2.1.2）— Grok Build 由零部署說明書

> ### ⚠️ 【極重要 — 正式版上架前必做清理規則】
> 正式部署到 Cloudflare Pages 前，必須確保 `index.html` 內**已完全移除** `📦 下載部署包` 按鈕（`#dev-download-bundle-btn`）及所有 `[DEV-ONLY-START]` 至 `[DEV-ONLY-END]` 區塊！
> 本 ZIP 內附嘅 `index.html` 已經自動剔除該區塊，上線前請執行：`grep -n "dev-download-bundle-btn\|DEV-ONLY-START" index.html`（必須零輸出）。

## Phase 1 — 建立 GitHub Repo（Takjai18/blackbox-idol）
```bash
mkdir -p blackbox-idol && cd blackbox-idol
git init -b main
git add index.html worker.js wrangler.toml README.md
git commit -m "feat: initial release of blackbox-idol v2.1.2 (Mode C)"
gh repo create Takjai18/blackbox-idol --public --source=. --remote=origin --push
```

## Phase 2 — 部署 Cloudflare Workers 後端
```bash
npx wrangler login
npx wrangler deploy
curl -s https://blackbox-idol.ymtwill.workers.dev/health
```
如取得不同 workers.dev 網域，請更新 `index.html` 內 `const DEFAULT_WORKER_URL =` 並 `git push`。

## Phase 3 — 部署前端到 Cloudflare Pages
```bash
npx wrangler pages project create blackbox-idol --production-branch=main
mkdir -p dist && cp index.html dist/index.html
npx wrangler pages deploy dist --project-name=blackbox-idol
```

## Phase 4 — 連結至主站 Takjai18/kyc-joshua（#icebreaking）
複製 `https://github.com/Takjai18/kyc-joshua.git`，於根目錄 `index.html` 嘅 `#icebreaking` 區塊加入 `https://blackbox-idol.pages.dev` 遊戲卡片（按鈕用 `#E63E7A`），推送至 `main`。
