/* Source: 90-image-storage.js */
/* Compatibility and lossless storage for images created before Studio v4.
 * UI and event handlers live only in noteImageStudio. */
const noteImageStorage = (() => {
        const ATTR = 'data-note-image-edit', MAX_PIXELS = 12000000, MAX_EDGE = 4096;
        const IDENTITY = [1, 0, 0, 1, 0, 0];
        const matrixOf = mark => mark.matrix || IDENTITY;
        const copy = value => JSON.parse(JSON.stringify(value));
        const bounded = (n, low, high) => Math.max(low, Math.min(high, Number(n) || 0));
        const galleryKey = source => {
            let hash = 2166136261;
            for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
            return source.length + '-' + (hash >>> 0).toString(36);
        };
        const galleryData = () => Object.fromEntries(currentPastedImages.map(src => [galleryKey(src), currentGalleryImageEdits[galleryKey(src)]]).filter(([, value]) => value));
        const blankDoc = (w, h) => ({ crop: { x: 0, y: 0, w, h }, rotation: 0, flip: false, marks: [] });
        const compactCache = new Map(), sourceCache = new Map(), losslessCache = new Map();
        function sourceKey(source) {
            let a = 2166136261, b = 2246822507;
            for (let i = 0; i < source.length; i++) { const c = source.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 3266489909); }
            return 'note-image-source:' + source.length + ':' + (a >>> 0).toString(36) + ':' + (b >>> 0).toString(36);
        }
        function cacheSource(src, source) {
            if (src.length > 16000000) return;
            sourceCache.set(src, source);
            while (sourceCache.size > 4 || [...sourceCache.keys()].reduce((n, key) => n + key.length, 0) > 16000000) sourceCache.delete(sourceCache.keys().next().value);
        }
        function embeddedSource(src) {
            if (sourceCache.has(src)) return sourceCache.get(src);
            if (!/^data:image\/svg\+xml[;,]/i.test(src)) throw new Error('圖片的原圖封裝格式不正確');
            const comma = src.indexOf(','), header = src.slice(0, comma);
            const xml = /;base64/i.test(header) ? new TextDecoder().decode(Uint8Array.from(atob(src.slice(comma + 1)), c => c.charCodeAt(0))) : decodeURIComponent(src.slice(comma + 1));
            const root = new DOMParser().parseFromString(xml, 'image/svg+xml');
            const source = root.querySelector('image[id="note-image-source"]')?.getAttribute('href');
            if (root.querySelector('parsererror') || !/^data:image\//i.test(source || '')) throw new Error('圖片中的原圖資料不完整');
            cacheSource(src, source);
            return source;
        }
        function imageIdentity(src, metadata) {
            if (![1, 2, 3].includes(metadata?.v) || !metadata.doc) return null;
            const source = metadata.v === 3 ? embeddedSource(src) : metadata.source;
            if (!/^data:image\//i.test(source || '')) return null;
            const doc = copy(metadata.doc);
            doc.marks = (doc.marks || []).map(mark => ({ ...mark, matrix: mark.matrix || [...IDENTITY] }));
            const storedKey = sourceKey(source);
            const key = metadata.v === 3 && metadata.storedKey === storedKey && /^note-image-source:\d+:[a-z0-9]+:[a-z0-9]+$/.test(metadata.sourceKey || '') ? metadata.sourceKey : storedKey;
            const plain = metadata.plain === true && !doc.marks.length && !doc.rotation && !doc.flip && doc.crop?.x === 0 && doc.crop?.y === 0 && doc.crop.w === metadata.w && doc.crop.h === metadata.h;
            return { source, doc, key, plain };
        }
        function readBlob(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('圖片讀取失敗')); r.readAsDataURL(blob); }); }
        async function loadSource(src, signal) {
            if (!/^data:image\//i.test(src)) {
                src = await noteExternalImages.resolve(src,{signal});
            }
            const image = new Image(); image.decoding = 'async'; image.src = src;
            await noteImageReady(image);
            if (!image.naturalWidth || !image.naturalHeight) throw new Error('圖片尺寸無效');
            const probe = document.createElement('canvas'); probe.width = probe.height = 1;
            probe.getContext('2d').drawImage(image, 0, 0, 1, 1); probe.toDataURL();
            return { image, src };
        }
        function validateDoc(value, w, h) {
            if (!value || !Array.isArray(value.marks) || value.marks.length > 1000) throw new Error('標記資料格式無效');
            const d = blankDoc(w, h), c = value.crop || d.crop;
            d.crop = { x: bounded(c.x, 0, w - 1), y: bounded(c.y, 0, h - 1), w: 1, h: 1 };
            d.crop.w = bounded(c.w, 1, w - d.crop.x); d.crop.h = bounded(c.h, 1, h - d.crop.y);
            d.rotation = bounded(Math.round(value.rotation), 0, 3); d.flip = !!value.flip;
            d.marks = value.marks.map(m => {
                if (!['pen', 'arrow', 'rect', 'highlight', 'text'].includes(m.type) || !Array.isArray(m.points) || !m.points.length || m.points.length > 20000) throw new Error('標記資料格式無效');
                const matrix = m.matrix || IDENTITY;
                if (!Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(n => Number.isFinite(n) && Math.abs(n) < 1e7) || Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]) < 1e-8) throw new Error('標記變形資料無效');
                return { type: m.type, points: m.points.map(p => ({ x: bounded(p.x, 0, w), y: bounded(p.y, 0, h) })), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ef4444', width: bounded(m.width, 1, 200), font: bounded(m.font, 8, 500), text: String(m.text || '').slice(0, 2000), matrix: [...matrix] };
            });
            return d;
        }
        function sceneGeometry(s, full = false) {
            const c = full ? { x: 0, y: 0, w: s.w, h: s.h } : s.doc.crop;
            const r = s.doc.rotation, w = r % 2 ? c.h : c.w, h = r % 2 ? c.w : c.h;
            let m = [[1, 0, 0, 1, -c.x, -c.y], [0, 1, -1, 0, c.h + c.y, -c.x], [-1, 0, 0, -1, c.w + c.x, c.h + c.y], [0, -1, 1, 0, -c.y, c.w + c.x]][r];
            if (s.doc.flip) m = [-m[0], m[1], -m[2], m[3], w - m[4], m[5]];
            return { w, h, m };
        }
        function pointsBox(points) { const xs = points.map(p => p.x), ys = points.map(p => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; }
        function drawMark(ctx, m) {
            const p = m.points[0], q = m.points[m.points.length - 1];
            ctx.save(); ctx.transform(...matrixOf(m)); ctx.strokeStyle = ctx.fillStyle = m.color; ctx.lineWidth = m.width; ctx.lineJoin = ctx.lineCap = 'round';
            if (m.type === 'text') { ctx.font = `600 ${m.font}px system-ui, sans-serif`; ctx.textBaseline = 'top'; m.text.split('\n').forEach((line, i) => ctx.fillText(line, p.x, p.y + i * m.font * 1.25)); }
            else if (m.type === 'rect' || m.type === 'highlight') { const b = pointsBox(m.points); if (m.type === 'highlight') { ctx.globalAlpha = .28; ctx.fillRect(b.x, b.y, b.w, b.h); } else ctx.strokeRect(b.x, b.y, b.w, b.h); }
            else {
                ctx.beginPath(); ctx.moveTo(p.x, p.y); m.points.slice(1).forEach(t => ctx.lineTo(t.x, t.y));
                if (m.points.length === 1) { ctx.lineTo(p.x + .01, p.y); } ctx.stroke();
                if (m.type === 'arrow') {
                    const angle = Math.atan2(q.y - p.y, q.x - p.x), length = Math.min(Math.hypot(q.x - p.x, q.y - p.y) * .45, Math.max(m.width * 4, 12));
                    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - length * Math.cos(angle - .48), q.y - length * Math.sin(angle - .48)); ctx.lineTo(q.x - length * Math.cos(angle + .48), q.y - length * Math.sin(angle + .48)); ctx.closePath(); ctx.fill();
                }
            }
            ctx.restore();
        }
        function drawScene(canvas, g, scale, preview = false, scene = null, original = true) {
            canvas.width = Math.max(1, Math.round(g.w * scale)); canvas.height = Math.max(1, Math.round(g.h * scale));
            const ctx = canvas.getContext('2d'), sx = canvas.width / g.w, sy = canvas.height / g.h, m = g.m;
            ctx.setTransform(sx * m[0], sy * m[1], sx * m[2], sy * m[3], sx * m[4], sy * m[5]);
            if (original) ctx.drawImage(scene.image, 0, 0);
            scene.doc.marks.forEach((mark, index) => { if (!preview || scene.textEdit?.index !== index) drawMark(ctx, mark); });
            ctx.setTransform(sx, 0, 0, sy, 0, 0); return ctx;
        }
        function encodedImageAttribute(src) {
            // 二進位 base64 本身不必再做 URL/base64 編碼，避免原圖多出三分之一。
            if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(src)) return src;
            return encodeURIComponent(src.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
        async function smallerSource(source, image) {
            if (!/^data:image\/png[;,]/i.test(source) || image.naturalWidth * image.naturalHeight > MAX_PIXELS) return source;
            if (losslessCache.has(source)) return losslessCache.get(source);
            const promise = (async () => {
                const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d', {willReadFrequently:true});
                try {
                    ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 1));
                    if (!blob || blob.type !== 'image/webp') return source;
                    const candidate = await readBlob(blob);
                    if (candidate.length >= source.length * .97) return source;
                    const check = new Image(); check.src = candidate; await noteImageReady(check);
                    if (check.naturalWidth !== canvas.width || check.naturalHeight !== canvas.height) return source;
                    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(check, 0, 0);
                    const verified = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    // 不假設瀏覽器的品質 1 一定無損；逐一核對所有 RGBA 通道才採用。
                    for (let i = 0; i < pixels.length; i++) if (pixels[i] !== verified[i]) return source;
                    return candidate;
                } catch (_) { return source; }
                finally { canvas.width = canvas.height = 1; }
            })();
            losslessCache.set(source, promise);
            while (losslessCache.size > 24 || [...losslessCache.keys()].reduce((n,key)=>n+key.length,0)>24000000) losslessCache.delete(losslessCache.keys().next().value);
            return promise;
        }
        async function packageImage(scene, {plain = false, source = null} = {}) {
            const g = sceneGeometry(scene), scale = Math.min(1, MAX_EDGE / Math.max(g.w, g.h), Math.sqrt(MAX_PIXELS / (g.w * g.h)));
            const stored = source || await smallerSource(scene.original, scene.image);
            const width = Math.max(1, Math.round(g.w * scale)), height = Math.max(1, Math.round(g.h * scale));
            let marks = '';
            if (scene.doc.marks.length) {
                const overlay = document.createElement('canvas'); drawScene(overlay, g, scale, false, scene, false);
                const blob = await new Promise((resolve, reject) => overlay.toBlob(b => b ? resolve(b) : reject(new Error('無法產生標記圖層')), 'image/png'));
                marks = await readBlob(blob); overlay.width = overlay.height = 1;
            }
            const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${g.w} ${g.h}" overflow="hidden"><g transform="matrix(${g.m.join(' ')})"><image id="note-image-source" width="${scene.w}" height="${scene.h}" href="NOTE_SOURCE_DATA"/></g>${marks?`<image width="${g.w}" height="${g.h}" href="NOTE_MARKS_DATA"/>`:''}</svg>`;
            const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml).replace('NOTE_SOURCE_DATA', encodedImageAttribute(stored)).replace('NOTE_MARKS_DATA', encodedImageAttribute(marks));
            // 套用前確認瀏覽器真的能顯示，失敗時保留原筆記與編輯視窗。
            const check = new Image(); check.src = src; await noteImageReady(check);
            cacheSource(src, stored);
            return { src, metadata: { v: 3, sourceKey: scene.originalKey || sourceKey(scene.original), storedKey: sourceKey(stored), w:scene.w, h:scene.h, ...(plain?{plain:true}:{}), doc: copy(scene.doc) } };
        }
        async function compactImage(src, metadata) {
            if (![1, 2].includes(metadata?.v)) return { src, metadata };
            const key = JSON.stringify(metadata), cached = compactCache.get(src);
            if (cached?.key === key) return cached.promise;
            const promise = (async () => {
                const identity = imageIdentity(src, metadata);
                if (!identity) throw new Error('舊圖片的原圖或標記資料不完整；已保留本機內容');
                const loaded = await loadSource(identity.source);
                const w = loaded.image.naturalWidth, h = loaded.image.naturalHeight;
                const doc = validateDoc(identity.doc, w, h);
                return packageImage({ original: loaded.src, originalKey: identity.key, image: loaded.image, w, h, doc });
            })();
            compactCache.set(src, { key, promise });
            while (compactCache.size > 4) compactCache.delete(compactCache.keys().next().value);
            try { return await promise; } catch (error) { compactCache.delete(src); throw error; }
        }
        async function compactPlainImage(src) {
            if (!/^data:image\/png[;,]/i.test(src || '')) return null;
            const cached = compactCache.get(src); if (cached?.key === 'plain') return cached.promise;
            const promise = (async () => {
                const loaded = await loadSource(src), source = await smallerSource(loaded.src, loaded.image);
                if (source === loaded.src) return null;
                const w = loaded.image.naturalWidth, h = loaded.image.naturalHeight;
                return packageImage({ original:loaded.src, image:loaded.image, w,h,doc:blankDoc(w,h) }, {plain:true,source});
            })();
            compactCache.set(src,{key:'plain',promise});while(compactCache.size>24)compactCache.delete(compactCache.keys().next().value);
            try{return await promise;}catch(_){compactCache.delete(src);return null;}
        }
        async function compactPayload(payload, {compressAll = false} = {}) {
            let converted = 0;
            const notes = [];
            for (const note of payload) {
                let next = note;
                if (note.text?.includes(ATTR) || (compressAll && note.text?.includes('<img'))) {
                    const template = document.createElement('template'); template.innerHTML = note.text;
                    let changed = false;
                    for (const img of template.content.querySelectorAll('img')) {
                        let metadata; try { metadata = JSON.parse(img.getAttribute(ATTR)); } catch (_) { throw new Error('圖片標記資料無法讀取；已停止上傳以保留原圖'); }
                        const result = [1,2].includes(metadata?.v) ? await compactImage(img.getAttribute('src'), metadata) : compressAll && !metadata ? await compactPlainImage(img.getAttribute('src')) : null;
                        if (!result) continue;
                        img.setAttribute('src', result.src); img.setAttribute(ATTR, JSON.stringify(result.metadata)); changed = true; converted++;
                    }
                    if (changed) next = { ...next, text: template.innerHTML };
                }
                if (note.galleryImageEdits || compressAll) {
                    const edits = { ...note.galleryImageEdits };let galleryChanged = false;
                    for (const name of ['images', 'galleryImages', 'pastedImages', 'uploadedImages', 'imageUrls', 'image']) {
                        const sources = name === 'image' ? [note.image] : note[name]; if (!Array.isArray(sources)) continue;
                        let changed = false; const values = [];
                        for (const src of sources) {
                            const metadata = edits[galleryKey(src || '')];
                            const result = [1,2].includes(metadata?.v) ? await compactImage(src, metadata) : compressAll && !metadata ? await compactPlainImage(src) : null;
                            if (!result) { values.push(src); continue; }
                            values.push(result.src); edits[galleryKey(result.src)] = result.metadata; changed = galleryChanged = true; converted++;
                        }
                        if (changed) next = { ...next, [name]: name === 'image' ? values[0] : values };
                    }
                    if (galleryChanged) {
                        const keys = new Set(['images', 'galleryImages', 'pastedImages', 'uploadedImages', 'imageUrls'].flatMap(name => next[name] || []).concat(next.image || []).map(galleryKey));
                        next.galleryImageEdits = Object.fromEntries(Object.entries(edits).filter(([key]) => keys.has(key)));
                    }
                }
                notes.push(next);
            }
            return { notes, converted };
        }
        return {galleryKey, galleryData, imageIdentity, sourceKey, compactPayload};
})();


