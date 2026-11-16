// Joins src/app/*.js (in name order) into js/app.js. Run: node tools/build.mjs
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
const dir = new URL('../src/app/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const out = '/* Built from src/app by tools/build.mjs. Edit the files in src/app, not this file. */\n' +
    files.map(f => readFileSync(new URL(f, dir), 'utf8')).join('');
writeFileSync(new URL('../js/app.js', import.meta.url), out);
console.log('js/app.js', files.length, 'modules', out.length, 'bytes');
