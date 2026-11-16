/* Source: 70-workspace-and-pagination.js */
function initializeDriveWorkspace(){
    const boot=noteDriveBoot,select=document.getElementById('drive-book');
    for(const book of boot.books){const option=document.createElement('option');option.value=book.id;option.textContent=book.title;select.append(option);}
    select.value=boot.book;document.title=boot.title+'｜藥學筆記雲端工作台';
    const message=document.getElementById('drive-message'),migrate=document.getElementById('drive-migrate'),convert=document.getElementById('drive-convert'),importButton=document.getElementById('drive-import'),cancel=document.getElementById('drive-cancel');
    let active=null,resultText='';
    function update(){
        const state=window.noteDriveCloud?.state();if(!state)return;
        migrate.disabled=!!active||!state.loaded||state.records>0;
        importButton.disabled=!state.loaded||active?.kind==='json';
        importButton.textContent=active?.kind==='legacy'?'停止並改用 JSON 備份':state.records?'匯入 JSON 補圖／補筆記':'匯入完整備份 JSON';
        convert.hidden=!state.remaining;convert.disabled=!!active;
        cancel.hidden=!active||active.kind!=='legacy';select.disabled=!!active;
        if(!active)message.textContent=resultText||(!state.loaded?'正在連線到私人 Google Drive…':state.remaining?`文字已可閱讀。還有 ${state.remaining} 個舊圖片／畫記待搬移；也可直接匯入完整 JSON 補圖。`:state.records?'此科目已使用新版儲存。JSON 可補入新筆記；內容不同會保留備份副本。':'此科目是空白的。可從舊雲端搬移，或匯入舊網站下載的完整 JSON 備份。');
    }
    function stopLegacy(){
        if(active?.kind!=='legacy')return;
        active.controller.abort();cancel.disabled=true;
        message.textContent='正在停止舊搬移；已送出的保存會完成，之後可改用 JSON。';
    }
    function work(fn,kind='legacy'){
        if(active)return active.promise;
        const task={kind,controller:new AbortController(),promise:null};active=task;resultText='';cancel.disabled=false;
        const container=document.querySelector('.container');container.inert=true;update();
        task.promise=(async()=>{
            try{await notePersistence.waitForCloud(task.controller.signal);await fn(task.controller.signal);}
            catch(e){resultText=e.code==='CANCELLED'?'已停止舊雲端搬移；已保存的筆記與圖片會保留，可直接匯入 JSON 補圖。':e.message+' 已完成的內容會保留，可重試或改用完整 JSON 備份。';}
            finally{if(active===task){active=null;container.inert=false;cancel.disabled=false;update();}}
        })();return task.promise;
    }
    async function migrateImages(signal){
        noteDriveCheckSignal(signal);message.textContent='正在將舊原圖與畫記轉存為 Drive 檔案；可隨時停止並改用 JSON…';
        const result=await noteDriveCloud.migrateOriginals((done,total,failed)=>message.textContent=`已搬移 ${done}／${total} 個原圖／畫記${failed?`；${failed} 個讀取失敗，其他項目繼續保存`:''}。`,()=>signal.aborted,signal);
        noteDriveCheckSignal(signal);notePersistence.refreshCloudImages();
        resultText=result.failed?`已保留成功搬移的圖片；${result.failed} 個原圖／畫記讀取失敗。可直接匯入完整 JSON 補圖，或按「繼續搬移原圖」重試。${result.failures[0]?.message||''}`:result.remaining?`進度已保存，還有 ${result.remaining} 個原圖／畫記待搬移。`:'搬移完成。文字、原圖與畫記已保存至新版 Google Drive。';
    }
    migrate.onclick=()=>work(async signal=>{
        message.textContent='正在讀取舊雲端文字索引；可停止並改用 JSON 備份…';
        const snapshot=await noteDriveCloud.importLegacy(signal);noteDriveCheckSignal(signal);
        await notePersistence.importDriveData(snapshot,{legacy:true,signal});
        await migrateImages(signal);
    });
    convert.onclick=()=>work(migrateImages);
    cancel.onclick=stopLegacy;
    const input=document.getElementById('drive-file');
    importButton.onclick=()=>{stopLegacy();input.click();};
    input.onchange=async()=>{
        const file=input.files[0];input.value='';if(!file)return;
        while(active){if(active.kind==='json')return;stopLegacy();await active.promise;}
        void work(async signal=>{
            message.textContent='正在讀取完整 JSON，補入筆記與圖片；現有內容會保留…';let data;
            try{data=JSON.parse(await file.text());}catch(_){throw new Error('備份不是有效的 JSON。');}
            const result=await notePersistence.importDriveData(data,{merge:true,signal});
            resultText=`JSON 已同步：新增 ${result.added} 則、相同 ${result.unchanged} 則、差異保留副本 ${result.copies} 則，補回 ${result.recovered} 個原圖／畫記。`+(result.remaining?` 仍有 ${result.remaining} 個舊圖片參照未補齊；請使用含這些原圖的完整備份。`:' 目前沒有待搬移的舊圖片。');
        },'json');
    };
    select.onchange=async()=>{
        const next=select.value;select.disabled=true;document.getElementById('drive-open-book').hidden=true;
        await notePersistence.flush();
        if(notePersistence.hasPendingCloud()){message.textContent='這個科目仍有待同步內容，請先完成同步再切換。';select.value=boot.book;select.disabled=false;return;}
        // A normal web page can switch subjects directly (no Apps Script frame any more).
        location.href=boot.appUrl+'?book='+encodeURIComponent(next);
    };
    document.getElementById('drive-quota').onclick=async()=>{
        const button=document.getElementById('drive-quota');button.disabled=true;
        document.getElementById('drive-quota-text').textContent='正在讀取 Google 儲存空間…';
        try{const result=await noteDriveRpc('quota'),q=result.storageQuota||{},gb=n=>(Number(n)/1e9).toFixed(2)+' GB';document.getElementById('drive-quota-text').textContent='Google 儲存空間已使用 '+gb(q.usage||0)+(q.limit?'／'+gb(q.limit):'（帳號未回報容量上限）');}
        catch(e){document.getElementById('drive-quota-text').textContent=e.message;}
        finally{button.disabled=false;}
    };
    window.addEventListener('note-drive-state',update);update();
}

