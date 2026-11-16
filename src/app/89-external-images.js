/* Source: 89-external-images.js */
/* Images dragged or pasted as web links (Yamol, Google Images, any site) are downloaded and
   stored with the note. Sites that allow it are read directly by the browser; the rest go
   through the owner's image proxy, because a browser may show another site's image but not
   read its bytes. */
const noteExternalImages=(()=>{
    const pending=new Map(),cache=new Map();
    function normalize(value){
        const u=new URL(String(value).trim(),location.href);
        if(!['http:','https:','blob:','data:'].includes(u.protocol)||u.username||u.password)throw Error('圖片網址無效');
        if(u.protocol==='http:'&&isYamol(u.hostname))u.protocol='https:';
        if(/^https?:$/.test(u.protocol))u.hash='';return u.href;
    }
    const isYamol=host=>host==='yamol.tw'||host.endsWith('.yamol.tw');
    function supported(value){try{return /^https?:$/.test(new URL(normalize(value)).protocol);}catch(_){return false;}}
    const fallbacks=new Map();
    function setFallback(url,fallback){if(url&&fallback&&url!==fallback)fallbacks.set(url,fallback);while(fallbacks.size>50)fallbacks.delete(fallbacks.keys().next().value);}
    function abort(signal){if(signal?.aborted)throw Error('已停止圖片載入');}
    function read(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('圖片讀取失敗'));r.readAsDataURL(blob);});}
    async function direct(url){
        if(isYamol(new URL(url).hostname))return null;          // Yamol never allows direct reads
        try{
            const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});
            if(!response.ok)return null;
            const blob=await response.blob();
            return blob.type.startsWith('image/')&&blob.size<=16*1024*1024?read(blob):null;
        }catch(_){return null;}
    }
    async function fetchImage(url){
        const quick=await direct(url);if(quick)return quick;
        const result=await noteDriveRpc('externalImage',{url},noteDriveBoot.book,undefined,0);
        if(!result.data||!/^image\//.test(result.mime)||!Number.isSafeInteger(result.bytes)||result.bytes>16*1024*1024)throw Error('外部圖片回覆不完整');
        const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
        if(bytes.length!==result.bytes||hash!==result.key)throw Error('外部圖片校驗失敗，請重試');
        return 'data:'+result.mime+';base64,'+result.data;
    }
    async function resolve(value,{signal}={}){
        abort(signal);const url=normalize(value);if(url.startsWith('data:image/'))return url;
        if(cache.has(url)){const source=cache.get(url);cache.delete(url);cache.set(url,source);return source;}
        if(!pending.has(url))pending.set(url,fetchImage(url).then(source=>{
            cache.set(url,source);while(cache.size>8||[...cache.values()].reduce((sum,v)=>sum+v.length,0)>32*1024*1024)cache.delete(cache.keys().next().value);return source;
        }).finally(()=>pending.delete(url)));
        const result=await pending.get(url);abort(signal);return result;
    }
    async function prepareInsert(source){
        if(!supported(source))return source;
        try{return await resolve(source);}
        catch(error){
            const fallback=fallbacks.get(source);   // e.g. the Google Images thumbnail when the full-size page blocks downloads
            if(fallback){try{return fallback.startsWith('data:image/')?fallback:await resolve(fallback);}catch(_){}}
            showPreviewModeToast('圖片連結已保留，原圖匯入未完成：'+error.message+'。可稍後按「編輯／標記」重試。');return source;
        }
    }
    return {resolve,supported,prepareInsert,normalize,setFallback};
})();

