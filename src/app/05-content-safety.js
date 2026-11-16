/* Source: 05-content-safety.js */
/* Shared boundary for note HTML, pasted content and imported image URLs. */
const NOTE_RECOVERY_ID = '__NOTE_RECOVERY_V1__';
const noteSafeContent = (() => {
    const tags = new Set('a b strong i em u s strike sub sup font p div span br hr h1 h2 h3 h4 h5 h6 ol ul li table thead tbody tfoot tr th td colgroup col caption blockquote pre code mark details summary img'.split(' '));
    const discard = new Set('script style iframe object embed link meta base template svg math form input button select textarea audio video source canvas'.split(' '));
    const attributes = new Set('class title dir lang align color face size width height colspan rowspan span start reversed type scope valign border cellpadding cellspacing alt loading decoding role aria-label'.split(' '));
    const dataAttributes = new Set('data-inline-image data-note-image-edit data-note-table data-note-link data-note-arrow-list data-note-arrow-item data-arrow-note data-arrow-list data-arrow-item'.split(' '));
    const styles = new Set('color background-color font font-family font-size font-weight font-style text-decoration text-decoration-line text-decoration-color text-align text-indent line-height letter-spacing word-spacing white-space overflow-wrap word-break vertical-align width height min-width min-height max-width max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left border-width border-style border-color border-collapse border-spacing border-radius table-layout list-style-type list-style-position display float clear object-fit'.split(' '));
    const cache = new Map();let cacheSize=0;
    function url(value, image = false) {
        const source = String(value || '').trim();
        if (!source || /[\u0000-\u0020\u007f]/.test(source.slice(0, 32))) return '';
        if (image && /^note-local-asset:[a-zA-Z0-9-]+$/.test(source)) return source;
        if (image && /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif|x-icon|svg\+xml)[;,]/i.test(source)) return source;
        if (!image && source.startsWith('#')) return source;
        try {
            const parsed = new URL(source);
            if (['http:', 'https:'].includes(parsed.protocol) || !image && ['mailto:', 'tel:'].includes(parsed.protocol)) return source;
            if (image && parsed.protocol === 'blob:' && parsed.origin === location.origin) return source;
        } catch (_) { /* Relative and executable URLs are not note assets. */ }
        return '';
    }
    function html(value = '') {
        const source = String(value || '');
        if (cache.has(source)) {const result=cache.get(source);cache.delete(source);cache.set(source,result);return result;}
        const template = document.createElement('template');
        template.innerHTML = source;
        for (const element of [...template.content.querySelectorAll('*')]) {
            const tag = element.localName.toLowerCase();
            if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || discard.has(tag)) { element.remove(); continue; }
            if (!tags.has(tag)) { element.replaceWith(...element.childNodes); continue; }
            for (const attribute of [...element.attributes]) {
                const name = attribute.name.toLowerCase();
                if (name === 'style') {
                    for (const property of [...element.style]) {
                        const text = element.style.getPropertyValue(property);
                        if (!styles.has(property) || /url\s*\(|expression\s*\(|var\s*\(|[\\@]/i.test(text)) element.style.removeProperty(property);
                        else element.style.setProperty(property, text, '');
                    }
                    if (!element.style.length) element.removeAttribute('style');
                } else if (name === 'href' && tag === 'a' || name === 'src' && tag === 'img') {
                    const safe = url(attribute.value, tag === 'img');
                    if (safe) element.setAttribute(name, safe); else element.removeAttribute(name);
                } else if (name === 'contenteditable' && attribute.value === 'false' && (element.hasAttribute('data-inline-image') || element.hasAttribute('data-note-table'))) {
                    // Atomic editor blocks retain their browser selection behavior.
                } else if (!(attributes.has(name) || dataAttributes.has(name))) {
                    element.removeAttribute(attribute.name);
                }
            }
            if (tag === 'a') {
                element.setAttribute('rel', 'noopener noreferrer');
                if (/^https?:/i.test(element.getAttribute('href')||'')) element.setAttribute('target','_blank');
            }
        }
        const result = template.innerHTML;
        if(source.length<2*1024*1024){cache.set(source,result);cacheSize+=source.length+result.length;while(cache.size>80||cacheSize>4*1024*1024){const key=cache.keys().next().value;cacheSize-=key.length+cache.get(key).length;cache.delete(key);}}
        return result;
    }
    function note(record) {
        const next = {...record, text: html(record.text)};
        for (const name of ['images', 'galleryImages', 'pastedImages', 'uploadedImages', 'imageUrls']) {
            if (Array.isArray(next[name])) next[name] = next[name].map(value => url(value, true)).filter(Boolean);
        }
        if (next.image) next.image = url(next.image, true);
        return next;
    }
    return {html, url, note};
})();

function sanitizeNoteHtml(value) { return noteSafeContent.html(value); }
function inlineJsArgument(value) { return escapeAttribute(JSON.stringify(String(value))); }

function normalizeSearchText(value = '') {
    return String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function notePlainText(html = '') {
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('script,style,template').forEach(node => node.remove());
    template.content.querySelectorAll('br,hr').forEach(node => node.replaceWith(' '));
    template.content.querySelectorAll('p,div,li,tr,td,th,blockquote,h1,h2,h3,h4,h5,h6').forEach(node => node.append(' '));
    return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

