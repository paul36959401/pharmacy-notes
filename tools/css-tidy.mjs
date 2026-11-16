// CSS tidy-up for css/app.css, designed to be provably safe or verified:
//   node tools/css-tidy.mjs format  <in> <out>   parse + re-print only
//   node tools/css-tidy.mjs dead    <in> <out>   + drop declarations always overridden by the same selector later
//   node tools/css-tidy.mjs unimportant <in> <out> <keep.json>  + drop !important except ids listed in keep.json
//   node tools/css-tidy.mjs list-important <in>   prints candidate !important declarations as JSON
import {readFileSync, writeFileSync} from 'node:fs';

export function parse(text) {
    let i = 0;
    const n = text.length;
    function skipString(q) {i++; while (i < n && text[i] !== q) {if (text[i] === '\\') i++; i++;} i++;}
    function readUntil(stops) {
        const start = i; let depth = 0;
        while (i < n) {
            const c = text[i];
            if (c === '"' || c === "'") {skipString(c); continue;}
            if (c === '(') depth++; else if (c === ')') depth--;
            else if (depth === 0 && stops.includes(c)) break;
            i++;
        }
        return text.slice(start, i);
    }
    function block() {   // i at '{' -> returns inner text, i after matching '}'
        i++; const start = i; let depth = 1;
        while (i < n) {
            const c = text[i];
            if (c === '"' || c === "'") {skipString(c); continue;}
            if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
            i++;
        }
        const inner = text.slice(start, i); i++; return inner;
    }
    function decls(inner) {
        const out = []; let j = 0, depth = 0, start = 0, q = null;
        for (; j <= inner.length; j++) {
            const c = inner[j];
            if (q) {if (c === '\\') j++; else if (c === q) q = null; continue;}
            if (c === '"' || c === "'") {q = c; continue;}
            if (c === '(') depth++; else if (c === ')') depth--;
            if ((c === ';' && depth === 0) || j === inner.length) {
                const raw = inner.slice(start, j).trim(); start = j + 1;
                if (!raw) continue;
                const colon = raw.indexOf(':');
                const prop = raw.slice(0, colon).trim().toLowerCase();
                let value = raw.slice(colon + 1).trim(), important = false;
                const m = /\s*!\s*important\s*$/i.exec(value);
                if (m) {important = true; value = value.slice(0, m.index).trim();}
                out.push({prop, value: value.replace(/\s*\n\s*/g, ' '), important});
            }
        }
        return out;
    }
    function list(endAt) {
        const nodes = [];
        while (i < endAt) {
            while (i < endAt && /\s/.test(text[i])) i++;
            if (i >= endAt) break;
            const prelude = readUntil(['{', ';', '}']).trim();
            if (text[i] === ';') {i++; nodes.push({type: 'statement', text: prelude}); continue;}
            if (text[i] === '}') {i++; continue;}
            if (prelude.startsWith('@')) {
                const name = /^@([\w-]+)/.exec(prelude)[1].toLowerCase();
                if (name === 'media' || name === 'supports') {
                    const open = i; const inner = block(); const save = i;
                    const sub = parse(inner);
                    nodes.push({type: 'at', name, prelude: prelude.replace(/\s+/g, ' '), children: sub});
                    i = save; void open;
                } else nodes.push({type: 'raw', prelude, inner: block()});
            } else nodes.push({type: 'rule', selector: prelude.replace(/\s+/g, ' '), decls: decls(block())});
        }
        return nodes;
    }
    return list(n);
}

export function print(nodes, indent = '') {
    let s = '';
    for (const node of nodes) {
        if (node.type === 'statement') s += indent + node.text + ';\n';
        else if (node.type === 'raw') s += indent + node.prelude + ' {' + node.inner.replace(/\s+$/, '') .replace(/^\n?/, '\n') + '\n' + indent + '}\n';
        else if (node.type === 'at') s += indent + node.prelude + ' {\n' + print(node.children, indent + '  ') + indent + '}\n';
        else if (node.decls.length) {
            const sel = node.selector.split(/,\s*(?![^()]*\))/).map(x => x.trim()).join(',\n' + indent);
            s += indent + sel + ' {\n' + node.decls.map(d => indent + '  ' + d.prop + ': ' + d.value + (d.important ? ' !important' : '') + ';\n').join('') + indent + '}\n';
        }
    }
    return s;
}

// Walk rules with their at-rule context and a global order index.
function walk(nodes, context = '', out = []) {
    for (const node of nodes) {
        if (node.type === 'rule') out.push({node, context});
        else if (node.type === 'at') walk(node.children, context + ' | ' + node.prelude, out);
    }
    return out;
}

