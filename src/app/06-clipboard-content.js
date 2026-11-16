/* Source: 06-clipboard-content.js */
/* Clipboard HTML is a selection plus source-page layout, not a saved note.
   Use the clipboard's selected text for spacing and HTML for inline formatting. */
const noteClipboardContent=(()=>{
    const inlineTags=new Set('a b strong i em u s strike sub sup font mark code'.split(' '));
    const textStyles='color background-color font-family font-size font-weight font-style font-variant text-decoration text-decoration-line text-decoration-color vertical-align'.split(' ');
    const blockTags=new Set('p div h1 h2 h3 h4 h5 h6 blockquote li td th caption section article header footer'.split(' '));
    const structures='table,ol,ul,img,pre,hr,[data-note-table],[data-inline-image]';
    const hiddenSelector='[hidden],[aria-hidden="true"],[data-selection-bookmark],.inline-image-controls,.inline-drop-marker,.inline-annotation-overlay,.annotation-badge,.note-table-controls,.table-drop-marker';
    const asciiSpace=/[\t\n\r\f ]+/g;
    function selectedHtml(raw){
        const doc=new DOMParser().parseFromString(String(raw||''),'text/html'),walker=doc.createTreeWalker(doc,NodeFilter.SHOW_COMMENT);let start=null,end=null,node;
        while(node=walker.nextNode()){if(/^\s*StartFragment\s*$/i.test(node.data))start=node;else if(start&&/^\s*EndFragment\s*$/i.test(node.data)){end=node;break;}}
        let root=doc.body;
        if(start&&end&&(start.compareDocumentPosition(end)&Node.DOCUMENT_POSITION_FOLLOWING)){
            const range=doc.createRange();range.setStartAfter(start);range.setEndBefore(end);let fragment=range.cloneContents(),parent=range.commonAncestorContainer;
            if(parent.nodeType!==Node.ELEMENT_NODE)parent=parent.parentElement;
            const cell=start.parentElement?.closest('td,th'),singleCell=cell&&end.parentElement?.closest('td,th')===cell;
            while(parent&&parent!==doc.body&&parent!==doc.documentElement){const wrapper=singleCell&&parent===cell?doc.createElement('span'):parent.cloneNode(false);if(singleCell&&parent===cell)for(const a of parent.attributes)wrapper.setAttribute(a.name,a.value);wrapper.append(fragment);fragment=wrapper;if(singleCell&&parent===cell)break;parent=parent.parentElement;}
            root=doc.createElement('div');root.append(fragment);
        }
        root.querySelectorAll(hiddenSelector).forEach(n=>n.remove());
        for(const element of root.querySelectorAll('[style]'))if(element.style.display==='none'||element.style.visibility==='hidden')element.remove();
        return root.innerHTML;
    }
    function formatChain(text,root){
        const chain=[];
        for(let parent=text.parentElement;parent&&parent!==root;parent=parent.parentElement){
            const tag=parent.localName,semantic=inlineTags.has(tag),copy=document.createElement(semantic?tag:'span');
            if(semantic)for(const a of parent.attributes)if(a.name!=='style'&&a.name!=='class')copy.setAttribute(a.name,a.value);
            if(parent.classList.contains('note-internal-link'))copy.className='note-internal-link';
            for(const name of ['dir','lang'])if(parent.hasAttribute(name))copy.setAttribute(name,parent.getAttribute(name));
            if(/^h[1-6]$/.test(tag)){copy.style.fontWeight='bold';copy.style.fontSize=[2,1.5,1.17,1,.83,.67][Number(tag[1])-1]+'em';}
            for(const key of textStyles){const v=parent.style.getPropertyValue(key);if(v)copy.style.setProperty(key,v);}
            if(semantic||copy.attributes.length)chain.unshift(copy);
        }
        return chain;
    }
    function addText(root,value){const lines=value.split('\n');for(let i=0;i<lines.length;i++){if(i)root.append(document.createElement('br'));if(lines[i])root.append(document.createTextNode(lines[i]));}}
    function selectedTextMarkup(root,plain){
        if(root.querySelector(structures)||root.textContent.replace(/\s/g,'')!==plain.replace(/\s/g,''))return null;
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;
        while(node=walker.nextNode())if(/\S/.test(node.data))nodes.push(node);
        if(!nodes.length){const output=document.createElement('div');addText(output,plain);return output.innerHTML;}
        const positions=[];for(let i=0;i<plain.length;i++)if(/\S/.test(plain[i]))positions.push(i);
        const runs=[];let used=0,cursor=0;
        for(const source of nodes){
            used+=source.data.replace(/\s/g,'').length;const end=positions[used-1]+1,chain=formatChain(source,root),key=chain.map(n=>n.outerHTML).join('|'),value=plain.slice(cursor,end);cursor=end;
            if(runs.at(-1)?.key===key)runs.at(-1).value+=value;else runs.push({key,chain,value});
        }
        runs.at(-1).value+=plain.slice(cursor);
        const output=document.createElement('div');
        for(const run of runs){let target=output;for(const prototype of run.chain){const next=prototype.cloneNode(false);target.append(next);target=next;}addText(target,run.value);}
        return output.innerHTML;
    }
    function compactStructures(root,plain=null){
        const preformatted=new WeakSet();
        for(const node of root.querySelectorAll('*'))if(['pre','code'].includes(node.localName)||/^pre/.test(node.style.whiteSpace))preformatted.add(node);
        // A rectangular TSV selection identifies actual spaces inside table cells.
        const tables=root.querySelectorAll('table');
        if(typeof plain==='string'&&tables.length===1){
            const rows=[...tables[0].rows],lines=plain.split('\n');if(lines.at(-1)===''&&lines.length===rows.length+1)lines.pop();const cells=lines.map(line=>line.split('\t'));
            if(rows.length===cells.length&&rows.every((row,i)=>row.cells.length===cells[i].length&&[...row.cells].every(c=>c.colSpan===1&&c.rowSpan===1)))for(let i=0;i<rows.length;i++)for(let j=0;j<rows[i].cells.length;j++){const cell=rows[i].cells[j],exact=selectedTextMarkup(cell,cells[i][j]);if(exact!==null){cell.innerHTML=exact;preformatted.add(cell);}}
        }
        const keepSpace=node=>{for(let p=node.parentElement;p&&p!==root;p=p.parentElement)if(preformatted.has(p))return true;return false;};
        const atomic=node=>!!node.closest('img,table,[data-inline-image],[data-note-table]');
        for(const node of root.querySelectorAll('*')){
            if(atomic(node))continue;
            for(const key of [...node.style]){if(key==='white-space'&&preformatted.has(node))continue;if(/^(?:margin|padding)(?:-|$)/.test(key)||['width','height','min-width','min-height','max-width','max-height','text-indent','letter-spacing','word-spacing','line-height','white-space','float','clear'].includes(key))node.style.removeProperty(key);}
            if(node.localName==='p'){node.style.marginTop='0';node.style.marginBottom='0';}
        }
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
        while(node=walker.nextNode())if(!keepSpace(node))node.data=node.data.replace(asciiSpace,' ');
        for(const block of [root,...root.querySelectorAll([...blockTags].join(','))]){
            const leaves=[],walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let n;
            while(n=walker.nextNode())if(!keepSpace(n))leaves.push(n);
            if(leaves.length){leaves[0].data=leaves[0].data.replace(/^[\t\r\n\f ]+/,'');leaves.at(-1).data=leaves.at(-1).data.replace(/[\t\r\n\f ]+$/,'');}
        }
        const comments=[],commentWalker=document.createTreeWalker(root,NodeFilter.SHOW_COMMENT);while(node=commentWalker.nextNode())comments.push(node);comments.forEach(n=>n.remove());
        return root.innerHTML;
    }
    function html(value,plain=null){
        const root=document.createElement('div');root.innerHTML=sanitizeNoteHtml(selectedHtml(value));
        if(typeof plain==='string'){plain=plain.replace(/\r\n?/g,'\n');const exact=selectedTextMarkup(root,plain);if(exact!==null)return exact;}
        return compactStructures(root,plain);
    }
    function text(value){const root=document.createElement('div');addText(root,String(value||'').replace(/\r\n?/g,'\n'));return root.innerHTML;}
    return {html,text};
})();

