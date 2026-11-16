/* Source: 50-drive-transport.js */
/* Private Drive transport. Preview data never enters the editable original asset store. */
const noteDriveBoot = window.NOTE_CLOUD_BOOTSTRAP;
const noteDriveError = (message, code='DRIVE', retryable=true) => Object.assign(new Error(message),{code,retryable});
let noteDriveActive=0,noteDriveBackground=0;
const noteDriveQueue=[];
function noteDriveAbortError(){return noteDriveError('已停止舊雲端搬移，已完成的進度會保留。','CANCELLED',false);}
function noteDriveCheckSignal(signal){if(signal?.aborted)throw noteDriveAbortError();}
function noteDrivePump(){while(noteDriveActive<4&&noteDriveQueue.length){noteDriveQueue.sort((a,b)=>a.priority-b.priority);const index=noteDriveQueue.findIndex(job=>job.priority<10||noteDriveBackground<1&&noteDriveActive<3);if(index<0)break;const [job]=noteDriveQueue.splice(index,1);noteDriveActive++;if(job.priority>=10)noteDriveBackground++;job.start();}}
async function noteDriveRpc(action,body={},book=noteDriveBoot.book,signal,priority=0){
    noteDriveCheckSignal(signal);
    await new Promise((resolve,reject)=>{
        const cancel=()=>{const i=noteDriveQueue.indexOf(job);if(i>=0){noteDriveQueue.splice(i,1);reject(noteDriveAbortError());}};
        const job={priority,start:()=>{signal?.removeEventListener('abort',cancel);resolve();}};
        signal?.addEventListener('abort',cancel,{once:true});noteDriveQueue.push(job);noteDrivePump();
    });
    try{return await new Promise((resolve,reject)=>{
        let settled=false;
        const cancel=()=>finish(reject,noteDriveAbortError());
        const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);fn(value);};
        const timer=setTimeout(()=>finish(reject,noteDriveError('Google 雲端回覆逾時，本機草稿仍保留。','TIMEOUT')),120000);
        signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}
        // The old Apps Script server is replaced by direct Google Drive calls from this browser.
        noteDriveServer.call({...body,action,book}).then(value=>{
            if(!value||value.success!==true)return finish(reject,noteDriveError(value?.error||'雲端未確認操作。',value?.code,value?.retryable!==false));
            finish(resolve,value);
        },e=>finish(reject,noteDriveError(String(e?.message||e).slice(0,350),'RPC')));
    });}finally{noteDriveActive--;if(priority>=10)noteDriveBackground--;noteDrivePump();}
}