const MODERN = /\b(dvh|svh|lvh|dvw|svw)\b|color-mix\(|-webkit-|-moz-/;
export function removeDead(nodes) {
    const rules = walk(nodes);
    let removed = 0;
    // last[key][prop] = {important}; scan backwards.
    const seen = new Map();
    for (let r = rules.length - 1; r >= 0; r--) {
        const {node, context} = rules[r];
        const key = context + ' :: ' + node.selector;
        const later = seen.get(key) || new Map();
        const keep = [];
        // Within one rule, keep every declaration (fallback pairs are intentional).
        for (const d of node.decls) {
            const l = later.get(d.prop);
            const overridden = l && (l.important || !d.important) && !MODERN.test(l.value) && !MODERN.test(d.value);
            if (overridden) removed++; else keep.push(d);
        }
        for (const d of node.decls) {
            const l = later.get(d.prop);
            if (!l || (d.important && !l.important)) later.set(d.prop, d);
        }
        node.decls = keep;
        seen.set(key, later);
    }
    return removed;
}
// Merge directly adjacent rules with the same selector, and adjacent identical at-rules.
export function mergeAdjacent(nodes) {
    const out = [];
    for (const node of nodes) {
        if (node.type === 'at') node.children = mergeAdjacent(node.children);
        if (node.type === 'rule' && !node.decls.length) continue;
        if (node.type === 'at' && !node.children.length) continue;
        const prev = out[out.length - 1];
        if (prev && node.type === 'rule' && prev.type === 'rule' && prev.selector === node.selector) {prev.decls.push(...node.decls); continue;}
        if (prev && node.type === 'at' && prev.type === 'at' && prev.prelude === node.prelude) {prev.children = mergeAdjacent([...prev.children, ...node.children]); continue;}
        out.push(node);
    }
    return out;
}
// Inside one rule, a later duplicate of the same property wins; drop the earlier copy
// unless it is a fallback (vendor value / newer unit).
export function dedupeWithinRule(nodes) {
    let removed = 0;
    for (const {node} of walk(nodes)) {
        const keep = [];
        for (let k = node.decls.length - 1; k >= 0; k--) {
            const d = node.decls[k];
            const l = keep.find(x => x.prop === d.prop);
            if (l && (l.important || !d.important) && !MODERN.test(l.value) && !MODERN.test(d.value)) {removed++; continue;}
            keep.unshift(d);
        }
        node.decls = keep;
    }
    return removed;
}

const DYNAMIC = /:(hover|focus|focus-visible|focus-within|active|target|visited)\b/;
export function importantCandidates(nodes, protectedProps) {
    const list = [];
    walk(nodes).forEach(({node, context}, r) => node.decls.forEach((d, k) => {
        if (!d.important) return;
        const id = r + ':' + k;
        const family = d.prop.split('-')[0];
        const reason = DYNAMIC.test(node.selector) ? 'state selector' : protectedProps.some(p => p === d.prop || p === family || d.prop.startsWith(p + '-')) ? 'set by JS/inline' : null;
        list.push({id, selector: node.selector, context, prop: d.prop, value: d.value, keep: reason});
    }));
    return list;
}
export function dropImportant(nodes, keepIds) {
    let changed = 0;
    walk(nodes).forEach(({node}, r) => node.decls.forEach((d, k) => {
        if (d.important && !keepIds.has(r + ':' + k)) {d.important = false; changed++;}
    }));
    return changed;
}

if (process.argv[1] && process.argv[1].endsWith('css-tidy.mjs')) {
    const [mode, input, output, extra] = process.argv.slice(2);
    let tree = parse(readFileSync(input, 'utf8'));
    const stats = {};
    if (mode === 'dead') {
        stats.withinRule = dedupeWithinRule(tree);
        stats.dead = removeDead(tree);
        tree = mergeAdjacent(tree);
        stats.withinRuleAfterMerge = dedupeWithinRule(tree);
    }
    if (mode === 'merge' || mode === 'groups') {} else if (mode === 'list-important') {
        const protectedProps = JSON.parse(output);
        console.log(JSON.stringify(importantCandidates(tree, protectedProps)));
    } else {
        if (mode === 'unimportant') stats.unimportant = dropImportant(tree, new Set(JSON.parse(readFileSync(extra, 'utf8'))));
        writeFileSync(output, print(tree));
        console.error(JSON.stringify(stats));
    }
}

// Move an earlier rule's declarations into the last rule with the same selector in the
// same context (earlier declarations first, so the later ones still win). Only used
// together with the computed-style check; groups listed in `skip` stay as they are.
export function mergeDistant(nodes, skip = new Set()) {
    const groups = new Map();
    walk(nodes).forEach(({node, context}) => {
        const key = context + ' :: ' + node.selector;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(node);
    });
    let merged = 0;
    for (const [key, list] of groups) {
        if (list.length < 2 || skip.has(key)) continue;
        const last = list[list.length - 1];
        const earlier = list.slice(0, -1).flatMap(n => n.decls);
        last.decls = [...earlier, ...last.decls];
        list.slice(0, -1).forEach(n => {n.decls = [];});
        merged++;
    }
    return merged;
}
export function groupKeys(nodes) {
    const c = new Map();
    walk(nodes).forEach(({node, context}) => {const k = context + ' :: ' + node.selector; c.set(k, (c.get(k) || 0) + 1);});
    return [...c].filter(([, v]) => v > 1).map(([k]) => k);
}
if (process.argv[1] && process.argv[1].endsWith('css-tidy.mjs') && process.argv[2] === 'merge') {
    const [, , , input, output, skipFile] = process.argv;
    let tree = parse(readFileSync(input, 'utf8'));
    const skip = new Set(skipFile ? JSON.parse(readFileSync(skipFile, 'utf8')) : []);
    const n = mergeDistant(tree, skip);
    tree = mergeAdjacent(tree);
    dedupeWithinRule(tree);
    writeFileSync(output, print(tree));
    console.error(JSON.stringify({merged: n}));
}
if (process.argv[1] && process.argv[1].endsWith('css-tidy.mjs') && process.argv[2] === 'groups') {
    console.log(JSON.stringify(groupKeys(parse(readFileSync(process.argv[3], 'utf8')))));
}
