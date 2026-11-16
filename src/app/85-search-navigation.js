/* Source: 85-search-navigation.js */
/* Search decorations affect reader DOM only; canonical note HTML is unchanged. */
const noteSearchNavigation = (() => {
    let initialized = false, cursor = null, lastQuery = '', busy = false, layoutFrame = 0;
    function layoutDock() {
        cancelAnimationFrame(layoutFrame);
        layoutFrame=requestAnimationFrame(()=>{
            const dock=document.getElementById('note-reader-dock');if(!dock)return;
            const quick=document.getElementById('note-quick-actions');if(quick)quick.hidden=document.getElementById('note-page-dock').hidden;
            dock.hidden=[...dock.children].every(node=>node.hidden);
            document.body.classList.toggle('note-reader-docked',!dock.hidden);
            const height=dock.hidden?0:Math.ceil(dock.getBoundingClientRect().height);
            document.documentElement.style.setProperty('--note-reader-dock-height',height+'px');
        });
    }
    const query = () => normalizeSearchText(document.getElementById('search-input').value);
    const candidates = () => randomDrawState.active
        ? randomDrawState.selectedIds.map(resolveLinkedNote).filter(Boolean)
        : getNormallyFilteredNotes();
    function normalizedMap(text) {
        let normalized = ''; const starts = [], ends = [];
        const fallback = function*(){let index=0;for(const segment of text){yield {segment,index};index+=segment.length;}};
        const chunks = typeof Intl.Segmenter === 'function'
            ? new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(text)
            : fallback();
        for (const chunk of chunks) for (const character of chunk.segment.normalize('NFKC').toLowerCase()) {
            const value = /\s/.test(character) ? ' ' : character;
            if (value === ' ' && normalized.endsWith(' ')) { if (ends.length) ends[ends.length-1] = chunk.index + chunk.segment.length; continue; }
            for (let i = 0; i < value.length; i++) { starts.push(chunk.index); ends.push(chunk.index + chunk.segment.length); }
            normalized += value;
        }
        return {text:normalized, starts, ends};
    }
    function ranges(text, term, limit = 150) {
        if (!term || !normalizeSearchText(text).includes(term)) return [];
        const map = normalizedMap(text), result = [];
        for (let from = 0; term && result.length < limit;) {
            const index = map.text.indexOf(term, from); if (index < 0) break;
            result.push([map.starts[index], map.ends[index + term.length - 1]]); from = index + term.length;
        }
        return result;
    }
    function markedText(text, term) {
        const found = ranges(text, term, 20); let output = '', start = 0;
        for (const [a,b] of found) { output += escapeHtml(text.slice(start,a)) + '<mark>' + escapeHtml(text.slice(a,b)) + '</mark>'; start = b; }
        return output + escapeHtml(text.slice(start));
    }
    function excerpt(text, term) {
        const compact = String(text || '').replace(/\s+/g, ' ').trim(), first = ranges(compact, term, 1)[0];
        if (!first) return '';
        const start = Math.max(0, first[0]-40), end = Math.min(compact.length, first[1]+90);
        return (start ? '…' : '') + markedText(compact.slice(start,end), term) + (end < compact.length ? '…' : '');
    }
    function decorate(root, options = {}) {
        if (!root) return;
        const hit=options.preserveViewport&&!noteBrowse.isFlipping()&&!document.querySelector('.modal-overlay.active')?document.elementFromPoint(innerWidth*.5,innerHeight*.45):null;
        const anchor=hit?.closest('.note-text,.note-images-container,.note-title-display');
        const anchorTop=anchor&&root.contains(anchor)?anchor.getBoundingClientRect().top:null;
        const term = query();
        root.querySelectorAll('mark[data-search-hit]').forEach(mark => mark.replaceWith(...mark.childNodes));
        root.querySelectorAll('.note-search-excerpt').forEach(node => node.remove());
        if (!term) { update(); return; }
        for (const item of root.querySelectorAll('.note-item')) {
            const note = resolveLinkedNote(item.dataset.id); if (!note) continue;
            let count = 0;
            for (const content of item.querySelectorAll('.note-title-display,.note-text')) {
                content.normalize();
                const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {acceptNode:node => node.parentElement.closest('script,style,button,textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
                const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
                for (const text of nodes) {
                    if (count >= 150) break;
                    const found = ranges(text.data, term, 150-count); if (!found.length) continue;
                    const fragment = document.createDocumentFragment(); let offset = 0;
                    for (const [a,b] of found) {
                        fragment.append(text.data.slice(offset,a)); const mark = document.createElement('mark');
                        mark.dataset.searchHit = '1'; mark.textContent = text.data.slice(a,b); fragment.append(mark); offset = b; count++;
                    }
                    fragment.append(text.data.slice(offset)); text.replaceWith(fragment);
                }
            }
            const ocr = noteImageSearch.text(note), ocrSnippet = excerpt(ocr, term);
            const textSnippet = !count ? excerpt(notePlainText(note.text), term) : '';
            if (ocrSnippet || textSnippet) {
                const summary = document.createElement('div'); summary.className = 'note-search-excerpt';
                summary.innerHTML = (textSnippet ? '<div>內文命中：' + textSnippet + '</div>' : '') + (ocrSnippet ? '<div>圖片文字命中：' + ocrSnippet + '</div>' : '');
                summary.querySelectorAll('mark').forEach(mark => mark.dataset.searchHit='1');
                item.querySelector('.note-content-area').prepend(summary);
            }
            if (!count && !ocrSnippet && !textSnippet) {
                const summary = document.createElement('div'); summary.className = 'note-search-excerpt';
                summary.textContent = '分類命中：' + getNoteCategoryIds(note).map(id=>getCategoryById(id)?.name||'').join('、');
                item.querySelector('.note-content-area').prepend(summary);
            }
        }
        update();
        if(anchor?.isConnected&&Number.isFinite(anchorTop)){
            const delta=anchor.getBoundingClientRect().top-anchorTop;
            if(Math.abs(delta)>.5)window.scrollBy({top:delta,left:0,behavior:'instant'});
        }
    }
    function update() {
        const panel = document.getElementById('note-search-navigation'); if (!panel) return;
        const term = query(), list = candidates(); panel.hidden = !term;
        if (term !== lastQuery) { cursor = null; lastQuery = term; }
        const index = cursor ? list.findIndex(note=>String(note.id)===cursor.id) : -1;
        panel.querySelector('[data-search-count]').textContent = !list.length ? '找不到符合的筆記' : index < 0 ? '找到 '+list.length+' 則筆記' : '第 '+(index+1)+'／'+list.length+' 則 · 第 '+(cursor.hit+1)+' 處';
        panel.querySelectorAll('[data-search-step]').forEach(button=>button.disabled=!list.length||busy);
        layoutDock();
    }
    async function move(direction) {
        if (busy || !query() || document.querySelector('.container')?.inert || document.querySelector('.modal-overlay.active')) return;
        const list = candidates(); if (!list.length) return;
        busy = true;
        try {
            let index = cursor ? list.findIndex(note=>String(note.id)===cursor.id) : -1;
            let hit = cursor?.hit ?? -1;
            let current = index >= 0 ? findRenderedNoteElement(list[index].id) : null;
            // Manual page changes should continue within the newly displayed page.
            if (!current && (cursor || noteBrowse.state().page>0)) {
                const visible=[...document.querySelectorAll('#note-list > .note-item')];
                current=direction>0?visible[0]:visible[visible.length-1];
                if(current)index=list.findIndex(note=>String(note.id)===current.dataset.id);
            }
            const marks = current ? [...current.querySelectorAll('mark[data-search-hit]')] : [];
            if(current&&(!cursor||cursor.id!==current.dataset.id))hit=direction>0?-1:marks.length;
            if (index >= 0 && hit + direction >= 0 && hit + direction < marks.length) hit += direction;
            else { index = index < 0 ? direction > 0 ? 0 : list.length-1 : (index+direction+list.length)%list.length; hit = direction > 0 ? 0 : -1; }
            noteBrowse.requestReveal(list[index].id); filterNotes();
            const item = findRenderedNoteElement(list[index].id), targets = item ? [...item.querySelectorAll('mark[data-search-hit]')] : [];
            if (hit < 0) hit = Math.max(0, targets.length-1);
            cursor = {id:String(list[index].id),hit};
            const target = targets[hit] || item;
            document.querySelectorAll('.note-current-search-hit').forEach(node=>node.classList.remove('note-current-search-hit'));
            if (target) { target.classList.add('note-current-search-hit'); target.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
        } finally { busy = false; update(); }
    }
    function clear() { document.getElementById('search-input').value='';cursor=null;filterNotes();document.getElementById('search-input').focus(); }
    function initialize() {
        if (initialized) return; initialized=true;
        const panel = document.createElement('div'); panel.id='note-search-navigation';panel.hidden=true;
        panel.setAttribute('role','region');panel.setAttribute('aria-label','搜尋結果定位');
        panel.innerHTML='<span data-search-count role="status" aria-live="polite"></span><button type="button" data-search-step="-1">上一處</button><button type="button" data-search-step="1">下一處</button><button type="button" data-search-clear>清除搜尋</button>';
        const pagination=document.getElementById('note-page-dock'),dock=document.createElement('div');
        dock.id='note-reader-dock';dock.hidden=true;
        const quick=document.createElement('div');quick.id='note-quick-actions';quick.setAttribute('role','group');quick.setAttribute('aria-label','閱讀快捷操作');
        quick.innerHTML='<button type="button" data-reader-quick="search">搜尋</button><button type="button" data-reader-quick="add">＋ 筆記</button><button type="button" data-reader-quick="categories">分類</button><button type="button" data-reader-quick="top" aria-label="回到頁面頂端">↑ 頂端</button><button type="button" data-reader-quick="bottom" aria-label="前往目前這一頁底部">↓ 底部</button>';
        quick.addEventListener('click',event=>{const name=event.target.closest('[data-reader-quick]')?.dataset.readerQuick;if(name==='search'){const input=document.getElementById('search-input');input.focus({preventScroll:true});input.select();}else if(name==='add')openAddModal();else if(name==='categories')openCategoryOverviewModal();else if(name==='top'||name==='bottom')window.scrollTo({top:name==='top'?0:(document.scrollingElement||document.documentElement).scrollHeight,behavior:'instant'});});
        pagination.before(dock);dock.append(quick,panel,pagination);
        if(typeof ResizeObserver==='function')new ResizeObserver(layoutDock).observe(dock);
        window.addEventListener('resize',layoutDock,{passive:true});layoutDock();
        panel.addEventListener('click',event=>{const step=event.target.closest('[data-search-step]');if(step)void move(Number(step.dataset.searchStep));if(event.target.closest('[data-search-clear]'))clear();});
        document.getElementById('search-input').addEventListener('compositionend',()=>handleSearchInput());
        window.addEventListener('keydown',event=>{if(event.key==='F3'&&!document.querySelector('.modal-overlay.active')&&query()){event.preventDefault();void move(event.shiftKey?-1:1);}});
    }
    return {initialize,decorate,update,move,excerpt,layoutDock};
})();

