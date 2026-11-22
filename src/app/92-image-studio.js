/* Source: 92-image-studio.js */
/* Note image studio. Original assets are retained separately from editable objects. */
const noteImageStudio = (() => {
    const M=noteStudioModel,NS='http://www.w3.org/2000/svg',ATTR='data-note-image-edit';
    const names={image:'圖片',pen:'畫筆',arrow:'箭頭',line:'直線',rect:'方框',ellipse:'圓形',highlight:'螢光標記',text:'文字',badge:'編號',callout:'說明框'};
    const colorMemory=createNoteImageColorMemory();
    let session=null,sequence=0,frame=0,clipboard=null,space=false;
    const el=id=>document.getElementById(id),isOpen=()=>!!session;
    const snapshot=()=>JSON.stringify(session.doc);
    const selected=()=>session?.doc?session.doc.objects.filter(o=>session.selected.includes(o.id)):[];
    const editable=()=>selected().filter(o=>!o.locked&&o.visible);
    function units(items){const groups=new Map();for(const o of items){const key=o.groupId||o.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}return [...groups.values()].map(objects=>({objects,bounds:M.box(objects.flatMap(M.objectCorners))}));}
    function toolStyle(type){const d={...session.defaults};if(!['text','callout','badge'].includes(type))delete d.weight;return {...d,opacity:type==='highlight'?d.opacity*.28:d.opacity,fill:type==='highlight'?d.fill||d.color:type==='callout'?d.fill||'#ffffff':d.fill};}
    const inputTarget=node=>!!node?.closest?.('input,textarea,select,[contenteditable="true"]');
    const readBlob=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('圖片讀取失敗'));r.readAsDataURL(blob);});
    function message(text){if(el('studio-status'))el('studio-status').textContent=text;}
    function setSelection(ids,{individual=false}={}){
        if(!session)return;const wanted=new Set(ids),groups=new Set(session.doc.objects.filter(o=>wanted.has(o.id)&&o.groupId).map(o=>o.groupId));
        const next=session.doc.objects.filter(o=>o.visible&&(wanted.has(o.id)||!individual&&groups.has(o.groupId))).map(o=>o.id);
        if(next.length===session.selected.length&&next.every((id,i)=>id===session.selected[i]))return;
        session.selected=next;update();schedule();
    }
    function commit(before){
        if(!session)return;
        if(snapshot()!==before){session.undo.push(before);if(session.undo.length>80)session.undo.shift();session.redo=[];notePersistence.changed();}
        update();schedule();
    }
    function change(fn){if(!session?.ready||session.busy)return;finishText();cancelGesture();const before=snapshot();fn();commit(before);}
    function init(){
        if(el('noteImageEditModal'))return;
        const root=document.createElement('div');root.id='noteImageEditModal';root.className='modal-overlay';root.hidden=true;
        root.innerHTML=noteStudioUI.markup();
        document.body.append(root);
        root.addEventListener('pointerdown',event=>{if(!event.target.closest('.studio-shape-group'))toggleShapeMenu(false);},true);
        root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.studioColor)setStyle({color:button.dataset.studioColor});if(button.dataset.studioAction)void action(button.dataset.studioAction);if(button.dataset.studioShapeMore!==undefined){toggleShapeMenu();return;}if(button.dataset.studioShape){toggleShapeMenu(false);setTool(button.dataset.studioShape);return;}if(button.dataset.studioTool)setTool(button.dataset.studioTool);});
        root.addEventListener('change',propertyChange);
        root.addEventListener('input',event=>{if(['studio-brightness','studio-contrast','studio-saturation'].includes(event.target.id))el(event.target.id+'-value').textContent=event.target.value;if(['studio-text-size'].includes(event.target.id)&&event.target.value!=='')propertyChange(event);});
        root.addEventListener('pointerdown',event=>{if(session?.textEdit&&event.target!==el('studio-text-editor')){if(event.target.closest('[data-studio-action="edit-text"]')){event.preventDefault();return;}finishText();}},true);
        root.addEventListener('focusout',event=>{if(['studio-text-size','studio-w','studio-h'].includes(event.target.id)&&selected().some(o=>o.type==='text'))requestAnimationFrame(()=>{if(session)update();});});
        const viewport=el('studio-viewport');viewport.addEventListener('pointerdown',pointerDown);viewport.addEventListener('pointermove',pointerMove);viewport.addEventListener('pointerup',pointerUp);viewport.addEventListener('pointercancel',event=>{cancelGesture();session?.pointers.delete(event.pointerId);if(session?.pointers.size<2)session.pinch=null;});
        viewport.addEventListener('lostpointercapture',event=>{if(session?.gesture?.id===event.pointerId||session?.pendingPress?.event.pointerId===event.pointerId){cancelGesture();session?.pointers.delete(event.pointerId);}});
        viewport.addEventListener('dblclick',event=>{if(!session?.ready||session.busy||inputTarget(event.target))return;const hit=document.elementFromPoint(event.clientX,event.clientY);if(hit?.closest('[data-studio-handle]'))return;const item=hit?.closest('[data-studio-object]')||event.target.closest('[data-studio-object]'),o=session.doc.objects.find(o=>o.id===item?.dataset.studioObject);if(o&&!o.locked&&['text','callout','badge'].includes(o.type))beginText(o.id);else if(o?.type==='image'){setSelection([o.id],{individual:true});void openImageCrop();}});
        viewport.addEventListener('wheel',wheelZoom,{passive:false});
        viewport.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();});
        viewport.addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();message('請先將圖片加入筆記，再開啟編輯。');}});
        const text=el('studio-text-editor');text.addEventListener('input',()=>{const o=session?.doc.objects.find(o=>o.id===session.textEdit?.id);if(o){o.text=text.value;M.fitText(o);positionText();schedule();notePersistence.changed();}});text.addEventListener('compositionstart',()=>{if(session?.textEdit)session.textEdit.composing=true;});text.addEventListener('compositionend',()=>{if(session?.textEdit)session.textEdit.composing=false;});text.addEventListener('blur',()=>finishText());
        const crop=el('studio-crop-preview');crop.addEventListener('pointerdown',cropPointer);crop.addEventListener('pointermove',cropPointer);crop.addEventListener('pointerup',cropPointer);crop.addEventListener('pointercancel',event=>{if(session?.imageCrop)session.imageCrop.drag=null;});
        colorMemory.mount(el('studio-color-memory'),color=>setStyle({color}));
        new ResizeObserver(scheduleViewportResize).observe(viewport);
    }
    async function loadSource(src,signal){
        src=await notePersistence.resolveEditorValue(src);
        if(!/^data:image\//i.test(src||'')){
            if(!/^https?:|^blob:/i.test(src||''))throw Error('圖片網址無效');
            src=await noteExternalImages.resolve(src,{signal});
        }
        const image=new Image();image.decoding='async';image.src=src;await noteImageReady(image);if(signal?.aborted)throw Error('已停止圖片載入');
        if(!image.naturalWidth||!image.naturalHeight)throw Error('圖片尺寸無效');
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;canvas.getContext('2d').drawImage(image,0,0,1,1);canvas.toDataURL();return {src,image};
    }
    function identity(src,metadata){
        if(metadata?.v!==4)return noteImageStorage.imageIdentity(src,metadata);
        const sources=M.embedded(src),doc=M.validate(metadata.doc,metadata.w,metadata.h);
        for(const[id,a]of Object.entries(doc.assets))if(!sources[id]||a.key!==noteImageStorage.sourceKey(sources[id]))throw Error('圖片素材校驗不符，原圖與標記均已保留');
        const storedKey=noteImageStorage.sourceKey(sources.original);
        return {source:sources.original,sources,doc,key:metadata.storedKey===storedKey&&/^note-image-source:\d+:[a-z0-9]+:[a-z0-9]+$/.test(metadata.sourceKey||'')?metadata.sourceKey:storedKey,plain:false};
    }
    async function open(target,recovered=null){
        if(session||!el('noteModal')?.classList.contains('active'))return;
        const source=target.image?.getAttribute('src')||currentPastedImages[target.gallery];if(!source)return;
        init();resetInlineImageDrag();clearInlineImageSelection();window.getSelection()?.removeAllRanges();
        const root=el('noteImageEditModal'),note=el('noteModal');
        const s=session={id:++sequence,target,source,ready:false,busy:false,doc:null,sources:{},loaded:new Map(),selected:[],tool:'select',undo:[],redo:[],zoom:1,fit:true,resizeFrame:0,gesture:null,pointers:new Map(),abort:new AbortController(),inert:note.inert,overflow:document.body.style.overflow,color:colorMemory.begin(),stroke:3,font:24,dragGuides:[],nodes:new Map(),assetSignature:'',textEdit:null,imageCrop:null};
        s.defaults={color:s.color,stroke:s.stroke,font:s.font,fill:null,opacity:1,dash:'solid',family:'sans',bold:true,weight:600,italic:false,lineHeight:1.4,align:'left'};
        note.inert=true;document.body.style.overflow='hidden';root.hidden=false;root.classList.add('active');root.classList.remove('studio-inspector-open','studio-cropping');for(const node of root.querySelectorAll('.studio-workspace,.studio-commandbar,.studio-stylebar,.studio-textbar,.studio-footer'))node.inert=false;el('studio-discard').hidden=true;el('studio-image-crop-panel').hidden=true;
        el('studio-scene').replaceChildren();el('studio-assets').replaceChildren();el('studio-selection').replaceChildren();el('studio-guides').replaceChildren();message('正在讀取原圖與標記…');notePersistence.refreshStatus();update();root.querySelector('[data-studio-action="cancel"]').focus();
        const timer=setTimeout(()=>s.abort.abort(),20000);
        try{
            let metadata=null;try{metadata=target.image?JSON.parse(target.image.getAttribute(ATTR)||'null'):currentGalleryImageEdits[noteImageStorage.galleryKey(source)];}catch(_){throw Error('圖片編輯資料無法讀取，未修改原圖片');}
            const rawTextDoc=recovered?.studioVersion===4?recovered.doc:metadata?.v===4?metadata.doc:null;s.needsTextMigration=!!recovered?.textLayoutUpgrade||!!rawTextDoc?.objects?.some(o=>o.type==='text'&&o.textLayout!=='manual-lines');
            const originalIdentity=recovered?null:identity(source,metadata);
            const initialSource=recovered?.source||originalIdentity?.source||source;
            const loaded=await loadSource(initialSource,s.abort.signal);if(session!==s)return;
            s.original=loaded.src;s.originalKey=recovered?.sourceKey||originalIdentity?.key||noteImageStorage.sourceKey(loaded.src);s.w=loaded.image.naturalWidth;s.h=loaded.image.naturalHeight;
            s.sources=recovered?.studioVersion===4?{...recovered.images,original:loaded.src}:originalIdentity?.sources?{...originalIdentity.sources}: {original:loaded.src};
            s.doc=M.migrate(recovered?.doc||originalIdentity?.doc,s.w,s.h);
            for(const[id,asset]of Object.entries(s.doc.assets)){
                const data=id==='original'?loaded:await loadSource(s.sources[id],s.abort.signal);if(session!==s)return;
                s.sources[id]=data.src;s.loaded.set(id,data.image);asset.key=noteImageStorage.sourceKey(data.src);
            }
            s.initial=recovered?.initial?JSON.stringify(M.migrate(recovered.initial,s.w,s.h)):JSON.stringify(s.doc);
            // Older drafts carry no asset keys; canonicalize their initial original reference too.
            if(recovered?.initial){const initial=JSON.parse(s.initial);for(const[id,a]of Object.entries(initial.assets))if(s.sources[id])a.key=noteImageStorage.sourceKey(s.sources[id]);s.initial=JSON.stringify(initial);}
            s.ready=true;s.font=Math.round(M.clamp(Math.max(s.w,s.h)/24,18,64));s.stroke=Math.round(M.clamp(Math.max(s.w,s.h)/200,2,12));colorMemory.adopt(s.doc.objects.map(o=>o.color));
            Object.assign(s.defaults,{font:s.font,stroke:s.stroke});
            fit();update();schedule();message('選取物件調整；長按後拖動畫布；滾輪縮放。');
        }catch(error){if(session===s){message('圖片開啟未完成：'+error.message+'。原內容未更動。');update();}}
        finally{clearTimeout(timer);}
    }
    function close(force=false){
        if(!session)return;finishText();const s=session;
        if(!force&&s.ready&&(s.gesture||snapshot()!==s.initial)){el('studio-discard').hidden=false;el('studio-discard').querySelector('button').focus();return;}
        cancelGesture();clearWheel();s.abort.abort();cancelAnimationFrame(s.resizeFrame);s.resizeFrame=0;cancelAnimationFrame(frame);frame=0;session=null;space=false;
        el('noteImageEditModal').hidden=true;el('noteImageEditModal').classList.remove('active');el('studio-text-editor').hidden=true;
        el('noteModal').inert=s.inert;document.body.style.overflow=s.overflow;el('studio-scene').replaceChildren();el('studio-assets').replaceChildren();s.loaded.clear();notePersistence.changed();
        if(s.target.image?.isConnected)selectInlineImage(s.target.image);else el('modal-text').focus({preventScroll:true});
    }
    function frameFor(items=selected()){
        if(!items.length)return null;if(items.length===1)return M.objectCorners(items[0]);return M.corners(M.box(items.flatMap(M.objectCorners)));
    }
    function selectedBox(){const f=frameFor();return f?M.box(f):null;}
    function sceneGeometry(full=session?.tool==='crop'){return M.geometry(session.doc,full);}
    function render(){
        if(frame)cancelAnimationFrame(frame);frame=0;const s=session;if(!s?.ready)return;const d=s.doc,g=sceneGeometry(),scene=el('studio-scene');
        renderViewport(g);
        const assetSignature=Object.keys(d.assets).join('|');if(assetSignature!==s.assetSignature){el('studio-assets').innerHTML=M.assetMarkup(d,s.sources);s.assetSignature=assetSignature;}
        let clip=el('studio-canvas-clip');if(!clip){clip=document.createElementNS(NS,'clipPath');clip.id='studio-canvas-clip';clip.append(document.createElementNS(NS,'rect'));el('studio-assets').append(clip);}const c=s.tool==='crop'?d.bounds:d.crop;for(const[key,value]of Object.entries({x:c.x,y:c.y,width:c.w,height:c.h}))clip.firstElementChild.setAttribute(key,value);scene.setAttribute('clip-path','url(#studio-canvas-clip)');
        let bg=scene.querySelector('[data-studio-background]');if(!bg){bg=document.createElementNS(NS,'rect');bg.dataset.studioBackground='1';scene.prepend(bg);}for(const[key,value]of Object.entries({x:d.bounds.x,y:d.bounds.y,width:d.bounds.w,height:d.bounds.h,fill:d.background||'transparent'}))bg.setAttribute(key,value);
        const wanted=new Set(d.objects.map(o=>o.id));for(const[id,node]of s.nodes)if(!wanted.has(id)){node.remove();s.nodes.delete(id);}
        let previous=bg;
        for(const o of d.objects){
            let node=s.nodes.get(o.id);if(!node){node=document.createElementNS(NS,'g');node.dataset.studioObject=o.id;s.nodes.set(o.id,node);}
            const content={...o,matrix:null,visible:null,locked:null,name:null};const signature=JSON.stringify(content);
            if(node._signature!==signature){node.innerHTML=`<rect width="${o.w}" height="${o.h}" fill="transparent" pointer-events="all"/>`+M.objectMarkup(o,d);node._signature=signature;}
            node.setAttribute('transform',`matrix(${o.matrix.join(' ')})`);node.setAttribute('opacity',o.opacity);node.setAttribute('visibility',o.visible&&s.textEdit?.id!==o.id?'visible':'hidden');node.style.cursor=o.locked?'default':s.tool==='select'?'move':'inherit';
            if(previous.nextElementSibling!==node)previous.after(node);previous=node;
        }
        renderSelection(g);positionText();
    }
    function renderSelection(g){
        const s=session,overlay=el('studio-selection'),guides=el('studio-guides');let markup='';overlay.dataset.selectedIds=JSON.stringify(s.selected);
        if(s.tool==='crop'){
            const c=M.corners(s.doc.crop).map(p=>M.transform(p,g.m));markup=`<path d="M0 0H${g.w}V${g.h}H0Z M${c.map(p=>p.x+' '+p.y).join('L')}Z" fill="#0f172a77" fill-rule="evenodd"/><polygon points="${c.map(p=>p.x+','+p.y)}" fill="none" stroke="#ffffff" stroke-width="${2/s.zoom}"/>`;
        }else if(s.gesture?.mode==='marquee'){
            const b=M.box([s.gesture.startDisplay,s.gesture.currentDisplay||s.gesture.startDisplay]);markup=`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#2563eb18" stroke="#2563eb" stroke-width="${1.5/s.zoom}"/>`;
        }else if(s.tool==='select'){
            const f=frameFor()?.map(p=>M.transform(p,g.m));if(f){
                const movable=editable().length===selected().length;
                markup=`<polygon points="${f.map(p=>p.x+','+p.y)}" fill="none" stroke="${movable?'#7c3aed':'#64748b'}" stroke-width="${1.5/s.zoom}"/>`;
                if(movable){
                    const handles=[];for(let i=0;i<4;i++){handles.push({p:f[i],corner:i});handles.push({p:{x:(f[i].x+f[(i+1)%4].x)/2,y:(f[i].y+f[(i+1)%4].y)/2},edge:i});}
                    const size=10/s.zoom;markup+=handles.map(h=>`<rect data-studio-handle="resize" ${h.corner!=null?'data-corner="'+h.corner+'"':'data-edge="'+h.edge+'"'} x="${h.p.x-size/2}" y="${h.p.y-size/2}" width="${size}" height="${size}" rx="${2/s.zoom}" fill="#fff" stroke="#7c3aed" stroke-width="${1.5/s.zoom}"/>`).join('');
                    const top={x:(f[0].x+f[1].x)/2,y:(f[0].y+f[1].y)/2},center={x:(f[0].x+f[2].x)/2,y:(f[0].y+f[2].y)/2},length=Math.hypot(top.x-center.x,top.y-center.y)||1,turn={x:top.x+(top.x-center.x)/length*28/s.zoom,y:top.y+(top.y-center.y)/length*28/s.zoom};
                    markup+=`<path d="M${top.x} ${top.y}L${turn.x} ${turn.y}" stroke="#7c3aed" stroke-width="${1/s.zoom}"/><circle data-studio-handle="rotate" cx="${turn.x}" cy="${turn.y}" r="${8/s.zoom}" fill="#fff" stroke="#7c3aed" stroke-width="${1.5/s.zoom}"/>`;
                }
            }
        }
        if(overlay._markup!==markup){overlay.innerHTML=markup;overlay._markup=markup;}
        const guideMarkup=s.dragGuides.map(line=>`<line x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" stroke="#db2777" stroke-dasharray="${4/s.zoom} ${3/s.zoom}" stroke-width="${1/s.zoom}"/>`).join('');
        if(guides._markup!==guideMarkup){guides.innerHTML=guideMarkup;guides._markup=guideMarkup;}
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(render);}
    function scheduleViewportResize(){
        const s=session;if(!s?.ready||s.resizeFrame)return;
        // ResizeObserver only schedules work; writing layout inside its callback
        // can make scrollbar changes trigger another resize in the same frame.
        s.resizeFrame=requestAnimationFrame(()=>{
            s.resizeFrame=0;if(session!==s||!s.ready)return;
            if(s.fit)fit();else schedule();
        });
    }
    // View changes do not serialize every stroke or rebuild any object markup.
    function renderViewport(g=sceneGeometry()){
        const s=session,svg=el('studio-artboard'),surface=el('studio-surface');
        svg.setAttribute('viewBox',`0 0 ${g.w} ${g.h}`);
        svg.style.width=surface.style.width=g.w*s.zoom+'px';
        svg.style.height=surface.style.height=g.h*s.zoom+'px';
        el('studio-scene').setAttribute('transform',`matrix(${g.m.join(' ')})`);
    }
    function fit(){
        if(!session?.ready)return;
        const g=sceneGeometry(),v=el('studio-viewport');if(!v.clientWidth||!v.clientHeight)return;
        // Use the actual space around the image. The previous 64px allowance
        // was smaller than its 48px + 48px padding, so scrollbars oscillated.
        const space=getComputedStyle(v.querySelector('.studio-space'));
        const inset=(a,b)=>(parseFloat(space[a])||0)+(parseFloat(space[b])||0);
        const width=Math.max(1,v.clientWidth-inset('paddingLeft','paddingRight')-2),height=Math.max(1,v.clientHeight-inset('paddingTop','paddingBottom')-2);
        session.zoom=Math.max(.01,Math.min(width/g.w,height/g.h,1));session.fit=true;render();update();
    }
    function zoomAt(factor,x,y){
        const s=session;if(!s?.ready)return;const v=el('studio-viewport'),vr=v.getBoundingClientRect(),r=el('studio-artboard').getBoundingClientRect();x=x??vr.left+vr.width/2;y=y??vr.top+vr.height/2;
        const p={x:(x-r.left)/s.zoom,y:(y-r.top)/s.zoom};s.zoom=M.clamp(s.zoom*factor,.02,8);s.fit=false;renderViewport();const next=el('studio-artboard').getBoundingClientRect();v.scrollLeft+=next.left+p.x*s.zoom-x;v.scrollTop+=next.top+p.y*s.zoom-y;
        renderSelection(sceneGeometry());positionText();el('studio-zoom-value').textContent=Math.round(s.zoom*100)+'%';
    }
    function clearWheel(){const s=session;if(!s)return;cancelAnimationFrame(s.wheelFrame);s.wheelFrame=0;s.wheel=null;}
    function flushWheel(){const s=session,zoom=s?.wheel;clearWheel();if(zoom)zoomAt(Math.exp(zoom.delta),zoom.x,zoom.y);}
    function wheelZoom(event){
        const s=session;if(!s?.ready||s.busy||s.imageCrop||inputTarget(event.target))return;
        event.preventDefault();clearPendingPress();if(s.gesture||s.pinch)return;
        const unit=event.deltaMode===1?16:event.deltaMode===2?el('studio-viewport').clientHeight:1;
        const delta=M.clamp(-event.deltaY*unit*.0018,-.55,.55);
        s.wheel={delta:M.clamp((s.wheel?.delta||0)+delta,-2,2),x:event.clientX,y:event.clientY};
        if(!s.wheelFrame)s.wheelFrame=requestAnimationFrame(flushWheel);
    }
    function positionText(){
        const s=session;if(!s?.textEdit)return;const o=s.doc.objects.find(o=>o.id===s.textEdit.id);if(!o)return;
        const input=el('studio-text-editor'),matrix=M.mul(sceneGeometry().m,o.matrix);
        Object.assign(input.style,{width:o.w+'px',height:o.h+'px',font:M.font(o),lineHeight:o.lineHeight,textAlign:o.align,color:o.color,backgroundColor:o.fill||'#ffffffdd',transform:`matrix(${matrix.map((v,i)=>i<4?v*s.zoom:v*s.zoom).join(',')})`});
    }
    function value(id,next){const node=el(id);if(node&&document.activeElement!==node)node.value=next;}
    function update(){
        const s=session;if(!s)return;const ready=s.ready&&!s.busy,items=selected(),o=items.length===1?items[0]:null,locked=items.some(o=>o.locked),style=o||s.defaults;
        el('noteImageEditModal').querySelectorAll('button').forEach(button=>button.disabled=!ready&&!['cancel','discard','continue','fullscreen','inspector'].includes(button.dataset.studioAction));
        el('studio-inspector').querySelectorAll('input,select').forEach(node=>node.disabled=!ready||locked&&!!node.closest('#studio-object-properties'));
        for(const action of ['duplicate','group','ungroup','delete','front','back','up','down','align-left','align-center','align-right','align-top','align-middle','align-bottom','distribute-x','distribute-y','flip-x','flip-y','image-crop','image-reset','edit-text']){
            const min=action==='group'?2:action.startsWith('distribute')?3:1;
            el('noteImageEditModal').querySelectorAll('[data-studio-action="'+action+'"]').forEach(button=>button.disabled=!ready||(action.startsWith('distribute')?units(items).length:items.length)<min||locked||action==='ungroup'&&!items.some(o=>o.groupId));
        }
        el('noteImageEditModal').querySelector('[data-studio-action="undo"]').disabled=!ready||!s.undo.length;el('noteImageEditModal').querySelector('[data-studio-action="redo"]').disabled=!ready||!s.redo.length;
        el('noteImageEditModal').querySelectorAll('[data-studio-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.studioTool===s.tool)));
        el('studio-zoom-value').textContent=Math.round(s.zoom*100)+'%';
        const drawing=!['select','hand','crop'].includes(s.tool);el('studio-object-properties').hidden=!items.length&&!drawing;
        const textContext=items.length?items.every(o=>['text','callout','badge'].includes(o.type)):s.tool==='text';
        el('studio-textbar').hidden=false;el('studio-textbar').querySelectorAll('input,select,[data-studio-action^="font-"]').forEach(node=>node.disabled=!ready||locked||!textContext);el('studio-edit-text').textContent=s.textEdit?'完成輸入':'編輯文字';el('studio-edit-text').disabled=!ready||locked||!o||!textContext;el('studio-textbar').querySelector('small').textContent=textContext?'只在 Enter 換行':'選取文字以調整';
        el('studio-stroke-label').hidden=false;el('studio-dash-label').hidden=false;el('studio-stroke').disabled=!ready||locked||textContext;el('studio-dash').disabled=!ready||locked||textContext;
        el('studio-property-title').textContent=items.length>1?'已選 '+items.length+' 個物件':o?(o.name||names[o.type]):drawing?'工具樣式':'畫布設定';
        el('studio-selection-help').textContent=locked?'已鎖定；在進階調整按「解鎖舊物件」。':items.length>1?'可群組、對齊或一起調整透明度。':o?.type==='text'?'雙擊或按 Enter 編輯；邊緣把手調框大小，角落調整字級。':drawing?'這些設定會用於接下來建立的物件。':'拖曳選取，Shift 加選；Alt 可單獨選取群組內物件。';
        el('studio-name').closest('label').hidden=!o;el('studio-x').closest('.studio-property-grid').hidden=!items.length;
        el('studio-canvas-properties').hidden=!!items.length&&s.tool!=='crop';el('studio-vector-properties').hidden=o?.type==='image'||items.length>1&&items.every(o=>o.type==='image');
        el('studio-text-properties').hidden=!(o&&['text','callout','badge'].includes(o.type)||!items.length&&['text','callout','badge'].includes(s.tool));
        el('studio-image-properties').hidden=o?.type!=='image';
        const b=selectedBox();if(b){value('studio-x',Math.round(o?o.matrix[4]:b.x));value('studio-y',Math.round(o?o.matrix[5]:b.y));value('studio-w',Math.round(o?o.w*Math.hypot(o.matrix[0],o.matrix[1]):b.w));value('studio-h',Math.round(o?o.h*Math.hypot(o.matrix[2],o.matrix[3]):b.h));value('studio-angle',o?Math.round(Math.atan2(o.matrix[1],o.matrix[0])*180/Math.PI):0);}
        value('studio-name',o?.name||'');value('studio-opacity',Math.round(style.opacity*100));value('studio-color',style.color);value('studio-stroke',style.stroke);value('studio-fill',style.fill||'#ffffff');el('studio-no-fill').checked=!style.fill;
        value('studio-dash',style.dash);value('studio-text-size',style.font);value('studio-text-weight',String(M.weight(style)));value('studio-family',style.family);value('studio-line-height',style.lineHeight);value('studio-text-align',style.align);el('studio-bold').checked=M.weight(style)>=600;el('studio-italic').checked=!!style.italic;
        for(const key of ['brightness','contrast','saturation']){value('studio-'+key,o?.[key]??100);el('studio-'+key+'-value').textContent=o?.[key]??100;}
        if(s.ready){value('studio-canvas-angle',s.doc.angle);value('studio-background',s.doc.background||'#ffffff');el('studio-transparent').checked=!s.doc.background;
            value('studio-padding-left',Math.max(0,-s.doc.bounds.x));value('studio-padding-top',Math.max(0,-s.doc.bounds.y));value('studio-padding-right',Math.max(0,s.doc.bounds.x+s.doc.bounds.w-s.w));value('studio-padding-bottom',Math.max(0,s.doc.bounds.y+s.doc.bounds.h-s.h));}
        colorMemory.render(style.color,ready);
        for(const button of el('noteImageEditModal').querySelectorAll('[data-studio-color]')){button.disabled=!ready||locked;button.setAttribute('aria-pressed',String(button.dataset.studioColor===style.color));}
        for(const node of el('noteImageEditModal').querySelectorAll('.studio-stylebar input,.studio-stylebar select'))node.disabled=!ready||locked||textContext&&['studio-stroke','studio-dash'].includes(node.id);
        el('noteImageEditModal').querySelector('[data-studio-action="multi"]').setAttribute('aria-pressed',String(!!s.multi));
        for(const [name,key,test] of [['unlock-all','locked',true],['show-all','visible',false]]){const button=el('noteImageEditModal').querySelector('[data-studio-action="'+name+'"]');if(button)button.hidden=!s.doc?.objects.some(o=>o[key]===test);}
        el('studio-artboard').style.cursor=space||s.tool==='hand'?'grab':s.tool==='select'?'default':'crosshair';
    }
    /* 連續繪製 (continuous drawing) setting, remembered on this device; on by default. */
    function studioContinuous(){try{return localStorage.getItem('nd-studio-continuous')!=='0';}catch(_){return true;}}
    function setStudioContinuous(on){try{localStorage.setItem('nd-studio-continuous',on?'1':'0');}catch(_){}const b=document.querySelector('[data-studio-continuous]');if(b)b.setAttribute('aria-pressed',String(on));}
    document.addEventListener('click',event=>{const b=event.target.closest?.('[data-studio-continuous]');if(!b)return;setStudioContinuous(!studioContinuous());message(studioContinuous()?'連續繪製：開啟。畫完方框等形狀會留在同一個工具，按 Esc 或 V 回到選取。':'連續繪製：關閉。畫完一個形狀就回到選取。');});
    /* 直線／箭頭／圓形共用一個按鈕：選了哪個，按鈕就換成哪個（下次也記得）。 */
    function toggleShapeMenu(open){
        const menu=el('noteImageEditModal').querySelector('.studio-shape-menu'),more=el('noteImageEditModal').querySelector('[data-studio-shape-more]');if(!menu)return;
        const show=open??menu.hidden;menu.hidden=!show;more?.setAttribute('aria-expanded',String(show));
        if(show){   // fixed position, so the scrolling tool column cannot cut the menu off
            const r=menu.parentElement.getBoundingClientRect(),w=menu.offsetWidth,h=menu.offsetHeight;
            const side=r.right+6+w<=innerWidth;
            menu.style.left=(side?r.right+6:Math.max(6,Math.min(r.left,innerWidth-w-6)))+'px';
            menu.style.top=(side?Math.min(r.top,innerHeight-h-6):Math.min(r.bottom+4,innerHeight-h-6))+'px';
        }
    }
    function showShape(tool){
        if(!noteStudioUI.SHAPES.includes(tool))return;
        const main=el('noteImageEditModal').querySelector('[data-studio-shape-main]');if(!main)return;
        const [,icon,label,key]=noteStudioUI.shapeInfo(tool);
        main.dataset.studioTool=tool;main.title=label+'（'+key+'）';main.querySelector('b').textContent=icon;main.querySelector('span').textContent=label;
        try{localStorage.setItem('nd-studio-shape',tool);}catch(_){}
    }
    function setTool(tool){if(!session?.ready||session.busy)return;showShape(tool);finishText();cancelGesture();session.tool=tool;session.selected=[];update();if(tool==='crop')fit();else schedule();message(({select:'拖曳空白處移動畫面；拖曳標記可移動它；Ctrl+拖曳框選；Shift 多選，Alt 選群組內物件。',hand:'拖曳移動畫布；滾輪縮放。',crop:'拖曳選取裁切範圍，設定比例後按「完成裁切」。',text:'點畫布新增文字，雙擊已有文字編輯。'})[tool]||'在畫布上拖曳新增'+(names[tool]||'標記')+'；按 V 返回選取。');}
    function setStyle(values){
        const s=session;if(!s?.ready||s.busy)return;const items=editable();
        if(Object.hasOwn(values,'bold'))values={...values,weight:values.bold?700:400};if(Object.hasOwn(values,'weight'))values={...values,bold:values.weight>=600};
        if(values.color){s.color=values.color;colorMemory.remember(values.color,selected().map(o=>o.color));}if(values.stroke)s.stroke=values.stroke;if(values.font)s.font=values.font;
        for(const[key,value]of Object.entries(values))if(Object.hasOwn(s.defaults,key))s.defaults[key]=value;
        if(items.length)change(()=>{for(const o of editable()){Object.assign(o,values);M.fitText(o);}});else update();
    }
    function propertyChange(event){
        const s=session;if(!s?.ready||s.busy)return;const id=event.target.id,v=event.target.value,items=selected(),o=items.length===1?items[0]:null;
        if(id==='studio-image-ratio'){if(id==='studio-image-ratio')resetCropRatio();return;}
        if(id==='studio-snap')return;
        if(id==='studio-background'||id==='studio-transparent'){change(()=>s.doc.background=el('studio-transparent').checked?null:el('studio-background').value);return;}
        if(id==='studio-canvas-angle'){change(()=>s.doc.angle=M.clamp(v,-36000,36000));fit();return;}
        if(id==='studio-crop-ratio'){if(s.tool==='crop')change(()=>s.doc.crop=ratioRect(s.doc.crop,Number(v),s.doc.bounds));return;}
        if(items.some(o=>o.locked))return;
        if(id==='studio-text-size'){setStyle({font:M.clamp(v,8,500)});return;}
        if(id==='studio-text-weight'){setStyle({weight:M.clamp(v,100,900)});return;}
        const mapping={'studio-color':['color',M.color(v)],'studio-stroke':['stroke',M.clamp(v,.1,200)],'studio-fill':['fill',M.color(v)],'studio-no-fill':['fill',event.target.checked?null:el('studio-fill').value],'studio-opacity':['opacity',M.clamp(v,0,100)/100],'studio-name':['name',v.slice(0,80)],'studio-dash':['dash',v],'studio-family':['family',v],'studio-line-height':['lineHeight',M.clamp(v,.8,3)],'studio-text-align':['align',v],'studio-bold':['bold',event.target.checked],'studio-italic':['italic',event.target.checked]};
        if(mapping[id]){const[key,value]=mapping[id];setStyle({[key]:value});return;}
        for(const key of ['brightness','contrast','saturation'])if(id==='studio-'+key){setStyle({[key]:M.clamp(v,0,200)});return;}
        if(id==='studio-angle'&&o){change(()=>{const current=Math.atan2(o.matrix[1],o.matrix[0])*180/Math.PI,center=M.transform({x:o.w/2,y:o.h/2},o.matrix);o.matrix=M.mul(M.around(M.rotate(M.clamp(v,-36000,36000)-current),center),o.matrix);});return;}
        if(['studio-x','studio-y','studio-w','studio-h'].includes(id)&&items.length){
            change(()=>{const b=selectedBox();if(id==='studio-x'||id==='studio-y'){const key=id.endsWith('x')?'x':'y',current=o?o.matrix[key==='x'?4:5]:b[key],delta=M.clamp(v,-100000,100000)-current;applyTransform(M.translate(key==='x'?delta:0,key==='y'?delta:0));}
                else if(o){const x=id==='studio-w',scale=Math.hypot(...(x?o.matrix.slice(0,2):o.matrix.slice(2,4))),size=(x?o.w:o.h)*scale,factor=M.clamp(v,1,50000)/size;if(o.type==='text'){o[x?'w':'h']=M.clamp(v,1,50000)/scale;o.manualSize=true;M.fitText(o);}else o.matrix=M.mul(o.matrix,[x?factor:1,0,0,x?1:factor,0,0]);}
                else {const x=id==='studio-w',factor=M.clamp(v,1,50000)/(x?b.w:b.h);applyTransform(M.around([x?factor:1,0,0,x?1:factor,0,0],{x:b.x,y:b.y}));}});return;
        }
    }
    function applyTransform(matrix,originals=null){const items=editable();for(const o of items){const original=originals?.find(item=>item.id===o.id)||o;o.matrix=M.mul(matrix,original.matrix);}}
    function beginText(id,before=null){
        const s=session;if(!s?.ready||s.busy)return;finishText();cancelGesture();const o=s.doc.objects.find(o=>o.id===id);if(!o||o.locked||!['text','badge','callout'].includes(o.type))return;
        s.tool='select';setSelection([id],{individual:true});s.textEdit={id,before:before||snapshot(),composing:false};const input=el('studio-text-editor');input.value=o.text;input.maxLength=o.type==='badge'?12:4000;input.hidden=false;update();positionText();render();input.focus({preventScroll:true});input.select();message('直接編輯文字；Enter 換行，按「完成輸入」或 Ctrl／⌘ + Enter 完成。');
    }
    function finishText(cancel=false){
        const s=session,e=s?.textEdit;if(!e)return;s.textEdit=null;const o=s.doc.objects.find(o=>o.id===e.id);
        if(cancel)s.doc=JSON.parse(e.before);else if(o){o.text=el('studio-text-editor').value.replace(/\r/g,'').slice(0,o.type==='badge'?12:4000);if(!o.text.trim()){s.doc.objects=s.doc.objects.filter(item=>item.id!==o.id);s.selected=[];}else M.fitText(o);}
        el('studio-text-editor').hidden=true;if(cancel){update();schedule();}else commit(e.before);
    }
    function duplicate(objects=editable(),offset=18){
        const s=session,newIds=[],groups=new Map();
        if(objects.length+s.doc.objects.length>1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}
        for(const item of objects){const o=M.copy(item);o.id=M.uid();o.locked=false;o.matrix=M.mul(M.translate(offset,offset),o.matrix);if(o.groupId){if(!groups.has(o.groupId))groups.set(o.groupId,M.uid());o.groupId=groups.get(o.groupId);}s.doc.objects.push(o);newIds.push(o.id);}s.selected=newIds;
    }
    function arrange(name){
        const s=session,items=editable();if(!items.length||items.length!==selected().length)return;
        if(['front','back','up','down'].includes(name)){
            change(()=>{const chosen=new Set(items.map(o=>o.id)),all=s.doc.objects;
                if(name==='front'||name==='back'){const rest=all.filter(o=>!chosen.has(o.id));s.doc.objects=name==='front'?[...rest,...items]:[...items,...rest];}
                else if(name==='up'){for(let i=all.length-2;i>=0;i--)if(chosen.has(all[i].id)&&!chosen.has(all[i+1].id))[all[i],all[i+1]]=[all[i+1],all[i]];}
                else for(let i=1;i<all.length;i++)if(chosen.has(all[i].id)&&!chosen.has(all[i-1].id))[all[i],all[i-1]]=[all[i-1],all[i]];
            });return;
        }
        const parts=units(items),union=parts.length>1?M.box(items.flatMap(M.objectCorners)):s.doc.crop;
        if(name.startsWith('align-'))change(()=>{for(const part of parts){const b=part.bounds;let dx=0,dy=0;if(name==='align-left')dx=union.x-b.x;if(name==='align-center')dx=union.x+union.w/2-b.x-b.w/2;if(name==='align-right')dx=union.x+union.w-b.x-b.w;if(name==='align-top')dy=union.y-b.y;if(name==='align-middle')dy=union.y+union.h/2-b.y-b.h/2;if(name==='align-bottom')dy=union.y+union.h-b.y-b.h;for(const o of part.objects)o.matrix=M.mul(M.translate(dx,dy),o.matrix);}});
        if(name.startsWith('distribute')&&parts.length>=3)change(()=>{const x=name==='distribute-x',key=x?'x':'y',size=x?'w':'h',sorted=[...parts].sort((a,b)=>a.bounds[key]-b.bounds[key]),gap=(union[size]-sorted.reduce((n,part)=>n+part.bounds[size],0))/(sorted.length-1);let position=union[key];for(const part of sorted){const b=part.bounds,delta=position-b[key];for(const o of part.objects)o.matrix=M.mul(M.translate(x?delta:0,x?0:delta),o.matrix);position+=b[size]+gap;}});
    }
    async function action(name){
        const s=session;if(!s)return;
        if(name==='cancel')return close();if(name==='discard')return close(true);if(name==='continue'){el('studio-discard').hidden=true;return el('studio-artboard').focus();}
        if(name==='fullscreen'){const root=el('noteImageEditModal'),on=root.classList.toggle('studio-fullscreen');root.querySelector('[data-studio-action="fullscreen"]').setAttribute('aria-pressed',String(on));if(s.ready)fit();return;}
        if(name==='inspector'){const on=el('noteImageEditModal').classList.toggle('studio-inspector-open');el('noteImageEditModal').querySelector('.studio-commandbar [data-studio-action="inspector"]').setAttribute('aria-pressed',String(on));if(!on)el('noteImageEditModal').querySelector('.studio-commandbar [data-studio-action="inspector"]').focus({preventScroll:true});if(s.ready&&s.fit)scheduleViewportResize();return;}
        if(name==='multi'){s.multi=!s.multi;update();message(s.multi?'多選已開啟：逐一點選物件即可加選／取消。':'多選已關閉。');return;}
        if(name==='edit-text'){if(s.textEdit){finishText();el('studio-artboard').focus({preventScroll:true});}else beginText(selected()[0]?.id);return;}
        if(!s.ready||s.busy)return;finishText();if(!name.startsWith('crop-'))cancelGesture();
        if(name==='next-object'){const objects=s.doc.objects.filter(o=>o.visible);if(objects.length){s.tool='select';const index=objects.findIndex(o=>o.id===s.selected.at(-1)),o=objects[(index+1)%objects.length];setSelection([o.id],{individual:true});message('已選取：'+(o.name||names[o.type])+(o.locked?'（已鎖定）':''));}return;}
        if(name==='apply')return apply();if(name==='png'||name==='jpg')return exportImage(name);
        if(name==='font-up'||name==='font-down')return setStyle({font:M.clamp((selected()[0]||s.defaults).font+(name==='font-up'?2:-2),8,500)});
        if(name==='fit'){clearWheel();return fit();}if(name==='zoom-in'||name==='zoom-out')return zoomAt(name==='zoom-in'?1.25:.8);
        
        if(name==='image-crop')return openImageCrop();if(name==='crop-cancel'){closeImageCrop();return;}
        if(name==='crop-reset'){if(s.imageCrop){const a=s.doc.assets[s.imageCrop.assetId];s.imageCrop.rect={x:0,y:0,w:a.w,h:a.h};drawImageCrop();}return;}
        if(name==='crop-apply'){if(s.imageCrop){const crop=s.imageCrop,o=s.doc.objects.find(o=>o.id===crop.id);closeImageCrop();change(()=>{o.crop={...crop.rect};o.h=o.w*o.crop.h/o.crop.w;});}return;}
        if(name==='undo'||name==='redo'){
            const from=name==='undo'?s.undo:s.redo,to=name==='undo'?s.redo:s.undo;if(from.length){to.push(snapshot());s.doc=JSON.parse(from.pop());s.selected=[];s.assetSignature='';notePersistence.changed();update();if(s.fit)fit();else schedule();}return;
        }
        if(name==='unlock-all')return change(()=>s.doc.objects.forEach(o=>o.locked=false));
        if(name==='show-all')return change(()=>s.doc.objects.forEach(o=>o.visible=true));
        if(name==='duplicate')return change(()=>duplicate());
        if(name==='delete')return change(()=>{const ids=new Set(editable().map(o=>o.id));s.doc.objects=s.doc.objects.filter(o=>!ids.has(o.id));s.selected=[];});
        if(name==='group'&&editable().length>1)return change(()=>{const id=M.uid();for(const o of editable())o.groupId=id;});
        if(name==='ungroup')return change(()=>editable().forEach(o=>delete o.groupId));
        if(name==='flip-x'||name==='flip-y')return change(()=>editable().forEach(o=>o.matrix=M.mul(o.matrix,name==='flip-x'?[-1,0,0,1,o.w,0]:[1,0,0,-1,0,o.h])));
        if(name==='image-reset')return change(()=>editable().filter(o=>o.type==='image').forEach(o=>{const a=s.doc.assets[o.assetId];Object.assign(o,{brightness:100,contrast:100,saturation:100,opacity:1,crop:{x:0,y:0,w:a.w,h:a.h}});o.h=o.w*a.h/a.w;}));
        if(name==='reset'){if(!confirm('要還原整張原圖嗎？這次操作可用復原返回。'))return;change(()=>{s.doc=M.blank(s.w,s.h);s.doc.assets.original.key=noteImageStorage.sourceKey(s.original);s.selected=[];s.assetSignature='';});fit();return;}
        if(['canvas-left','canvas-right','canvas-flip-x','canvas-flip-y','uncrop','padding'].includes(name)){
            change(()=>{if(name==='canvas-left')s.doc.angle-=90;if(name==='canvas-right')s.doc.angle+=90;if(name==='canvas-flip-x')s.doc.flipX=!s.doc.flipX;if(name==='canvas-flip-y')s.doc.flipY=!s.doc.flipY;
                if(name==='uncrop')s.doc.crop={...s.doc.bounds};if(name==='padding'){const p=Object.fromEntries(['left','right','top','bottom'].map(key=>[key,M.clamp(el('studio-padding-'+key).value,0,10000)]));s.doc.bounds={x:-p.left,y:-p.top,w:s.w+p.left+p.right,h:s.h+p.top+p.bottom};s.doc.crop={...s.doc.bounds};}});fit();return;
        }
        if(name==='finish-crop'){setTool('select');fit();return;}
        arrange(name);
    }
    function eventPoint(event){const r=el('studio-artboard').getBoundingClientRect(),g=sceneGeometry(),display={x:(event.clientX-r.left)/session.zoom,y:(event.clientY-r.top)/session.zoom};return {display,world:M.inverse(display,g.m)};}
    function overlaps(a,b){for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],axis={x:q.y-p.y,y:p.x-q.x},ap=a.map(p=>p.x*axis.x+p.y*axis.y),bp=b.map(p=>p.x*axis.x+p.y*axis.y);if(Math.max(...ap)<Math.min(...bp)||Math.max(...bp)<Math.min(...ap))return false;}return true;}
    function clearPendingPress(){
        const s=session,pending=s?.pendingPress;if(!pending)return;
        clearTimeout(pending.timer);s.pendingPress=null;
        const viewport=el('studio-viewport');if(viewport.hasPointerCapture(pending.event.pointerId))viewport.releasePointerCapture(pending.event.pointerId);
    }
    function pointerDown(event){
        const s=session;if(!s?.ready||s.busy||s.imageCrop||inputTarget(event.target)||![0,1].includes(event.button))return;
        flushWheel();clearPendingPress();
        // Touch keeps immediate drawing/pinch. Mouse starts drawing as soon as it moves;
        // holding still switches to pan without creating an annotation or undo entry.
        if(event.pointerType!=='mouse'||event.button===1||space||s.tool==='hand'||event.target.closest('[data-studio-handle]'))return beginPointer(event);
        event.preventDefault();finishText();el('studio-artboard').focus({preventScroll:true});
        const pending=s.pendingPress={event,timer:0};el('studio-viewport').setPointerCapture(event.pointerId);
        pending.timer=setTimeout(()=>{
            if(session!==s||s.pendingPress!==pending)return;s.pendingPress=null;
            const viewport=el('studio-viewport');s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
            s.gesture={id:event.pointerId,mode:'pan',startClient:{x:event.clientX,y:event.clientY},scroll:{x:viewport.scrollLeft,y:viewport.scrollTop}};
            viewport.classList.add('is-panning');message('拖曳移動畫布；放開後繼續使用原工具。');
        },420);
    }
    function beginPointer(event){
        const s=session;if(!s?.ready||s.busy||s.imageCrop||event.target===el('studio-text-editor')||![0,1].includes(event.button))return;
        event.preventDefault();el('studio-artboard').focus({preventScroll:true});finishText();s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        const viewport=el('studio-viewport');
        if(event.pointerType==='touch'&&s.pointers.size===2){cancelGesture();const values=[...s.pointers.values()];s.pinch={distance:Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y),center:{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2}};for(const id of s.pointers.keys())viewport.setPointerCapture(id);return;}
        if(s.pointers.size>1)return;
        const point=eventPoint(event),before=snapshot(),g={id:event.pointerId,before,start:point.world,startDisplay:point.display,startClient:{x:event.clientX,y:event.clientY},previous:[...s.selected],originals:[],frame:null};
        const handle=event.target.closest('[data-studio-handle]');
        if(space||s.tool==='hand'||event.button===1){g.mode='pan';g.scroll={x:viewport.scrollLeft,y:viewport.scrollTop};}
        else if(handle&&editable().length===selected().length){g.mode=handle.dataset.studioHandle;g.corner=handle.hasAttribute('data-corner')?Number(handle.dataset.corner):null;g.edge=handle.hasAttribute('data-edge')?Number(handle.dataset.edge):null;g.frame=frameFor();g.originals=M.copy(editable());g.center={x:(g.frame[0].x+g.frame[2].x)/2,y:(g.frame[0].y+g.frame[2].y)/2};g.angle=Math.atan2(point.world.y-g.center.y,point.world.x-g.center.x);}
        else if(s.tool==='select'){
            const id=event.target.closest('[data-studio-object]')?.dataset.studioObject,o=s.doc.objects.find(o=>o.id===id);
            if(o&&!o.locked){
                if(!s.selected.includes(id)||event.shiftKey||event.altKey||s.multi)setSelection(event.shiftKey||s.multi?s.selected.includes(id)?s.selected.filter(key=>key!==id):[...s.selected,id]:[id],{individual:event.altKey});
                if(event.altKey&&editable().length){duplicate();update();}
                if(!editable().length||editable().length!==selected().length)return;
                g.mode='move';g.originals=M.copy(editable());g.frame=frameFor();g.box=M.box(g.originals.flatMap(M.objectCorners));g.snapTargets=[s.doc.crop,...s.doc.objects.filter(o=>o.visible&&!s.selected.includes(o.id)).map(M.bounds)];
            }else if(event.ctrlKey||event.metaKey||event.shiftKey){g.mode='marquee';g.clickId=o?.id||null;g.additive=event.shiftKey;if(!event.shiftKey)setSelection(o?[o.id]:[]);}
            // 按住左鍵拖曳照片的空白處（或鎖定的底圖）＝移動畫面；框選改成 Ctrl+拖曳。只點一下照樣選取／取消選取。
            else{setSelection(o?[o.id]:[]);g.mode='pan';g.clickId=o?.id||null;g.scroll={x:viewport.scrollLeft,y:viewport.scrollTop};}
        }else if(s.tool==='crop'){g.mode='crop';}
        else if(s.tool==='text'){
            const hit=event.target.closest('[data-studio-object]'),existing=s.doc.objects.find(o=>o.id===hit?.dataset.studioObject);if(existing?.type==='text'&&!existing.locked){beginText(existing.id);return;}
            if(s.doc.objects.length>=1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}
            const o=M.fitText(M.object('text',point.world.x,point.world.y,220,80,{...toolStyle('text'),text:'輸入文字'}));
            s.doc.objects.push(o);s.tool='select';setSelection([o.id]);beginText(o.id,before);return;
        }else{
            if(s.doc.objects.length>=1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}
            const o=M.object(s.tool,point.world.x,point.world.y,1,1,toolStyle(s.tool));if(['pen','line','arrow'].includes(o.type))o.points=[{x:0,y:0}];s.doc.objects.push(o);s.selected=[o.id];g.mode='draw';g.objectId=o.id;
        }
        s.gesture=g;viewport.setPointerCapture(event.pointerId);schedule();
    }
    function snappedDelta(g,dx,dy,event){
        const s=session;s.dragGuides=[];if(!el('studio-snap').checked||event.ctrlKey||event.metaKey)return {dx,dy};
        const moving={x:g.box.x+dx,y:g.box.y+dy,w:g.box.w,h:g.box.h},targets=g.snapTargets,threshold=6/s.zoom;
        const find=(key,size)=>{let best=null;for(const target of targets)for(const a of [moving[key],moving[key]+moving[size]/2,moving[key]+moving[size]])for(const b of [target[key],target[key]+target[size]/2,target[key]+target[size]]){const offset=b-a;if(Math.abs(offset)<=threshold&&(!best||Math.abs(offset)<Math.abs(best.offset)))best={offset,position:b};}return best;};
        const x=find('x','w'),y=find('y','h'),c=s.doc.crop,m=sceneGeometry().m;
        if(x){dx+=x.offset;const a=M.transform({x:x.position,y:c.y},m),b=M.transform({x:x.position,y:c.y+c.h},m);s.dragGuides.push([a.x,a.y,b.x,b.y]);}
        if(y){dy+=y.offset;const a=M.transform({x:c.x,y:y.position},m),b=M.transform({x:c.x+c.w,y:y.position},m);s.dragGuides.push([a.x,a.y,b.x,b.y]);}
        return {dx,dy};
    }
    function resizeGesture(g,p,event){
        const single=g.originals.length===1,o=g.originals[0],b=single?{x:0,y:0,w:o.w,h:o.h}:M.box(g.frame),start=single?M.inverse(g.start,o.matrix):g.start,current=single?M.inverse(p,o.matrix):p;
        const signs=g.corner!=null?[[-1,-1],[1,-1],[1,1],[-1,1]][g.corner]:[[0,-1],[1,0],[0,1],[-1,0]][g.edge];
        let sx=signs[0]?M.clamp((b.w+signs[0]*(current.x-start.x))/b.w,.02,30):1,sy=signs[1]?M.clamp((b.h+signs[1]*(current.y-start.y))/b.h,.02,30):1;
        if(g.corner!=null&&(event.shiftKey||!single||['image','text','badge','callout'].includes(o.type))){const ratio=Math.abs(sx-1)>Math.abs(sy-1)?sx:sy;sx=sy=ratio;}
        const anchor={x:signs[0]<0?b.x+b.w:b.x,y:signs[1]<0?b.y+b.h:b.y},scale=M.around([sx,0,0,sy,0,0],anchor);
        if(single&&o.type==='text'){
            const next=session.doc.objects.find(item=>item.id===o.id);next.w=o.w*sx;next.h=o.h*sy;next.font=g.corner!=null?M.clamp(o.font*sx,8,500):o.font;next.manualSize=g.corner!=null?!!o.manualSize:true;M.fitText(next);
            next.matrix=M.mul(o.matrix,M.translate(signs[0]<0?o.w-next.w:0,signs[1]<0?o.h-next.h:0));return;
        }
        if(single)session.doc.objects.find(item=>item.id===o.id).matrix=M.mul(o.matrix,scale);else applyTransform(scale,g.originals);
    }
    function pointerMove(event){
        const s=session;if(!s?.ready)return;
        const pending=s.pendingPress;if(pending&&pending.event.pointerId===event.pointerId){
            if(event.buttons===0){clearPendingPress();return;}
            if(Math.hypot(event.clientX-pending.event.clientX,event.clientY-pending.event.clientY)<4)return;
            clearTimeout(pending.timer);s.pendingPress=null;beginPointer(pending.event);
        }
        if(s.gesture&&event.pointerType==='mouse'&&event.buttons===0&&event.type==='pointermove'){cancelGesture();s.pointers.clear();return;}
        if(s.pointers.has(event.pointerId))s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(s.pinch&&s.pointers.size>=2){const points=[...s.pointers.values()],distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),center={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};zoomAt(distance/(s.pinch.distance||1),center.x,center.y);el('studio-viewport').scrollLeft-=center.x-s.pinch.center.x;el('studio-viewport').scrollTop-=center.y-s.pinch.center.y;s.pinch={distance,center};return;}
        const g=s.gesture;if(!g||g.id!==event.pointerId)return;event.preventDefault();const {world:p,display}=eventPoint(event);
        if(g.mode==='pan'){el('studio-viewport').scrollLeft=g.scroll.x-(event.clientX-g.startClient.x);el('studio-viewport').scrollTop=g.scroll.y-(event.clientY-g.startClient.y);return;}
        if(g.mode==='move'){const delta=snappedDelta(g,p.x-g.start.x,p.y-g.start.y,event);applyTransform(M.translate(delta.dx,delta.dy),g.originals);}
        else if(g.mode==='resize')resizeGesture(g,p,event);
        else if(g.mode==='rotate'){let delta=Math.atan2(p.y-g.center.y,p.x-g.center.x)-g.angle;if(event.shiftKey)delta=Math.round(delta/(Math.PI/12))*Math.PI/12;applyTransform(M.around(M.rotate(delta*180/Math.PI),g.center),g.originals);}
        else if(g.mode==='marquee'){
            g.currentDisplay=display;const selection=M.corners(M.box([g.startDisplay,display])),matrix=sceneGeometry().m,found=s.doc.objects.filter(o=>!o.locked&&o.visible&&overlaps(selection,M.objectCorners(o).map(p=>M.transform(p,matrix)))).map(o=>o.id);setSelection(g.additive?[...g.previous,...found]:found);
        }else if(g.mode==='crop'){const b=M.box([g.start,p]),bounds=s.doc.bounds;s.doc.crop=ratioRect({x:M.clamp(b.x,bounds.x,bounds.x+bounds.w-1),y:M.clamp(b.y,bounds.y,bounds.y+bounds.h-1),w:Math.max(1,b.w),h:Math.max(1,b.h)},Number(el('studio-crop-ratio').value),bounds);}
        else if(g.mode==='draw'){
            const o=s.doc.objects.find(o=>o.id===g.objectId);if(!o)return;
            if(o.type==='pen'){const point={x:p.x-g.start.x,y:p.y-g.start.y},last=o.points.at(-1);if(o.points.length<20000&&Math.hypot(point.x-last.x,point.y-last.y)*s.zoom>1.2)o.points.push(point);}
            else{let q=p;if(event.shiftKey&&['rect','ellipse','highlight'].includes(o.type)){const length=Math.max(Math.abs(p.x-g.start.x),Math.abs(p.y-g.start.y));q={x:g.start.x+Math.sign(p.x-g.start.x)*length,y:g.start.y+Math.sign(p.y-g.start.y)*length};}if(['line','arrow'].includes(o.type)&&event.shiftKey){const angle=Math.round(Math.atan2(p.y-g.start.y,p.x-g.start.x)/(Math.PI/4))*Math.PI/4,length=Math.hypot(p.x-g.start.x,p.y-g.start.y);q={x:g.start.x+length*Math.cos(angle),y:g.start.y+length*Math.sin(angle)};}
                const b=M.box([g.start,q]);o.w=Math.max(1,b.w);o.h=Math.max(1,b.h);o.matrix=M.translate(b.x,b.y);if(['line','arrow'].includes(o.type))o.points=[{x:g.start.x-b.x,y:g.start.y-b.y},{x:q.x-b.x,y:q.y-b.y}];}
        }
        schedule();
    }
    function pointerUp(event){
        const s=session;if(!s)return;const pending=s.pendingPress;
        if(pending?.event.pointerId===event.pointerId){clearTimeout(pending.timer);s.pendingPress=null;beginPointer(pending.event);}
        s.pointers.delete(event.pointerId);if(s.pinch){if(s.pointers.size<2)s.pinch=null;return;}
        const g=s.gesture;if(!g||g.id!==event.pointerId)return;pointerMove(event);s.gesture=null;s.dragGuides=[];const viewport=el('studio-viewport');if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
        if(g.mode==='pan'){viewport.classList.remove('is-panning');update();return;}
        if(g.mode==='marquee'&&Math.hypot(event.clientX-g.startClient.x,event.clientY-g.startClient.y)<3)setSelection(g.clickId?[g.clickId]:g.additive?g.previous:[]);
        if(g.mode==='draw'){
            const o=s.doc.objects.find(o=>o.id===g.objectId);
            if(o?.type==='pen'){const b=M.box(o.points);o.points=o.points.map(p=>({x:p.x-b.x,y:p.y-b.y}));o.matrix=M.mul(o.matrix,M.translate(b.x,b.y));o.w=Math.max(1,b.w);o.h=Math.max(1,b.h);}
            else if(Math.hypot(event.clientX-g.startClient.x,event.clientY-g.startClient.y)<3){s.doc=JSON.parse(g.before);s.selected=[];}
            // 連續繪製: stay on the shape tool so several boxes can be drawn in a row.
            if(!['pen','highlight'].includes(s.tool)&&!studioContinuous())s.tool='select';
        }
        commit(g.before);
    }
    function cancelGesture(){clearPendingPress();const s=session,g=s?.gesture;if(!g)return;s.gesture=null;if(g.mode!=='pan'){s.doc=JSON.parse(g.before);s.selected=g.previous;}s.dragGuides=[];const viewport=el('studio-viewport');viewport.classList.remove('is-panning');if(viewport.hasPointerCapture(g.id))viewport.releasePointerCapture(g.id);update();schedule();}
    function ratioRect(rect,ratio,bounds){
        let {x,y,w,h}=rect;w=Math.max(1,w);h=Math.max(1,h);x=M.clamp(x,bounds.x,bounds.x+bounds.w-1);y=M.clamp(y,bounds.y,bounds.y+bounds.h-1);
        if(ratio>0){if(w/h>ratio)w=h*ratio;else h=w/ratio;}const scale=Math.min(1,(bounds.x+bounds.w-x)/w,(bounds.y+bounds.h-y)/h);return {x,y,w:Math.max(1,w*scale),h:Math.max(1,h*scale)};
    }
    function copyObjects(event,cut=false){
        const s=session;if(!s?.ready||inputTarget(event.target)||!selected().length)return;
        const objects=M.copy(selected()),assetIds=new Set(objects.filter(o=>o.type==='image').map(o=>o.assetId)),assets=Object.fromEntries([...assetIds].map(id=>[id,{...s.doc.assets[id],source:s.sources[id]}]));clipboard={objects,assets};
        event.preventDefault();event.stopImmediatePropagation();const json=JSON.stringify(clipboard);if(json.length<32000000)event.clipboardData?.setData('application/x-pharmacy-studio',json);event.clipboardData?.setData('text/plain',objects.map(o=>o.text||names[o.type]).join('\n'));
        if(cut)change(()=>{const ids=new Set(editable().map(o=>o.id));s.doc.objects=s.doc.objects.filter(o=>!ids.has(o.id));s.selected=[];});message('已複製 '+objects.length+' 個物件。');
    }
    async function pasteObjects(event){
        const s=session;if(!s?.ready||s.busy||inputTarget(event.target))return;event.preventDefault();event.stopImmediatePropagation();
        try{
            const data=event.clipboardData,raw=data?.getData('application/x-pharmacy-studio');
            if(raw){if(raw.length>32000000)throw Error('貼上的物件資料過大');const value=JSON.parse(raw);await pasteDocument(value);return;}
            const files=[...(data?.files||[])].filter(file=>file.type.startsWith('image/'));if(files.length){message('請先將圖片加入筆記，再開啟編輯。');return;}
            const text=data?.getData('text/plain');if(text){const c=s.doc.crop;change(()=>{if(s.doc.objects.length>=1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}const o=M.fitText(M.object('text',c.x+c.w*.2,c.y+c.h*.2,Math.min(300,c.w),80,{...toolStyle('text'),text:text.slice(0,4000)}));s.doc.objects.push(o);s.selected=[o.id];});}
            else if(clipboard)await pasteDocument(clipboard);
        }catch(error){message('貼上未完成：'+error.message);}
    }
    async function pasteDocument(value){
        const s=session;if(!s||!Array.isArray(value?.objects)||value.objects.length+s.doc.objects.length>1000)throw Error('物件資料無效或數量過多');
        if(Object.keys(value.assets||{}).length>32)throw Error('貼上的原始圖片過多');
        s.busy=true;update();
        try{
        const imports={},aliases={};for(const[id,a]of Object.entries(value.assets||{})){
            const loaded=await loadSource(a.source,s.abort.signal);if(session!==s)return;const key=noteImageStorage.sourceKey(loaded.src),same=Object.entries(s.doc.assets).find(([,asset])=>asset.key===key);
            const nextId=same?.[0]||M.uid();aliases[id]=nextId;if(!same)imports[nextId]={loaded,key};
        }
        if(Object.keys(s.doc.assets).length+Object.keys(imports).length>32)throw Error('每張畫布最多可使用 32 張原始圖片');
        if([...Object.values(s.sources),...Object.values(imports).map(v=>v.loaded.src)].reduce((sum,src)=>sum+src.length,0)>64*1024*1024)throw Error('這張畫布的原圖資料已較大，請分成另一張圖片編輯');
        const test=M.copy(s.doc);for(const[id,{loaded,key}]of Object.entries(imports))test.assets[id]={w:loaded.image.naturalWidth,h:loaded.image.naturalHeight,key};
        const groups=new Map();let next=value.objects.map(item=>{const o=M.copy(item);o.id=M.uid();o.locked=false;if(o.assetId)o.assetId=aliases[o.assetId]||o.assetId;o.matrix=M.mul(M.translate(18,18),o.matrix);if(o.groupId){if(!groups.has(o.groupId))groups.set(o.groupId,M.uid());o.groupId=groups.get(o.groupId);}return o;});test.objects.push(...next);next=M.validate(test,s.w,s.h).objects.slice(s.doc.objects.length);
        if(session!==s)return;s.busy=false;
        change(()=>{for(const[id,{loaded,key}]of Object.entries(imports)){s.sources[id]=loaded.src;s.loaded.set(id,loaded.image);s.doc.assets[id]={w:loaded.image.naturalWidth,h:loaded.image.naturalHeight,key};}s.doc.objects.push(...next);s.selected=next.map(o=>o.id);s.assetSignature='';});
        }finally{if(session===s){s.busy=false;update();}}
    }
    window.addEventListener('copy',event=>copyObjects(event),true);window.addEventListener('cut',event=>copyObjects(event,true),true);window.addEventListener('paste',event=>{if(session)void pasteObjects(event);},true);
    window.addEventListener('keydown',event=>{
        const s=session;if(!s)return;event.stopImmediatePropagation();if(event.isComposing||s.textEdit?.composing)return;
        if(event.key==='Tab'){
            const items=[...(s.imageCrop?el('studio-image-crop-panel'):el('noteImageEditModal')).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[inert]')),first=items[0],last=items.at(-1);
            if(event.shiftKey&&(document.activeElement===first||!el('noteImageEditModal').contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;
        }
        if(event.target===el('studio-text-editor')){if(event.key==='Escape'){event.preventDefault();finishText(true);}else if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();finishText();el('studio-artboard').focus();}return;}
        if(event.key==='Escape'){event.preventDefault();if(s.imageCrop)closeImageCrop();else if(s.gesture)cancelGesture();else if(['arrow','rect','line','ellipse'].includes(s.tool))setTool('select');else if(s.selected.length)setSelection([]);else close();return;}
        if(s.imageCrop){if(event.key==='Enter'&&!inputTarget(event.target)){event.preventDefault();void action('crop-apply');}return;}
        if(inputTarget(event.target))return;const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
        if(mod&&(key==='c'||key==='v'||key==='x'))return;
        if(mod&&key==='z'){event.preventDefault();void action(event.shiftKey?'redo':'undo');}else if(mod&&key==='y'){event.preventDefault();void action('redo');}
        else if(mod&&key==='d'){event.preventDefault();void action('duplicate');}else if(mod&&key==='g'){event.preventDefault();void action(event.shiftKey?'ungroup':'group');}
        else if(mod&&key==='a'){event.preventDefault();s.tool='select';setSelection(s.doc.objects.filter(o=>o.visible&&!o.locked).map(o=>o.id));}
        else if(mod&&event.key==='Enter'){event.preventDefault();void action('apply');}
        else if(event.key==='Enter'&&selected().length===1&&['text','callout','badge'].includes(selected()[0].type)){event.preventDefault();beginText(selected()[0].id);}
        else if(event.code==='Space'){event.preventDefault();space=true;update();}
        else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();void action('delete');}
        else if(event.key.startsWith('Arrow')){event.preventDefault();const step=event.shiftKey?10:1;change(()=>applyTransform(M.translate(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)));}
        else if(!mod&&!event.altKey&&noteStudioUI.shortcuts[key]){event.preventDefault();setTool(noteStudioUI.shortcuts[key]);}
    },true);
    window.addEventListener('keyup',event=>{if(session&&event.code==='Space'){event.preventDefault();space=false;update();}},true);
    function releaseInteraction(){if(session){space=false;cancelGesture();clearWheel();session.pointers.clear();session.pinch=null;}}
    window.addEventListener('blur',releaseInteraction);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseInteraction();});
    async function openImageCrop(){
        const s=session,o=selected()[0];if(!s?.ready||!o||o.type!=='image'||o.locked)return;
        const image=s.loaded.get(o.assetId);if(!image)return;finishText();s.imageCrop={id:o.id,assetId:o.assetId,rect:{...o.crop},image,drag:null};el('studio-image-ratio').value='0';el('studio-image-crop-panel').hidden=false;el('noteImageEditModal').classList.add('studio-cropping');for(const node of el('noteImageEditModal').querySelectorAll('.studio-workspace,.studio-commandbar,.studio-stylebar,.studio-textbar,.studio-footer'))node.inert=true;drawImageCrop();el('studio-crop-preview').focus();
    }
    function closeImageCrop(){if(session)session.imageCrop=null;el('studio-image-crop-panel').hidden=true;el('noteImageEditModal').classList.remove('studio-cropping');for(const node of el('noteImageEditModal').querySelectorAll('.studio-workspace,.studio-commandbar,.studio-stylebar,.studio-textbar,.studio-footer'))node.inert=false;el('studio-artboard').focus({preventScroll:true});}
    function drawImageCrop(){
        const s=session,c=s?.imageCrop;if(!c)return;const canvas=el('studio-crop-preview'),ctx=canvas.getContext('2d'),a=s.doc.assets[c.assetId],scale=Math.min((canvas.width-24)/a.w,(canvas.height-24)/a.h),x=(canvas.width-a.w*scale)/2,y=(canvas.height-a.h*scale)/2;
        c.view={scale,x,y};ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e2e8f0';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(c.image,x,y,a.w*scale,a.h*scale);
        const r={x:x+c.rect.x*scale,y:y+c.rect.y*scale,w:c.rect.w*scale,h:c.rect.h*scale};ctx.fillStyle='#0f172a99';ctx.fillRect(x,y,a.w*scale,r.y-y);ctx.fillRect(x,r.y+r.h,a.w*scale,y+a.h*scale-r.y-r.h);ctx.fillRect(x,r.y,r.x-x,r.h);ctx.fillRect(r.x+r.w,r.y,x+a.w*scale-r.x-r.w,r.h);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#ffffff';for(const p of M.corners(r))ctx.fillRect(p.x-4,p.y-4,8,8);
    }
    function resetCropRatio(){const s=session,c=s?.imageCrop;if(!c)return;const a=s.doc.assets[c.assetId],center={x:c.rect.x+c.rect.w/2,y:c.rect.y+c.rect.h/2};c.rect=ratioRect(c.rect,Number(el('studio-image-ratio').value),{x:0,y:0,w:a.w,h:a.h});c.rect.x=M.clamp(center.x-c.rect.w/2,0,a.w-c.rect.w);c.rect.y=M.clamp(center.y-c.rect.h/2,0,a.h-c.rect.h);drawImageCrop();}
    function cropPointer(event){
        const c=session?.imageCrop;if(!c)return;const canvas=el('studio-crop-preview'),r=canvas.getBoundingClientRect(),a=session.doc.assets[c.assetId],p={x:M.clamp(((event.clientX-r.left)/r.width*canvas.width-c.view.x)/c.view.scale,0,a.w),y:M.clamp(((event.clientY-r.top)/r.height*canvas.height-c.view.y)/c.view.scale,0,a.h)};
        if(event.type==='pointerdown'){event.preventDefault();canvas.setPointerCapture(event.pointerId);c.drag={id:event.pointerId,start:p};}
        else if(c.drag?.id===event.pointerId){event.preventDefault();const b=M.box([c.drag.start,p]);c.rect=ratioRect(b,Number(el('studio-image-ratio').value),{x:0,y:0,w:a.w,h:a.h});if(event.type==='pointerup'){c.drag=null;canvas.releasePointerCapture(event.pointerId);}drawImageCrop();}
    }
    function packagedDoc(){
        const d=M.copy(session.doc),used=new Set(['original',...d.objects.filter(o=>o.type==='image').map(o=>o.assetId)]);d.assets=Object.fromEntries(Object.entries(d.assets).filter(([id])=>used.has(id)));return M.validate(d,session.w,session.h);
    }
    async function packageImage(){
        const s=session,d=packagedDoc(),g=M.geometry(d),scale=Math.min(1,4096/Math.max(g.w,g.h),Math.sqrt(12000000/(g.w*g.h))),src=M.dataUrl(d,s.sources,scale);
        const image=new Image();image.src=src;await noteImageReady(image);if(session!==s)throw Error('圖片編輯已取消');
        return {src,metadata:{v:4,sourceKey:s.originalKey,storedKey:noteImageStorage.sourceKey(s.original),w:s.w,h:s.h,doc:d}};
    }
    async function apply(){
        const s=session;if(!s?.ready||s.busy)return;finishText();cancelGesture();if(snapshot()===s.initial&&!s.needsTextMigration&&!/^https?:/i.test(s.source)){close(true);return;}s.busy=true;update();message('正在校驗並產生可再次編輯的圖片…');
        try{
            const {src,metadata}=await packageImage();if(session!==s)return;
            if(s.target.image){
                const image=s.target.image;if(!image.isConnected||!el('modal-text').contains(image))throw Error('原圖片位置已變更，請取消後重新開啟');
                const clone=image.cloneNode(true);clone.src=src;clone.setAttribute(ATTR,JSON.stringify(metadata));for(const key of ['height','srcset','sizes'])clone.removeAttribute(key);clone.style.removeProperty('height');clone.style.removeProperty('aspect-ratio');
                const range=document.createRange();range.selectNode(image);el('noteModal').inert=s.inert;s.target.image=insertImageHtmlWithHistory(cleanInlineImageHtml(clone),range);
            }else{
                if(currentPastedImages[s.target.gallery]!==s.source)throw Error('原圖片順序已變更，請重新開啟');const key=noteImageStorage.galleryKey(src);currentPastedImages[s.target.gallery]=src;currentGalleryImageEdits[key]=metadata;renderPreviewGrid();
            }
            close(true);
        }catch(error){if(session===s){el('noteModal').inert=true;s.busy=false;update();message('套用未完成：'+error.message+'。原筆記與編輯草稿仍保留。');}}
    }
    async function exportImage(type){
        const s=session;if(!s?.ready||s.busy)return;finishText();s.busy=true;update();
        try{
            const d=packagedDoc(),g=M.geometry(d),requested=Number(el('studio-export-scale').value)||1,scale=Math.min(requested,4096/Math.max(g.w,g.h),Math.sqrt(12000000/(g.w*g.h))),image=new Image();image.src=M.dataUrl(d,s.sources,scale);await noteImageReady(image);if(session!==s)return;
            const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(g.w*scale));canvas.height=Math.max(1,Math.round(g.h*scale));const ctx=canvas.getContext('2d');if(type==='jpg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(image,0,0,canvas.width,canvas.height);
            const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('無法產生輸出檔案')),type==='jpg'?'image/jpeg':'image/png',.95));if(session!==s)return;
            const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='筆記圖片-'+Date.now()+'.'+type;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(`已匯出 ${canvas.width} × ${canvas.height} ${type.toUpperCase()}；原圖與標記仍保留。`);canvas.width=canvas.height=1;
        }catch(error){if(session===s)message('匯出未完成：'+error.message);}
        finally{if(session===s){s.busy=false;update();}}
    }
    function exportDraft(){
        const s=session;if(!s?.ready)return null;const initial=JSON.parse(s.initial),used=new Set([...Object.keys(s.doc.assets),...Object.keys(initial.assets)]);
        return {studioVersion:4,source:s.original,sourceKey:s.originalKey,doc:M.copy(s.doc),initial,textLayoutUpgrade:!!s.needsTextMigration,images:Object.fromEntries([...used].filter(id=>id!=='original'&&s.sources[id]).map(id=>[id,s.sources[id]])),imageIndex:s.target.image?[...el('modal-text').querySelectorAll('img[data-inline-image="1"]')].indexOf(s.target.image):null,gallery:s.target.gallery??null};
    }
    return {open,close,isOpen,identity,exportDraft};
})();

const noteImageEditor={
    open:noteImageStudio.open,close:noteImageStudio.close,isOpen:noteImageStudio.isOpen,
    galleryKey:noteImageStorage.galleryKey,galleryData:noteImageStorage.galleryData,
    imageIdentity:noteImageStudio.identity,sourceKey:noteImageStorage.sourceKey,
    compactPayload:noteImageStorage.compactPayload,exportDraft:noteImageStudio.exportDraft
};

