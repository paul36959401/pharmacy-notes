// In-memory imitation of the parts of the Google Drive v3 REST API the site uses.
import {createHash, randomUUID} from 'node:crypto';

export function createMockDrive() {
    const files = new Map();
    const sessions = new Map();
    let clock = Date.parse('2026-01-01T00:00:00Z');
    const stats = {requests: 0, writes: 0, byKind: {}};
    const now = () => new Date(clock += 1000).toISOString();
    const sha = buf => createHash('sha256').update(buf).digest('hex');

    function add({name, mimeType, parents = [], content = Buffer.alloc(0), appProperties}) {
        const id = 'f' + randomUUID().replace(/-/g, '').slice(0, 20);
        const t = now();
        files.set(id, {id, name, mimeType, parents, createdTime: t, modifiedTime: t, trashed: false, appProperties, content: Buffer.from(content)});
        stats.writes++;
        return files.get(id);
    }
    function meta(f, fields) {
        const all = {id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, createdTime: f.createdTime, modifiedTime: f.modifiedTime, trashed: f.trashed};
        if (f.mimeType !== 'application/vnd.google-apps.folder' && !f.mimeType.startsWith('application/vnd.google-apps')) {
            all.size = String(f.content.length); all.sha256Checksum = sha(f.content);
        }
        if (!fields) return all;
        const wanted = fields.replace(/^files\(|\)$/g, '').split(',').map(s => s.trim());
        return Object.fromEntries(Object.entries(all).filter(([k]) => wanted.includes(k)));
    }
    function matches(f, query) {
        const terms = query.split(/\s+and\s+/);
        return terms.every(term => {
            let m;
            if ((m = /^name='((?:[^'\\]|\\.)*)'$/.exec(term))) return f.name === m[1].replace(/\\(.)/g, '$1');
            if ((m = /^name contains '((?:[^'\\]|\\.)*)'$/.exec(term))) return f.name.startsWith(m[1].replace(/\\(.)/g, '$1'));
            if ((m = /^mimeType='([^']*)'$/.exec(term))) return f.mimeType === m[1];
            if ((m = /^'([^']*)' in parents$/.exec(term))) return f.parents.includes(m[1]);
            if (term === 'trashed=false') return !f.trashed;
            throw new Error('mock: unsupported query term ' + term);
        });
    }
    function parseMultipart(body, contentType) {
        const boundary = /boundary=(.+)$/.exec(contentType)[1];
        const sep = Buffer.from('--' + boundary);
        const parts = [];
        let start = body.indexOf(sep) + sep.length;
        while (true) {
            const next = body.indexOf(sep, start);
            if (next < 0) break;
            let part = body.subarray(start, next);
            if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
            const headerEnd = part.indexOf('\r\n\r\n');
            let data = part.subarray(headerEnd + 4);
            if (data.subarray(-2).toString() === '\r\n') data = data.subarray(0, -2);
            parts.push({headers: part.subarray(0, headerEnd).toString(), data});
            start = next + sep.length;
        }
        return {metadata: JSON.parse(parts[0].data.toString('utf8')), data: parts[1].data, mime: /Content-Type: ([^\r\n]+)/.exec(parts[1].headers)[1]};
    }
    const json = (status, value, headers = {}) => ({status, headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(value)});
    const error = (status, message) => json(status, {error: {code: status, message}});

    function handle(method, url, headers, body) {
        stats.requests++;
        const u = new URL(url), p = u.pathname, s = u.searchParams;
        const kind = method + ' ' + p.replace(/\/f[0-9a-f]{20}/, '/:id').replace(/upload_id=.*/, '');
        stats.byKind[kind] = (stats.byKind[kind] || 0) + 1;
        if (!/^Bearer \S+/.test(headers.authorization || '') && !s.get('upload_id')) return error(401, 'no auth');
        if (p === '/drive/v3/about') return json(200, {storageQuota: {usage: '123456789', limit: '16106127360'}, user: {emailAddress: 'student@example.com', displayName: 'Student'}});
        if (p === '/drive/v3/files' && method === 'GET') {
            let list = [...files.values()].filter(f => matches(f, s.get('q')));
            const order = s.get('orderBy') || '';
            if (order.startsWith('createdTime')) list.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
            if (order.startsWith('modifiedTime')) list.sort((a, b) => a.modifiedTime.localeCompare(b.modifiedTime));
            if (/desc/.test(order)) list.reverse();
            const size = Number(s.get('pageSize') || 100), token = Number(s.get('pageToken') || 0);
            const page = list.slice(token, token + size);
            return json(200, {files: page.map(f => meta(f, s.get('fields')?.match(/files\(([^)]*)\)/)?.[1])), ...(token + size < list.length ? {nextPageToken: String(token + size)} : {})});
        }
        if (p === '/drive/v3/files' && method === 'POST') {
            const m = JSON.parse(body.toString('utf8'));
            return json(200, {id: add({name: m.name, mimeType: m.mimeType, parents: m.parents || []}).id});
        }
        let m;
        if ((m = /^\/drive\/v3\/files\/([^/]+)(\/export)?$/.exec(p))) {
            const f = files.get(m[1]);
            if (!f) return error(404, 'File not found');
            if (method === 'DELETE') {files.delete(f.id); return {status: 204, headers: {}, body: ''};}
            if (m[2]) return {status: 200, headers: {'content-type': 'text/plain'}, body: 'OCR 文字：' + f.name};
            if (s.get('alt') === 'media') return {status: 200, headers: {'content-type': f.mimeType}, body: f.content};
            return json(200, meta(f, s.get('fields')));
        }
        if (p === '/upload/drive/v3/files' && method === 'POST' && s.get('uploadType') === 'multipart') {
            const {metadata, data} = parseMultipart(body, headers['content-type']);
            let content = data;
            if (metadata.mimeType === 'application/vnd.google-apps.document') content = Buffer.from('converted');
            const f = add({name: metadata.name, mimeType: metadata.mimeType, parents: metadata.parents || [], content, appProperties: metadata.appProperties});
            return json(200, meta(f));
        }
        if (p === '/upload/drive/v3/files' && method === 'POST' && s.get('uploadType') === 'resumable') {
            const id = randomUUID();
            sessions.set(id, {metadata: JSON.parse(body.toString('utf8')), total: Number(headers['x-upload-content-length']), chunks: [], received: 0});
            return {status: 200, headers: {location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=' + id}, body: ''};
        }
        if (p === '/upload/drive/v3/files' && method === 'PUT' && s.get('upload_id')) {
            const session = sessions.get(s.get('upload_id'));
            if (!session) return error(404, 'session');
            const range = headers['content-range'] || '';
            const done = () => {
                const f = add({name: session.metadata.name, mimeType: session.metadata.mimeType, parents: session.metadata.parents, content: Buffer.concat(session.chunks), appProperties: session.metadata.appProperties});
                sessions.delete(s.get('upload_id')); return json(200, meta(f));
            };
            if ((m = /^bytes \*\/(\d+)$/.exec(range))) return session.received === session.total ? done() : {status: 308, headers: session.received ? {range: 'bytes=0-' + (session.received - 1)} : {}, body: ''};
            m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
            if (Number(m[1]) !== session.received) return error(400, 'offset');
            session.chunks.push(body); session.received += body.length;
            if (session.received === session.total) return done();
            return {status: 308, headers: {range: 'bytes=0-' + (session.received - 1)}, body: ''};
        }
        if ((m = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p)) && method === 'PATCH') {
            const f = files.get(m[1]); if (!f) return error(404, 'File not found');
            f.content = Buffer.from(body); f.modifiedTime = now(); stats.writes++;
            return json(200, {id: f.id});
        }
        return error(400, 'mock: unsupported ' + method + ' ' + p);
    }

    async function install(context) {
        const cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'location, range'};
        await context.route('https://www.googleapis.com/**', async route => {
            const r = route.request();
            if (r.method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
            const result = handle(r.method(), r.url(), r.headers(), r.postDataBuffer() || Buffer.alloc(0));
            await route.fulfill({status: result.status, headers: {...cors, ...result.headers}, body: result.body});
        });
        await context.route('https://accounts.google.com/gsi/client', route => route.fulfill({status: 200, contentType: 'text/javascript', body: `
            window.google={accounts:{oauth2:{
                initTokenClient(cfg){const c={callback:cfg.callback,error_callback:null,requestAccessToken(){setTimeout(()=>c.callback({access_token:'tok-'+Date.now(),expires_in:3600,scope:'https://www.googleapis.com/auth/drive'}),20);}};return c;},
                hasGrantedAllScopes(){return true;},revoke(t,cb){cb&&cb();}}}};`}));
    }
    return {files, add, install, stats, sha};
}
