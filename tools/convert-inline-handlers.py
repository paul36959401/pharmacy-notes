"""Rewrites inline on*="..." handlers into data-on-<event> attributes handled by 07-actions.js.
   onclick="event.stopPropagation(); deleteNote(${x})"  ->  data-on-click="deleteNote" data-args="[${x}]" data-stop
"""
import re, sys, glob

def js_args_to_json(args, in_template):
    out = []
    depth = 0; cur = ''; parts = []
    for ch in args:
        if ch in '({[': depth += 1
        if ch in ')}]': depth -= 1
        if ch == ',' and depth == 0: parts.append(cur.strip()); cur = ''
        else: cur += ch
    if cur.strip(): parts.append(cur.strip())
    for p in parts:
        if p == 'event': out.append('&quot;$event&quot;')
        elif re.fullmatch(r"-?\d+(\.\d+)?", p): out.append(p)
        elif re.fullmatch(r"'[^']*'", p): out.append('&quot;' + p[1:-1] + '&quot;')
        elif re.fullmatch(r"\$\{inlineJsArgument\([^}]*\)\}", p): out.append(p)
        elif re.fullmatch(r"\$\{[a-zA-Z_.]+\}", p): out.append(p)            # numeric template value e.g. ${index}
        elif re.fullmatch(r"\{gallery:\$\{index\}\}", p): out.append('{&quot;gallery&quot;:${index}}')
        else: raise ValueError('unsupported argument: ' + p)
    return '[' + ','.join(out) + ']' if out else ''

def convert(event, body, in_template):
    attrs = []
    body = body.strip()
    m = re.fullmatch(r"if\(event\.key==='(\w+)'\)\{event\.preventDefault\(\);([\w.]+)\(\);\}", body)
    if m:
        return f'data-on-{event}="{m.group(2)}" data-key="{m.group(1)}" data-prevent'
    stmts = [s.strip() for s in re.split(r';\s*(?![^()]*\))', body) if s.strip()]
    flags = []; calls = []
    for s in stmts:
        if s == 'event.preventDefault()': flags.append('data-prevent')
        elif s == 'event.stopPropagation()': flags.append('data-stop')
        else:
            mm = re.fullmatch(r"([\w.]+)\((.*)\)", s, re.S)
            if not mm: raise ValueError('unsupported statement: ' + s)
            calls.append((mm.group(1), js_args_to_json(mm.group(2), in_template)))
    names = ' '.join(c[0] for c in calls)
    attrs.append(f'data-on-{event}="{names}"')
    if len(calls) == 1 and calls[0][1]: attrs.append(f'data-args="{calls[0][1]}"')
    if len(calls) > 1 and any(c[1] for c in calls): raise ValueError('multiple calls with arguments: ' + body)
    return ' '.join(attrs + flags)

total = 0
for path in ['index.html'] + sorted(glob.glob('src/app/*.js')):
    text = open(path, encoding='utf-8').read()
    in_template = path.endswith('.js')
    def sub(m):
        global total
        total += 1
        return ' ' + convert(m.group(1)[2:], m.group(2), in_template)
    new = re.sub(r' (on(?:click|mousedown|input|change|keydown))="([^"]*)"', sub, text)
    if new != text:
        open(path, 'w', encoding='utf-8').write(new)
        print(path, len(re.findall(r' data-on-', new)))
print('converted', total)