/* Pagination only changes the rendered slice. Every record stays in notesData and cloud storage. */
const noteBrowse=(()=>{
    const allowed=new Set([0,1,3,5,10,20]);
    let size=5,page=0,items=[],lastContext=null,pendingId=null,restored=false,initialized=false,saved={},storageKey='',printState=null,hold=null,scrollFrame=0,composing=false,scrollHold=null;
    const consumedClicks=new WeakMap();
    const el=id=>document.getElementById(id);
    const normalContext=()=>JSON.stringify(['',false,null,null]);
    function context(){return JSON.stringify([el('search-input').value.trim().toLowerCase(),!!isStarFilterActive,activeCategoryFilterId||null,randomDrawState.active?randomDrawState.selectedIds:null]);}
    const pageCount=()=>size?Math.max(1,Math.ceil(items.length/size)):1;
    const message=text=>{el('note-reader-message').textContent=text;el('note-reader-message').hidden=!text;};
    function remember(){
        saved={...saved,size};
        if(lastContext===normalContext()&&items.length)saved={size,page,anchorId:String(items[size?page*size:0]?.id??'')};
        try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_){}
    }
    function update(){
        const count=pageCount(),start=items.length?(size?page*size+1:1):0,end=size?Math.min(items.length,(page+1)*size):items.length;
        const filtered=lastContext!==null&&lastContext!==normalContext();
        const summary=lastContext===null?'正在讀取…':(filtered?'篩選 ':'')+start+'–'+end+'／'+items.length+' 則';
        el('note-page-summary').textContent=summary;el('note-page-summary').setAttribute('aria-live',hold?'off':'polite');
        el('note-page-size').title=summary+'；調整每頁筆記數';
        el('note-page-size').value=String(size);el('note-page-total').textContent='／'+count+' 頁';
        if(document.activeElement!==el('note-page-input'))el('note-page-input').value=String(page+1);
        el('note-page-input').disabled=!size||count<=1;
        el('note-page-first').disabled=el('note-page-prev').disabled=el('note-side-prev').disabled=page===0;
        el('note-page-last').disabled=el('note-page-next').disabled=el('note-side-next').disabled=page>=count-1;
        el('note-page-dock').hidden=!items.length;
        el('note-side-prev').hidden=el('note-side-next').hidden=!size||count<=1;
        document.body.classList.toggle('note-paging-docked',!el('note-page-dock').hidden);
        if(typeof noteSearchNavigation!=='undefined')noteSearchNavigation.layoutDock();
    }
    function select(list){
        if(printState)return list;
        const nextContext=context();
        if(lastContext!==null&&lastContext!==nextContext){page=0;message('');}
        lastContext=nextContext;items=list;
        if(!restored&&list.length){
            if(lastContext===normalContext()){
                const index=list.findIndex(note=>String(note.id)===saved.anchorId);
                page=size&&index>=0?Math.floor(index/size):(Number.isSafeInteger(saved.page)?saved.page:0);
            }
            restored=true;
        }
        if(pendingId!==null){const index=list.findIndex(note=>String(note.id)===pendingId);if(index>=0)page=size?Math.floor(index/size):0;pendingId=null;}
        page=Math.max(0,Math.min(page,pageCount()-1));update();
        return size?list.slice(page*size,(page+1)*size):list;
    }
    function scrollToStart(){
        cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{
            scrollFrame=0;
            const list=el('note-list'),inset=(document.querySelector('.top-bar')?.offsetHeight||0)+12;
            window.scrollTo({top:Math.max(0,scrollY+list.getBoundingClientRect().top-inset),behavior:'auto'});
            notePersistence.prepareRenderedImages(list);
        });
    }
    function go(index){
        if(document.querySelector('.container').inert||!size)return false;
        if(context()!==lastContext)filterNotes();
        const next=Math.max(0,Math.min(Number(index)||0,pageCount()-1));
        if(next===page)return false;
        savedNoteFocusSession++;page=next;message('');window.scrollTo(0,0);filterNotes();if(!hold)remember();scrollToStart();return true;
    }
    function typingTarget(node){return !!(node?.isContentEditable||node?.closest?.('input,textarea,select,[role="textbox"],[role="combobox"]'));}
    function readingAllowed(event,kind='page'){
        return (kind==='scroll'||!!size&&pageCount()>1)&&!printState&&!composing&&!document.hidden&&!document.querySelector('.container').inert
            &&!document.querySelector('.modal-overlay.active')&&!typingTarget(document.activeElement)&&!typingTarget(event?.target)
            &&!event?.isComposing&&event?.keyCode!==229&&!event?.altKey&&!event?.ctrlKey&&!event?.metaKey;
    }
    function stopHold(){
        if(!hold)return;const previous=hold;hold=null;clearTimeout(previous.timer);
        if(previous.button){delete previous.button.dataset.holding;consumedClicks.set(previous.button,performance.now()+500);}
        remember();update();
        if(!document.hidden&&!printState&&!document.querySelector('.container').inert)notePersistence.prepareRenderedImages(el('note-list'));
    }
    function startHold(direction,source){
        stopScroll();stopHold();if(!readingAllowed())return;
        const session=hold={...source,direction,started:performance.now(),timer:0};
        if(session.button)session.button.dataset.holding='true';
        if(!go(page+direction)){stopHold();return;}
        function repeat(){
            if(hold!==session)return;
            if(!readingAllowed()||!go(page+direction)){stopHold();return;}
            if(page===0||page===pageCount()-1){stopHold();return;}
            session.timer=setTimeout(repeat,performance.now()-session.started>1100?45:90);
        }
        if(page===0||page===pageCount()-1){stopHold();return;}
        session.timer=setTimeout(repeat,270);
    }
    function stopScroll(){if(!scrollHold)return;const previous=scrollHold;scrollHold=null;cancelAnimationFrame(previous.frame);}
    function startScroll(direction,source){
        stopHold();if(!readingAllowed(null,'scroll')){stopScroll();return;}
        savedNoteFocusSession++;
        const now=performance.now(),limit=Math.max(0,document.scrollingElement.scrollHeight-innerHeight);
        // Repeated taps share their destination and velocity instead of restarting an animation.
        if(scrollHold&&!scrollHold.down&&!scrollHold.continuous){
            Object.assign(scrollHold,source,{direction,down:true,started:now,target:Math.max(0,Math.min(limit,scrollHold.target+direction*120))});
            return;
        }
        stopScroll();
        const position=scrollY,target=Math.max(0,Math.min(limit,position+direction*120));if(target===position)return;
        const session=scrollHold={...source,direction,down:true,continuous:false,started:now,last:now,frame:0,position,target,velocity:0,applied:position};
        function tick(now){
            if(scrollHold!==session)return;
            if(!readingAllowed(null,'scroll')){stopScroll();return;}
            const dt=Math.max(0,Math.min(40,now-session.last));session.last=now;
            const shift=scrollY-session.applied;
            if(Math.abs(shift)>1){session.position+=shift;session.target+=shift;}
            const max=Math.max(0,document.scrollingElement.scrollHeight-innerHeight);
            session.target=Math.max(0,Math.min(max,session.target));
            if(session.down&&now-session.started>=120)session.continuous=true;
            if(session.continuous){
                // Carry the tap's velocity into the held motion, without a stationary gap.
                const speed=session.direction*1.8,decay=Math.exp(-dt/60);
                session.position+=speed*dt+(session.velocity-speed)*60*(1-decay);
                session.velocity=speed+(session.velocity-speed)*decay;
            }else{
                // Critically damped motion reaches each 120px target without overshoot.
                const spring=.032,offset=session.position-session.target,c=session.velocity+spring*offset,decay=Math.exp(-spring*dt);
                session.position=session.target+(offset+c*dt)*decay;
                session.velocity=(session.velocity-spring*c*dt)*decay;
            }
            session.position=Math.max(0,Math.min(max,session.position));
            window.scrollTo({top:session.position,behavior:'instant'});session.applied=scrollY;
            if((session.direction<0&&session.position<=0)||(session.direction>0&&session.position>=max)){stopScroll();return;}
            if(!session.down&&!session.continuous&&Math.abs(session.position-session.target)<.25&&Math.abs(session.velocity)<.01){
                window.scrollTo({top:session.target,behavior:'instant'});stopScroll();return;
            }
            session.frame=requestAnimationFrame(tick);
        }
        session.frame=requestAnimationFrame(tick);
    }
    function releaseScroll(code){
        if(scrollHold?.code!==code)return;
        scrollHold.down=false;
        // A quick tap finishes its small eased step; a held scroll stops on release.
        if(scrollHold.continuous)stopScroll();
    }
    function stopReadingMotion(){stopScroll();stopHold();}
    function bindHold(button){
        const direction=Number(button.dataset.notePageHold);
        button.addEventListener('pointerdown',event=>{
            if(event.button!==0||event.isPrimary===false||button.disabled)return;
            event.preventDefault();button.focus({preventScroll:true});
            consumedClicks.set(button,performance.now()+60000);
            startHold(direction,{source:'pointer',id:event.pointerId,button});
            if(hold?.button===button)try{button.setPointerCapture(event.pointerId);}catch(_){}
        });
        button.addEventListener('click',event=>{
            if(event.detail>0&&performance.now()<(consumedClicks.get(button)||0)){event.preventDefault();return;}
            stopHold();if(readingAllowed())go(page+direction);
        });
        button.addEventListener('contextmenu',event=>event.preventDefault());
        button.addEventListener('lostpointercapture',()=>{if(hold?.button===button)stopHold();});
    }
    function requestReveal(id){pendingId=String(id);}
    function reveal(id){
        const index=items.findIndex(note=>String(note.id)===String(id));if(index<0)return false;
        const next=size?Math.floor(index/size):0;if(next!==page){page=next;renderNotes(items);remember();}
        return true;
    }
    function integer(value){const text=String(value).normalize('NFKC').trim(),n=Number(text);return /^[0-9]+$/.test(text)&&Number.isSafeInteger(n)&&n>0?n:null;}
    function initialize(){
        if(initialized)return;initialized=true;
        let hash=2166136261;for(const c of (noteDriveBoot.workspace||noteDriveBoot.appUrl||SCRIPT_URL))hash=Math.imul(hash^c.charCodeAt(0),16777619);
        storageKey='pharmacy-note-reading-v1-'+noteDriveBoot.book+'-'+(hash>>>0).toString(36);
        try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};if(allowed.has(saved.size))size=saved.size;}catch(_){saved={};}
        const search=el('search-input');search.enterKeyHint='search';
        search.addEventListener('keydown',event=>{
            if(event.key!=='Enter'||event.repeat||event.isComposing||composing||(event.keyCode||event.which)===229||event.altKey||event.ctrlKey||event.metaKey)return;
            event.preventDefault();event.stopPropagation();
            clearTimeout(searchRenderTimer);searchRenderTimer=null;savedNoteFocusSession++;
            filterNotes({background:true});
            search.blur();document.body.focus({preventScroll:true});
        });
        el('note-page-size').value=String(size);
        el('note-page-size').addEventListener('change',()=>{
            stopReadingMotion();
            const anchor=items[size?page*size:0]?.id,value=Number(el('note-page-size').value);if(!allowed.has(value))return;
            size=value;page=0;if(anchor!=null)requestReveal(anchor);savedNoteFocusSession++;filterNotes();remember();
            if(anchor!=null)focusSavedNoteAfterSave(anchor);else scrollToStart();
        });
        el('note-page-first').onclick=()=>{stopReadingMotion();go(0);};el('note-page-last').onclick=()=>{stopReadingMotion();go(pageCount()-1);};
        document.querySelectorAll('[data-note-page-hold]').forEach(bindHold);
        window.addEventListener('keydown',event=>{
            const key=event.key?.toLowerCase();
            if(event.altKey||event.ctrlKey||event.metaKey)stopScroll();
            if(!['a','d','w','s'].includes(key)){if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape'].includes(event.key))stopScroll();return;}
            const scrolling=key==='w'||key==='s';
            if(!readingAllowed(event,scrolling?'scroll':'page')){stopReadingMotion();return;}
            event.preventDefault();event.stopPropagation();if(event.repeat)return;
            if(scrolling)startScroll(key==='w'?-1:1,{code:event.code||key});
            else startHold(key==='a'?-1:1,{source:'keyboard',code:event.code||key});
        },true);
        window.addEventListener('keyup',event=>{const code=event.code||event.key?.toLowerCase();if(hold?.source==='keyboard'&&code===hold.code)stopHold();releaseScroll(code);},true);
        document.addEventListener('pointerup',event=>{if(hold?.source==='pointer'&&hold.id===event.pointerId)stopHold();},true);
        document.addEventListener('pointercancel',stopReadingMotion,true);
        document.addEventListener('pointermove',event=>{
            if(hold?.source!=='pointer'||hold.id!==event.pointerId)return;const r=hold.button.getBoundingClientRect(),pad=18;
            if(event.clientX<r.left-pad||event.clientX>r.right+pad||event.clientY<r.top-pad||event.clientY>r.bottom+pad)stopHold();
        },{passive:true});
        document.addEventListener('pointerdown',event=>{stopScroll();if(!event.target.closest?.('[data-note-page-hold]'))stopHold();},true);
        document.addEventListener('focusin',event=>{if(typingTarget(event.target))stopReadingMotion();});
        document.addEventListener('compositionstart',()=>{composing=true;stopReadingMotion();},true);
        document.addEventListener('compositionend',()=>{composing=false;},true);
        window.addEventListener('blur',stopReadingMotion);window.addEventListener('pagehide',stopReadingMotion);
        window.addEventListener('wheel',stopScroll,{passive:true});window.addEventListener('touchstart',stopScroll,{passive:true});
        document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReadingMotion();});
        function goToInputPage(){
            const n=integer(el('note-page-input').value);
            if(!n||n>pageCount()){update();message('請輸入 1 到 '+pageCount()+' 之間的頁碼。');return;}
            go(n-1);update();
        }
        el('note-page-input').addEventListener('change',goToInputPage);
        el('note-page-jump').addEventListener('submit',event=>{event.preventDefault();el('note-page-input').blur();goToInputPage();});
        window.addEventListener('beforeprint',()=>{
            stopReadingMotion();if(printState)return;printState={page,x:scrollX,y:scrollY};filterNotes();
        });
        window.addEventListener('afterprint',()=>{
            if(!printState)return;const previous=printState;printState=null;page=previous.page;filterNotes();
            requestAnimationFrame(()=>scrollTo(previous.x,previous.y));
        });
        // The Apps Script page lives in an iframe. Give the reading surface keyboard focus on startup.
        if(!document.body.hasAttribute('tabindex'))document.body.tabIndex=-1;
        if(document.activeElement===document.body)document.body.focus({preventScroll:true});
        update();
    }
    function adjacentImageIds(){
        if(!size||!items.length)return[];
        const nearby=[...items.slice((page+1)*size,(page+2)*size),...items.slice(Math.max(0,(page-1)*size),page*size)];
        const ids=new Set();for(const note of nearby){
            // Packed HTML can also contain annotation ids; only ids with preview descriptors are fetched.
            for(const match of JSON.stringify(note).matchAll(/note-local-asset:([a-zA-Z0-9-]+)/g)){ids.add(match[1]);if(ids.size>=48)return[...ids];}
        }
        return[...ids];
    }
    return {initialize,select,requestReveal,reveal,adjacentImageIds,isFlipping:()=>!!hold,bottomInset:()=>{const dock=el('note-reader-dock')||el('note-page-dock');return dock&&!dock.hidden?dock.offsetHeight+24:18;},state:()=>({size,page,count:pageCount(),total:items.length})};
})();

