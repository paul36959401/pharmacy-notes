/* Source: 60-persistence.js */
    // 草稿、離線快取與雲端佇列分開保存；讀取失敗時絕不以空陣列覆蓋雲端。
    const notePersistence = (() => {
        const $ = id => document.getElementById(id);
        const tokenPrefix = 'note-local-asset:';
        let hash = 2166136261;
        for (const c of (noteDriveBoot.workspace||noteDriveBoot.appUrl||SCRIPT_URL)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
        const scope = 'pharmacy-notes-drive-v2-' + noteDriveBoot.book + '-' + (hash >>> 0).toString(36);
        const tailKey = scope + ':draft';
        const assets = new Map(), byValue = new Map(), pendingAssets = new Map(), htmlCache = new WeakMap(), imageCache = new WeakMap(), packedNoteCache=new WeakMap();
        let db = null, dbError = '', localError = '', cloudError = '', loading = true, ready = false, dirty = false, running = false;
        let workspace = [], base = [], draft = null, stamp = 0, durableStamp = 0, seq = 0, ackSeq = 0, savingLocal = false;
        let captureTimer = null, checkpointTimer = null, syncTimer = null, retryTimer = null, retryCount = 0, firstDirtyAt = 0;
        let editSession = null, restoring = false, ending = false, lastCloudAt = '', lastLocalAt = '', tailSafe = false;
        let firstCaptureAt = 0, firstCheckpointAt = 0, tailStamp = -1, tailTimer = null;
        let initialized = false, lastStatus = '', lastDetailTimes = '', viewError = '', editorPending = false, capturePending = false;
        let cloudStage = '', uploadBytes = 0, originalUploadBytes = 0;
        const comparisonCache = new WeakMap();
        let chunkProgress = null;
        let cloudVerified = false, lastContentAt = '', upgradePending = false;
        let syncFinished = Promise.resolve();
        const chunkCloud = createNoteChunkCloud({endpoint: SCRIPT_URL, space: scope,
            getAsset: id => assets.get(id),
            loadAsset: async id => {if(!db)return undefined;const value=await request(db.transaction('assets').objectStore('assets').get(id));if(typeof value==='string'){assets.set(id,value);byValue.set(value,id);}return value;},
            installAsset: (id,value) => { if (assets.get(id)!==value) {assets.set(id,value);pendingAssets.set(id,value);} byValue.set(value,id);void persist(); },
            progress: value => {chunkProgress=value;cloudStage=value.phase;uploadBytes=value.bytes;status();},
            isBusy:()=>running||dirty||editorPending
        });
        const uid = () => crypto.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        const request = req => new Promise((resolve,reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
        const transaction = tx => new Promise((resolve,reject) => { tx.oncomplete=resolve; tx.onerror=tx.onabort=()=>reject(tx.error || new Error('本機寫入未完成')); });
        const stampNow = () => stamp = Math.max(Date.now(), stamp + 1);
        function asset(value) {
            if (!value) return value;
            let id=byValue.get(value);
            if (!id) { id=uid(); byValue.set(value,id); assets.set(id,value); pendingAssets.set(id,value); }
            return tokenPrefix+id;
        }
        function resolveAsset(value) {
            if (typeof value !== 'string' || !value.startsWith(tokenPrefix)) return value;
            const found=assets.get(value.slice(tokenPrefix.length));
            if (found == null && chunkCloud.hasRemoteAsset(value.slice(tokenPrefix.length))) return value;
            if (found == null) throw new Error('部分圖片草稿尚未完整寫入，已保留可用的備份');
            return found;
        }
        function packImages(clone, original = null) {
            const originals=original?.querySelectorAll('img');
            clone.querySelectorAll('img').forEach((img,index)=>{
                const real=originals?.[index] || img;
                let cache=imageCache.get(real); if (!cache) { cache={}; imageCache.set(real,cache); }
                for (const name of ['src','data-note-image-edit']) {
                    const value=real.getAttribute(name);
                    if (!value || value.startsWith(tokenPrefix) || (name==='src' && !value.startsWith('data:'))) continue;
                    if (cache[name]?.value !== value) cache[name]={value,token:asset(value)};
                    img.setAttribute(name,cache[name].token);
                }
            });
        }
        function unpackHtml(html) {
            if (!html?.includes(tokenPrefix)) return html || '';
            // token 僅由本程式寫入屬性值；替換時保留 HTML 屬性跳脫。
            return html.replace(/note-local-asset:([a-zA-Z0-9-]+)/g,(_,id)=>{
                const value=assets.get(id); if(value==null && chunkCloud.hasRemoteAsset(id))return tokenPrefix+id;
                if (value==null) throw new Error('部分圖片草稿尚未完整寫入');
                return escapeAttribute(value);
            });
        }
        function sameShape(a,b){
            if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
            const ak=Object.keys(a),bk=Object.keys(b);if(ak.length!==bk.length)return false;for(let i=0;i<ak.length;i++)if(ak[i]!==bk[i]||!sameShape(a[ak[i]],b[bk[i]]))return false;return true;
        }
        function copyShape(value){if(!value||typeof value!=='object')return value;return Array.isArray(value)?value.map(copyShape):Object.fromEntries(Object.entries(value).map(([key,v])=>[key,copyShape(v)]));}
        function packNote(note) {
            if (isRecoveryCarrier(note)) return JSON.parse(JSON.stringify({...note,record:{...note.record,...(note.record.snapshot?{snapshot:packNote(note.record.snapshot)}:{})}}));
            const prior=packedNoteCache.get(note);if(prior&&sameShape(note,prior.source))return copyShape(prior.packed);
            const packed={...note};
            if (note.text) {
                let cached=htmlCache.get(note);
                if (!cached || cached.source!==note.text) {
                    const t=document.createElement('template');t.innerHTML=sanitizeNoteHtml(note.text);packImages(t.content);
                    cached={source:note.text,text:t.innerHTML};htmlCache.set(note,cached);
                }
                packed.text=cached.text;
            }
            if (Array.isArray(note.images)) packed.images=note.images.map(src=>typeof src==='string'&&src.startsWith('data:')?asset(src):src);
            if (note.image?.startsWith?.('data:')) packed.image=asset(note.image);
            if (note.galleryImageEdits) packed.galleryImageEdits=Object.fromEntries(Object.entries(note.galleryImageEdits).map(([k,v])=>[k,typeof v==='string'&&v.startsWith(tokenPrefix)?v:asset(JSON.stringify(v))]));
            const result=JSON.parse(JSON.stringify(packed));packedNoteCache.set(note,{source:copyShape(note),packed:copyShape(result)});return result;
        }
        function unpackNote(note) {
            if (isRecoveryCarrier(note)) return {...note,record:{...note.record,...(note.record.snapshot?{snapshot:unpackNote(note.record.snapshot)}:{})}};
            const n={...note}; if (n.text) n.text=unpackHtml(n.text);
            if (Array.isArray(n.images)) n.images=n.images.map(resolveAsset);
            if (n.image) n.image=resolveAsset(n.image);
            if (n.galleryImageEdits) n.galleryImageEdits=Object.fromEntries(Object.entries(n.galleryImageEdits).map(([k,v])=>[k,typeof v==='string'?(resolveAsset(v).startsWith(tokenPrefix)?v:JSON.parse(resolveAsset(v))):v]));
            return n;
        }
        const packPayload = () => buildSavePayload().map(packNote);
        const unpackPayload = payload => payload.map(unpackNote);
        const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
        const stable = value => JSON.stringify(value, (_,v) => v && typeof v==='object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
        function comparable(note) {
            if (!note) return '';
            if (comparisonCache.has(note)) return comparisonCache.get(note);
            const n=unpackNote(note);
            if (n.text?.includes('<img')) {
                const t=document.createElement('template');t.innerHTML=n.text;
                for(const img of t.content.querySelectorAll('img')) {
                    const metadata=JSON.parse(img.getAttribute('data-note-image-edit'));
                    const identity=noteImageEditor.imageIdentity(img.getAttribute('src'),metadata);
                    img.setAttribute('src',identity?.key || noteImageEditor.sourceKey(img.getAttribute('src')||''));
                    if(identity&&!identity.plain)img.setAttribute('data-note-image-edit',stable({doc:identity.doc}));
                    else if(identity?.plain)img.removeAttribute('data-note-image-edit');
                }
                n.text=t.innerHTML;
            }
            if(n.galleryImageEdits||['images','galleryImages','pastedImages','uploadedImages','imageUrls'].some(name=>n[name]?.length)||n.image) {
                const edits={...n.galleryImageEdits};
                for(const name of ['images','galleryImages','pastedImages','uploadedImages','imageUrls','image']) {
                    const sources=name==='image'?[n.image]:n[name];if(!Array.isArray(sources))continue;
                    const values=sources.map(src=>{if(!src)return src;const key=noteImageEditor.galleryKey(src),metadata=edits[key],identity=noteImageEditor.imageIdentity(src,metadata);if(identity)delete edits[key];return 'note-comparable:'+stable({source:identity?.key||noteImageEditor.sourceKey(src),doc:identity&&!identity.plain?identity.doc:null});});
                    n[name]=name==='image'?values[0]:values;
                }
                n.galleryImageEdits=edits;
            }
            const result=stable(packNote(n));comparisonCache.set(note,result);return result;
        }
        function sameNote(a,b) {
            if(same(a,b))return true;
            try{return comparable(a)===comparable(b);}catch(_){return false;}
        }
        function matchesStoredNote(expected,actual) {
            return !!actual && Object.keys(expected).every(key=>stable(expected[key])===stable(actual[key]));
        }
        function status() {
            const protectedLocal=(tailSafe || durableStamp>=stamp)&&!capturePending;
            const imageDraft=typeof noteImageEditor!=='undefined'&&noteImageEditor.isOpen();
            const matched=cloudVerified&&ready&&seq===ackSeq&&!dirty&&!running&&!editorPending&&!capturePending&&!imageDraft;
            let text,kind;
            if (loading) { text=workspace.length?'已載入本機備份 · 背景檢查雲端':'正在讀取雲端…';kind='syncing'; }
            else if (viewError) {text='雲端已連線 · 畫面更新異常';kind='error';}
            else if (localError) {text='本機備份未完成';kind='error';}
            else if (cloudError) {text=stamp>0?(protectedLocal?'已存本機 · 雲端待重試':'雲端待重試 · 本機儲存中'):'雲端讀取失敗 · 待重試';kind='error';}
            else if (imageDraft) {text='圖片編輯中 · 尚未套用到雲端';kind='syncing';}
            else if (dirty || running || editorPending || capturePending) {const phase=cloudStage==='整理圖片資料'?'整理圖片…':cloudStage==='上傳筆記'?'上傳雲端中…':cloudStage==='確認雲端已保存內容'?'確認雲端內容…':'同步中…';text=protectedLocal?'已存本機 · '+phase:'正在儲存…';kind='syncing';}
            else if (matched) {text='雲端同步完成 · 已確認內容一致';kind='success';}
            else {text='已存本機 · 等待雲端內容確認';kind='syncing';}
            const key=kind+text;
            if (lastStatus!==key) {setSyncStatus(kind,text);lastStatus=key;}
            const hint=$('note-autosave-hint');
            if (hint) {
                const msg=imageDraft?'圖片編輯草稿會保留；套用圖片後自動同步。':`${protectedLocal?'本機草稿已儲存':'正在保存草稿…'}${cloudError?' · 雲端連線後會自動重試':dirty||running?' · 等待雲端同步':' · 編輯會自動儲存，關閉不會捨棄修改'}`;
                if (hint.textContent!==msg) hint.textContent=msg;
            }
            const detail=$('sync-detail-message');
            const detailText=viewError || localError || cloudError || (imageDraft?'圖片修改目前是本機草稿，套用到筆記後才會上傳雲端。':cloudStage?cloudStage+'…':loading?'正在檢查筆記文字更新，圖片會按需要讀取。':matched?'已重新讀取雲端內容並確認與目前筆記一致。':'目前內容尚未確認全部存到雲端；本機草稿會保留。');
            if (detail && detail.textContent!==detailText) detail.textContent=detailText;
            const size=$('sync-detail-size');
            const sizeText=chunkProgress?`本次新增傳輸 ${(uploadBytes/1000000).toFixed(2)} MB；${chunkProgress.phase}。原圖與畫記另外保存，不隨整本筆記重送。`:'Google Drive 私人儲存：文字與預覽優先，編輯或放大時才讀取原圖。';
            if(size && size.textContent!==sizeText)size.textContent=sizeText;
            const times=$('sync-detail-times');
            const timesKey=JSON.stringify([matched,imageDraft,lastContentAt,lastCloudAt,lastLocalAt]);
            if (times && timesKey!==lastDetailTimes) {lastDetailTimes=timesKey;times.textContent=`內容狀態：${matched?'已確認與雲端一致':imageDraft?'圖片草稿尚未套用':'尚待確認／同步'}\n最近內容修改：${lastContentAt?new Date(lastContentAt).toLocaleString('zh-TW'):'本次尚無內容修改'}\n雲端讀回確認：${lastCloudAt?new Date(lastCloudAt).toLocaleString('zh-TW'):'尚未確認'}\n本機快取寫入：${lastLocalAt?new Date(lastLocalAt).toLocaleTimeString('zh-TW'):'尚未完成'}（快取時間不代表有新的未同步內容）`;}

        }
        function installUi() {
            if ($('sync-details')) return;
            $('sync-status').tabIndex=0;
            document.body.insertAdjacentHTML('beforeend','<div id="sync-details" hidden><strong>自動儲存狀態</strong><p id="sync-detail-message"></p><p id="sync-detail-size"></p><small id="sync-detail-times"></small><div class="sync-detail-actions"><button type="button" id="sync-retry">立即重試</button><button type="button" id="sync-backup">下載完整備份</button><button type="button" id="sync-text-backup">下載純文字備份</button><button type="button" id="sync-detail-close">關閉</button></div></div>');
            const toggle=()=>{$('sync-details').hidden=!$('sync-details').hidden;status();positionToolbarSyncDetails();};
            $('sync-status').addEventListener('click',toggle);$('sync-status').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
            $('sync-detail-close').onclick=()=>$('sync-details').hidden=true;
            $('sync-retry').onclick=()=>{capture();checkpoint();clearTimeout(retryTimer);retryCount=0;void synchronize(true);};
            $('sync-backup').onclick=downloadBackup;
            $('sync-text-backup').onclick=downloadTextBackup;
        }
        let imageObserver=null,noteObserver=null,activeImageLoads=0,imageGeneration=0,scanTimer=null,warmTimer=null,warmingActive=false;
        let lookahead=Math.max(2400,innerHeight*3),scrollDirection=1,lastScrollY=scrollY,lastScrollTime=performance.now(),warmCursor=0,warmBytes=0,warmCount=0;
        let observerMargin='',warmIds=[];
        const queuedImages=new Map(),imageLoads=new WeakMap(),preparedImages=new Set(),preparedNotes=new Set(),nearNotes=new Set(),loadedImages=new Set();
        const imageSlots=new WeakMap(),recentImageSizes=new Map();
        const imageId=image=>image.dataset.cloudAsset||image.dataset.cloudOriginal;
        const validImageSize=size=>size&&Number.isFinite(size.width)&&Number.isFinite(size.height)&&size.width>0&&size.height>0;
        function readerImageSize(image,id){
            const cloud=chunkCloud.dimensions(id);
            if(validImageSize(cloud))return cloud;
            const remembered=recentImageSizes.get(id);if(remembered)return remembered;
            const attrs={width:Number(image.getAttribute('width')),height:Number(image.getAttribute('height'))};
            return validImageSize(attrs)?attrs:null;
        }
        function imageSlotChanged(image,size){
            const current=imageSlots.get(image);
            return validImageSize(size)&&(current?.width!==size.width||current?.height!==size.height);
        }
        function reserveImageSlot(image,size){
            imageSlots.set(image,size);image.dataset.readerImageSized='1';
            image.style.setProperty('--reader-image-width',size.width+'px');
            image.style.aspectRatio=size.width+'/'+size.height;
            if(!image.hasAttribute('width'))image.setAttribute('width',size.width);
            if(!image.hasAttribute('height'))image.setAttribute('height',size.height);
        }
        function readerLineAt(list){
            const bounds=list.getBoundingClientRect(),dock=document.getElementById('note-reader-dock')||document.getElementById('note-page-dock');
            const headerBottom=Math.max(0,document.querySelector('.top-bar')?.getBoundingClientRect().bottom||0);
            // Leave a newly opened page at its start until the reader scrolls into it.
            if(bounds.top>=headerBottom-1)return null;
            const top=headerBottom;
            const bottom=Math.min(innerHeight,bounds.bottom,dock&&!dock.hidden?dock.getBoundingClientRect().top:innerHeight);
            if(bottom-top<8||bounds.right<=bounds.left)return null;
            const middle=(bounds.left+bounds.right)/2;
            let fallback=null;
            for(const part of [.4,.23,.57,.08,.74,.9,.98]){
                const y=top+(bottom-top)*part,hit=document.elementFromPoint(middle,y);
                const content=hit?.closest('.note-content-area');if(!content||!list.contains(content))continue;
                const block=hit.closest('img,.note-title-display,p,li,td,th,blockquote,pre')||content;
                if(!fallback&&content.contains(block))fallback={node:block,box:block,top:block.getBoundingClientRect().top};
                if(!hit.closest('.note-text,.note-title-display')||hit.closest('img'))continue;
                const rect=content.getBoundingClientRect();
                for(const offset of [.09,.48,.83]){
                    const range=caretRangeFromPoint(rect.left+rect.width*offset,y),node=range?.startContainer;
                    if(node?.nodeType!==3||!node.data.trim()||!content.contains(node))continue;
                    const start=Math.min(range.startOffset,node.length-1);
                    range.setStart(node,start);range.setEnd(node,start+1);
                    const line=range.getBoundingClientRect();
                    if(line.height>0&&line.top<bottom&&line.bottom>top&&y>=line.top-6&&y<=line.bottom+6)return {node,box:range,top:line.top};
                }
            }
            return fallback;
        }
        function changeReaderImageLayout(images,apply){
            // Snapshot the live line only for mutations that can move visible content.
            // No saved scroll position survives a load, user scroll, or page turn.
            const list=scrollY>0&&!document.hidden&&!noteBrowse.isFlipping()&&!document.querySelector('.modal-overlay.active, .container[inert]')&&document.getElementById('note-list');
            const anchor=list&&images.some(image=>list.contains(image)&&image.getBoundingClientRect().top<innerHeight)?readerLineAt(list):null;
            apply();
            if(!anchor?.node.isConnected||!list.contains(anchor.node))return;
            // Measuring after layout also accounts for any native scroll anchoring already applied.
            const delta=anchor.box.getBoundingClientRect().top-anchor.top;
            if(Number.isFinite(delta)&&Math.abs(delta)>.5)window.scrollBy({top:delta,left:0,behavior:'instant'});
        }
        function resetRenderedImages(){
            imageGeneration++;imageObserver?.disconnect();noteObserver?.disconnect();imageObserver=noteObserver=null;observerMargin='';
            clearTimeout(scanTimer);clearTimeout(warmTimer);scanTimer=warmTimer=null;
            queuedImages.clear();preparedImages.clear();preparedNotes.clear();nearNotes.clear();loadedImages.clear();warmIds=[];warmCursor=warmBytes=warmCount=0;
        }
        function imageDistance(image){
            const rect=image.getBoundingClientRect();return rect.bottom<0?-rect.bottom:rect.top>innerHeight?rect.top-innerHeight:0;
        }
        function queueImage(image){
            if(!image.isConnected||!image.dataset.cloudAsset||imageLoads.has(image)||image.classList.contains('cloud-image-error'))return;
            const distance=imageDistance(image);queuedImages.set(image,distance);
        }
        function pumpImages(){
            if(noteBrowse.isFlipping())return;
            if(document.body.dataset.noteView==='home')return;
            if(!queuedImages.size)return;
            const sorted=[...queuedImages].filter(([image])=>image.isConnected).sort((a,b)=>a[1]-b[1]);
            queuedImages.clear();for(const pair of sorted)queuedImages.set(...pair);
            while(activeImageLoads<16&&queuedImages.size){
                const [image,distance]=queuedImages.entries().next().value;queuedImages.delete(image);
                if(!image.isConnected||!image.dataset.cloudAsset)continue;
                activeImageLoads++;
                hydrateRenderedImage(image,distance<innerHeight?0:2).catch(()=>{}).finally(()=>{activeImageLoads--;pumpImages();});
            }
        }
        function observeImages(){
            if(typeof IntersectionObserver==='undefined')return;
            const back=Math.max(1200,Math.round(lookahead*.45)),margin=scrollDirection>0?`${back}px 0px ${Math.round(lookahead)}px 0px`:`${Math.round(lookahead)}px 0px ${back}px 0px`;
            if(margin===observerMargin&&imageObserver)return;observerMargin=margin;
            imageObserver?.disconnect();noteObserver?.disconnect();
            imageObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)queueImage(entry.target);else queuedImages.delete(entry.target);}pumpImages();},{rootMargin:margin});
            noteObserver=new IntersectionObserver(entries=>{
                for(const entry of entries){const note=entry.target;if(entry.isIntersecting){nearNotes.add(note);for(const image of [...note.querySelectorAll('img[data-cloud-asset]')].slice(0,8))queueImage(image);}else nearNotes.delete(note);}
                pumpImages();
            },{rootMargin:margin});
            for(const image of preparedImages)if(image.isConnected&&image.dataset.cloudAsset)imageObserver.observe(image);
            for(const note of preparedNotes)if(note.isConnected)noteObserver.observe(note);
        }
        function trimRenderedImages(){
            const distance=Math.max(6000,innerHeight*8);
            for(const image of loadedImages){
                if(!image.isConnected){loadedImages.delete(image);continue;}
                const note=image.closest('.note-item'),rect=(note||image).getBoundingClientRect();
                const far=rect.bottom < -distance||rect.top>innerHeight+distance;
                if(!far&&!(loadedImages.size>64&&imageDistance(image)>innerHeight*3))continue;
                const id=imageId(image);if(!id||!imageSlots.has(image))continue;
                image.dataset.cloudAsset=id;image.removeAttribute('src');image.classList.add('cloud-image-pending');
                const frame=image.closest('.note-image-frame');if(frame)frame.dataset.viewSrc=tokenPrefix+id;
                loadedImages.delete(image);imageObserver?.observe(image);
            }
        }
        function scheduleImageScan(){
            if(document.body.dataset.noteView==='home')return;
            if(scanTimer)return;scanTimer=setTimeout(()=>{
                scanTimer=null;observeImages();
                for(const note of nearNotes)for(const image of note.querySelectorAll('img[data-cloud-asset]')){
                    const rect=image.getBoundingClientRect();if(rect.top<innerHeight+lookahead&&rect.bottom>-lookahead)queueImage(image);
                }
                pumpImages();trimRenderedImages();
            },90);
        }
        function scheduleWarm(delay=1200){clearTimeout(warmTimer);warmTimer=setTimeout(warmPreviews,delay);}
        async function warmPreviews(){
            if(noteBrowse.isFlipping())return;
            warmTimer=null;if(warmingActive){scheduleWarm(400);return;}
            if(document.hidden||navigator.connection?.saveData||document.body.dataset.noteView==='home')return;
            if(running||dirty||editorPending){scheduleWarm(900);return;}
            const budget=(navigator.deviceMemory&&navigator.deviceMemory<=4?12:24)*1024*1024;
            if(warmBytes>=budget||warmCount>=240||warmCursor>=warmIds.length)return;
            const generation=imageGeneration,batch=warmIds.slice(warmCursor,warmCursor+12);warmCursor+=batch.length;warmingActive=true;
            try{const result=await chunkCloud.prefetchPreviews(batch);warmBytes+=result.bytes;warmCount+=result.images;}finally{warmingActive=false;if(generation===imageGeneration&&warmCursor<warmIds.length)scheduleWarm(120);else if(generation!==imageGeneration)scheduleWarm(1200);}
        }
        window.addEventListener('scroll',()=>{
            const now=performance.now(),delta=scrollY-lastScrollY,elapsed=Math.max(16,now-lastScrollTime);
            if(Math.abs(delta)>4)scrollDirection=delta>0?1:-1;
            const target=Math.max(innerHeight*3,2400,Math.min(8000,Math.abs(delta)/elapsed*1800+innerHeight*2));
            if(Math.abs(target-lookahead)>700)lookahead=target;
            lastScrollY=scrollY;lastScrollTime=now;scheduleImageScan();
        },{passive:true});
        window.addEventListener('resize',()=>{lookahead=Math.max(2400,innerHeight*3);scheduleImageScan();},{passive:true});
        document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleImageScan();scheduleWarm(500);}});
        function prepareRenderedImages(root){
            if(root.id==='note-list'){
                for(const image of preparedImages)if(!image.isConnected){imageObserver?.unobserve(image);preparedImages.delete(image);queuedImages.delete(image);loadedImages.delete(image);}
                for(const note of preparedNotes)if(!note.isConnected){noteObserver?.unobserve(note);preparedNotes.delete(note);nearNotes.delete(note);}
            }
            const sizing=[],connected=[];
            root.querySelectorAll('img').forEach(image=>{
                const source=image.getAttribute('src')||'';
                if(!source.startsWith(tokenPrefix)&&!image.dataset.cloudAsset&&!image.dataset.cloudOriginal)return;
                if(source.startsWith(tokenPrefix)){image.dataset.cloudAsset=source.slice(tokenPrefix.length);image.removeAttribute('src');}
                preparedImages.add(image);const id=imageId(image),size=readerImageSize(image,id);
                if(imageSlotChanged(image,size))sizing.push([image,size]);
                if(image.dataset.cloudAsset&&!image.classList.contains('cloud-image-pending')){image.classList.add('cloud-image-pending');image.title='圖片會提前載入；點一下可讀取原圖';}
                if(image.isConnected)connected.push([image,id]);
            });
            if(sizing.length){
                const apply=()=>{for(const [image,size] of sizing)reserveImageSlot(image,size);};
                if(root.isConnected)changeReaderImageLayout(sizing.map(([image])=>image),apply);else apply();
            }
            if(!root.isConnected)return;
            for(const [image,id] of connected){
                const note=image.closest('.note-item');if(note)preparedNotes.add(note);
                if(chunkCloud.peekPreview(id)){const rect=(note||image).getBoundingClientRect();if(rect.top<innerHeight+lookahead&&rect.bottom>-lookahead)queueImage(image);}
            }
            observeImages();pumpImages();
            if(typeof IntersectionObserver==='undefined')for(const image of preparedImages)if(imageDistance(image)<lookahead)queueImage(image);
            const visibleIds=[...preparedImages].map(imageId),adjacentIds=noteBrowse.adjacentImageIds();
            warmIds=[...new Set([...visibleIds.slice(0,12),...adjacentIds,...visibleIds.slice(12)].filter(id=>chunkCloud.previewBytes(id)))];
            scheduleWarm();scheduleImageScan();
        }
        async function hydrateRenderedImage(image,priority=0){
            if(!image)return '';
            if(imageLoads.has(image))return imageLoads.get(image);
            const id=image.dataset.cloudAsset;if(!id)return image.getAttribute('src')||'';
            const generation=imageGeneration;
            const job=(async()=>{
                image.classList.remove('cloud-image-error');
                try{
                    const source=await chunkCloud.ensurePreview(id,{priority});
                    const decoded=new Image();decoded.src=source;await noteImageReady(decoded);
                    if(image.isConnected&&generation===imageGeneration&&imageId(image)===id){
                        const size=readerImageSize(image,id)||{width:decoded.naturalWidth,height:decoded.naturalHeight};
                        const changed=imageSlotChanged(image,size);
                        const apply=()=>{
                            if(changed)reserveImageSlot(image,size);
                            image.dataset.cloudOriginal=id;image.loading='eager';image.src=source;
                            image.classList.remove('cloud-image-pending','cloud-image-error');delete image.dataset.cloudAsset;
                            image.title='點一下讀取原圖並放大';imageObserver?.unobserve(image);loadedImages.add(image);
                            const frame=image.closest('.note-image-frame');if(frame)frame.dataset.viewSrc=source;
                        };
                        if(changed||!imageSlots.has(image))changeReaderImageLayout([image],apply);else apply();
                        if(validImageSize(size)){
                            recentImageSizes.delete(id);recentImageSizes.set(id,size);
                            if(recentImageSizes.size>512)recentImageSizes.delete(recentImageSizes.keys().next().value);
                        }
                    }
                    return source;
                }catch(e){if(image.isConnected&&generation===imageGeneration){image.classList.add('cloud-image-error');image.title='預覽暫時無法讀取；點一下可重試原圖，文字與同步仍可使用。';imageObserver?.unobserve(image);}throw e;}
            })();imageLoads.set(image,job);try{return await job;}finally{imageLoads.delete(image);}
        }
        async function renderedImageSource(element) {
            const image=element.matches('img')?element:element.querySelector('img');
            try{const id=image?.dataset.cloudOriginal||image?.dataset.cloudAsset;return id?await chunkCloud.ensureAsset(id):await hydrateRenderedImage(image);}catch(e){showPreviewModeToast('這張圖片尚未載入，請稍後再點一次重試。');return '';}
        }
        async function prepareNoteForEditing(note) {return packNote(note);}
        async function resolveEditorValue(value){return typeof value==='string'&&value.startsWith(tokenPrefix)?chunkCloud.ensureAsset(value.slice(tokenPrefix.length)):value;}
        function imageSearchIds(note){return tokenIds(packNote(note)).filter(id=>{const d=chunkCloud.assetDescriptor(id);return d&&(d.preview||d.kind==='data-url'&&/^image\//.test(d.file?.mime||''));});}

        async function openDatabase() {
            const req=indexedDB.open(scope,1);
            req.onupgradeneeded=()=>{req.result.createObjectStore('state');req.result.createObjectStore('assets');};
            db=await request(req);db.onversionchange=()=>db.close();
        }
        function tokenIds(value) {
            const ids=new Set();
            function visit(item){
                if(typeof item==='string'){for(const match of item.matchAll(/note-local-asset:([a-zA-Z0-9-]+)/g))ids.add(match[1]);}
                else if(Array.isArray(item))item.forEach(visit);
                else if(item&&typeof item==='object')for(const[key,child]of Object.entries(item)){visit(key);visit(child);}
            }
            visit(value);return [...ids];
        }
        function writeTail() {
            clearTimeout(tailTimer);tailTimer=null;
            if (tailSafe && tailStamp===stamp) return;
            tailSafe=false;
            try {
                const missing=tokenIds([workspace,base,draft]).filter(id=>pendingAssets.has(id));
                let length=0;const embedded={};
                for (const id of missing) {length+=assets.get(id).length;if(length>750000) break;embedded[id]=assets.get(id);}
                const complete=missing.every(id=>id in embedded);
                if(!complete)return; // 等 IndexedDB 寫完大圖後，才發布指向該圖片的新草稿版本。
                localStorage.setItem(tailKey,JSON.stringify({stamp,draft,workspace,base,dirty,lastCloudAt,lastContentAt,verificationVersion:upgradePending?2:3,assets:complete?embedded:{}}));
                tailSafe=complete;tailStamp=stamp;
            } catch (_) { /* IndexedDB 可容納大圖；同步寫入失敗時由離開頁面保護補上。 */ }
        }
        async function persist() {
            if (savingLocal || !db) {if(!db&&dbError){localError=dbError;status();}return;}
            savingLocal=true;
            const savedStamp=stamp, pending=[...pendingAssets], saved={workspace,base,draft,dirty,stamp,lastCloudAt,lastContentAt,verificationVersion:upgradePending?2:3};
            try {
                const tx=db.transaction(['state','assets'],'readwrite'),done=transaction(tx);
                for(const [id,value] of pending)tx.objectStore('assets').put(value,id);
                tx.objectStore('state').put(saved,'current');await done;
                for(const [id,value]of pending)if(pendingAssets.get(id)===value)pendingAssets.delete(id);
                durableStamp=Math.max(durableStamp,savedStamp);lastLocalAt=new Date().toISOString();localError='';
                // IndexedDB is already durable; the synchronous fallback waits for a pause in typing.
            } catch(e) {writeTail();localError='瀏覽器的本機空間不足或無法寫入，請用「下載備份」保留內容。';}
            finally {savingLocal=false;if(!editSession&&!running&&!pendingAssets.size){for(const[id,value]of assets){if(value.length>100000&&chunkCloud.canReleaseAsset(id)){assets.delete(id);if(byValue.get(value)===id)byValue.delete(value);}}}status();if(savedStamp!==stamp)setTimeout(()=>void persist(),100);}
        }
        function touch() {
            stampNow();tailSafe=false;clearTimeout(tailTimer);
            if(!db)writeTail();else tailTimer=setTimeout(writeTail,1500);
            void persist();status();
        }
        function capture() {
            clearTimeout(captureTimer);captureTimer=null;firstCaptureAt=0;
            if (restoring || !editSession || !$('noteModal').classList.contains('active')) return;
            const imageDraft=noteImageEditor.exportDraft?.();capturePending=false;
            const next={id:editingNoteId||editSession.id,isNew:editSession.isNew,title:$('note-title-input').value,text:serializeEditorContent({prepare:false,packAssets:true}),images:currentPastedImages.map(src=>src.startsWith('data:')?asset(src):src),galleryImageEdits:Object.fromEntries(Object.entries(noteImageEditor.galleryData()).map(([k,v])=>[k,typeof v==='string'&&v.startsWith(tokenPrefix)?v:asset(JSON.stringify(v))])),categoryIds:[...pendingCategoryIds],createdAt:editSession.createdAt,original:editSession.original?packNote(editSession.original):null,imageEditor:packImageDraft(imageDraft)};
            if(sameShape(next,draft)){status();return;}draft=next;
            touch();
        }
        function packImageDraft(value){if(!value)return null;return {...value,source:value.source.startsWith(tokenPrefix)?value.source:asset(value.source),...(value.images?{images:Object.fromEntries(Object.entries(value.images).map(([id,source])=>[id,source.startsWith(tokenPrefix)?source:asset(source)]))}:{})};}
        function unpackImageDraft(value){if(!value)return null;return {...value,source:resolveAsset(value.source),...(value.images?{images:Object.fromEntries(Object.entries(value.images).map(([id,source])=>[id,resolveAsset(source)]))}:{})};}
        function changed() {
            if (!initialized || restoring || !editSession) return;
            editorPending=true;capturePending=true;clearTimeout(tailTimer);tailTimer=null;status();
            const now=Date.now();if(!firstCaptureAt)firstCaptureAt=now;if(!firstCheckpointAt)firstCheckpointAt=now;
            clearTimeout(captureTimer);captureTimer=setTimeout(capture,Math.max(0,Math.min(180,1000-(now-firstCaptureAt))));
            clearTimeout(checkpointTimer);checkpointTimer=setTimeout(checkpoint,Math.max(0,Math.min(1800,8000-(now-firstCheckpointAt))));
        }
        function begin() {
            if (restoring) return;
            clearTimeout(captureTimer);clearTimeout(checkpointTimer);
            const original=editingNoteId?notesData.find(n=>n.id===editingNoteId):null;
            editSession={id:editingNoteId||('note-'+uid()),isNew:!original,createdAt:original?.createdAt||new Date().toISOString(),original:original?{...original}:null,historyRecorded:false};
            capture();
        }
        function checkpoint() {
            clearTimeout(checkpointTimer);checkpointTimer=null;firstCheckpointAt=0;
            if (!editSession || restoring || !$('noteModal').classList.contains('active') || noteImageEditor.isOpen()) return;
            saveCurrent({automatic:true,close:false});
        }
        function saveCurrent({automatic=false,close=true}={}) {
            if (noteImageEditor.isOpen()) return;
            if (!editSession) begin();
            capture();if(!draft)return;
            const text=unpackHtml(draft.text),title=cleanNoteTitle(draft.title),existing=notesData.find(n=>n.id===draft.id);
            const empty=!title&&!$('modal-text').textContent.trim()&&!currentPastedImages.length&&(!text||text==='<br>'||text==='<div><br></div>');
            if (empty&&!existing) {editorPending=false;status();if(!automatic)alert('請至少輸入文字或附上一張圖片！');return;}
            const now=new Date().toISOString();
            const next={...(existing||{}),id:draft.id,title,text:empty?'':text,images:[...currentPastedImages],galleryImageEdits:noteImageEditor.galleryData(),categoryIds:pendingCategoryIds.filter(id=>getCategoryById(id)),starred:existing?.starred||false,createdAt:existing?.createdAt||editSession.createdAt};
            for(const name of ['image','imageAnnotations','galleryImages','pastedImages','uploadedImages','imageUrls'])delete next[name];
            // Capture already sanitized this exact DOM; reuse its packed HTML for the checkpoint.
            htmlCache.set(next,{source:next.text,text:draft.text});
            const comparison=n=>[n?.title||'',n?.text||'',n?.images||[],n?.galleryImageEdits||{},n?.categoryIds||[]];
            let updated=false;
            if(!existing||(!sameShape(comparison(existing),comparison(next))&&!sameNote(packNote(existing),packNote(next)))){
                if(existing)noteRecovery.beforeEdit(existing,editSession);
                next.updatedAt=now;const index=notesData.findIndex(n=>n.id===next.id);if(index<0)notesData.push(next);else notesData[index]=next;
                // 同一份 DOM 的緊湊 HTML 可重用，避免每次鍵入重新解析大圖。
                htmlCache.set(next,{source:next.text,text:draft.text});updated=true;
            }
            editingNoteId=next.id;draft.id=next.id;
            editorPending=false;
            if (!automatic) recordHistory();
            if(updated||!automatic)queueSave(automatic?null:100);
            status();
            if(close){const id=next.id;finishSession();ending=true;closeModal();ending=false;filterNotes();focusSavedNoteAfterSave(id);}
        }
        function recordHistory() {
            if(!editSession||editSession.historyRecorded)return;
            const current=notesData.find(n=>n.id===(editingNoteId||editSession.id));
            if(current&&(!editSession.original||!sameNote(packNote(current),packNote(editSession.original)))) {
                addHistoryRecord(editSession.isNew?'新增':'編輯',current,'自動儲存筆記');editSession.historyRecorded=true;
            }
        }
        function finishSession() {
            clearTimeout(captureTimer);clearTimeout(checkpointTimer);firstCaptureAt=firstCheckpointAt=0;draft=null;editSession=null;editorPending=capturePending=false;touch();
        }
        function closing() {
            if(ending||restoring||!editSession)return;
            saveCurrent({automatic:true,close:false});recordHistory();queueSave(100);finishSession();filterNotes();
        }
        function queueSave(delay=null) {
            if(restoring)return;
            const next=packPayload();
            if(sameShape(next,workspace)){
                if(dirty&&delay!=null){clearTimeout(syncTimer);syncTimer=setTimeout(()=>void synchronize(),delay);}
                return;
            }
            workspace=next;seq++;dirty=true;cloudVerified=false;lastContentAt=new Date().toISOString();if(!firstDirtyAt)firstDirtyAt=Date.now();touch();
            const quiet=delay??1600,max=8000;
            clearTimeout(syncTimer);syncTimer=setTimeout(()=>void synchronize(),Math.max(0,Math.min(quiet,max-(Date.now()-firstDirtyAt))));
        }
        async function fetchBackend(method='GET',payload=null,packed=null,verify=false) {
            if (method==='GET') {
                const result=await chunkCloud.read({verify});
                return result?.packed ? result.packed : result;
            }
            if(chunkCloud.isSupported()) return chunkCloud.write(packed || payload.map(packNote));
            return chunkCloud.legacyWrite(payload);
        }
        function merge(local,old,remote) {
            const oldMap=new Map(old.map(n=>[n.id,n])),localMap=new Map(local.map(n=>[n.id,n])),result=new Map(remote.map(n=>[n.id,n]));
            // A save timestamp alone is not a competing edit. Keep strict readback
            // verification unchanged; this comparison is only for merging notes.
            const sameContent=(a,b)=>sameNote(a,b)||!!(a&&b&&sameNote({...a,updatedAt:undefined},{...b,updatedAt:undefined}));
            const cloudCategories=remote.find(n=>n.id===CATEGORY_SYSTEM_ID)?.records||[];
            let conflicts=0;
            function preserveCloudVersion(note) {
                const existing=[...result.values(),...localMap.values()].some(carrier=>isRecoveryCarrier(carrier)&&!carrier.record.removedAt&&carrier.record.kind==='version'&&carrier.record.noteId===note.id&&sameContent(carrier.record.snapshot,note));
                if(existing)return;
                const versionId=uid(),now=new Date().toISOString(),id=NOTE_RECOVERY_ID+':'+versionId;
                result.set(id,{id,_type:'system-recovery',record:{id:versionId,noteId:note.id,kind:'version',source:'sync-conflict',capturedAt:now,updatedAt:now,reason:'同步差異：另一份雲端修改；原筆記保留本機內容',snapshot:structuredClone(note),index:remote.indexOf(note),categories:structuredClone(cloudCategories.filter(category=>(note.categoryIds||[]).includes(category.id)))}});
                conflicts++;
            }
            for(const [id,n]of localMap){
                if(sameContent(n,oldMap.get(id)))continue;
                const cloud=result.get(id),baseline=oldMap.get(id);
                if(isRecoveryCarrier(n)) {
                    const localTime=Date.parse(n.record.updatedAt||n.record.capturedAt)||0,remoteTime=Date.parse(cloud?.record?.updatedAt||cloud?.record?.capturedAt)||0;
                    if(!cloud||localTime>=remoteTime)result.set(id,n);continue;
                }
                if(id===CATEGORY_SYSTEM_ID){
                    const prior=new Map((baseline?.records||[]).map(item=>[item.id,item])),localItems=new Map((n.records||[]).map(item=>[item.id,item])),items=new Map((cloud?.records||[]).map(item=>[item.id,item]));
                    for(const[key,item]of localItems)if(!same(item,prior.get(key)))items.set(key,item);
                    for(const[key,item]of prior)if(!localItems.has(key)&&same(items.get(key),item))items.delete(key);
                    result.set(id,{...n,records:[...items.values()]});continue;
                }
                if(id===HISTORY_SYSTEM_ID){
                    const items=new Map((cloud?.records||[]).map(x=>[x.id,x]));for(const x of n.records||[])items.set(x.id,x);result.set(id,{...n,records:[...items.values()]});continue;
                }
                if(cloud&&!sameContent(cloud,baseline)&&!sameContent(cloud,n))preserveCloudVersion(cloud);
                // Keep the note's identity, links and open editor attached to the
                // same note. The alternative belongs in versions, not the list.
                result.set(id,n);
            }
            for(const[id,n]of oldMap)if(!localMap.has(id)&&sameContent(result.get(id),n))result.delete(id);
            if(conflicts)showPreviewModeToast('已保留目前筆記；另一份修改已存到「垃圾桶與版本 → 筆記版本」。');
            return [...result.values()];
        }
        function refreshUi() {
            try{updateCategoryUi();filterNotes({background:true});updateHistoryBadge();updatePreviewModeUi();viewError='';}
            catch(e){viewError='雲端資料已讀取，但畫面更新未完成。內容仍保留，可先下載備份再重整。';console.error('筆記畫面更新失敗：',e.name);}
        }
        async function protectUpgradeSnapshot() {
            if(!upgradePending)return null;
            const descriptors=chunkCloud.snapshotAssetDescriptors(tokenIds(workspace));
            const saved={workspace:structuredClone(workspace),base:structuredClone(base),draft:draft?structuredClone(draft):null,descriptors,createdAt:new Date().toISOString()};
            // Keep the complete previous local state before a fresh read can replace it.
            if(db){const prior=await request(db.transaction('state').objectStore('state').get('before-reader-sync-v3'));if(prior)return prior;const tx=db.transaction('state','readwrite'),done=transaction(tx);tx.objectStore('state').put(saved,'before-reader-sync-v3');await done;}
            else {const prior=localStorage.getItem(scope+':before-reader-sync-v3');if(prior)return JSON.parse(prior);localStorage.setItem(scope+':before-reader-sync-v3',JSON.stringify(saved));}
            return saved;
        }
        function preserveUpgradeDifferences(saved,remote,merged) {
            if(!saved)return merged;
            chunkCloud.restoreAssetDescriptors(saved.descriptors);
            const remoteMap=new Map(remote.map(note=>[note.id,note])),mergedMap=new Map(merged.map(note=>[note.id,note]));
            const categories=saved.workspace.find(note=>note.id===CATEGORY_SYSTEM_ID)?.records||[];
            let recovered=0;
            for(const note of saved.workspace){
                if(isRecoveryCarrier(note)){
                    const current=mergedMap.get(note.id);
                    if(!current||(Date.parse(note.record.updatedAt||note.record.capturedAt)||0)>(Date.parse(current.record.updatedAt||current.record.capturedAt)||0))mergedMap.set(note.id,note);
                    continue;
                }
                if(note.id===HISTORY_SYSTEM_ID||note.id===CATEGORY_SYSTEM_ID||sameNote(note,remoteMap.get(note.id)))continue;
                const id=uid(),now=new Date().toISOString();
                mergedMap.set(NOTE_RECOVERY_ID+':'+id,{id:NOTE_RECOVERY_ID+':'+id,_type:'system-recovery',record:{id,noteId:note.id,kind:'version',capturedAt:now,updatedAt:now,reason:'升級前本機內容與雲端不同，已保留供還原',snapshot:note,index:saved.workspace.indexOf(note),categories:categories.filter(category=>(note.categoryIds||[]).includes(category.id))}});
                recovered++;
            }
            upgradePending=false;
            if(recovered)showPreviewModeToast('已保留 '+recovered+' 份更新前本機差異，可從「垃圾桶與版本 → 筆記版本」還原。');
            return [...mergedMap.values()];
        }
        async function synchronize(forceRead=false) {
            if(running)return syncFinished;
            clearTimeout(syncTimer);clearTimeout(retryTimer);syncTimer=retryTimer=null;
            let finishSync;syncFinished=new Promise(resolve=>{finishSync=resolve;});
            running=true;status();
            try{
                if(!ready||forceRead){
                    cloudStage='讀取雲端筆記';status();
                    const upgrade=await protectUpgradeSnapshot();
                    const remote=await fetchBackend('GET',null,null,true);checkpoint();
                    const local=workspace,old=base,hadLocal=dirty;
                    normalizeLoadedData(remote);const remotePacked=packPayload();
                    const merged=preserveUpgradeDifferences(upgrade,remotePacked,hadLocal?merge(local,old,remotePacked):remotePacked);
                    normalizeLoadedData(merged);workspace=packPayload();base=remotePacked;ready=true;dirty=chunkCloud.needsMigration()||!same(workspace,base);loading=false;
                    cloudVerified=!dirty;if(cloudVerified){ackSeq=seq;lastCloudAt=new Date().toISOString();}
                    refreshUi();touch();
                }
                if(dirty){
                    const sent=workspace,sentSeq=seq,previous=base,payload=unpackPayload(sent);
                    cloudStage='整理圖片資料';status();originalUploadBytes=chunkCloud.isSupported()?0:new Blob([JSON.stringify(payload)]).size;
                    // 舊後端沒有分段能力時，先停止大包重送，不能把新協定物件寫入舊資料檔。
                    if(!chunkCloud.isSupported() && originalUploadBytes>4*1048576) await chunkCloud.legacyWrite(payload);
                    const compacted=chunkCloud.isSupported() ? {notes:payload} : await noteImageEditor.compactPayload(payload,{compressAll:false});
                    cloudStage='上傳筆記';status();await fetchBackend('POST',compacted.notes,chunkCloud.isSupported()?sent:null);
                    // 成功回覆後重新讀回；不能只因 HTTP 200 就清掉尚未寫入的圖片草稿。
                    cloudStage='確認雲端已保存內容';status();
                    const confirmed=await fetchBackend('GET',null,null,true),list=Array.isArray(confirmed)?confirmed:confirmed.notes;
                    const confirmedMap=new Map(list.map(n=>[n.id,packNote(n)])),oldMap=new Map(previous.map(n=>[n.id,n]));
                    const submitted=compacted.notes.map(packNote);
                    if(submitted.length!==confirmedMap.size||submitted.some(n=>!matchesStoredNote(n,confirmedMap.get(n.id)))||previous.some(n=>!sent.some(x=>x.id===n.id)&&confirmedMap.has(n.id)))throw new Error('雲端回覆成功，但重新讀取的內容尚未完整包含這次修改。本機草稿仍保留，沒有標示為同步完成。');
                    const sentMap=new Map(sent.map(n=>[n.id,n]));
                    // 讀回已確認的較小圖片格式，避免往後每次打字都重新編碼全部舊圖片。
                    // 正在輸入的新版本與筆記 DOM 保持原狀，既有游標、拖曳與復原不受影響。
                    workspace=workspace.map(n=>same(n,sentMap.get(n.id))?(confirmedMap.get(n.id)||n):n);
                    base=sent.map(n=>confirmedMap.get(n.id)||n);ackSeq=sentSeq;dirty=seq!==sentSeq;lastCloudAt=new Date().toISOString();firstDirtyAt=dirty?Date.now():0;
                    cloudVerified=!dirty;
                    normalizeLoadedData(workspace);refreshUi();touch();
                }
                cloudError='';retryCount=0;
            }catch(e){loading=false;cloudVerified=false;cloudError=(cloudStage?cloudStage+'失敗：':'')+e.message;ready=false;if(e.retryable!==false){const delay=Math.min(120000,5000*2**Math.min(retryCount++,5));retryTimer=setTimeout(()=>void synchronize(),delay);}}
            finally{running=false;cloudStage='';status();if(dirty&&!cloudError){clearTimeout(syncTimer);syncTimer=setTimeout(()=>void synchronize(),2200);}finishSync();}
        }
        async function flush(){
            capture();checkpoint();
            // An in-flight request may contain an older snapshot. Wait for it, then
            // persist the changes captured by this explicit save before returning.
            while(running)await syncFinished;
            if(dirty||!ready||!cloudVerified||cloudError)await synchronize();
        }
        async function restoreForm(savedDraft) {
            if(!savedDraft)return;
            savedDraft=noteSafeContent.note(savedDraft);
            if(savedDraft.original)savedDraft.original=noteSafeContent.note(savedDraft.original);
            await chunkCloud.ensureAssetIds(tokenIds(savedDraft));
            restoring=true;
            try{
                const original=savedDraft.original?unpackNote(savedDraft.original):null;
                if(!notesData.some(n=>n.id===savedDraft.id)&&original)notesData.push(original);
                if(notesData.some(n=>n.id===savedDraft.id))await openEditModal(savedDraft.id);else openAddModal();
                editingNoteId=notesData.some(n=>n.id===savedDraft.id)?savedDraft.id:null;
                $('note-title-input').value=savedDraft.title||'';$('modal-text').innerHTML=sanitizeNoteHtml(unpackHtml(savedDraft.text));
                currentPastedImages=(savedDraft.images||[]).map(resolveAsset);currentGalleryImageEdits=Object.fromEntries(Object.entries(savedDraft.galleryImageEdits||{}).map(([k,v])=>[k,typeof v==='string'?JSON.parse(resolveAsset(v)):structuredClone(v)]));pendingCategoryIds=savedDraft.categoryIds||[];
                renderPreviewGrid();prepareInlineImagesInEditor();prepareNoteTablesInEditor();prepareArrowNoteLists();
                editSession={id:savedDraft.id,isNew:savedDraft.isNew,createdAt:savedDraft.createdAt||new Date().toISOString(),original,historyRecorded:false};draft=savedDraft;
                const range=document.createRange();range.selectNodeContents($('modal-text'));range.collapse(false);setInlineImageRange(range);
                if(savedDraft.imageEditor){const recovered=unpackImageDraft(savedDraft.imageEditor);const target=recovered.gallery!=null?{gallery:recovered.gallery}:{image:$('modal-text').querySelectorAll('img[data-inline-image="1"]')[recovered.imageIndex]};if(target.image||target.gallery!=null)await noteImageEditor.open(target,recovered);}
                showPreviewModeToast('已還原上次尚未關閉的筆記草稿。');
            }finally{restoring=false;changed();}
        }
        async function start() {
            installUi();initialized=true;
            await chunkCloud.initializeCache();
            let record=null,tail=null;
            try{tail=JSON.parse(localStorage.getItem(tailKey)||'null');}catch(_){}
            try{await openDatabase();record=await request(db.transaction('state').objectStore('state').get('current'));}
            catch(e){dbError='瀏覽器無法使用大型圖片草稿空間；文字仍會嘗試保留，建議先下載備份。';}
            try{
                for(const[id,value]of Object.entries(tail?.assets||{})){assets.set(id,value);byValue.set(value,id);pendingAssets.set(id,value);}
                const restoreSource=tail&&tail.stamp>(record?.stamp||0)?tail:record;
                chunkCloud.rememberRemoteIds(tokenIds(restoreSource?.base||[]));
                chunkCloud.primeRecords(restoreSource?.base||[]);
                const draftIds=new Set(tokenIds([record?.draft,tail?.draft]));
                const ids=tokenIds([record,tail]).filter(id=>draftIds.has(id)||!chunkCloud.hasRemoteAsset(id));
                if(ids.length&&db){const tx=db.transaction('assets'),store=tx.objectStore('assets');await Promise.all(ids.map(async id=>{if(assets.has(id))return;const value=await request(store.get(id));if(value!=null){assets.set(id,value);byValue.set(value,id);}}));}
                const latest=tail&&tail.stamp>(record?.stamp||0)?tail:record;
                if(latest){workspace=latest.workspace||[];base=latest.base||[];upgradePending=latest.verificationVersion!==3&&workspace.length>0;dirty=!!latest.dirty;lastCloudAt=latest.lastCloudAt||'';lastContentAt=latest.lastContentAt||'';stamp=latest.stamp||0;durableStamp=record?.stamp||0;normalizeLoadedData(workspace);refreshUi();if(latest.draft)await restoreForm(latest.draft);}
            }catch(e){localError='部分本機備份無法完整讀取，請在同步狀態中下載備份，並檢查瀏覽器儲存空間。';}
            const noteModal=$('noteModal');
            noteModal.addEventListener('input',changed,true);noteModal.addEventListener('change',changed,true);
            // Selection, drag markers and preview decorations are not saved content.
            const transientClasses=new Set('image-selected inline-image-dragging controls-open note-table-dragging cell-selection-mode table-cell-selected table-cell-anchor table-active-cell note-editor-image-loading note-editor-image-error'.split(' '));
            const contentClasses=value=>(value||'').split(/\s+/).filter(name=>name&&!transientClasses.has(name)).sort().join(' ');
            const transientNode=node=>node.nodeType===Node.TEXT_NODE?!node.data.replace(/\u200B/g,''):node.nodeType===Node.ELEMENT_NODE&&node.matches('.inline-image-controls,.inline-drop-marker,.inline-annotation-overlay,.annotation-badge,.note-table-controls,.table-drop-marker,[data-selection-bookmark]');
            new MutationObserver(records=>{
                const relevant=records.some(record=>{
                    if(record.target.parentElement?.closest('.inline-image-controls,.note-table-controls,[data-selection-bookmark]'))return false;
                    if(record.type==='attributes'&&record.attributeName==='class')return contentClasses(record.oldValue)!==contentClasses(record.target.getAttribute('class'));
                    if(record.type==='childList')return [...record.addedNodes,...record.removedNodes].some(node=>!transientNode(node));
                    return true;
                });
                if(relevant)changed();
            }).observe($('modal-text'),{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['src','data-note-image-edit','style','class','colspan','rowspan']});
            new MutationObserver(changed).observe($('preview-grid'),{childList:true});
            window.addEventListener('online',()=>{cloudError='';void synchronize(true);});
            window.addEventListener('offline',()=>{cloudError='目前已離線，本機內容會保留；連線後自動重試。';status();});
            document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){capture();checkpoint();writeTail();void persist();}});
            window.addEventListener('pagehide',()=>{capture();writeTail();void persist();});
            window.addEventListener('beforeunload',event=>{capture();writeTail();if((editSession||dirty)&&!tailSafe&&durableStamp<stamp){event.preventDefault();event.returnValue='';}});
            void synchronize();status();
        }
        function downloadTextBackup() {
            capture();checkpoint();
            const payload={format:'pharmacy-notes-text-backup-v1',textOnly:true,book:noteDriveBoot.book,exportedAt:new Date().toISOString(),notes:notesData.map(note=>({id:note.id,title:note.title||'',text:notePlainText(note.text),categoryIds:getNoteCategoryIds(note),starred:!!note.starred})),draft:draft?{title:draft.title||'',text:notePlainText(draft.text)}:null};
            const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=document.title+'-純文字備份-'+localDateKey()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }
        async function downloadBackup() {
            const button=$('sync-backup');if(button.disabled)return;button.disabled=true;button.textContent='準備完整備份…';
            try{
                capture();const savedNotes=packPayload(),savedDraft=draft?structuredClone(draft):null;
                await chunkCloud.ensureAssetIds(tokenIds([savedNotes,savedDraft]));
                const payload={notes:unpackPayload(savedNotes),draft:savedDraft?{...savedDraft,text:unpackHtml(savedDraft.text),images:savedDraft.images.map(resolveAsset),galleryImageEdits:Object.fromEntries(Object.entries(savedDraft.galleryImageEdits||{}).map(([k,v])=>[k,JSON.parse(resolveAsset(v))])),original:savedDraft.original?unpackNote(savedDraft.original):null,imageEditor:unpackImageDraft(savedDraft.imageEditor)}:null,exportedAt:new Date().toISOString()};
                const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=document.title+'-備份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            }catch(error){alert('完整備份需要讀取尚未下載的圖片；目前未能全部讀取，沒有輸出缺圖備份。請連線後重試。');}
            finally{button.disabled=false;button.textContent='下載完整備份';}
        }
        async function waitForCloud(signal){
            noteDriveCheckSignal(signal);capture();checkpoint();
            while(running){noteDriveCheckSignal(signal);await new Promise(r=>setTimeout(r,80));}
            noteDriveCheckSignal(signal);if(dirty)await synchronize();noteDriveCheckSignal(signal);
            if(dirty||cloudError)throw new Error(cloudError||'目前仍有待同步修改，請先重試同步。');
        }
        async function importDriveData(data,{merge=false,legacy=false,signal}={}){
            noteDriveCheckSignal(signal);
            if(!ready||running)throw new Error('請先完成雲端連線，再匯入備份。');
            if(!merge&&(notesData.length||editHistory.length||categoryDefinitions.length))throw new Error('舊雲端搬移只可匯入空白科目；已有資料請改用 JSON 補入。');
            const packed=legacy&&Array.isArray(data?.packed),raw=packed?data.packed:(data?.notes||data),importedDraft=data?.draft;
            const validList=Array.isArray(raw)&&!raw.some(n=>!n||!['string','number'].includes(typeof n.id)||!String(n.id)||String(n.id).length>250)&&new Set(raw.map(n=>String(n.id))).size===raw.length;
            if(!validList)throw new Error('備份缺少有效的筆記清單，沒有寫入雲端。');
            if(!packed&&tokenIds([raw,importedDraft]).length)throw new Error('這份備份含有尚未下載的圖片參照；請回舊網站下載「完整備份」。');
            if(importedDraft&&(!['string','number'].includes(typeof importedDraft.id)||typeof importedDraft.text!=='string'))throw new Error('備份的未完成草稿格式不正確，沒有寫入雲端。');
            if(noteImageEditor.isOpen())throw new Error('請先套用或關閉目前的圖片編輯，再匯入備份。');
            if(data?.textOnly)throw new Error('這是純文字備份，適合閱讀與另存文字；請使用完整備份 JSON 還原圖片、格式與版本。');
            const before=packPayload();let incoming,draftCopy=null,draftId=null,draftTargetId=null;
            try{
                normalizeLoadedData(packed?unpackPayload(raw):Array.isArray(data)?raw:{...data,notes:raw});
                if(importedDraft){
                    const backup={...importedDraft,title:(importedDraft.title||'未命名筆記')+'（匯入的未完成草稿）',createdAt:importedDraft.createdAt||data?.exportedAt,categoryIds:importedDraft.categoryIds||[]};
                    delete backup.original;delete backup.isNew;delete backup.imageEditor;
                    draftCopy=packNote(backup);
                }
                incoming=packPayload();
            }finally{normalizeLoadedData(before);}
            const candidates=tokenIds([incoming,draftCopy]).map(id=>[id,assets.get(id)]).filter(([,value])=>typeof value==='string');
            const matched=await chunkCloud.matchBackupAssets(candidates,signal);noteDriveCheckSignal(signal);
            const rewrite=value=>JSON.parse(JSON.stringify(value).replace(/note-local-asset:([a-zA-Z0-9-]+)/g,(all,id)=>matched.aliases[id]?tokenPrefix+matched.aliases[id]:all));
            incoming=rewrite(incoming);if(draftCopy)draftCopy=rewrite(draftCopy);
            const canonical=note=>{
                const value=JSON.parse(JSON.stringify(note).replace(/note-local-asset:([a-zA-Z0-9-]+)/g,(all,id)=>matched.fingerprints[id]?'note-sha256:'+matched.fingerprints[id]:all));
                delete value.updatedAt;return stable(value);
            };
            const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
            if(draftCopy){draftId='imported-draft-'+(await digest(canonical(draftCopy))).slice(0,24);draftCopy.id=draftId;draftTargetId=draftId;incoming.splice(Math.max(0,incoming.length-2),0,draftCopy);}
            const result={added:0,unchanged:0,copies:0,recovered:matched.recovered};
            let next=incoming;
            if(merge){
                next=structuredClone(before);
                const categoryCarrier=list=>list.find(n=>n.id===CATEGORY_SYSTEM_ID),historyCarrier=list=>list.find(n=>n.id===HISTORY_SYSTEM_ID);
                const currentCategories=categoryCarrier(next),importedCategories=categoryCarrier(incoming),categoryMap=new Map((currentCategories?.records||[]).map(n=>[n.id,n])),categoryAliases=new Map();
                for(const item of importedCategories?.records||[]){
                    const current=categoryMap.get(item.id);
                    if(!current)categoryMap.set(item.id,item);
                    else if(current.name!==item.name){
                        const existing=[...categoryMap.values()].find(n=>n.name===item.name);
                        const id=existing?.id||'json-category-'+(await digest(stable(item))).slice(0,20);categoryAliases.set(item.id,id);if(!existing)categoryMap.set(id,{...item,id});
                    }
                }
                if(currentCategories)currentCategories.records=[...categoryMap.values()];
                const history=historyCarrier(next),historyMap=new Map((history?.records||[]).map(n=>[n.id,n]));
                for(const item of historyCarrier(incoming)?.records||[])if(!historyMap.has(item.id))historyMap.set(item.id,item);
                if(history)history.records=[...historyMap.values()];
                const byId=new Map(next.map(n=>[JSON.stringify(n.id),n]));
                for(const original of incoming){
                    if(original.id===CATEGORY_SYSTEM_ID||original.id===HISTORY_SYSTEM_ID)continue;
                    if(isRecoveryCarrier(original)){
                        const existing=next.find(n=>n.id===original.id);
                        if(!existing)next.push(original);
                        else if((Date.parse(original.record.updatedAt||original.record.capturedAt)||0)>(Date.parse(existing.record.updatedAt||existing.record.capturedAt)||0))next[next.indexOf(existing)]=original;
                        continue;
                    }
                    const note={...original,categoryIds:(original.categoryIds||[]).map(id=>categoryAliases.get(id)||id)},key=JSON.stringify(note.id),current=byId.get(key);
                    if(!current){next.push(note);byId.set(key,note);result.added++;continue;}
                    if(canonical(note)===canonical(current)){result.unchanged++;continue;}
                    const copyId='json-copy-'+(await digest(canonical(note))).slice(0,24);
                    if(note.id===draftId)draftTargetId=copyId;
                    if(byId.has(JSON.stringify(copyId))){result.unchanged++;continue;}
                    const copy={...note,id:copyId,title:(note.title||'未命名筆記')+'（JSON 備份副本）'};next.push(copy);byId.set(JSON.stringify(copyId),copy);result.copies++;
                }
            }else result.added=incoming.filter(n=>n.id!==CATEGORY_SYSTEM_ID&&n.id!==HISTORY_SYSTEM_ID&&!isRecoveryCarrier(n)).length;
            noteDriveCheckSignal(signal);
            normalizeLoadedData(next);workspace=packPayload();seq++;dirty=true;touch();refreshUi();await synchronize();
            if(cloudError||dirty)throw new Error(cloudError||'匯入資料尚未完全同步，本機草稿已保留。');
            if(importedDraft?.imageEditor){
                // Preserve unfinished annotations separately from the saved note.
                const copy={...importedDraft,id:draftTargetId,isNew:false,original:null};await restoreForm(copy);capture();await persist();
                showPreviewModeToast('筆記已匯入，另保留未完成的圖片編輯草稿；請套用後儲存。');
            }
            return {...result,remaining:chunkCloud.state().remaining};
        }

        return {refreshStatus:status,snapshot:note=>structuredClone(packNote(note)),restoreSnapshot:async note=>{await chunkCloud.ensureAssetIds(tokenIds(note));return noteSafeContent.note(unpackNote(structuredClone(note)));},hasOpenEditor:()=>!!editSession,resolveEditorValue,imageSearchIds,waitForCloud,importDriveData,hasUnsavedChanges:()=>dirty||editorPending||noteImageEditor.isOpen(),hasPendingCloud:()=>!cloudVerified||!ready||dirty||running||editorPending||capturePending||noteImageEditor.isOpen()||!!cloudError,refreshCloudImages:()=>refreshUi(),start,begin,changed,capture,closing,saveCurrent,queueSave,flush,packImages,resetRenderedImages,prepareRenderedImages,renderedImageSource,prepareNoteForEditing};
    })();



