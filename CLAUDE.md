# 藥學筆記雲端 — notes for whoever edits this site

- Static site on GitHub Pages (paul36959401/pharmacy-notes). Notes live in the owner's Google Drive.
- Edit `src/app/*.js`, then `node tools/build.mjs` (builds `js/app.js`). Test: `node test/e2e.mjs` (all must PASS).
- Release: `tools/release.sh "message"` bumps the version (`pages-vN`), copies to the repo and pushes.
- 購物紀錄 (the owner's shopping records) is `shopping.html` + `js/shopping.js` + `css/shopping.css`, in the same
  menu as the subjects. Data: Drive file `敗家紀錄雲端備份.json` + folder `購物紀錄網站圖片` (shared format with the
  owner's old shopping HTML file; unknown fields must be kept). The 一鍵記錄 bookmark is `js/shopping-grab.js`
  (built to `js/shopping-grab.min.js` by `node tools/build.mjs`; bump `V` and `GRAB_VERSION` together).
  Test: `node test/shopping-e2e.mjs` (all must PASS). Ruten pictures need `tools/image-proxy.gs` (page mode) deployed.

## Every release (the owner asked for this)
1. Add a changelog entry for the new version at the top of `assets/manual.json` → `changelog`
   (version `vN`, date, short user-facing lines in 繁體中文 — the same "新增了…" text given to the owner).
   `tools/release.sh` refuses to release without it.
2. If a feature, shortcut or how-to changed, update `sections` (功能與快捷鍵); add new questions the
   owner asked about the site to `faq` (Q&A), simplified.
3. Upgrades must not slow the site down or lower note/image quality; measure typing smoothness after changes.
