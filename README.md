# 藥學筆記雲端（GitHub Pages 版）

網址：https://paul36959401.github.io/pharmacy-notes/

- 筆記、圖片、版本紀錄都存在**你自己的 Google Drive**（資料夾「藥學筆記雲端工作台」），這個網站本身不保存任何資料。
- 和舊的 Apps Script 網站讀寫的是**同一批檔案、同一種格式**。

## 檔案說明
| 位置 | 用途 |
|---|---|
| `index.html` | 網頁本體 |
| `js/config.js` | 唯一可能需要手動改的設定（Google 登入用戶端 ID、科目清單） |
| `js/auth.js` | Google 登入 |
| `js/drive-server.js` | 直接連 Google Drive（取代舊的 Apps Script 後端） |
| `js/boot.js` | 啟動流程、唯讀檢查模式 |
| `js/app.js` | 筆記程式（由 `src/app/` 合併產生，不要直接改） |
| `src/app/*.js` | 筆記程式原始碼，依檔名順序合併 |
| `css/` | 外觀 |
| `assets/zhuyin-dict.json.gz` | 注音鍵盤字典（第一次用注音時才下載） |
| `test/` | 自動化測試（用模擬的 Google Drive） |

## 修改流程
1. 改 `src/app/` 裡的檔案
2. `node tools/build.mjs` 產生 `js/app.js`
3. `node test/e2e.mjs` 測試
4. 把 `config.js`、`index.html` 裡的 `?v=` 版本號一起改新，避免瀏覽器用舊快取