function createNoteDriveCloud(options){
    const {getAsset,loadAsset=async()=>undefined,installAsset,progress=()=>{}}=options;
    const prefix='note-local-asset:',enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
    const cache=createNoteReadCache(options.space+'-drive-v2'),assets=new Map(),confirmed=new Set(),jobs=new Map(),previewJobs=new Map();
    const binaries=new Map(),previewValues=new Map(),encoded=new Map(),legacyReaders=new Map(),scopedLegacyReaders=new WeakMap(),restoredLegacy=new Set();
    let head={revision:null,pages:[],preload:[]},records=[],initialized=null,loaded=false,expected=null,transferred=0;
    const previewDisk=createNotePreviewCache(cache,{pinned:()=>head.preload.map(d=>d.key)});
    let mutations=Promise.resolve();
    function serialize(fn){const job=mutations.then(fn,fn);mutations=job.catch(()=>{});return job;}
    let previewTimer=null,previewDue=0,previewQueue=[],activePreviewBatches=0;
    function rememberPreview(key,value){previewValues.delete(key);previewValues.set(key,value);while(previewValues.size>40)previewValues.delete(previewValues.keys().next().value);return value;}
    const ids=value=>[...new Set((JSON.stringify(value).match(/note-local-asset:[a-zA-Z0-9-]+/g)||[]).map(s=>s.slice(prefix.length)))];
    const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
    const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    async function hash(bytes){if(!crypto?.subtle)throw noteDriveError('瀏覽器不支援安全校驗，請更新瀏覽器。','CRYPTO',false);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
    async function parallel(items,fn,limit=3){let i=0,failed=null;const out=new Array(items.length);await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(!failed&&i<items.length){const n=i++;try{out[n]=await fn(items[n],n);}catch(e){failed=e;}}}));if(failed)throw failed;return out;}
    async function initializeCache(){
        if(initialized)return initialized;
        initialized=(async()=>{const saved=await cache.get('snapshot');if(saved&&await hash(enc.encode(JSON.stringify(saved.data)))===saved.hash){
            head=saved.data.head;records=saved.data.records;for(const[id,d]of Object.entries(saved.data.assets))assets.set(id,d);
        }await previewDisk.initialize();} )();return initialized;
    }
    async function saveSnapshot(){const data={head,records,assets:Object.fromEntries(assets)};await cache.put([['snapshot',{data,hash:await hash(enc.encode(JSON.stringify(data)))}]]);}
    async function checkedBlob(d,data){const bytes=typeof data==='string'?un64(data):new Uint8Array(await data.arrayBuffer());if(bytes.length!==d.bytes||await hash(bytes)!==d.key)throw noteDriveError('雲端檔案校驗失敗，未取代原內容。','CHECKSUM',false);return new Blob([bytes],{type:d.mime});}
    async function download(d,priority=0){
        if(binaries.has(d.key))return binaries.get(d.key);
        const saved=await cache.get('binary:'+d.key);
        if(saved instanceof Blob){try{const blob=await checkedBlob(d,saved);binaries.set(d.key,blob);return blob;}catch(_){await cache.remove('binary:'+d.key);}}
        const blob=await checkedBlob(d,await noteDriveServer.downloadBlob(d));await cache.put([['binary:'+d.key,blob]]);binaries.set(d.key,blob);
        // Bound in-memory raw binary cache; persistent cache remains available.
        while(binaries.size>8||[...binaries.values()].reduce((n,b)=>n+b.size,0)>32*1024*1024)binaries.delete(binaries.keys().next().value);
        return blob;
    }
    async function upload(blob,role,signal){
        noteDriveCheckSignal(signal);
        const key=await hash(await blob.arrayBuffer()),mime=blob.type||'application/octet-stream';
        noteDriveCheckSignal(signal);
        let result;
        try{result={file:await noteDriveServer.uploadBlob(blob,role,(done,total)=>{progress({phase:'保存新增原圖',completed:done,total,bytes:transferred+done});})};}
        catch(e){throw noteDriveError(e.message,e.code,e.retryable!==false);}
        transferred+=blob.size;
        noteDriveCheckSignal(signal);
        if(!result.file||result.file.key!==key||result.file.bytes!==blob.size)throw noteDriveError('原檔儲存確認不完整。','CHECKSUM',false);
        await cache.put([['binary:'+key,blob]]);return result.file;
    }
    async function makePreview(value){
        if(!/^data:image\//i.test(value))return null;
        const image=new Image();image.src=value;
        try{
            await noteImageReady(image);
            const scale=Math.min(1,1280/image.naturalWidth,4096/image.naturalHeight,Math.sqrt(3000000/(image.naturalWidth*image.naturalHeight)));
            const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
            canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
            let blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.86));
            if(blob?.size>490000){canvas.width=Math.max(1,Math.round(canvas.width*.65));canvas.height=Math.max(1,Math.round(canvas.height*.65));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.74));}
            if(!blob||blob.size>500000)throw new Error('preview');
            const dimensions={width:image.naturalWidth,height:image.naturalHeight};canvas.width=canvas.height=1;
            return {blob,...dimensions};
        }catch(_){return null;}
    }
    async function encode(value,withPreview=true,depth=0,signal){
        noteDriveCheckSignal(signal);
        const valueHash=await hash(enc.encode(value)),cached=encoded.get(valueHash);
        if(cached&&(!withPreview||cached.preview||!/^data:image\//.test(value)))return cached;
        const saved=await cache.get('encoded:'+valueHash);
        if(saved&&(!withPreview||saved.preview||!/^data:image\//.test(value))){encoded.set(valueHash,saved);return saved;}
        if(depth>6)throw noteDriveError('圖片巢狀封裝過深。','IMAGE_FORMAT',false);
        let descriptor,blob;
        // Existing editor SVGs contain unchanged canonical base64 source images.
        // Keep literal slices so reconstruction is byte-for-byte identical.
        const embedded=/^data:image\/svg\+xml[;,]/i.test(value)&&!/^data:[^,]*;base64,/.test(value)?[...value.matchAll(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi)]:[];
        if(embedded.length){
            const parts=[],sources=[];let offset=0;
            for(const match of embedded){parts.push(value.slice(offset,match.index));sources.push(await encode(match[0],false,depth+1,signal));offset=match.index+match[0].length;}
            parts.push(value.slice(offset));blob=new Blob([JSON.stringify({parts,sources})],{type:'application/json'});descriptor={kind:'svg-template',valueHash};
        }else if(/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value)){
            const comma=value.indexOf(','),header=value.slice(0,comma+1),bytes=un64(value.slice(comma+1));
            if(b64(bytes)!==value.slice(comma+1))throw noteDriveError('圖片 base64 格式不正確。','IMAGE_FORMAT',false);
            blob=new Blob([bytes],{type:header.slice(5,header.indexOf(';'))});descriptor={kind:'data-url',valueHash,header};
        }else{
            let data;try{data=JSON.parse(value);}catch(_){}
            if(data&&typeof data.source==='string'&&/^data:image\//.test(data.source)&&JSON.stringify(data)===value){
                const source=await encode(data.source,false,depth+1,signal);delete data.source;
                // Retain property order exactly, including the source slot.
                const original=JSON.parse(value);original.source={noteDriveSource:source};blob=new Blob([JSON.stringify(original)],{type:'application/json'});descriptor={kind:'json-source',valueHash};
            }else{blob=new Blob([enc.encode(value)],{type:'text/plain'});descriptor={kind:'text',valueHash};}
        }
        descriptor.file=await upload(blob,'asset',signal);
        if(withPreview){const preview=await makePreview(value);noteDriveCheckSignal(signal);if(preview){descriptor.preview=await upload(preview.blob,'preview',signal);descriptor.width=preview.width;descriptor.height=preview.height;rememberPreview(descriptor.preview.key,'data:'+preview.blob.type+';base64,'+b64(new Uint8Array(await preview.blob.arrayBuffer())));}}
        encoded.set(valueHash,descriptor);await cache.put([['encoded:'+valueHash,descriptor]]);return descriptor;
    }
    async function decode(d,depth=0,priority=0){
        if(depth>6)throw noteDriveError('圖片封裝不正確。','IMAGE_FORMAT',false);
        const blob=await download(d.file,priority);let value;
        if(d.kind==='data-url')value=d.header+b64(new Uint8Array(await blob.arrayBuffer()));
        else if(d.kind==='svg-template'){const template=JSON.parse(await blob.text());value=template.parts[0];for(let i=0;i<template.sources.length;i++)value+=await decode(template.sources[i],depth+1,priority)+template.parts[i+1];}
        else if(d.kind==='json-source'){const body=JSON.parse(await blob.text());body.source=await decode(body.source.noteDriveSource,depth+1,priority);value=JSON.stringify(body);}
        else if(d.kind==='text')value=dec.decode(await blob.arrayBuffer());
        else throw noteDriveError('未知的原圖封裝。','IMAGE_FORMAT',false);
        if(await hash(enc.encode(value))!==d.valueHash)throw noteDriveError('圖片重建校驗失敗，原筆記仍保留。','CHECKSUM',false);return value;
    }
    function legacyReader(){throw noteDriveError('舊版雲端已全部搬移完成，新版網站不再讀取舊雲端；可改用完整 JSON 備份補圖。','LEGACY_REMOVED',false);}
    async function ensureAsset(id,signal,priority=0){
        noteDriveCheckSignal(signal);
        if(jobs.has(id))return jobs.get(id);
        const job=(async()=>{
            await initializeCache();const d=assets.get(id);let value=getAsset(id)??await loadAsset(id);
            if(typeof value==='string'&&(!d||await hash(enc.encode(value))===d.valueHash))return value;
            if(!d)throw noteDriveError('找不到完整原圖，已保留草稿。','LOCAL_ASSET',false);
            if(d.kind==='legacy'){
                const reader=legacyReader(d.sourceBook,signal);reader.adoptAssets({[id]:d.source});value=await reader.ensureAsset(id);
            }else value=await decode(d,0,priority);
            noteDriveCheckSignal(signal);
            installAsset(id,value);return value;
        })();jobs.set(id,job);try{return await job;}finally{jobs.delete(id);}
    }
    async function ensureAssetIds(list){await parallel([...new Set(list)],id=>ensureAsset(id));}
    async function receivePreviews(list){
        const checked=[];
        for(const item of list||[]){if(!item.data)continue;try{const blob=await checkedBlob(item.file,item.data);checked.push({file:item.file,blob});rememberPreview(item.file.key,'data:'+blob.type+';base64,'+item.data);}catch(_){/* A display preview cannot invalidate readable note text. */}}
        if(checked.length)await previewDisk.put(checked);
    }
    function schedulePreviews(delay=12){const due=Date.now()+delay;if(!previewTimer||due<previewDue){clearTimeout(previewTimer);previewDue=due;previewTimer=setTimeout(pumpPreviews,delay);}}
    function pumpPreviews(){
        previewTimer=null;
        while(activePreviewBatches<2&&previewQueue.length){
            previewQueue.sort((a,b)=>a.priority-b.priority);const background=previewQueue[0].priority>=10;
            if(background&&(activePreviewBatches||options.isBusy?.()||document.hidden)){schedulePreviews(500);break;}
            const items=[];let bytes=0;
            while(previewQueue.length&&items.length<12){const item=previewQueue[0];if((item.priority>=10)!==background||items.length&&bytes+item.file.bytes>1200000)break;previewQueue.shift();items.push(item);bytes+=item.file.bytes;item.started=true;}
            activePreviewBatches++;
            void(async()=>{
                try{const result=await noteDriveRpc('previews',{files:items.map(x=>x.file)},noteDriveBoot.book,undefined,background?10:1);await receivePreviews(result.files);for(const item of items){const value=previewValues.get(item.file.key);value?item.resolve(value):item.reject(noteDriveError('預覽暫時無法載入，點擊可讀取原圖。'));}}
                catch(e){items.forEach(item=>item.reject(e));}
                finally{activePreviewBatches--;if(previewQueue.length)schedulePreviews();}
            })();
        }
    }
    async function ensurePreview(id,{priority=0}={}){
        const d=assets.get(id);
        if(!d)return getAsset(id)??ensureAsset(id);
        if(!d.preview)throw noteDriveError(d.kind==='legacy'?'舊原圖尚未搬移完成，點擊可先讀取原圖。':'這張圖片未產生預覽，點擊可讀取原圖。','NO_PREVIEW',false);
        const p=d.preview;if(previewValues.has(p.key))return previewValues.get(p.key);
        if(previewJobs.has(p.key)){const existing=previewJobs.get(p.key);existing.priority=Math.min(existing.priority,priority);schedulePreviews();return existing.promise;}
        const entry={file:p,priority,started:false,promise:null};
        entry.promise=(async()=>{const cached=await previewDisk.get(p);if(cached instanceof Blob){try{const blob=await checkedBlob(p,cached);const src='data:'+blob.type+';base64,'+b64(new Uint8Array(await blob.arrayBuffer()));rememberPreview(p.key,src);if(!previewDisk.has(p.key))await previewDisk.put([{file:p,blob}]);return src;}catch(_){await previewDisk.remove(p.key);}}
            return new Promise((resolve,reject)=>{Object.assign(entry,{resolve,reject});previewQueue.push(entry);schedulePreviews();});})();
        previewJobs.set(p.key,entry);try{return await entry.promise;}finally{previewJobs.delete(p.key);}
    }
    async function prefetchPreviews(list){
        await previewDisk.initialize();const wanted=[...new Set(list)].filter(id=>assets.get(id)?.preview&&!previewValues.has(assets.get(id).preview.key)&&!previewDisk.has(assets.get(id).preview.key));
        const bytes=wanted.reduce((n,id)=>n+assets.get(id).preview.bytes,0);
        await Promise.allSettled(wanted.map(id=>ensurePreview(id,{priority:10})));return {bytes,images:wanted.length};
    }
    async function decodePage(item){
        const blob=await checkedBlob(item.file,item.data);let raw=blob;
        if(item.file.mime==='application/gzip'){if(typeof DecompressionStream==='undefined')throw noteDriveError('請更新瀏覽器以讀取壓縮文字。','CODEC',false);raw=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();}
        const page=JSON.parse(await raw.text());if(page.schema!==1||!Array.isArray(page.records)||!page.assets||page.records.length!==item.file.count)throw noteDriveError('筆記文字頁不完整。','CATALOG',false);
        await cache.put([['page:'+item.file.key,{page,file:item.file,pageHash:await hash(enc.encode(JSON.stringify(page)))}]]);return page;
    }
    async function read({verify=false}={}){
        await initializeCache();const result=await noteDriveRpc('read',{knownRevision:verify?null:head.revision,skipPreviews:verify&&loaded});
        if(verify&&result.unchanged)throw noteDriveError('雲端尚未提供可重新校驗的內容，未確認同步完成。','VERIFY');
        if(expected&&result.head.revision!==expected){expected=null;throw noteDriveError('另一個裝置已修改雲端，正在合併。','CONFLICT');}expected=null;
        if(result.format!=='pharmacy-notes-drive-v2')throw noteDriveError('雲端版本不相容。','FORMAT',false);
        if(!result.unchanged){
            const newHead=result.head,pages=new Array(newHead.pages.length);await receivePreviews(result.previews);
            for(const item of result.pages||[])pages[item.index]=await decodePage(item);
            const missing=[];for(let i=0;i<pages.length;i++){if(pages[i])continue;const saved=verify?null:await cache.get('page:'+newHead.pages[i].key);if(saved&&saved.file.proof===newHead.pages[i].proof&&await hash(enc.encode(JSON.stringify(saved.page)))===saved.pageHash)pages[i]=saved.page;else missing.push(i);}
            const groups=[];for(let i=0;i<missing.length;i+=8)groups.push(missing.slice(i,i+8));
            await parallel(groups,async indices=>{const response=await noteDriveRpc('pages',{revision:newHead.revision,indices});for(const item of response.pages)pages[item.index]=await decodePage(item);});
            const nextRecords=pages.flatMap(p=>p.records),nextAssets=Object.assign({},...pages.map(p=>p.assets));
            if(nextRecords.length!==newHead.count||new Set(nextRecords.map(n=>String(n.id))).size!==nextRecords.length||ids(nextRecords).some(id=>!nextAssets[id]))throw noteDriveError('筆記索引不完整或有重複識別碼，未取代本機內容。','CATALOG',false);
            head=newHead;records=nextRecords;assets.clear();for(const[id,d]of Object.entries(nextAssets))assets.set(id,d);await saveSnapshot();
        }
        loaded=true;window.dispatchEvent(new CustomEvent('note-drive-state',{detail:state()}));return {packed:structuredClone(records)};
    }
    async function pageBlob(page){let blob=new Blob([JSON.stringify(page)],{type:'application/json'});if(blob.size>7*1024*1024)throw noteDriveError('單篇筆記文字超過 7 MB，請拆成數篇；圖片另存，不計入這個大小。','PAGE_TOO_LARGE',false);if(typeof CompressionStream!=='undefined'&&blob.size>4096){const zipped=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();if(zipped.size<blob.size*.95)blob=new Blob([zipped],{type:'application/gzip'});}return blob;}
    function write(nextRecords){return serialize(()=>writeNow(nextRecords));}
    async function writeNow(nextRecords){
        if(!loaded)throw noteDriveError('請先完整讀取文字再儲存。','NOT_READY');
        const nextAssets={},list=ids(nextRecords);transferred=0;
        await parallel(list,async id=>{
            const d=assets.get(id),value=getAsset(id);
            const matches=d&&(typeof value!=='string'||await hash(enc.encode(value))===d.valueHash);
            if(matches&&!(d.kind==='legacy'&&restoredLegacy.has(id)&&typeof value==='string')){nextAssets[id]=d;return;}
            const original=value??await loadAsset(id);if(typeof original!=='string')throw noteDriveError('這張原圖尚未準備完成，草稿仍保留。','LOCAL_ASSET',false);
            nextAssets[id]=await encode(original);
        },2);
        // Fixed note-count pages avoid repartitioning the whole catalog on each keystroke.
        const groups=[];let group=[],size=0;
        for(const record of nextRecords){const length=enc.encode(JSON.stringify(record)).length;if(group.length&&(group.length>=120||size+length>700000)){groups.push(group);group=[];size=0;}group.push(record);size+=length;}if(group.length)groups.push(group);
        const pages=await parallel(groups,async group=>{
            const page={schema:1,records:group,assets:Object.fromEntries(ids(group).map(id=>[id,nextAssets[id]]))};
            const blob=await pageBlob(page),key=await hash(await blob.arrayBuffer()),previous=head.pages.find(p=>p.key===key);
            if(previous)return {file:previous};
            if(blob.size<=260000)return {inline:{key,bytes:blob.size,mime:blob.type,data:b64(new Uint8Array(await blob.arrayBuffer()))}};
            return {file:await upload(blob,'catalog')};
        });
        const preload=[];for(const id of list){const p=nextAssets[id].preview;if(p&&!preload.some(d=>d.key===p.key))preload.push(p);if(preload.length===4)break;}
        progress({phase:'保存筆記文字',completed:0,total:1,bytes:transferred});
        const result=await noteDriveRpc('commit',{baseRevision:head.revision,pages,preload});
        head=result.head;records=structuredClone(nextRecords);assets.clear();for(const[id,d]of Object.entries(nextAssets)){assets.set(id,d);if(d.kind!=='legacy')restoredLegacy.delete(id);}expected=head.revision;
        await saveSnapshot();progress({phase:'已確認雲端版本',completed:1,total:1,bytes:transferred});window.dispatchEvent(new CustomEvent('note-drive-state',{detail:state()}));return result;
    }
    function state(){const list=ids(records),remaining=list.filter(id=>assets.get(id)?.kind==='legacy').length;return {loaded,records:records.length,images:list.length,remaining,revision:head.revision};}
    async function importLegacy(signal){
        if(!loaded||records.length)throw noteDriveError('只可將舊雲端匯入空白科目，避免覆蓋現有筆記。','IMPORT',false);
        const reader=legacyReader(noteDriveBoot.book,signal),result=await reader.read();noteDriveCheckSignal(signal);
        if(result.packed){for(const[id,source]of Object.entries(reader.exportAssetDescriptors()))assets.set(id,{kind:'legacy',valueHash:source.key,sourceBook:noteDriveBoot.book,source});return {packed:result.packed};}
        return result;
    }
    async function matchBackupAssets(entries,signal){
        const byHash=new Map(),fingerprints={},aliases={},recovered=new Set();
        for(const[id,d]of assets){fingerprints[id]=d.valueHash;if(!byHash.has(d.valueHash))byHash.set(d.valueHash,[]);byHash.get(d.valueHash).push(id);}
        for(const[id,value]of entries){
            noteDriveCheckSignal(signal);const key=await hash(enc.encode(value));fingerprints[id]=key;
            const matches=byHash.get(key)||[];
            for(const target of matches)if(assets.get(target)?.kind==='legacy'){installAsset(target,value);restoredLegacy.add(target);recovered.add(target);}
            if(matches.length)aliases[id]=matches[0];
        }
        return {aliases,fingerprints,recovered:recovered.size};
    }
    async function migrateOriginals(onProgress=()=>{},shouldStop=()=>false,signal){
        if(!loaded)throw noteDriveError('請先載入科目。');
        const pending=ids(records).filter(id=>assets.get(id)?.kind==='legacy'),failures=[];let done=0;
        for(let i=0;i<pending.length;i+=4){
            if(shouldStop())break;noteDriveCheckSignal(signal);
            const group=pending.slice(i,i+4),changes=[];let fatal=null;
            await parallel(group,async id=>{
                if(fatal)return;
                try{const value=await ensureAsset(id,signal);changes.push([id,await encode(value,true,0,signal)]);}
                catch(e){if(['LEGACY_PART_MISSING','PART','CHECKSUM'].includes(e.code))failures.push({id,message:e.message});else fatal=e;}
            },2);
            noteDriveCheckSignal(signal);
            if(changes.length)await serialize(async()=>{
                noteDriveCheckSignal(signal);
                const previous=new Map(changes.map(([id])=>[id,assets.get(id)]));changes.forEach(([id,d])=>assets.set(id,d));
                try{await writeNow(records);}catch(e){previous.forEach((d,id)=>assets.set(id,d));throw e;}
            });
            done+=changes.length;onProgress(done,pending.length,failures.length);window.dispatchEvent(new CustomEvent('note-drive-state',{detail:state()}));
            if(fatal)throw fatal;
        }
        return {...state(),failed:failures.length,failures};
    }
    const api={read,write,initializeCache,ensureAsset,ensureAssetIds,ensurePreview,prefetchPreviews,
        snapshotAssetDescriptors:list=>Object.fromEntries(list.filter(id=>assets.has(id)).map(id=>[id,assets.get(id)])),
        restoreAssetDescriptors:descriptors=>{for(const[id,d]of Object.entries(descriptors||{}))if(!assets.has(id))assets.set(id,d);},
        peekPreview:id=>previewValues.get(assets.get(id)?.preview?.key),previewBytes:id=>assets.get(id)?.preview?.bytes||0,
        primeRecords:()=>{},rememberRemoteIds:list=>list.forEach(id=>confirmed.add(id)),hasRemoteAsset:id=>assets.has(id)||confirmed.has(id),isSupported:()=>true,needsMigration:()=>false,
        legacyWrite:()=>{throw noteDriveError('此工作台只使用 Drive 新版儲存。','FORMAT',false);},state,importLegacy,migrateOriginals,matchBackupAssets,
        canReleaseAsset:id=>assets.has(id)&&assets.get(id).kind!=='legacy'&&!jobs.size,
        dimensions:id=>({width:assets.get(id)?.width,height:assets.get(id)?.height}),
        assetDescriptor:id=>assets.get(id),isBusy:()=>!!options.isBusy?.()};
    window.noteDriveCloud=api;return api;
}
function createNoteChunkCloud(options){return createNoteDriveCloud(options);}


