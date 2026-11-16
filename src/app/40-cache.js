/* Source: 40-cache.js */
    function createNoteReadCache(space) {
        let db = null, opening = null, writable = true;
        async function open() {
            if (opening) return opening;
            opening = new Promise(resolve => {
                let storage;try{storage=globalThis.indexedDB;}catch(_){return resolve(null);}
                if (!storage) return resolve(null);
                let done = false, request;
                const finish = value => {if(done){value?.close();return;}done=true;clearTimeout(timer);db=value;resolve(value);};
                const timer=setTimeout(()=>finish(null),1200);
                try {
                    request=storage.open(space+'-cloud-read-cache-v1',1);
                    request.onupgradeneeded=()=>request.result.createObjectStore('entries');
                    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();db=null;};finish(request.result);};
                    request.onerror=request.onblocked=()=>finish(null);
                } catch (_) {finish(null);}
            });
            return opening;
        }
        async function get(key) {
            await open();if(!db)return undefined;
            return new Promise(resolve=>{try{const request=db.transaction('entries').objectStore('entries').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(undefined);}catch(_){resolve(undefined);}});
        }
        async function put(entries) {
            await open();if(!db||!writable)return false;
            return new Promise(resolve=>{try{const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');for(const [key,value]of entries)store.put(value,key);tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>{writable=false;resolve(false);};}catch(_){writable=false;resolve(false);}});
        }
        async function remove(key) {
            await open();if(!db)return;
            return new Promise(resolve=>{try{const tx=db.transaction('entries','readwrite');tx.objectStore('entries').delete(key);tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch(_){resolve();}});
        }
        return {get,put,remove};
    }

    // 圖片及每則筆記各自以內容雜湊保存；大型物件再切成小段。
function createNotePreviewCache(cache,{maxBytes=48*1024*1024,pinned=()=>[]}={}){
    const key='preview-index-v1',prefix='preview-v1:';let entries=new Map(),ready=null,writing=Promise.resolve();
    async function initialize(){
        if(!ready)ready=(async()=>{const saved=await cache.get(key);if(Array.isArray(saved))for(const item of saved){if(item&&/^[a-f0-9]{64}$/.test(item.key)&&Number.isSafeInteger(item.bytes)&&item.bytes>0&&item.bytes<=500000)entries.set(item.key,item);}})();
        return ready;
    }
    function serial(fn){const job=writing.then(fn,fn);writing=job.catch(()=>{});return job;}
    async function put(items){
        await initialize();return serial(async()=>{
            const before=new Map(entries),now=Date.now(),writes=[];
            for(const item of items){entries.set(item.file.key,{key:item.file.key,bytes:item.file.bytes,used:now});writes.push([prefix+item.file.key,item.blob]);}
            let size=[...entries.values()].reduce((n,item)=>n+item.bytes,0);const keep=new Set(pinned()),removed=[];
            for(const item of [...entries.values()].sort((a,b)=>a.used-b.used)){
                if(size<=maxBytes)break;if(keep.has(item.key))continue;
                entries.delete(item.key);size-=item.bytes;removed.push(item.key);
            }
            if(!await cache.put([...writes,[key,[...entries.values()]]])){entries=before;return false;}
            for(const id of removed)await cache.remove(prefix+id);
            return true;
        });
    }
    async function get(file){
        await initialize();const blob=await cache.get(prefix+file.key)||await cache.get('binary:'+file.key);
        const item=entries.get(file.key);if(item)item.used=Date.now();return blob;
    }
    async function remove(id){await initialize();return serial(async()=>{entries.delete(id);await cache.remove(prefix+id);await cache.remove('binary:'+id);await cache.put([[key,[...entries.values()]]]);});}
    return {initialize,get,put,remove,has:id=>entries.has(id),size:()=>[...entries.values()].reduce((n,item)=>n+item.bytes,0)};
}


