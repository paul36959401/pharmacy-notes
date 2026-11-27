// Joins src/app/*.js (in name order) into js/app.js, and packs the 購物紀錄小幫手 browser
// extension (extension/ → assets/shopping-helper.zip; files at the top, so Windows' 解壓縮全部
// makes a folder named after the downloaded file, 購物紀錄小幫手).
// Run: node tools/build.mjs
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir = new URL('../src/app/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const out = '/* Built from src/app by tools/build.mjs. Edit the files in src/app, not this file. */\n' +
    files.map(f => readFileSync(new URL(f, dir), 'utf8')).join('');
writeFileSync(new URL('../js/app.js', import.meta.url), out);
console.log('js/app.js', files.length, 'modules', out.length, 'bytes');

// Same files → same zip (fixed dates), so a release only changes it when the extension changed.
const root = new URL('..', import.meta.url).pathname;
execFileSync('python3', ['-I', '-c', `
import os, zipfile, json, sys
root = sys.argv[1]
src = os.path.join(root, 'extension')
json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))
dest = os.path.join(root, 'assets', 'shopping-helper.zip')
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, names in sorted(os.walk(src)):
        dirs.sort()
        for name in sorted(names):
            path = os.path.join(base, name)
            info = zipfile.ZipInfo(os.path.relpath(path, src).replace(os.sep, '/'), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, open(path, 'rb').read())
print('assets/shopping-helper.zip', os.path.getsize(dest), 'bytes')
`, root], {stdio: 'inherit'});
