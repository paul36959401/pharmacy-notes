/* Source: 95-note-keyboard.js */
/* Floating mouse keyboard. It owns no note content or cloud persistence state.
 * Zhuyin data derived from McBopomofo (https://github.com/openvanilla/McBopomofo).
 * MIT License, Copyright (c) 2011-2026 Mengjuei Hsieh et al.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const noteFloatingKeyboard=(()=>{
    const $=id=>document.getElementById(id),modes=['symbols','english','zhuyin','custom'];
    const defaultWidth=420,minWidth=300,maxWidth=760,candidateCount=6,commands={};
    const symbolGroups={
        common:{name:'常用',values:['→','←','↑','↓','↔','⇒','⇔','↗','↘','↳','★','☆','✓','✗','☑','☐','●','○','■','□','▲','△','▼','▽','◆','◇','※','±','×','÷','≠','≈','≤','≥','∞','℃','α','β','γ','δ']},
        greek:{name:'希臘字母',values:[...'αβγδεζηθικλμνξοπρστυφχψω','ς',...'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ']},
        math:{name:'數學／上下標',values:['+','−','×','÷','=','≠','≈','≡','≤','≥','±','∓','∞','∝','√','∑','∏','∫','∂','∆','∇','∈','∉','∪','∩','⊂','⊃','∴','∵',...'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻',...'₀₁₂₃₄₅₆₇₈₉₊₋']},
        punctuation:{name:'標點／單位',values:['，','。','、','；','：','！','？','「','」','『','』','（','）','【','】','《','》','〈','〉','…','—','·','～','％','‰','°','℃','℉','μg','mg','g','mL','L','mmHg','mEq','mol/L','®','©','™']}
    };
    const greekNames=['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega'];
    const greekLabels=Object.fromEntries([... 'αβγδεζηθικλμνξοπρστυφχψω'].flatMap((c,i)=>[[c,greekNames[i]],[c.toUpperCase(),greekNames[i]+' 大寫']]));
    const englishRows=['1234567890-=','qwertyuiop[]','asdfghjkl;\'','zxcvbnm,./'];
    const shifted={'1':'!','2':'@','3':'#','4':'$','5':'%','6':'^','7':'&','8':'*','9':'(','0':')','-':'_','=':'+','[':'{',']':'}',';':':',"'":'"',',':'<','.':'>','/':'?','`':'~','\\':'|'};
    const phoneticRows=[['ㄅ','ㄉ','ˇ','ˋ','ㄓ','ˊ','˙','ㄚ','ㄞ','ㄢ','ㄦ'],['ㄆ','ㄊ','ㄍ','ㄐ','ㄔ','ㄗ','ㄧ','ㄛ','ㄟ','ㄣ'],['ㄇ','ㄋ','ㄎ','ㄑ','ㄕ','ㄘ','ㄨ','ㄜ','ㄠ','ㄤ'],['ㄈ','ㄌ','ㄏ','ㄒ','ㄖ','ㄙ','ㄩ','ㄝ','ㄡ','ㄥ']];
    const phoneticHints=['1234567890-','qwertyuiop','asdfghjkl;','zxcvbnm,./'];
    const phoneticGroups=['ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ','ㄧㄨㄩ','ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ','ˉˊˇˋ˙'];
    let panel,modal,editor,title,trigger,initialized=false,shown=false,mode='symbols',group='common',shift=false,englishShift=null,lastSymbolKey='';
    let target=null,epoch=-1,ownEdit=false,physicalComposing=false,drag=null,sizing=null,panelWidth=defaultWidth,resizeFrame=0,statusTimer=0;
    let preferences={v:1,layout:2,custom:[],recent:[],position:null,width:defaultWidth},storageKey='',storageFailed=false,editingCustom=null,removing=false,cancelNextClick=false;
    let phonetic=['','','',''],candidatePage=0,candidates=[],dictionary=null,dictionaryJob=null;
    const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    function safeText(value,limit=64){return typeof value==='string'?[...value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().normalize('NFC')].slice(0,limit).join(''):'';}
    function cleanPreferences(value){
        const seen=new Set(),custom=[];
        for(const item of Array.isArray(value?.custom)?value.custom.slice(0,200):[]){
            const text=safeText(item?.text);if(!text||seen.has(text))continue;seen.add(text);
            custom.push({id:/^[a-zA-Z0-9-]{1,100}$/.test(item.id||'')?item.id:uid(),text,label:safeText(item.label,30)});
        }
        const p=value?.position;
        const width=Number.isFinite(value?.width)?Math.max(minWidth,Math.min(value.width,maxWidth)):defaultWidth;
        return {v:1,layout:2,custom,recent:[...new Set((Array.isArray(value?.recent)?value.recent:[]).map(x=>safeText(x)).filter(Boolean))].slice(0,16),position:p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y}:null,width:value?.layout===2?width:Math.min(defaultWidth,width)};
    }
    function readPreferences(){try{const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw?.v===1)preferences=cleanPreferences(raw);}catch(_){storageFailed=true;}}
    function savePreferences(){try{localStorage.setItem(storageKey,JSON.stringify(preferences));storageFailed=false;}catch(_){storageFailed=true;}updateStorageHint();}
    function updateStorageHint(){const node=$('nk-custom-hint');if(node)node.textContent=storageFailed?'此瀏覽器目前無法永久保存，請匯出備份；本次仍可使用。':'自訂符號保存在目前瀏覽器，可匯出備份或匯入其他裝置。';}
    function message(text){if(!panel)return;clearTimeout(statusTimer);$('nk-status').textContent=text;statusTimer=setTimeout(()=>{if(panel)$('nk-status').textContent='';},4500);}
    function available(){return modal?.classList.contains('active')&&!modal.inert&&!isPreviewMode&&!document.querySelector('.modal-overlay.active:not(#noteModal),dialog[open],#imageViewer.active');}
    function resetTarget(){target=null;epoch=noteOpenRequest;phonetic=['','','',''];candidatePage=0;candidates=[];physicalComposing=false;}
    function captureTarget(){
        if(!modal?.classList.contains('active')||ownEdit)return;
        if(epoch!==noteOpenRequest)resetTarget();
        if(document.activeElement===title){target={kind:'title',start:title.selectionStart??title.value.length,end:title.selectionEnd??title.value.length,direction:title.selectionDirection};}
        else{
            const selection=window.getSelection();if(!selection?.rangeCount)return;
            const range=selection.getRangeAt(0);if(!editor.contains(range.commonAncestorContainer))return;
            target={kind:'body',range:range.cloneRange(),backward:!range.collapsed&&selection.anchorNode===range.endContainer&&selection.anchorOffset===range.endOffset};
        }
    }
    function restoreTarget(){
        if(!available()||epoch!==noteOpenRequest){hide();return null;}
        if(physicalComposing){message('請先完成目前輸入法的選字。');return null;}
        if(!target){message('請先點一下筆記中的插入位置。');return null;}
        if(target.kind==='title'){
            title.focus({preventScroll:true});title.setSelectionRange(Math.min(target.start,title.value.length),Math.min(target.end,title.value.length),target.direction||'none');return title;
        }
        if(!target.range.startContainer.isConnected||!target.range.endContainer.isConnected||!editor.contains(target.range.commonAncestorContainer)){
            target=null;message('文字位置已變動，請點一下要繼續輸入的位置。');return null;
        }
        savedEditorRange=target.range.cloneRange();savedEditorSelectionBackward=target.backward;savedEditorFocusHost=getEditorFocusHostFromRange(savedEditorRange);restoreEditorSelection();return savedEditorFocusHost||editor;
    }
    function notifyInput(host,type,data=null){host.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:type,data}));}
    function beforeInput(host,type,data=null){return host.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:type,data}));}
    function typeText(text){
        const host=restoreTarget();if(!host)return false;
        ownEdit=true;let done=false;
        try{
            if(host===title){
                const room=title.maxLength-(title.value.length-(title.selectionEnd-title.selectionStart));let limited='';
                for(const char of text){if(limited.length+char.length>room)break;limited+=char;}
                if(limited!==text)message('標題最多 100 個字元。');text=limited;if(!text)return false;
            }
            if(!beforeInput(host,'insertText',text)){done=true;return true;}
            done=document.execCommand('insertText',false,text);
            if(!done){
                if(host===title)title.setRangeText(text,title.selectionStart,title.selectionEnd,'end');
                else{const r=window.getSelection().getRangeAt(0),node=document.createTextNode(text);r.deleteContents();r.insertNode(node);r.setStartAfter(node);r.collapse(true);window.getSelection().removeAllRanges();window.getSelection().addRange(r);}
                notifyInput(host,'insertText',text);done=true;
            }
            return done;
        }finally{ownEdit=false;captureTarget();} // Native/fallback input already reaches note autosave.
    }
    function keyCommand(action){
        if(mode==='zhuyin'&&phonetic.some(Boolean)){
            if(action==='backspace'){for(let i=3;i>=0;i--)if(phonetic[i]){phonetic[i]='';break;}candidatePage=0;renderPhonetic();return;}
            if(action==='space'&&!phonetic[3]){phonetic[3]='ˉ';candidatePage=0;renderPhonetic();return;}
            if(action==='enter'||action==='space'){const first=candidates[candidatePage*candidateCount];if(first)chooseCandidate(first);else message('目前沒有候選字，請調整注音或聲調。');return;}
        }
        if(action==='space'){typeText(' ');return;}
        const host=restoreTarget();if(!host)return;ownEdit=true;
        try{
            const keys={enter:'Enter',backspace:'Backspace',delete:'Delete',left:'ArrowLeft',right:'ArrowRight'};
            if(keys[action]&&!host.dispatchEvent(new KeyboardEvent('keydown',{key:keys[action],code:keys[action],bubbles:true,cancelable:true})))return;
            if(action==='left'||action==='right'){
                if(host===title){
                    let pos=action==='left'?title.selectionStart:title.selectionEnd;
                    if(title.selectionStart===title.selectionEnd){let chunks=[];if(typeof Intl.Segmenter==='function')chunks=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(title.value)].map(x=>x.index);else{let offset=0;for(const c of title.value){chunks.push(offset);offset+=c.length;}}const points=[...new Set([0,...chunks,title.value.length])];pos=action==='left'?(points.filter(x=>x<pos).at(-1)??0):(points.find(x=>x>pos)??title.value.length);}
                    title.setSelectionRange(pos,pos);
                }else window.getSelection()?.modify?.('move',action==='left'?'backward':'forward','character');
                return;
            }
            if(action==='enter'&&host===title){message('標題是單行；請點正文後再換行。');return;}
            const types={enter:'insertParagraph',backspace:'deleteContentBackward',delete:'deleteContentForward',undo:'historyUndo',redo:'historyRedo'};
            if(types[action]&&beforeInput(host,types[action]))document.execCommand(({enter:'insertParagraph',backspace:'delete',delete:'forwardDelete',undo:'undo',redo:'redo'})[action],false,null);
        }finally{ownEdit=false;captureTarget();}
    }
    function button(text,attributes={},label=''){
        const node=document.createElement('button');node.type='button';node.textContent=text;
        for(const [key,value] of Object.entries(attributes))node.dataset[key]=value;
        if(label){node.title=label;node.setAttribute('aria-label',label);}return node;
    }
    function insertSymbol(text){if(typeText(text)){preferences.recent=[text,...preferences.recent.filter(x=>x!==text)].slice(0,16);savePreferences();recentSync.used(text);}}
    /* 「最近」用過的符號：存一份在自己的 Google 雲端硬碟（nd-keyboard-recent.json），手機和電腦都一樣。
       每個符號記下最後使用的時間，合併時照時間排，取最新的 16 個，所以兩台裝置交替用也不會亂。 */
    const recentSync=(()=>{
        const FILE='nd-keyboard-recent.json',KEY='nd-keyboard-recent-at',LIMIT=16;let timer=0,fetchedAt=0,job=null;
        const readTimes=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}};
        const writeTimes=times=>{try{localStorage.setItem(KEY,JSON.stringify(times));}catch(_){}};
        function localItems(){
            const times=readTimes(),n=preferences.recent.length;
            // Symbols used before this version have no time: keep their order, older than anything timed.
            return preferences.recent.map((text,i)=>({text,at:Number(times[text])||(n-i)}));
        }
        function merge(...lists){
            const best=new Map();
            for(const item of lists.flat()){const text=safeText(item?.text),at=Number(item?.at)||0;if(text&&(!best.has(text)||best.get(text)<at))best.set(text,at);}
            return [...best].map(([text,at])=>({text,at})).sort((a,b)=>b.at-a.at).slice(0,LIMIT);
        }
        function apply(items){
            const list=items.map(item=>item.text);
            if(JSON.stringify(list)!==JSON.stringify(preferences.recent)){preferences.recent=list;savePreferences();if(panel&&mode==='symbols'&&group==='recent')renderSymbols();}
            writeTimes(Object.fromEntries(items.map(item=>[item.text,item.at])));
        }
        async function pull(){
            if(job)return job;
            job=(async()=>{
                try{
                    const remote=await noteDriveServer.rootJsonRead(FILE);fetchedAt=Date.now();
                    const merged=merge(Array.isArray(remote?.items)?remote.items:[],localItems());
                    apply(merged);
                    if(JSON.stringify(merged)!==JSON.stringify(merge(remote?.items||[])))push();
                }catch(_){}finally{job=null;}
            })();
            return job;
        }
        function push(){
            clearTimeout(timer);
            timer=setTimeout(()=>{void noteDriveServer.rootJsonUpdate(FILE,current=>({items:merge(Array.isArray(current?.items)?current.items:[],localItems()),updatedAt:new Date().toISOString()})).then(value=>{fetchedAt=Date.now();if(value?.items)apply(value.items);}).catch(()=>{});},1500);
        }
        function used(text){const times=readTimes();times[text]=Date.now();writeTimes(times);push();}
        // When the keyboard opens, pick up symbols used on another device (at most once a minute).
        function refresh(){if(Date.now()-fetchedAt>60000)void pull();}
        return {pull,used,refresh};
    })();
    function renderSymbols(){
        const renderKey=group+(group==='recent'?JSON.stringify(preferences.recent):'');if(lastSymbolKey===renderKey)return;lastSymbolKey=renderKey;
        const grid=$('nk-symbol-grid');grid.replaceChildren();
        const values=group==='recent'?preferences.recent:symbolGroups[group].values;
        for(const text of values)grid.append(button(text,{nkText:text},greekLabels[text]?text+' '+greekLabels[text]:'輸入 '+text));
        if(!values.length){const hint=document.createElement('p');hint.className='nk-hint';hint.textContent='點過的符號會出現在這裡。';grid.append(hint);}
        panel.querySelectorAll('[data-nk-group]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.nkGroup===group)));
    }
    function renderEnglish(){
        if(englishShift===shift)return;englishShift=shift;
        const grid=$('nk-english-grid');
        if(grid.children.length){
            grid.querySelectorAll('[data-nk-base]').forEach(key=>{const base=key.dataset.nkBase,value=shift?(shifted[base]||base.toUpperCase()):base;key.textContent=value;key.dataset.nkLetter=value;key.title='輸入 '+value;key.setAttribute('aria-label',key.title);});
            grid.querySelector('[data-nk-action="shift"]').setAttribute('aria-pressed',String(shift));return;
        }
        const letter=base=>{const value=shift?(shifted[base]||base.toUpperCase()):base;return button(value,{nkLetter:value,nkBase:base},'輸入 '+value);};
        for(const raw of englishRows){const row=document.createElement('div');row.className='nk-key-row nk-letter-row';for(const c of raw)row.append(letter(c));grid.append(row);}
        const shiftKey=button('⇧',{nkAction:'shift'},'大寫／Shift');shiftKey.className='nk-command';shiftKey.setAttribute('aria-pressed',String(shift));
        grid.lastChild.prepend(shiftKey);grid.lastChild.append(letter('\\'));
        const row=document.createElement('div');row.className='nk-key-row nk-space-row';row.append(letter('`'));grid.append(row);
    }
    function mountCommands(){
        // Move one set of command keys into the active layout; no duplicate handlers.
        const mount=(row,names)=>names.forEach(name=>{if(commands[name].parentNode!==row)row.append(commands[name]);});
        if(mode==='english'||mode==='zhuyin'){
            const grid=$(mode==='english'?'nk-english-grid':'nk-phonetic-grid'),rows=grid.querySelectorAll('.nk-letter-row');
            ['backspace','delete','enter'].forEach((name,i)=>mount(rows[i],[name]));
            mount(grid.querySelector('.nk-space-row'),['undo','redo','space','left','right']);
        }else{
            const section=$('nk-'+mode);
            mount(section.querySelector('.nk-edit-row'),['backspace','delete','space','enter']);
            mount(section.querySelector('.nk-nav-row'),['undo','left','right','redo']);
        }
    }
    async function loadDictionary(){
        if(dictionary)return dictionary;if(dictionaryJob)return dictionaryJob;
        dictionaryJob=(async()=>{
            // Dictionary is a separate static file, downloaded only when Zhuyin mode is first used.
            const response=await fetch(new URL('assets/zhuyin-dict.json.gz',document.baseURI));if(!response.ok)throw Error('注音字典下載失敗（'+response.status+'）');const bytes=new Uint8Array(await response.arrayBuffer());
            const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
            dictionary=JSON.parse(text);return dictionary;
        })().catch(error=>{dictionaryJob=null;throw error;});return dictionaryJob;
    }
    function readingKey(){const base=phonetic.slice(0,3).join('');return phonetic[3]?base+(phonetic[3]==='ˉ'?'':phonetic[3]):'*'+base;}
    function renderPhonetic(){
        $('nk-composition').textContent=phonetic.join('')||'點注音，再點候選字';
        const base=phonetic.slice(0,3).join('');candidates=dictionary&&base?[...(dictionary[readingKey()]||'')]:[];
        const pages=Math.max(1,Math.ceil(candidates.length/candidateCount));candidatePage=Math.min(candidatePage,pages-1);
        $('nk-candidate-page').textContent=(candidatePage+1)+' / '+pages;
        $('nk-candidate-prev').disabled=candidatePage===0;$('nk-candidate-next').disabled=candidatePage>=pages-1;
        const grid=$('nk-candidates');grid.replaceChildren();
        for(const text of candidates.slice(candidatePage*candidateCount,(candidatePage+1)*candidateCount))grid.append(button(text,{nkCandidate:text},'選字 '+text));
        const hint=!dictionary?'正在準備離線字庫…':!base?'點注音，再點候選字':!candidates.length?'沒有符合的字，請調整注音或聲調。':!phonetic[3]?'尚未指定聲調，顯示各聲調的候選字。':'點候選字輸入，或按換行選這頁第一個字。';
        $('nk-composition').title=hint;grid.setAttribute('aria-label',hint);
    }
    function chooseCandidate(text){if(typeText(text)){phonetic=['','','',''];candidatePage=0;renderPhonetic();}}
    function renderCustom(){
        const grid=$('nk-custom-grid');grid.replaceChildren();
        for(const item of preferences.custom){const node=button(item.text,{nkCustom:item.id},(removing?'刪除 ':editingCustom?'編輯 ':'輸入 ')+(item.label||item.text));if(removing)node.classList.add('nk-remove');grid.append(node);}
        $('nk-custom-manage').textContent=removing?'完成刪除':'刪除符號';$('nk-custom-manage').setAttribute('aria-pressed',String(removing));
        $('nk-custom-edit').textContent=editingCustom?'完成編輯':'編輯符號';$('nk-custom-edit').setAttribute('aria-pressed',String(!!editingCustom));
        updateStorageHint();
    }
    function render(){
        if(!panel)return;
        panel.querySelectorAll('[data-nk-mode]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.nkMode===mode)));
        for(const name of modes)$('nk-'+name).hidden=name!==mode;
        if(mode==='symbols')renderSymbols();if(mode==='english')renderEnglish();if(mode==='zhuyin')renderPhonetic();if(mode==='custom')renderCustom();
        mountCommands();applySize();scheduleClamp();
    }
    function setMode(next){if(!modes.includes(next))return;mode=next;render();if(mode==='zhuyin'&&!dictionary)void loadDictionary().then(()=>{if(mode==='zhuyin')renderPhonetic();}).catch(()=>{message('字庫未能載入，請再點注音重試。');});}
    function viewportBounds(){const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight};}
    function applySize(width=panelWidth){
        panelWidth=Math.max(minWidth,Math.min(Number.isFinite(width)?width:defaultWidth,maxWidth));
        const visibleWidth=Math.max(160,Math.min(panelWidth,viewportBounds().w-16));
        panel.style.width=Math.round(visibleWidth)+'px';panel.classList.toggle('nk-compact',visibleWidth<420);
        panel.style.setProperty('--nk-key-height',Math.round(Math.max(25,Math.min(48,visibleWidth*.075)))+'px');
        panel.style.setProperty('--nk-key-font',Math.round(Math.max(13,Math.min(23,visibleWidth*.037)))+'px');
        panel.style.setProperty('--nk-phonetic-font',Math.round(Math.max(15,Math.min(25,visibleWidth*.04)))+'px');
    }
    function clampPosition(x,y){
        if(!panel||panel.hidden)return;const v=viewportBounds(),r=panel.getBoundingClientRect();
        x=Math.max(v.x+8,Math.min(Number.isFinite(x)?x:r.left,v.x+v.w-r.width-8));y=Math.max(v.y+8,Math.min(Number.isFinite(y)?y:r.top,v.y+v.h-r.height-8));
        panel.style.left=Math.round(x)+'px';panel.style.top=Math.round(y)+'px';
    }
    function scheduleClamp(){if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(shown&&!panel.hidden){if(sizing)applySize(sizing.nextWidth);clampPosition(drag?.active?drag.nextX:undefined,drag?.active?drag.nextY:undefined);}});}
    function stopDrag(event){
        if(!drag||event?.pointerId!=null&&event.pointerId!==drag.id)return;
        const state=drag;drag=null;panel.classList.remove('nk-dragging');cancelNextClick=state.active||event?.type!=='pointerup';
        if(state.active){clampPosition(state.nextX,state.nextY);const r=panel.getBoundingClientRect();preferences.position={x:r.left,y:r.top};savePreferences();}
        if(state.handle.hasPointerCapture(state.id))state.handle.releasePointerCapture(state.id);
    }
    function stopSizing(){
        if(!sizing)return;const state=sizing;sizing=null;applySize(state.nextWidth);clampPosition();panel.classList.remove('nk-resizing');
        const handle=$('nk-resize-handle');if(handle.hasPointerCapture(state.id))handle.releasePointerCapture(state.id);
        const r=panel.getBoundingClientRect();preferences.width=panelWidth;preferences.position={x:r.left,y:r.top};savePreferences();
    }
    function show(event){
        if(!available())return;if(epoch!==noteOpenRequest)resetTarget();captureTarget();
        if(!target){const range=savedEditorRange?.cloneRange()||document.createRange();if(!editor.contains(range.commonAncestorContainer)){range.selectNodeContents(editor);range.collapse(false);}target={kind:'body',range,backward:false};}
        recentSync.refresh();
        const wasShown=shown;shown=true;panel.hidden=false;trigger.setAttribute('aria-expanded','true');render();
        if(!wasShown){const v=viewportBounds(),r=panel.getBoundingClientRect(),p=preferences.position||{x:event?.clientX??v.x+v.w-r.width-16,y:event?.clientY??v.y+v.h-r.height-16};clampPosition(p.x+(!preferences.position&&event?12:0),p.y+(!preferences.position&&event?12:0));}
    }
    function hide(){if(!panel)return;stopDrag();stopSizing();shown=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');cancelAnimationFrame(resizeFrame);resizeFrame=0;phonetic=['','','',''];candidatePage=0;}
    function modalChanged(){
        if(!modal.classList.contains('active')||epoch!==noteOpenRequest){hide();resetTarget();return;}
        if(modal.inert){stopDrag();stopSizing();}panel.hidden=!shown||modal.inert;if(shown&&!panel.hidden)scheduleClamp();
    }
    function saveCustom(){
        const raw=$('nk-custom-value').value;
        if([...safeText(raw,129)].length>64){message('每個符號或短語最多 64 個字，請縮短後再保存。');return;}
        const text=safeText(raw),label=safeText($('nk-custom-label').value,30);
        if(!text){message('請先貼上想保存的符號或短語。');$('nk-custom-value').focus();return;}
        const existing=preferences.custom.find(x=>x.text===text),editing=typeof editingCustom==='string'?preferences.custom.find(x=>x.id===editingCustom):null;
        if(existing&&existing!==editing){message('這個符號已經在自訂鍵盤裡。');return;}
        if(editing)Object.assign(editing,{text,label});else if(preferences.custom.length<200)preferences.custom.push({id:uid(),text,label});else{message('最多保存 200 個自訂符號，請先移除不需要的項目。');return;}
        editingCustom=null;$('nk-custom-value').value='';$('nk-custom-label').value='';$('nk-custom-save').textContent='加入';savePreferences();renderCustom();message('已保存，可直接點選使用。');
    }
    function exportCustom(){
        const payload={format:'pharmacy-note-symbols-v1',symbols:preferences.custom.map(({text,label})=>({text,label}))};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='藥學筆記-自訂符號.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async function importCustom(file){
        if(!file)return;try{
            if(file.size>128*1024)throw Error('備份檔太大');const data=JSON.parse(await file.text());
            if(data?.format!=='pharmacy-note-symbols-v1'||!Array.isArray(data.symbols)||data.symbols.length>200||data.symbols.some(x=>!x||typeof x.text!=='string'||!safeText(x.text)||[...x.text].length>64||x.label!=null&&typeof x.label!=='string'))throw Error('不是有效的自訂符號備份');
            const known=new Set(preferences.custom.map(x=>x.text)),added=[];
            for(const item of data.symbols){const text=safeText(item.text);if(!known.has(text)){known.add(text);added.push({id:uid(),text,label:safeText(item.label,30)});}}
            if(preferences.custom.length+added.length>200)throw Error('匯入後超過 200 個符號，請先整理目前清單');
            preferences.custom.push(...added);savePreferences();renderCustom();message('已匯入 '+added.length+' 個符號，重複的已略過。');
        }catch(error){message('匯入未完成：'+error.message+'。');}finally{$('nk-import-file').value='';}
    }
    function click(event){
        const node=event.target.closest('button');if(!node||!panel.contains(node))return;
        if(node.dataset.nkMode)return setMode(node.dataset.nkMode);
        if(node.dataset.nkGroup){group=node.dataset.nkGroup;renderSymbols();return;}
        if(node.dataset.nkText)return insertSymbol(node.dataset.nkText);
        if(node.dataset.nkLetter)return typeText(node.dataset.nkLetter);
        if(node.dataset.nkCandidate)return chooseCandidate(node.dataset.nkCandidate);
        if(node.dataset.nkPhonetic){const c=node.dataset.nkPhonetic,index=phoneticGroups.findIndex(g=>g.includes(c));if(index>=0)phonetic[index]=c;candidatePage=0;renderPhonetic();return;}
        if(node.dataset.nkCustom){
            const item=preferences.custom.find(x=>x.id===node.dataset.nkCustom);if(!item)return;
            if(removing){preferences.custom=preferences.custom.filter(x=>x!==item);savePreferences();renderCustom();message('已刪除自訂符號「'+(item.label||item.text)+'」。');}
            else if(editingCustom){editingCustom=item.id;$('nk-custom-value').value=item.text;$('nk-custom-label').value=item.label;$('nk-custom-save').textContent='保存修改';}
            else insertSymbol(item.text);return;
        }
        const action=node.dataset.nkAction;
        if(action==='shift'){shift=!shift;renderEnglish();return;}
        if(action==='clear-phonetic'){phonetic=['','','',''];candidatePage=0;renderPhonetic();return;}
        if(action==='literal-phonetic'){if(phonetic.some(Boolean)&&typeText(phonetic.join(''))){phonetic=['','','',''];renderPhonetic();}return;}
        if(action==='candidate-prev'||action==='candidate-next'){candidatePage+=action==='candidate-next'?1:-1;renderPhonetic();return;}
        if(action==='save-custom'){saveCustom();return;}
        if(action==='remove-custom'){removing=!removing;editingCustom=null;$('nk-custom-value').value='';$('nk-custom-label').value='';$('nk-custom-save').textContent='加入';renderCustom();return;}
        if(action==='edit-custom'){editingCustom=editingCustom?null:true;removing=false;$('nk-custom-value').value='';$('nk-custom-label').value='';$('nk-custom-save').textContent='加入';renderCustom();message(editingCustom?'點一個自訂符號後，可修改內容與名稱。':'');return;}
        if(action==='export'){exportCustom();return;}if(action==='import'){$('nk-import-file').click();return;}
        if(['backspace','delete','space','enter','left','right','undo','redo'].includes(action))keyCommand(action);
    }
    function initialize(){
        if(initialized)return;initialized=true;modal=$('noteModal');editor=$('modal-text');title=$('note-title-input');
        let hash=2166136261;for(const c of String(noteDriveBoot.workspace||noteDriveBoot.appUrl||'pharmacy-notes'))hash=Math.imul(hash^c.charCodeAt(0),16777619);storageKey='pharmacy-note-keyboard-v1-'+(hash>>>0).toString(36);readPreferences();panelWidth=preferences.width;
        panel=document.createElement('section');panel.id='note-floating-keyboard';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','浮動文字鍵盤');
        const editRows='<div class="nk-command-rows"><div class="nk-key-row nk-edit-row"></div><div class="nk-key-row nk-nav-row"></div></div>';
        panel.setAttribute('aria-description','右鍵關閉；按住左鍵拖曳移動；右下角縮放。');
        panel.innerHTML=`<div class="nk-content"><nav class="nk-tabs" aria-label="鍵盤類型" title="按住左鍵拖曳移動；右鍵關閉；右下角縮放">${[['symbols','符號'],['english','英文／數字'],['zhuyin','注音'],['custom','自訂']].map(([id,label])=>`<button type="button" data-nk-mode="${id}" aria-pressed="false">${label}</button>`).join('')}</nav>
          <div class="nk-body"><section id="nk-symbols"><nav id="nk-groups" aria-label="符號分類"></nav><div id="nk-symbol-grid" class="nk-symbol-grid"></div>${editRows}</section>
          <section id="nk-english" hidden><div id="nk-english-grid"></div></section>
          <section id="nk-zhuyin" hidden><div class="nk-composition-row"><output id="nk-composition" aria-label="注音組字"></output><button type="button" data-nk-action="clear-phonetic">清除</button><button type="button" data-nk-action="literal-phonetic" title="直接輸入注音符號">注音原字</button><span class="nk-candidate-controls"><button type="button" id="nk-candidate-prev" data-nk-action="candidate-prev" aria-label="上一頁候選字" title="上一頁候選字">‹</button><span id="nk-candidate-page"></span><button type="button" id="nk-candidate-next" data-nk-action="candidate-next" aria-label="下一頁候選字" title="下一頁候選字">›</button></span></div><div id="nk-candidates" class="nk-candidates" role="group"></div><div id="nk-phonetic-grid"></div></section>
          <section id="nk-custom" hidden><div class="nk-custom-form"><label>符號／短語<input id="nk-custom-value" type="text" maxlength="128" placeholder="貼上想保存的符號" autocomplete="off"></label><label>名稱（選填）<input id="nk-custom-label" type="text" maxlength="30" placeholder="方便辨識的名稱" autocomplete="off"></label><button type="button" id="nk-custom-save" data-nk-action="save-custom">加入</button></div><div class="nk-custom-tools"><button type="button" id="nk-custom-edit" data-nk-action="edit-custom">編輯符號</button><button type="button" id="nk-custom-manage" data-nk-action="remove-custom">刪除符號</button><button type="button" data-nk-action="export">匯出備份</button><button type="button" data-nk-action="import">匯入</button><input id="nk-import-file" type="file" accept="application/json,.json" hidden></div><p id="nk-custom-hint" class="nk-hint"></p><div id="nk-custom-grid" class="nk-symbol-grid"></div>${editRows}</section></div>
          <div id="nk-status" role="status" aria-live="polite"></div><button type="button" id="nk-resize-handle" aria-label="調整鍵盤大小" title="拖曳縮放鍵盤；雙擊還原大小；方向鍵也可調整"><span aria-hidden="true">◢</span></button></div>`;
        // A sibling avoids sending custom-symbol form input through note autosave.
        // Its stacking order stays below the later image/table/link dialogs.
        modal.after(panel);
        // 分類順序：常用 → 最近 → 其他。
        for(const [key,value]of Object.entries(symbolGroups)){$('nk-groups').append(button(value.name,{nkGroup:key}));if(key==='common')$('nk-groups').append(button('最近',{nkGroup:'recent'}));}
        for(const [name,text,label] of [['backspace','⌫','退格'],['delete','Del','刪除下一字'],['space','空白','空白'],['enter','↵','換行／注音選字'],['left','←','游標往左'],['right','→','游標往右'],['undo','↶','復原'],['redo','↷','重做']]){commands[name]=button(text,{nkAction:name},label);commands[name].className='nk-command';}
        phoneticRows.forEach((values,i)=>{const row=document.createElement('div');row.className='nk-key-row nk-letter-row';values.forEach((c,j)=>{const key=button(c,{nkPhonetic:c},'注音 '+c);const hint=document.createElement('small');hint.textContent=phoneticHints[i][j];key.append(hint);row.append(key);});$('nk-phonetic-grid').append(row);});
        const tone=button('一聲',{nkPhonetic:'ˉ'},'注音一聲（ˉ）');tone.className='nk-command';$('nk-phonetic-grid').lastChild.prepend(tone);
        const spaceRow=document.createElement('div');spaceRow.className='nk-key-row nk-space-row';$('nk-phonetic-grid').append(spaceRow);
        trigger=button('⌨ 鍵盤',{},'開啟／關閉浮動鍵盤（也可按右鍵）');trigger.id='note-keyboard-toggle';trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');modal.querySelector('.toolbar-row-main').append(trigger);
        trigger.addEventListener('pointerdown',event=>{if(event.button===0){captureTarget();event.preventDefault();}});trigger.addEventListener('click',()=>{if(shown&&!panel.hidden)hide();else show();});
        const toggleContext=event=>{if(event.shiftKey||!available()||panel.contains(event.target)&&event.target.closest('input,textarea,select'))return;event.preventDefault();if(shown&&!panel.hidden){captureTarget();hide();restoreTarget();}else show(event);};
        modal.addEventListener('contextmenu',toggleContext);panel.addEventListener('contextmenu',toggleContext);
        modal.addEventListener('pointerdown',event=>{if(event.button===2)captureTarget();},true);
        for(const type of ['select','input','keyup','pointerup','focus'])title.addEventListener(type,()=>{if(shown)captureTarget();});
        document.addEventListener('selectionchange',()=>{if(shown&&!drag&&!sizing&&!panel.contains(document.activeElement))captureTarget();});
        modal.addEventListener('compositionstart',()=>physicalComposing=true,true);modal.addEventListener('compositionend',()=>{physicalComposing=false;captureTarget();},true);
        panel.addEventListener('pointerdown',event=>{
            if(event.button!==0||event.isPrimary===false||event.target.closest('input,textarea,select,#nk-resize-handle'))return;
            event.preventDefault();stopDrag();cancelNextClick=false;
            const handle=event.target.closest('button')||panel;drag={id:event.pointerId,x:event.clientX,y:event.clientY,handle,active:false};handle.setPointerCapture(event.pointerId);
        });
        panel.addEventListener('click',event=>{if(cancelNextClick&&event.detail!==0){cancelNextClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);panel.addEventListener('click',click);
        $('nk-custom-value').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();saveCustom();}});$('nk-custom-label').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();saveCustom();}});
        $('nk-import-file').addEventListener('change',event=>void importCustom(event.target.files[0]));
        document.addEventListener('pointermove',event=>{
            if(drag?.id!==event.pointerId)return;if(!event.buttons){stopDrag(event);return;}
            const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
            if(!drag.active){if(Math.hypot(dx,dy)<6)return;const r=panel.getBoundingClientRect();drag.active=true;drag.left=r.left;drag.top=r.top;panel.classList.add('nk-dragging');}
            drag.nextX=drag.left+dx;drag.nextY=drag.top+dy;scheduleClamp();
        });
        for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,stopDrag);
        const sizeHandle=$('nk-resize-handle');
        sizeHandle.addEventListener('pointerdown',event=>{
            if(event.button!==0)return;event.preventDefault();stopDrag();cancelNextClick=false;
            const r=panel.getBoundingClientRect();sizing={id:event.pointerId,x:event.clientX,y:event.clientY,width:r.width,height:r.height,nextWidth:r.width};
            sizeHandle.setPointerCapture(event.pointerId);panel.classList.add('nk-resizing');
        });
        sizeHandle.addEventListener('pointermove',event=>{if(sizing?.id!==event.pointerId)return;const s=sizing,dx=event.clientX-s.x,dy=event.clientY-s.y;s.nextWidth=s.width*(1+(dx*s.width+dy*s.height)/(s.width*s.width+s.height*s.height));scheduleClamp();});
        for(const type of ['pointerup','pointercancel','lostpointercapture'])sizeHandle.addEventListener(type,stopSizing);
        sizeHandle.addEventListener('dblclick',()=>{stopSizing();applySize(defaultWidth);clampPosition();preferences.width=panelWidth;savePreferences();});
        sizeHandle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();event.stopPropagation();applySize(event.key==='Home'?defaultWidth:panelWidth+(['ArrowLeft','ArrowUp'].includes(event.key)?-20:20));clampPosition();preferences.width=panelWidth;savePreferences();});
        window.addEventListener('blur',()=>{stopDrag();stopSizing();});
        const viewportChanged=()=>{applySize();scheduleClamp();};window.addEventListener('resize',viewportChanged);window.visualViewport?.addEventListener('resize',viewportChanged);
        new ResizeObserver(scheduleClamp).observe(panel);new MutationObserver(modalChanged).observe(modal,{attributes:true,attributeFilter:['class','inert']});
        document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&shown&&!panel.hidden&&available()){event.preventDefault();event.stopPropagation();hide();restoreTarget();}},true);
        const firstPull=()=>setTimeout(()=>void recentSync.pull(),3000);
        if(window.noteDriveStartupComplete)firstPull();else window.addEventListener('note-drive-state',function once(event){if(event.detail?.loaded){removeEventListener('note-drive-state',once);firstPull();}});
        window.addEventListener('storage',event=>{if(event.key===storageKey){readPreferences();if(!sizing){applySize(preferences.width);scheduleClamp();}if(mode==='custom')renderCustom();if(mode==='symbols'&&group==='recent')renderSymbols();}});
        render();
    }
    return {initialize};
})();