/* Background search updates keep existing rows, decoded images and the reader's viewport. */
const noteSearchViewport=(()=>{
    const signatures=new WeakMap();let renderedContext=null;
    const context=()=>JSON.stringify([document.getElementById('search-input').value.trim().toLowerCase(),!!isStarFilterActive,activeCategoryFilterId||null,randomDrawState.active?randomDrawState.selectedIds:null]);
    function signature(note,index){
        const images=Array.isArray(note.images)&&note.images.length?note.images:note.image?[note.image]:[];
        return JSON.stringify([index,note.title||'',note.text||'',images,!!note.starred,getNoteCategoryIds(note).map(id=>getCategoryById(id)||null)]);
    }
    function filterOptions(options={}){
        // A newly typed query or explicit filter change still follows the normal first-page behavior.
        if(!options.background||renderedContext!==context())return {background:false};
        const anchor=noteBrowse.isFlipping()||document.querySelector('.modal-overlay.active')?null:capturePreviewViewportAnchor();
        if(anchor?.noteId)noteBrowse.requestReveal(anchor.noteId);
        return {background:true,anchor};
    }
    function begin(list,notes,options){
        const indices=new Map(notesData.map((note,index)=>[String(note.id),index]));
        const rows=notes.map(note=>({id:String(note.id),signature:signature(note,indices.get(String(note.id))??0)}));
        const current=[...list.children],byId=new Map(current.map(node=>[node.dataset.id,node]));
        const unchanged=!!options.background&&current.length===rows.length&&rows.every((row,index)=>current[index].dataset.id===row.id&&signatures.get(current[index])===row.signature);
        const update={list,rows:new Map(rows.map(row=>[row.id,row])),byId,nodes:[],background:!!options.background,anchor:options.anchor,unchanged};
        renderedContext=context();return update;
    }
    function reuse(update,note){
        if(!update.background)return null;
        const id=String(note.id),node=update.byId.get(id);
        if(node&&signatures.get(node)===update.rows.get(id)?.signature){update.nodes.push(node);return node;}
        return null;
    }
    function add(update,note,node){signatures.set(node,update.rows.get(String(note.id)).signature);update.nodes.push(node);}
    function commit(update){
        const {list,nodes,anchor}=update;
        if(!update.background){const fragment=document.createDocumentFragment();for(const node of nodes)fragment.appendChild(node);list.replaceChildren(fragment);return;}
        // Never detach unchanged rows into a fragment: that discards cached layout and image state.
        const wanted=new Set(nodes);
        for(const node of [...list.children])if(!wanted.has(node))node.remove();
        let cursor=list.firstElementChild;
        for(const node of nodes){if(node===cursor)cursor=cursor.nextElementSibling;else list.insertBefore(node,cursor);}
        if(!anchor)return;
        const node=nodes.find(node=>node.dataset.id===anchor.noteId);
        if(node&&Number.isFinite(anchor.noteTop)){
            const delta=node.getBoundingClientRect().top-anchor.noteTop;
            if(Math.abs(delta)>.5)window.scrollTo({left:anchor.scrollX,top:window.scrollY+delta,behavior:'instant'});
        }else if(Math.abs(window.scrollY-anchor.scrollY)>.5){
            window.scrollTo({left:anchor.scrollX,top:anchor.scrollY,behavior:'instant'});
        }
        // Position correction is synchronous. No delayed timer can pull the reader back after scrolling.
    }
    // Manual reading cancels a saved-note positioning request even before its first animation frame.
    window.addEventListener('wheel',()=>{savedNoteFocusSession++;},{passive:true});
    window.addEventListener('touchstart',()=>{savedNoteFocusSession++;},{passive:true});
    return {filterOptions,begin,reuse,add,commit};
})();

