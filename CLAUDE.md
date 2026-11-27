# 藥學筆記雲端 — notes for whoever edits this site

- Static site on GitHub Pages (paul36959401/pharmacy-notes). Notes live in the owner's Google Drive.
- Edit `src/app/*.js`, then `node tools/build.mjs` (builds `js/app.js`). Test: `node test/e2e.mjs` (all must PASS).
- Release: `tools/release.sh "message"` bumps the version (`pages-vN`), copies to the repo and pushes.
- 購物紀錄 (the owner's shopping records) is `shopping.html` + `js/shopping.js` + `css/shopping.css`, in the same
  menu as the subjects. Data: Drive file `敗家紀錄雲端備份.json` + folder `購物紀錄網站圖片` (shared format with the
  owner's old shopping HTML file; unknown fields must be kept).
- 購物紀錄小幫手 = the browser extension in `extension/` (MV3; `grab.js` reads shop pages, `save.js` writes to
  Drive, `background.js` = button / Alt+Shift+S / retry queue). Fixed ID `jhlnccbeohgdnkpmbcmnenpaholabnea` (from
  the `key` in its manifest); its Google sign-in needs `https://<that id>.chromiumapp.org/` as an authorized
  redirect URI on the notes site's OAuth client. `node tools/build.mjs` packs it into `assets/shopping-helper.zip`
  (the download on the 購物紀錄 page). Bump `version` in `extension/manifest.json` when it changes, so the page
  tells the owner to update. Test: `node test/shopping-e2e.mjs` (all must PASS; also loads the real extension).

## Every release (the owner asked for this)
1. Add a changelog entry for the new version at the top of `assets/manual.json` → `changelog`
   (version `vN`, date, short user-facing lines in 繁體中文 — the same "新增了…" text given to the owner).
   `tools/release.sh` refuses to release without it.
2. If a feature, shortcut or how-to changed, update `sections` (功能與快捷鍵); add new questions the
   owner asked about the site to `faq` (Q&A), simplified.
3. Upgrades must not slow the site down or lower note/image quality; measure typing smoothness after changes.
