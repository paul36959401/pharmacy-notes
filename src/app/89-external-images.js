/* Source: 89-external-images.js */
/* Public Yamol images need an owner-authenticated server read because their
   display permission and browser pixel-reading permission are different. */
const noteExternalImages=(()=>{
    const pending=new Map(),cache=new Map();
    function normalize(value){
        const u=new URL(String(value).trim(),location.href);
        if(!['http:','https:','blob:','data:'].includes(u.protocol)||u.username||u.password)throw Error('圖片網址無效');
        if(u.protocol==='http:'&&isYamol(u.hostname))u.protocol='https:';
        if(/^https?:$/.test(u.protocol))u.hash='';return u.href;
    }
    const isYamol=host=>host==='yamol.tw'||host.endsWith('.yamol.tw');
    function supported(value){try{const u=new URL(normalize(value));return u.protocol==='https:'&&isYamol(u.hostname);}catch(_){return false;}}
    function abort(signal){if(signal?.aborted)throw Error('已停止圖片載入');}
    function read(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('圖片讀取失敗'));r.readAsDataURL(blob);});}
    async function fetchImage(url){
        if(supported(url)){
            const result=await noteDriveRpc('externalImage',{url},noteDriveBoot.book,undefined,0);
            if(!result.data||!/^image\//.test(result.mime)||!Number.isSafeInteger(result.bytes)||result.bytes>16*1024*1024)throw Error('外部圖片回覆不完整');
            const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
            if(bytes.length!==result.bytes||hash!==result.key)throw Error('外部圖片校驗失敗，請重試');
            return 'data:'+result.mime+';base64,'+result.data;
        }
        let response;try{response=await fetch(url,{credentials:'omit'});}catch(_){throw Error('來源網站未允許瀏覽器讀取這張圖片；阿摩圖片可由私人伺服器匯入');}
        if(!response.ok)throw Error('圖片來源回覆 '+response.status);
        const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('圖片連結回覆的不是圖片');if(blob.size>16*1024*1024)throw Error('單張外部圖片超過 16 MB');return read(blob);
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
        try{return await resolve(source);}catch(error){showPreviewModeToast('圖片連結已保留，原圖匯入未完成：'+error.message+'。可稍後按「編輯／標記」重試。');return source;}
    }
    return {resolve,supported,prepareInsert,normalize};
})();

