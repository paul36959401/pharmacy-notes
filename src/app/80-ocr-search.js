/* Source: 80-ocr-search.js */
/* OCR is derived, resumable and low priority. It never enters a note revision. */
const noteImageSearch=(()=>{
    const engine='drive-ocr-auto-v2',holdCodes=['OCR_QUOTA','OCR_REQUEST','OCR_PERMISSION'];
    const entries=new Map(),assets=new Map(),noteCache=new WeakMap(),checked=new Set(),localRead=new Set(),failed=new Map(),holds=new Map();let assetVersion=0;
    const scope='note-ocr-v1-'+(noteDriveBoot.workspace||noteDriveBoot.appUrl)+'-'+noteDriveBoot.book;
    const cache=createNoteReadCache(scope);let started=false,paused=false,timer=null,busy=false,indexReady=false,indexError='',noticeTimer=null,refreshTimer=null,renderCache=null,force=false,holdUntil=0,idleUntil=0;
    const activeEditor=()=>!!document.querySelector('.modal-overlay.active');
    const canWork=()=>!paused&&Date.now()>=idleUntil&&(force||Date.now()>=holdUntil)&&!document.hidden&&navigator.onLine!==false&&!activeEditor()&&!window.noteDriveCloud?.isBusy();
    function refreshHold(){holdUntil=Math.max(0,...[...holds].filter(([key])=>assets.has(key)).map(([,until])=>until));}
    function schedule(delay=1500){clearTimeout(timer);timer=setTimeout(()=>void pump(),delay);}
    function publish(){
        renderStatus();clearTimeout(noticeTimer);
        function refreshResults(){
            if(Date.now()<idleUntil||noteBrowse.isFlipping()){noticeTimer=setTimeout(refreshResults,350);return;}
            if(document.getElementById('search-input').value.trim()&&!activeEditor())filterNotes({background:true});
        }
        noticeTimer=setTimeout(refreshResults,180);
    }
    function setEntry(key,entry){
        if(!entry.complete&&entry.engine!==engine&&['OCR_SERVICE','OCR_REQUEST','OCR_PERMISSION'].includes(entry.code)){
            entry={...entry,engine};for(const name of ['error','code','retryAfter','diagnostic'])delete entry[name];
        }
        if(!entry.complete&&holdCodes.includes(entry.code))holds.set(key,entry.retryAfter||0);else holds.delete(key);
        refreshHold();entries.set(key,entry);return entry;
    }
    async function remember(key,entry){entry=setEntry(key,entry);await cache.put([['entry:'+key,entry]]);publish();}
    function errorDetails(){
        const entry=[...assets.keys()].map(key=>entries.get(key)).find(entry=>entry?.error),d=entry?.diagnostic;
        return ['圖片文字辨識錯誤','網站版本：'+(noteDriveBoot.release||'未知'),entry?.error||indexError||[...failed.values()].find(value=>value.message)?.message||'',d?'階段：'+d.stage+'\nHTTP：'+d.status+'\n原因：'+(d.reasons||[]).join(', ')+'\n欄位：'+((d.fields||[]).join(', ')||'Google 未指定'):'', '筆記與原圖儲存不受辨識失敗影響；可按「重試辨識」接續。'].filter(Boolean).join('\n\n');
    }
    function keysFor(note){
        const saved=noteCache.get(note);if(saved?.version===assetVersion)return saved.keys;
        const keys=[...new Set(notePersistence.imageSearchIds(note).map(id=>window.noteDriveCloud.assetDescriptor(id)?.file?.key).filter(Boolean))];
        noteCache.set(note,{version:assetVersion,keys});return keys;
    }
    function refresh(){
        if(!started)return;
        assets.clear();assetVersion++;
        for(const note of notesData){
            const keys=[];for(const id of notePersistence.imageSearchIds(note)){
                const d=window.noteDriveCloud.assetDescriptor(id);if(!d?.file)continue;
                const key=d.file.key;if(!assets.has(key))assets.set(key,{id,descriptor:d});keys.push(key);
            }
            noteCache.set(note,{version:assetVersion,keys:[...new Set(keys)]});
        }
        refreshHold();publish();schedule(1500);
    }
    let statusSeenWork=false,statusQuiet=false,statusHideTimer=0;
    function renderStatus(){
        const root=document.getElementById('note-image-search-status');if(!root)return;
        const list=[...assets.keys()],done=list.filter(key=>entries.get(key)?.complete).length;
        // Show the line only while pictures are still being read; when everything is done, it
        // says so for a few seconds and then hides (nothing shown if all was already done).
        if(done<list.length&&!indexReady&&!statusSeenWork)statusQuiet=true;   // still reading saved results: nothing to report yet
        else if(done<list.length){statusSeenWork=true;clearTimeout(statusHideTimer);statusHideTimer=0;statusQuiet=false;}
        else if(!statusSeenWork)statusQuiet=true;
        else if(!statusHideTimer&&!statusQuiet)statusHideTimer=setTimeout(()=>{statusQuiet=true;statusHideTimer=0;renderStatus();},4000);
        root.hidden=!assets.size||statusQuiet;
        const errored=list.map(key=>entries.get(key)?.error||failed.get(key)?.message).find(Boolean)||indexError,httpError=list.map(key=>entries.get(key)?.diagnostic?.status).find(Boolean);
        const text=done===list.length?'圖片文字已可搜尋：'+done+' 張':paused?'圖片文字辨識已暫停：'+done+'／'+list.length+' 張':errored?(httpError?'圖片文字辨識遇到 '+httpError+'：':'圖片文字辨識稍後接續：')+done+'／'+list.length+' 張':'正在背景建立圖片文字索引：'+done+'／'+list.length+' 張；現在可搜尋已完成的圖片。';
        root.querySelector('span').textContent=text;root.title=errored||'只辨識新圖片，結果會保存在 Drive；原圖、畫記與筆記不會被改寫。';
        const pause=root.querySelector('[data-ocr-pause]');pause.hidden=done===list.length;pause.textContent=paused?'繼續辨識':'暫停';
        root.querySelector('[data-ocr-retry]').hidden=!errored;
        root.querySelector('[data-ocr-details]').hidden=!errored;
    }
    async function loadIndex(){
        const keys=[...assets.keys()].filter(key=>!checked.has(key));if(!keys.length){indexReady=true;return;}
        const localKeys=keys.filter(key=>!localRead.has(key));
        for(let i=0;i<localKeys.length;i+=64){const group=localKeys.slice(i,i+64),values=await Promise.all(group.map(key=>cache.get('entry:'+key)));group.forEach((key,n)=>{localRead.add(key);if(values[n])setEntry(key,values[n]);});}
        publish();
        if(document.hidden||navigator.onLine===false)return;
        for(let i=0;i<keys.length;i+=2000){
            const group=keys.slice(i,i+2000),result=await noteDriveRpc('ocrIndex',{keys:group},noteDriveBoot.book,undefined,20);
            const saved=Object.entries(result.entries||{}).map(([key,entry])=>[key,setEntry(key,entry)]);if(saved.length)await cache.put(saved.map(([key,entry])=>['entry:'+key,entry]));publish();
            group.forEach(key=>checked.add(key));
        }
        indexReady=true;indexError='';
    }
    async function tile(item,entry){
        const d=item.descriptor;
        if(d.kind==='data-url'&&['image/jpeg','image/png','image/gif','image/bmp'].includes(d.file.mime)&&d.file.bytes<=2000000)return {index:0,total:1};
        if(renderCache?.key!==d.file.key){
            const source=await window.noteDriveCloud.ensureAsset(item.id,undefined,20),image=new Image();image.src=source;await noteImageReady(image);
            const cols=Math.max(1,Math.ceil((image.naturalWidth-64)/1936)),rows=Math.max(1,Math.ceil((image.naturalHeight-64)/1936));
            if(cols*rows>64)throw new Error('這張圖片過長，暫時無法建立完整文字索引；原圖仍可閱讀與編輯。');
            if(renderCache)renderCache.image.src='';renderCache={key:d.file.key,image,cols,rows};
        }
        const {image,cols,rows}=renderCache,total=cols*rows;
        const index=Array.from({length:total},(_,i)=>i).find(i=>!Object.prototype.hasOwnProperty.call(entry?.parts||{},String(i)));
        if(index==null)return null;
        const x=index%cols*1936,y=Math.floor(index/cols)*1936,w=Math.min(2000,image.naturalWidth-x),h=Math.min(2000,image.naturalHeight-y);
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,w,h);context.drawImage(image,x,y,w,h,0,0,w,h);
        let blob;for(const quality of [.92,.82,.68]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=2000000)break;}
        canvas.width=canvas.height=1;if(!blob||blob.size>2000000)throw new Error('這張圖片的辨識分區過大，稍後可重試。');
        const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
        return {index,total,mime:'image/jpeg',data:btoa(binary)};
    }
    async function pump(){
        timer=null;if(busy)return;busy=true;
        try{
            if(!indexReady||[...assets.keys()].some(key=>!checked.has(key)))await loadIndex();
            if(!canWork())return;
            const key=[...assets.keys()].find(key=>!entries.get(key)?.complete&&(force||Math.max(entries.get(key)?.retryAfter||0,failed.get(key)?.until||0)<=Date.now()));
            if(!key)return;
            const item=assets.get(key),entry=entries.get(key),part=await tile(item,entry);
            if(!part||!canWork())return;
            const result=await noteDriveRpc('ocrRecognize',{file:item.descriptor.file,part,force},noteDriveBoot.book,undefined,20);force=false;
            if(result.entry)await remember(key,result.entry);
            if(result.pending)failed.set(key,{until:result.retryAfter||Date.now()+30000,message:'另一個視窗正在辨識，完成後會接續。'});else failed.delete(key);
        }catch(error){
            indexError=String(error.message||error);
            const key=renderCache?.key;if(key)failed.set(key,{until:Date.now()+60000,message:indexError});
        }finally{busy=false;if(renderCache&&(!canWork()||entries.get(renderCache.key)?.complete)){renderCache.image.src='';renderCache=null;}renderStatus();if([...assets.keys()].some(key=>!entries.get(key)?.complete))schedule(indexError||holdUntil>Date.now()?30000:1800);}
    }
    function start(){
        if(started)return;started=true;try{paused=localStorage.getItem(scope+':paused')==='1';}catch(_){}
        const status=document.createElement('div');status.id='note-image-search-status';status.hidden=true;
        status.innerHTML='<span role="status" aria-live="polite"></span><button type="button" data-ocr-pause>暫停</button><button type="button" data-ocr-details hidden>錯誤內容</button><button type="button" data-ocr-retry hidden>重試辨識</button>';
        document.querySelector('.top-bar').after(status);
        status.querySelector('[data-ocr-pause]').onclick=()=>{paused=!paused;try{localStorage.setItem(scope+':paused',paused?'1':'0');}catch(_){}renderStatus();if(!paused)schedule(100);};
        status.querySelector('[data-ocr-retry]').onclick=()=>{indexError='';failed.clear();holds.clear();force=true;holdUntil=0;paused=false;try{localStorage.setItem(scope+':paused','0');}catch(_){}schedule(100);};
        status.querySelector('[data-ocr-details]').onclick=()=>alert(errorDetails());
        window.addEventListener('note-drive-state',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,350);});
        document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(300);});window.addEventListener('online',()=>schedule(300));
        window.addEventListener('scroll',()=>{idleUntil=Date.now()+1500;},{passive:true});
        refresh();
    }
    function markImages(root){
        const query=normalizeSearchText(document.getElementById('search-input').value);
        for(const image of root.querySelectorAll('img')){
            const src=image.getAttribute('src')||'',id=image.dataset.cloudOriginal||image.dataset.cloudAsset||(src.startsWith('note-local-asset:')?src.slice(17):'');
            const key=window.noteDriveCloud?.assetDescriptor(id)?.file?.key,value=entries.get(key)?.text,text=typeof value==='string'?normalizeSearchText(value):'';
            image.classList.toggle('note-image-text-match',!!query&&text.includes(query));
        }
    }
    return {start,refresh,markImages,text:note=>keysFor(note).map(key=>entries.get(key)?.text||'').join(' '),state:()=>({total:assets.size,completed:[...assets.keys()].filter(key=>entries.get(key)?.complete).length,busy,paused})};
})();


