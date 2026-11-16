/* Source: 91-image-studio-model.js */
/* Editable image documents: immutable source assets plus ordered vector objects. */
const noteStudioModel = (() => {
    const I=[1,0,0,1,0,0], TYPES=new Set(['image','pen','arrow','line','rect','ellipse','highlight','text','badge','callout']);
    const fonts={sans:'Arial, "PingFang TC", "Microsoft JhengHei", sans-serif',serif:'Georgia, "Noto Serif TC", serif',mono:'Consolas, monospace'};
    const copy=value=>JSON.parse(JSON.stringify(value));
    const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const n=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,n(v,a)));
    const color=(v,fallback='#2563eb')=>/^#[a-f0-9]{6}$/i.test(v||'')?v:fallback;
    const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
    const translate=(x,y)=>[1,0,0,1,x,y];
    const transform=(p,m)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
    function inverse(p,m){const d=m[0]*m[3]-m[1]*m[2],x=p.x-m[4],y=p.y-m[5];return {x:(m[3]*x-m[2]*y)/d,y:(-m[1]*x+m[0]*y)/d};}
    const around=(matrix,p)=>mul(translate(p.x,p.y),mul(matrix,translate(-p.x,-p.y)));
    const rotate=degrees=>{const a=degrees*Math.PI/180;return [Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];};
    const corners=b=>[{x:b.x||0,y:b.y||0},{x:(b.x||0)+b.w,y:b.y||0},{x:(b.x||0)+b.w,y:(b.y||0)+b.h},{x:b.x||0,y:(b.y||0)+b.h}];
    function box(points){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};}
    const objectCorners=o=>corners({w:o.w,h:o.h}).map(p=>transform(p,o.matrix));
    const bounds=o=>box(objectCorners(o));
    const weight=o=>Math.round(clamp(o.weight??(o.bold?700:400),100,900)/100)*100;
    const font=o=>`${o.italic?'italic ':''}${weight(o)} ${o.font}px ${fonts[o.family]||fonts.sans}`;
    const context=document.createElement('canvas').getContext('2d');
    function textLines(o){
        if(o.type==='text')return String(o.text||'').split('\n');
        context.font=font(o);const width=Math.max(1,o.w-12),lines=[];
        for(const paragraph of String(o.text||'').split('\n')){
            let line='';const words=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'word'}).segment(paragraph)].map(v=>v.segment):[...paragraph];
            for(const word of words){
                if(line&&context.measureText(line+word).width>width){lines.push(line);line='';}
                if(context.measureText(word).width<=width){line+=word;continue;}
                for(const char of word){if(line&&context.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}
            }
            lines.push(line);
        }
        return lines;
    }
    function textSize(o){context.font=font(o);return {w:Math.max(24,...textLines(o).map(line=>context.measureText(line).width))+12,h:Math.max(o.font*1.2+12,textLines(o).length*o.font*o.lineHeight+12)};}
    function fitText(o){
        if(o.type==='text'){const size=textSize(o);o.w=o.manualSize?Math.max(o.w,size.w):size.w;o.h=o.manualSize?Math.max(o.h,size.h):size.h;}
        else if(o.type==='callout')o.h=Math.max(o.font*1.2+12,textLines(o).length*o.font*o.lineHeight+30);
        return o;
    }
    function object(type,x,y,w=160,h=100,style={}){
        return {id:uid(),type,name:'',matrix:translate(x,y),w:Math.max(1,w),h:Math.max(1,h),visible:true,locked:false,opacity:type==='highlight'?.28:1,color:'#2563eb',fill:type==='highlight'?'#facc15':null,stroke:3,dash:'solid',font:24,family:'sans',bold:false,italic:false,align:'left',lineHeight:1.4,text:'',...(type==='text'?{textLayout:'manual-lines',manualSize:false}:{}),...style};
    }
    function blank(w,h){return {schema:4,bounds:{x:0,y:0,w,h},crop:{x:0,y:0,w,h},angle:0,flipX:false,flipY:false,background:null,assets:{original:{w,h}},objects:[object('image',0,0,w,h,{id:'background-original',name:'原圖',assetId:'original',locked:true,crop:{x:0,y:0,w,h},brightness:100,contrast:100,saturation:100})]};}
    function geometry(doc,full=false){
        const c=full?doc.bounds:doc.crop,a=rotate(doc.angle),rotated=box(corners(c).map(p=>transform(p,a)));
        let m=mul(translate(-rotated.x,-rotated.y),a);
        if(doc.flipX)m=mul([-1,0,0,1,rotated.w,0],m);
        if(doc.flipY)m=mul([1,0,0,-1,0,rotated.h],m);
        return {w:rotated.w,h:rotated.h,m};
    }
    function validate(value,w,h){
        if(value?.schema!==4||!Array.isArray(value.objects)||value.objects.length>1000)throw Error('圖片文件格式不完整');
        const d=copy(value),validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id);
        const rect=(v,base)=>({x:clamp(v?.x??base.x,-100000,100000),y:clamp(v?.y??base.y,-100000,100000),w:clamp(v?.w??base.w,1,50000),h:clamp(v?.h??base.h,1,50000)});
        d.bounds=rect(d.bounds,{x:0,y:0,w,h});d.crop=rect(d.crop,d.bounds);
        d.crop.x=clamp(d.crop.x,d.bounds.x,d.bounds.x+d.bounds.w-1);d.crop.y=clamp(d.crop.y,d.bounds.y,d.bounds.y+d.bounds.h-1);
        d.crop.w=Math.min(d.crop.w,d.bounds.x+d.bounds.w-d.crop.x);d.crop.h=Math.min(d.crop.h,d.bounds.y+d.bounds.h-d.crop.y);
        d.angle=clamp(d.angle,-36000,36000);d.flipX=!!d.flipX;d.flipY=!!d.flipY;d.background=color(d.background,null);
        if(!d.assets||Array.isArray(d.assets)||Object.keys(d.assets).length>32)throw Error('圖片素材數量超過限制');
        const assets={};for(const[id,asset]of Object.entries(d.assets)){if(!validId(id))throw Error('圖片素材識別碼無效');assets[id]={w:clamp(asset.w,1,50000),h:clamp(asset.h,1,50000),...(asset.key?{key:String(asset.key).slice(0,120)}:{})};}d.assets=assets;
        const ids=new Set();
        d.objects=d.objects.map(raw=>{
            if(!validId(raw.id)||ids.has(raw.id)||!TYPES.has(raw.type))throw Error('圖片物件識別碼或類型無效');ids.add(raw.id);
            if(!Array.isArray(raw.matrix)||raw.matrix.length!==6||!raw.matrix.every(v=>Number.isFinite(v)&&Math.abs(v)<1e7)||Math.abs(raw.matrix[0]*raw.matrix[3]-raw.matrix[1]*raw.matrix[2])<1e-8)throw Error('圖片物件變形資料無效');
            const o=object(raw.type,0,0,clamp(raw.w,1,50000),clamp(raw.h,1,50000));
            Object.assign(o,{id:raw.id,matrix:[...raw.matrix],name:String(raw.name||'').slice(0,80),visible:raw.visible!==false,locked:!!raw.locked,opacity:clamp(raw.opacity??1,0,1),color:color(raw.color),fill:color(raw.fill,null),stroke:clamp(raw.stroke??3,.1,200),dash:['solid','dashed','dotted'].includes(raw.dash)?raw.dash:'solid',font:clamp(raw.font??24,8,500),family:fonts[raw.family]?raw.family:'sans',bold:!!raw.bold,italic:!!raw.italic,align:['left','center','right'].includes(raw.align)?raw.align:'left',lineHeight:clamp(raw.lineHeight??1.4,.8,3),text:String(raw.text||'').slice(0,4000)});
            if(o.type==='text'){o.weight=weight(raw);o.bold=o.weight>=600;o.manualSize=!!raw.manualSize;if(raw.textLayout!=='manual-lines')fitText(o);}
            if(validId(raw.groupId))o.groupId=raw.groupId;
            if(o.type==='image'){
                if(!assets[raw.assetId])throw Error('圖片物件缺少原始素材');o.assetId=raw.assetId;const a=assets[o.assetId];o.crop=rect(raw.crop,{x:0,y:0,w:a.w,h:a.h});
                o.crop.x=clamp(o.crop.x,0,a.w-1);o.crop.y=clamp(o.crop.y,0,a.h-1);o.crop.w=Math.min(o.crop.w,a.w-o.crop.x);o.crop.h=Math.min(o.crop.h,a.h-o.crop.y);
                for(const key of ['brightness','contrast','saturation'])o[key]=clamp(raw[key]??100,0,200);
            }
            if(['pen','line','arrow'].includes(o.type)){
                if(!Array.isArray(raw.points)||!raw.points.length||raw.points.length>20000)throw Error('筆畫資料無效');
                o.points=raw.points.map(p=>({x:clamp(p.x,-100000,100000),y:clamp(p.y,-100000,100000)}));
            }
            return o;
        });return d;
    }
    function migrate(old,w,h){
        if(old?.schema===4)return validate(old,w,h);
        const d=blank(w,h);if(!old)return d;
        d.crop={...d.crop,...old.crop};d.angle=(old.rotation||0)*90;d.flipX=!!old.flip;
        for(const mark of old.marks||[]){
            const b=box(mark.points),isText=mark.type==='text',o=object(mark.type,b.x,b.y,Math.max(b.w,1),Math.max(b.h,1),{color:mark.color,stroke:mark.width||3,font:mark.font||24,text:mark.text||'',bold:true,opacity:mark.type==='highlight'?.28:1,fill:mark.type==='highlight'?mark.color:null});
            o.matrix=mul(mark.matrix||I,translate(b.x,b.y));
            if(['pen','arrow','line'].includes(o.type))o.points=mark.points.map(p=>({x:p.x-b.x,y:p.y-b.y}));
            if(isText){context.font=font(o);o.w=Math.max(30,...o.text.split('\n').map(line=>context.measureText(line).width))+12;o.lineHeight=1.25;fitText(o);o.matrix=mul(o.matrix,translate(-6,-6));}
            d.objects.push(o);
        }
        return validate(d,w,h);
    }
    function cropImage(o,a){return o.crop||{x:0,y:0,w:a.w,h:a.h};}
    function objectMarkup(o,d){
        const stroke=`stroke="${o.color}" stroke-width="${o.stroke}" stroke-linecap="round" stroke-linejoin="round"${o.dash!=='solid'?` stroke-dasharray="${o.dash==='dotted'?o.stroke+' '+o.stroke*2:o.stroke*4+' '+o.stroke*2}"`:''}`;
        const fill=o.fill||'none';
        if(o.type==='image'){
            const a=d.assets[o.assetId],c=cropImage(o,a),sx=o.w/c.w,sy=o.h/c.h,B=o.brightness/100,C=o.contrast/100,S=o.saturation/100,slope=B*C,intercept=.5*(1-C);
            return `<defs><clipPath id="clip-${o.id}"><rect width="${o.w}" height="${o.h}"/></clipPath><filter id="filter-${o.id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feComponentTransfer>${['R','G','B'].map(channel=>`<feFunc${channel} type="linear" slope="${slope}" intercept="${intercept}"/>`).join('')}</feComponentTransfer><feColorMatrix type="saturate" values="${S}"/></filter></defs><g clip-path="url(#clip-${o.id})"><use href="#asset-${o.assetId}" transform="matrix(${sx} 0 0 ${sy} ${-c.x*sx} ${-c.y*sy})" filter="url(#filter-${o.id})"/></g>`;
        }
        if(o.type==='rect'||o.type==='highlight')return `<rect width="${o.w}" height="${o.h}" fill="${o.type==='highlight'?o.fill||o.color:fill}" ${o.type==='highlight'?'':stroke}/>`;
        if(o.type==='ellipse')return `<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}" fill="${fill}" ${stroke}/>`;
        if(['pen','arrow','line'].includes(o.type)){
            const points=o.points||[{x:0,y:0},{x:o.w,y:o.h}],last=points.at(-1),prior=points.length>1?points.at(-2):{x:last.x-1,y:last.y},angle=Math.atan2(last.y-prior.y,last.x-prior.x),length=Math.max(o.stroke*4,12);
            if(points.length===1)return `<circle cx="${last.x}" cy="${last.y}" r="${o.stroke/2}" fill="${o.color}"/>`;
            return `<polyline points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="none" ${stroke}/>`+(o.type==='arrow'?`<polygon points="${last.x},${last.y} ${last.x-length*Math.cos(angle-.48)},${last.y-length*Math.sin(angle-.48)} ${last.x-length*Math.cos(angle+.48)},${last.y-length*Math.sin(angle+.48)}" fill="${o.color}"/>`:'');
        }
        if(o.type==='badge')return `<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}" fill="${o.fill||o.color}"/><text x="${o.w/2}" y="${o.h/2}" dominant-baseline="central" text-anchor="middle" font-family="${xml(fonts[o.family])}" font-size="${o.font}" font-weight="700" fill="${o.fill?o.color:'#ffffff'}">${xml(o.text)}</text>`;
        let background='';if(o.type==='callout')background=`<path d="M0 0H${o.w}V${o.h-18}H${o.w*.4}L${o.w*.25} ${o.h}V${o.h-18}H0Z" fill="${o.fill||'#ffffff'}" ${stroke}/>`;
        else if(o.fill)background=`<rect width="${o.w}" height="${o.h}" rx="3" fill="${o.fill}"/>`;
        const x=o.align==='center'?o.w/2:o.align==='right'?o.w-6:6,anchor={left:'start',center:'middle',right:'end'}[o.align];
        return background+`<text fill="${o.color}" font-family="${xml(fonts[o.family])}" font-size="${o.font}" font-weight="${weight(o)}" font-style="${o.italic?'italic':'normal'}" text-anchor="${anchor}" xml:space="preserve">${textLines(o).map((line,index)=>`<tspan x="${x}" y="${6+o.font*.85+index*o.font*o.lineHeight}">${xml(line)}</tspan>`).join('')}</text>`;
    }
    function assetMarkup(doc,sources){return Object.entries(doc.assets).map(([id,a])=>{
        const source=sources[id];if(!/^data:image\//i.test(source||''))throw Error('部分原圖尚未準備好');
        return `<image id="asset-${id}" data-note-studio-asset="${id}" width="${a.w}" height="${a.h}" href="${xml(source)}"/>`;
    }).join('');}
    function svg(doc,sources,scale=1){
        const g=geometry(doc),body=doc.objects.filter(o=>o.visible).map(o=>`<g transform="matrix(${o.matrix.join(' ')})" opacity="${o.opacity}">${objectMarkup(o,doc)}</g>`).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1,Math.round(g.w*scale))}" height="${Math.max(1,Math.round(g.h*scale))}" viewBox="0 0 ${g.w} ${g.h}" overflow="hidden"><defs>${assetMarkup(doc,sources)}<clipPath id="studio-output-crop"><rect x="${doc.crop.x}" y="${doc.crop.y}" width="${doc.crop.w}" height="${doc.crop.h}"/></clipPath></defs><g transform="matrix(${g.m.join(' ')})" clip-path="url(#studio-output-crop)">${doc.background?`<rect x="${doc.crop.x}" y="${doc.crop.y}" width="${doc.crop.w}" height="${doc.crop.h}" fill="${doc.background}"/>`:''}${body}</g></svg>`;
    }
    function dataUrl(doc,sources,scale=1){
        const placeholders={};let serial=0;
        const safe=Object.fromEntries(Object.entries(sources).map(([id,src])=>{const token='NOTE_STUDIO_BINARY_'+serial++;placeholders[token]=src;return [id,token];}));
        // Build first using real validated sources, then leave canonical base64 slices unescaped.
        let raw=svg(doc,sources,scale);
        for(const[id,src]of Object.entries(sources))raw=raw.split(xml(src)).join(safe[id]);
        let encoded=encodeURIComponent(raw);
        for(const[token,src]of Object.entries(placeholders)){
            const attr=/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(src)?src:encodeURIComponent(xml(src));
            encoded=encoded.split(token).join(attr);
        }
        return 'data:image/svg+xml;charset=utf-8,'+encoded;
    }
    const sourceCache=new Map();
    function embedded(src){
        if(sourceCache.has(src))return sourceCache.get(src);
        if(!/^data:image\/svg\+xml[;,]/i.test(src))throw Error('圖片的可編輯原始資料無效');
        const comma=src.indexOf(','),xmlSource=/;base64/i.test(src.slice(0,comma))?new TextDecoder().decode(Uint8Array.from(atob(src.slice(comma+1)),c=>c.charCodeAt(0))):decodeURIComponent(src.slice(comma+1));
        const root=new DOMParser().parseFromString(xmlSource,'image/svg+xml');if(root.querySelector('parsererror'))throw Error('圖片的可編輯原始資料無效');
        const sources={};for(const image of root.querySelectorAll('image[data-note-studio-asset]')){const id=image.getAttribute('data-note-studio-asset'),value=image.getAttribute('href');if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)||!/^data:image\//i.test(value||''))throw Error('圖片素材內容無效');sources[id]=value;}
        if(!sources.original)throw Error('圖片缺少原圖');sourceCache.set(src,sources);while(sourceCache.size>3)sourceCache.delete(sourceCache.keys().next().value);return sources;
    }
    return {I,TYPES,fonts,copy,uid,n,clamp,color,xml,mul,translate,transform,inverse,around,rotate,corners,box,objectCorners,bounds,weight,font,textLines,textSize,fitText,object,blank,geometry,validate,migrate,objectMarkup,assetMarkup,svg,dataUrl,embedded};
})();

