// Joins src/app/*.js (in name order) into js/app.js, and makes the 一鍵記錄 bookmark
// (js/shopping-grab.js → js/shopping-grab.min.js). Run: node tools/build.mjs
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const dir = new URL('../src/app/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const out = '/* Built from src/app by tools/build.mjs. Edit the files in src/app, not this file. */\n' +
    files.map(f => readFileSync(new URL(f, dir), 'utf8')).join('');
writeFileSync(new URL('../js/app.js', import.meta.url), out);
console.log('js/app.js', files.length, 'modules', out.length, 'bytes');

// The bookmark must stay one function expression: (function (SHOP, DRY) {...})
const grab = readFileSync(new URL('../js/shopping-grab.js', import.meta.url), 'utf8');
let small;
try {
    const esbuild = createRequire(import.meta.url)('/opt/npm-tools/node_modules/esbuild');
    small = esbuild.transformSync(grab, {minifyWhitespace: true, minifyIdentifiers: true, minifySyntax: false, target: 'es2017', charset: 'utf8'}).code;
} catch (_) {
    small = grab.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s+/g, '\n');   // no esbuild: drop comments only
}
small = small.trim().replace(/;+$/, '');
if (!/^\(function\s*\(/.test(small) || !/\}\)$/.test(small)) throw new Error('js/shopping-grab.js must be a single (function (SHOP, DRY) {...}) expression');
new Function('return ' + small);   // syntax check
writeFileSync(new URL('../js/shopping-grab.min.js', import.meta.url), small + '\n');
console.log('js/shopping-grab.min.js', small.length, 'bytes');
