# 藥學筆記雲端 — notes for whoever edits this site

- Static site on GitHub Pages (paul36959401/pharmacy-notes). Notes live in the owner's Google Drive.
- Edit `src/app/*.js`, then `node tools/build.mjs` (builds `js/app.js`). Test: `node test/e2e.mjs` (all must PASS).
- Release: `tools/release.sh "message"` bumps the version (`pages-vN`), copies to the repo and pushes.

## Every release (the owner asked for this)
1. Add a changelog entry for the new version at the top of `assets/manual.json` → `changelog`
   (version `vN`, date, short user-facing lines in 繁體中文 — the same "新增了…" text given to the owner).
   `tools/release.sh` refuses to release without it.
2. If a feature, shortcut or how-to changed, update `sections` (功能與快捷鍵); add new questions the
   owner asked about the site to `faq` (Q&A), simplified.
3. Upgrades must not slow the site down or lower note/image quality; measure typing smoothness after changes.
