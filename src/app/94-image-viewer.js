/* Source: 94-image-viewer.js */
/* One cancellable viewing session owns loading, zooming and pointer capture. */
const noteImageViewer=(()=>{
    let initialized=false,sequence=0,frame=0,active=null,lastSource='',lastSize=null;
    const el=id=>document.getElementById(id),clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
    function init(){
        if(initialized)return;initialized=true;const root=el('imageViewer'),viewport=el('image-viewer-viewport');
        root.addEventListener('click',event=>{
            if(event.target.closest('[data-viewer-action="close"]'))return close();
            if(!active||active.ignoreBackdropClick)return;
            const background=event.target===root||event.target===viewport||event.target.classList.contains('image-viewer-content');
            if(background){const r=el('image-viewer-img').getBoundingClientRect(),overImage=active.ready&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;if(!overImage)close();}
        });
        root.addEventListener('wheel',event=>{if(!active)return;event.preventDefault();if(active.ready){const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?active.view.h:1);zoomBy(Math.exp(-clamp(delta,-300,300)*.0025),event.clientX,event.clientY);}},{passive:false});
        viewport.addEventListener('dragstart',event=>event.preventDefault());viewport.addEventListener('pointerdown',pointerDown);viewport.addEventListener('pointermove',pointerMove);viewport.addEventListener('pointerup',pointerEnd);viewport.addEventListener('pointercancel',pointerEnd);viewport.addEventListener('lostpointercapture',pointerEnd);
        window.addEventListener('blur',releasePointers);window.addEventListener('pagehide',close);document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePointers();});
        window.addEventListener('keydown',event=>{
            if(!active)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
            if(event.key==='Tab'){const nodes=[...root.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;}
            if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
            if(['+','=','-','0','f','F','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(!active.ready)return;
                if(event.key==='+'||event.key==='=')zoomBy(1.25);else if(event.key==='-')zoomBy(.8);else if(event.key==='0')zoomTo(1);else if(event.key.toLowerCase()==='f')fit();else if(event.key.startsWith('Arrow')){active.x+=event.key==='ArrowLeft'?60:event.key==='ArrowRight'?-60:0;active.y+=event.key==='ArrowUp'?60:event.key==='ArrowDown'?-60:0;bound();schedule();}}
        },true);
        new ResizeObserver(()=>{if(!active?.ready)return;measure();if(active.fitted)fit();else{bound();schedule();}}).observe(viewport);
    }
    function measure(){if(active){const r=el('image-viewer-viewport').getBoundingClientRect();active.view={x:r.left,y:r.top,w:r.width,h:r.height};}}
    function bound(){const s=active;if(!s?.ready)return;const w=s.w*s.scale,h=s.h*s.scale,v=s.view;s.x=w<=v.w?(v.w-w)/2:clamp(s.x,v.w-w-24,24);s.y=h<=v.h?(v.h-h)/2:clamp(s.y,v.h-h-24,24);}
    function paint(){frame=0;const s=active;if(!s?.ready)return;el('image-viewer-img').style.transform=`translate(${s.x}px,${s.y}px) scale(${s.scale})`;el('image-viewer-viewport').classList.toggle('viewer-can-pan',s.w*s.scale>s.view.w||s.h*s.scale>s.view.h);}
    function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
    function fit(){const s=active;if(!s?.ready)return;measure();s.scale=Math.min(1,(s.view.w-40)/s.w,(s.view.h-40)/s.h);s.scale=Math.max(.001,s.scale);s.fitted=true;s.x=(s.view.w-s.w*s.scale)/2;s.y=(s.view.h-s.h*s.scale)/2;s.fitScale=s.scale;bound();schedule();}
    function zoomTo(next,clientX,clientY){const s=active;if(!s?.ready)return;const v=s.view,x=Number.isFinite(clientX)?clamp(clientX-v.x,0,v.w):v.w/2,y=Number.isFinite(clientY)?clamp(clientY-v.y,0,v.h):v.h/2,scale=clamp(next,Math.min(.05,s.fitScale/4),8),ratio=scale/s.scale;s.x=x-(x-s.x)*ratio;s.y=y-(y-s.y)*ratio;s.scale=scale;s.fitted=false;bound();schedule();}
    function zoomBy(factor,x,y){if(active?.ready)zoomTo(active.scale*factor,x,y);}
    function releasePointers(){const s=active;if(!s)return;const viewport=el('image-viewer-viewport'),ids=[...s.pointers.keys()];s.pointers.clear();s.drag=null;s.pinch=null;viewport.classList.remove('viewer-dragging');for(const id of ids)try{if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);}catch(_){} }
    function pointerDown(event){const s=active;if(!s?.ready||event.button!==0)return;event.preventDefault();const v=el('image-viewer-viewport');v.focus({preventScroll:true});if(!s.pointers.size)s.ignoreBackdropClick=false;s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});try{v.setPointerCapture(event.pointerId);}catch(_){}
        if(s.pointers.size===2){s.ignoreBackdropClick=true;const p=[...s.pointers.values()];s.pinch={distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};s.drag=null;}else if(s.pointers.size===1){s.drag={id:event.pointerId,x:event.clientX,y:event.clientY,tx:s.x,ty:s.y};v.classList.add('viewer-dragging');}}
    function pointerMove(event){const s=active;if(!s?.ready||!s.pointers.has(event.pointerId))return;if(event.pointerType==='mouse'&&!(event.buttons&1)){releasePointers();return;}event.preventDefault();s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(s.pinch&&s.pointers.size>=2){const p=[...s.pointers.values()],distance=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),x=(p[0].x+p[1].x)/2,y=(p[0].y+p[1].y)/2;zoomBy(distance/(s.pinch.distance||1),x,y);s.x+=x-s.pinch.x;s.y+=y-s.pinch.y;s.pinch={distance,x,y};bound();schedule();}
        else if(s.drag?.id===event.pointerId){if(Math.hypot(event.clientX-s.drag.x,event.clientY-s.drag.y)>6)s.ignoreBackdropClick=true;s.x=s.drag.tx+event.clientX-s.drag.x;s.y=s.drag.ty+event.clientY-s.drag.y;s.fitted=false;bound();schedule();}}
    function pointerEnd(event){const s=active;if(!s?.pointers.has(event.pointerId))return;releasePointers();}
    function message(value){el('image-viewer-message').textContent=value;el('image-viewer-message').hidden=!value;}
    async function open(source){
        init();const root=el('imageViewer'),image=el('image-viewer-img'),previous=active?.focus||document.activeElement;close(false);
        const s=active={id:++sequence,ready:false,w:0,h:0,scale:1,x:0,y:0,fitted:true,view:null,pointers:new Map(),drag:null,pinch:null,ignoreBackdropClick:false,abort:new AbortController(),focus:previous};
        root.hidden=false;root.classList.add('active');root.setAttribute('aria-busy','true');image.hidden=true;message('正在讀取原圖…');root.querySelector('[data-viewer-action="close"]').focus({preventScroll:true});
        const editorRequest=noteOpenRequest,fromEditor=el('noteModal').classList.contains('active');let timer,abort;
        try{
            const cancelled=new Promise((_,reject)=>{abort=()=>reject(Error('已取消圖片載入'));s.abort.signal.addEventListener('abort',abort,{once:true});}),timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('原圖讀取逾時，請關閉後重試')),30000);});
            const full=await Promise.race([(async()=>notePersistence.resolveEditorValue(typeof source==='function'?await source():source))(),cancelled,timeout]);
            if(active!==s)return;if(fromEditor&&(editorRequest!==noteOpenRequest||!el('noteModal').classList.contains('active'))){close();return;}if(!full)throw Error('這張原圖目前無法讀取，請稍後重試');
            let size=lastSource===full&&image.complete&&image.naturalWidth?lastSize:null;
            if(!size){const decoded=new Image();decoded.decoding='async';decoded.src=full;await Promise.race([noteImageReady(decoded),cancelled,timeout]);size={w:decoded.naturalWidth,h:decoded.naturalHeight};}
            if(active!==s)return;if(fromEditor&&(editorRequest!==noteOpenRequest||!el('noteModal').classList.contains('active'))){close();return;}if(!size?.w||!size?.h)throw Error('圖片尺寸無效');if(lastSource!==full)image.src=full;lastSource=full;lastSize=size;s.w=size.w;s.h=size.h;s.ready=true;image.style.width=s.w+'px';image.style.height=s.h+'px';image.hidden=false;message('');root.removeAttribute('aria-busy');fit();
        }catch(error){if(active===s){root.removeAttribute('aria-busy');message(error.message+'；筆記與原圖仍保留。');}}
        finally{clearTimeout(timer);if(abort)s.abort.signal.removeEventListener('abort',abort);}
    }
    function close(restoreFocus=true){const s=active;releasePointers();active=null;sequence++;cancelAnimationFrame(frame);frame=0;s?.abort.abort();const root=el('imageViewer');if(root){root.classList.remove('active');root.hidden=true;root.removeAttribute('aria-busy');}if(restoreFocus&&s?.focus?.isConnected&&!root?.contains(s.focus))s.focus.focus?.({preventScroll:true});}
    return {open,close};
})();

