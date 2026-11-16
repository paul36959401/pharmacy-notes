/* Source: 88-image-preferences.js */
/* Image annotation preferences are independent of note text colors and note/image data. */
const noteImagePalette=Object.freeze(['#ef4444','#facc15','#22c55e','#2563eb','#8b5cf6','#111827','#ffffff']);
function createNoteImageColorMemory(options={}){
    const defaults=noteImagePalette;
    const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value.trim())?value.trim().toLowerCase():null;
    const unique=values=>[...new Set((Array.isArray(values)?values:[]).map(color).filter(Boolean))];
    const boot=typeof noteDriveBoot==='undefined'?{}:noteDriveBoot;
    let hash=2166136261;for(const c of String(boot.workspace||boot.appUrl||'pharmacy-notes'))hash=Math.imul(hash^c.charCodeAt(0),16777619);
    const key=options.key||'pharmacy-note-image-colors-v1-'+(hash>>>0).toString(36);
    let storage,failed=false,editing=false,view=null,viewColor=defaults[0],viewReady=false,viewSignature='',paletteSignature='';
    const empty=()=>({v:1,colors:[],last:defaults[0],removed:[]});
    let state=empty();
    try{storage=Object.prototype.hasOwnProperty.call(options,'storage')?options.storage:window.localStorage;if(!storage)failed=true;}catch(_){failed=true;}
    function read(){
        if(failed)return;
        let raw;try{raw=storage.getItem(key);}catch(_){failed=true;return;}
        if(!raw){state=empty();return;}
        try{
            const value=JSON.parse(raw);if(value?.v!==1)return;
            const removed=unique(value.removed).filter(c=>!defaults.includes(c));
            state={v:1,colors:unique(value.colors).filter(c=>!defaults.includes(c)&&!removed.includes(c)),last:color(value.last)||defaults[0],removed};
            if(removed.includes(state.last))state.last=defaults[0];
        }catch(_){/* A malformed optional preference must never block image editing. */}
    }
    function mutate(change){
        read();const before=JSON.stringify(state);change();
        if(before!==JSON.stringify(state))try{if(!storage)throw Error('No color storage');storage.setItem(key,JSON.stringify(state));failed=false;}catch(_){failed=true;}
        render(viewColor,viewReady);
    }
    function add(value,explicit=false){
        const c=color(value);if(!c)return;
        if(explicit)state.removed=state.removed.filter(old=>old!==c);
        if(!defaults.includes(c)&&!state.removed.includes(c)&&!state.colors.includes(c))state.colors.push(c);
    }
    function remember(value,previous=[]){
        const c=color(value);if(!c)return;
        mutate(()=>{for(const old of previous)add(old);add(c,true);state.last=c;});
    }
    function adopt(values){mutate(()=>{for(const c of values||[])add(c);});}
    function forget(value){
        const c=color(value);if(!c||defaults.includes(c))return;
        mutate(()=>{state.colors=state.colors.filter(old=>old!==c);if(!state.removed.includes(c))state.removed.push(c);if(state.last===c)state.last=defaults[0];});
    }
    function render(active=state.last,ready=false){
        viewColor=color(active)||defaults[0];viewReady=!!ready;if(!view)return;
        const signature=JSON.stringify([state.colors,editing,viewColor,viewReady,failed]);if(signature===viewSignature)return;viewSignature=signature;
        view.root.hidden=!state.colors.length&&!editing&&!failed;
        view.manage.hidden=!state.colors.length&&!editing;view.manage.disabled=!viewReady;
        view.manage.textContent=editing?'完成':'刪色';view.manage.setAttribute('aria-pressed',String(editing));
        view.status.textContent=failed?'此瀏覽器目前無法保存色票，本次開啟仍可使用。':editing?'點色票移除記憶；圖片上的標記會保留。':'';
        const colorsKey=JSON.stringify(state.colors);
        if(colorsKey!==paletteSignature){
            const fragment=document.createDocumentFragment();
            for(const c of state.colors){
                const button=document.createElement('button');button.type='button';button.className='nie-swatch nie-memory-swatch';
                button.dataset.nieMemoryColor=c;button.style.setProperty('--swatch',c);fragment.appendChild(button);
            }
            view.swatches.replaceChildren(fragment);paletteSignature=colorsKey;
        }
        // A selected-mark/color/readiness update must not replace a button under the pointer or keyboard focus.
        for(const button of view.swatches.children){
            const c=button.dataset.nieMemoryColor;button.disabled=!viewReady;
            button.setAttribute('aria-label',(editing?'刪除記憶色 ':'使用記憶色 ')+c);button.setAttribute('aria-pressed',String(!editing&&c===viewColor));
            button.title=(editing?'刪除色票 ':'使用顏色 ')+c;if(editing)button.dataset.removing='true';else delete button.dataset.removing;
        }
    }
    function mount(root,choose){
        if(!root||view)return;
        view={root,choose,swatches:root.querySelector('[data-nie-memory-swatches]'),manage:root.querySelector('[data-nie-memory-manage]'),status:root.querySelector('[data-nie-memory-status]')};
        root.addEventListener('click',event=>{
            const button=event.target.closest('button');if(!button||button.disabled||!root.contains(button))return;
            event.preventDefault();event.stopPropagation();
            if(button.hasAttribute('data-nie-memory-manage')){editing=!editing;render(viewColor,viewReady);return;}
            const c=color(button.dataset.nieMemoryColor);if(!c)return;
            if(editing)forget(c);else choose(c);
        });
        render(viewColor,viewReady);
    }
    function begin(){read();editing=false;render(state.last,false);return state.last;}
    read();
    if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===key&&!failed){read();render(viewColor,viewReady);}});
    return {begin,remember,adopt,forget,mount,render,snapshot:()=>JSON.parse(JSON.stringify({...state,failed,key}))};
}