/* Canonical asset references stay in src/metadata; srcset is a disposable display preview. */
const noteInstantEditor=(()=>{
    const prefix='note-local-asset:',pending=new WeakMap();let initialized=false;
    const placeholder='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#edf2ef"/></svg>');
    const isToken=value=>typeof value==='string'&&value.startsWith(prefix);
    function clean(clone){
        for(const image of clone.querySelectorAll('img[data-note-editor-dimensions]')){image.removeAttribute('width');image.removeAttribute('height');image.removeAttribute('data-note-editor-dimensions');}
        for(const image of clone.querySelectorAll('img[data-note-editor-preview]')){
            image.removeAttribute('srcset');image.removeAttribute('data-note-editor-preview');
            image.classList.remove('note-editor-image-loading','note-editor-image-error');
            image.removeAttribute('title');
        }
    }
    function decorate(image){
        const source=image.getAttribute('src')||'';if(!isToken(source))return;
        const id=source.slice(prefix.length);if(pending.get(image)===id)return;pending.set(image,id);
        const d=window.noteDriveCloud?.dimensions(id)||{};
        if(d.width&&d.height&&!image.hasAttribute('width')&&!image.hasAttribute('height')){image.width=d.width;image.height=d.height;image.dataset.noteEditorDimensions='1';}
        image.dataset.noteEditorPreview=id;image.srcset=(window.noteDriveCloud?.peekPreview(id)||placeholder)+' 1x';
        image.classList.add('note-editor-image-loading');image.title='圖片預覽在背景載入，現在可以編輯文字。';
        const job=window.noteDriveCloud?.hasRemoteAsset(id)?window.noteDriveCloud.ensurePreview(id):notePersistence.resolveEditorValue(source);
        Promise.resolve(job).then(value=>{
            if(!image.isConnected||image.getAttribute('src')!==source)return;
            image.srcset=value+' 1x';image.classList.remove('note-editor-image-loading','note-editor-image-error');image.title='放大或畫記時讀取這張原圖。';
        }).catch(()=>{if(image.isConnected&&image.getAttribute('src')===source){image.classList.remove('note-editor-image-loading');image.classList.add('note-editor-image-error');image.title='預覽暫時無法讀取；原圖與畫記保留，可稍後開啟這張圖片重試。';pending.delete(image);}});
    }
    function prepare(){document.getElementById('modal-text')?.querySelectorAll('img').forEach(decorate);}
    function prepareGallery(){document.getElementById('preview-grid')?.querySelectorAll('img').forEach(decorate);}
    async function resolveGallery(index){
        const source=currentPastedImages[index],request=noteOpenRequest;
        if(!source)return false;
        const full=await notePersistence.resolveEditorValue(source),key=noteImageEditor.galleryKey(full),metadata=currentGalleryImageEdits[key];
        const resolved=isToken(metadata)?JSON.parse(await notePersistence.resolveEditorValue(metadata)):metadata;
        if(request!==noteOpenRequest||currentPastedImages[index]!==source||!document.getElementById('noteModal').classList.contains('active'))return false;
        currentPastedImages[index]=full;if(resolved)currentGalleryImageEdits[key]=resolved;
        renderPreviewGrid();return true;
    }
    function initialize(){
        if(initialized)return;initialized=true;
        const editor=document.getElementById('modal-text');new MutationObserver(records=>{
            for(const record of records)for(const node of record.addedNodes){
                if(node.nodeType!==Node.ELEMENT_NODE)continue;
                if(node.matches('img'))decorate(node);node.querySelectorAll('img').forEach(decorate);
            }
        }).observe(editor,{childList:true,subtree:true});
        const originalGalleryData=noteImageEditor.galleryData;
        noteImageEditor.galleryData=()=>currentPastedImages.some(isToken)?{...currentGalleryImageEdits}:originalGalleryData();
        const originalOpen=noteImageEditor.open;
        noteImageEditor.open=async(target,recoveredDraft=null)=>{
            const request=noteOpenRequest;
            try{
                if(target.image){
                    const image=inlineImageNode(target.image),source=image?.getAttribute('src')||'',metadata=image?.getAttribute('data-note-image-edit');
                    const [full,edit]=await Promise.all([notePersistence.resolveEditorValue(source),isToken(metadata)?notePersistence.resolveEditorValue(metadata):metadata]);
                    if(request!==noteOpenRequest||!image?.isConnected||image.getAttribute('src')!==source||!document.getElementById('noteModal').classList.contains('active'))return;
                    image.src=full;image.removeAttribute('srcset');image.removeAttribute('data-note-editor-preview');image.classList.remove('note-editor-image-loading','note-editor-image-error');
                    if(edit)image.setAttribute('data-note-image-edit',edit);target={...target,image};
                }else if(target.gallery!=null&&!await resolveGallery(target.gallery))return;
                if(request===noteOpenRequest)return originalOpen(target,recoveredDraft);
            }catch(_){showPreviewModeToast('這張原圖尚未讀取完成；文字仍可編輯，原圖與畫記保留。');}
        };
        const originalMove=window.moveGalleryImageInline;
        window.moveGalleryImageInline=async index=>{try{if(await resolveGallery(index))originalMove(index);}catch(_){showPreviewModeToast('這張圖片尚未讀取完成，請稍後再移入文字；原圖仍保留。');}};
    }
    return {initialize,prepare,prepareGallery,clean};
})();


