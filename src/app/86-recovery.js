/* Source: 86-recovery.js */
/* Recovery entries are independent catalog records, so large libraries stay pageable. */
function isRecoveryCarrier(value) { return value?._type === 'system-recovery' && String(value.id || '').startsWith(NOTE_RECOVERY_ID + ':'); }

const noteRecovery = (() => {
    const day = 86400000, trashDays = 30, tombstoneDays = 90, maxVersions = 200, perNote = 10;
    let entries = [], initialized = false, selected = null, tab = 'trash', busy = false, opener = null;
    const uid = () => crypto.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const time = entry => Date.parse(entry.updatedAt || entry.capturedAt) || 0;
    const copy = value => JSON.parse(JSON.stringify(value));
    function trim() {
        const now = Date.now(), byNote = new Map(); let total = 0;
        entries.sort((a,b)=>time(b)-time(a));
        for (const entry of entries) {
            if (entry.removedAt) continue;
            const count = byNote.get(String(entry.noteId)) || 0;
            const expired = entry.kind === 'trash' ? now-Date.parse(entry.capturedAt)>trashDays*day : count>=perNote || total>=maxVersions;
            if (expired) { entry.removedAt=new Date(now).toISOString();entry.updatedAt=entry.removedAt;delete entry.snapshot;delete entry.categories; }
            else if (entry.kind==='version') {byNote.set(String(entry.noteId),count+1);total++;}
        }
        entries=entries.filter(entry=>!entry.removedAt || now-Date.parse(entry.removedAt)<tombstoneDays*day);
    }
    function load(carriers) {
        const found = new Map();
        for (const carrier of carriers || []) {
            const entry=carrier?.record;
            if (!entry || typeof entry.id!=='string' || !/^[a-zA-Z0-9-]{1,100}$/.test(entry.id) || !['trash','version'].includes(entry.kind) || !Number.isFinite(Date.parse(entry.capturedAt))) continue;
            if (!entry.removedAt && (!entry.snapshot || !['string','number'].includes(typeof entry.snapshot.id))) continue;
            const value=copy(entry);if(value.snapshot)value.snapshot=noteSafeContent.note(value.snapshot);
            const old=found.get(value.id);if(!old||time(value)>time(old))found.set(value.id,value);
        }
        entries=[...found.values()];trim();updateBadge();
    }
    function carriers() {trim();return entries.map(record=>({id:NOTE_RECOVERY_ID+':'+record.id,_type:'system-recovery',record:copy(record)}));}
    function capture(note, kind, reason) {
        const snapshot=notePersistence.snapshot(note);
        const latest=entries.find(entry=>!entry.removedAt&&entry.kind===kind&&entry.noteId===note.id);
        if (kind==='version'&&latest&&JSON.stringify(latest.snapshot)===JSON.stringify(snapshot)) return latest;
        const now=new Date().toISOString(),entry={id:uid(),noteId:note.id,kind,capturedAt:now,updatedAt:now,reason,snapshot,index:notesData.indexOf(note),categories:getNoteCategoryIds(note).map(getCategoryById).filter(Boolean).map(copy)};
        entries.unshift(entry);trim();updateBadge();return entry;
    }
    function beforeEdit(note, session) {
        if (!note) return;
        if (!session || !session.versionRecorded || Date.now()-(session.lastVersionAt||0)>=300000) {
            capture(note,'version','編輯前的內容');
            if(session){session.versionRecorded=true;session.lastVersionAt=Date.now();}
        }
    }
    function trash(note) {return capture(note,'trash','刪除前的完整內容');}
    function updateBadge() {
        const button=document.getElementById('note-recovery-open');
        if(button){const count=entries.filter(entry=>entry.kind==='trash'&&!entry.removedAt).length;button.textContent='垃圾桶與版本'+(count?'（'+count+'）':'');}
    }
    function open(nextTab='trash') {
        const dialog=document.getElementById('note-recovery-dialog');
        if(!dialog)return;tab=nextTab;selected=null;opener=document.activeElement;
        if(!dialog.open){dialog.classList.add('active');dialog.showModal();}render();
    }
    function render() {
        const dialog=document.getElementById('note-recovery-dialog');if(!dialog?.open)return;
        const term=normalizeSearchText(dialog.querySelector('[data-recovery-filter]').value);
        const visible=entries.filter(entry=>!entry.removedAt&&entry.kind===tab&&(!term||normalizeSearchText((entry.snapshot?.title||'')+' '+notePlainText(entry.snapshot?.text||'')).includes(term)));
        dialog.querySelectorAll('[data-recovery-tab]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.recoveryTab===tab));});
        const list=dialog.querySelector('[data-recovery-list]');list.replaceChildren();
        for(const entry of visible){
            const button=document.createElement('button');button.type='button';button.className='note-recovery-entry';button.dataset.recoveryEntry=entry.id;
            button.setAttribute('aria-pressed',String(selected===entry.id));
            const title=document.createElement('strong');title.textContent=entry.snapshot?.title||notePlainText(entry.snapshot?.text||'').slice(0,50)||'圖片筆記';
            const detail=document.createElement('small');detail.textContent=new Date(entry.capturedAt).toLocaleString('zh-TW')+' · '+entry.reason;
            button.append(title,detail);list.append(button);
        }
        if(!visible.length)list.textContent=tab==='trash'?'垃圾桶沒有符合的筆記。':'沒有符合的版本。新版本會在內容修改時開始保留。';
        if(!visible.some(entry=>entry.id===selected))selected=visible[0]?.id||null;
        list.querySelectorAll('[data-recovery-entry]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.recoveryEntry===selected)));
        const entry=entries.find(item=>item.id===selected&&!item.removedAt),preview=dialog.querySelector('[data-recovery-preview]');preview.replaceChildren();
        dialog.querySelector('[data-recovery-restore]').disabled=!entry||busy;
        dialog.querySelector('[data-recovery-remove]').disabled=!entry||busy;
        if(entry){
            const title=document.createElement('h3');title.textContent=entry.snapshot.title||'未命名筆記';preview.append(title);
            const content=document.createElement('div');content.className='note-recovery-text';content.innerHTML=sanitizeNoteHtml(entry.snapshot.text);
            content.querySelectorAll('img').forEach(image=>{const label=document.createElement('span');label.className='note-recovery-image-label';label.textContent='〔圖片會隨筆記還原〕';image.replaceWith(label);});
            preview.append(content);
            const gallery=entry.snapshot.images?.length||(entry.snapshot.image?1:0);
            if(gallery){const label=document.createElement('p');label.textContent='另有 '+gallery+' 張圖片會一併還原。';preview.append(label);}
        }
        updateBadge();
    }
    async function restore(id=selected) {
        const entry=entries.find(item=>item.id===id&&!item.removedAt);if(!entry||busy)return false;
        if(previewModeBlocksEditing())return false;
        if(notePersistence.hasOpenEditor()){alert('請先儲存並關閉目前編輯的筆記，再進行還原。');return false;}
        busy=true;render();
        const status=document.querySelector('[data-recovery-message]');if(status)status.textContent='正在準備完整內容與圖片…';
        try{
            const restored=await notePersistence.restoreSnapshot(entry.snapshot);
            for(const category of entry.categories||[])if(!getCategoryById(category.id))categoryDefinitions.push({id:String(category.id),name:String(category.name).slice(0,30),abbr:normalizeCategoryAbbr(category.abbr,category.name),color:normalizeCategoryColor(category.color)});
            const current=resolveLinkedNote(entry.noteId);
            if(entry.kind==='version'&&current){capture(current,'version','還原其他版本前的內容');restored.id=current.id;notesData[notesData.indexOf(current)]=restored;}
            else {if(current)restored.id='restored-'+uid();notesData.splice(Math.max(0,Math.min(notesData.length,entry.index??notesData.length)),0,restored);}
            restored.updatedAt=new Date().toISOString();
            if(entry.kind==='trash'){entry.removedAt=new Date().toISOString();entry.updatedAt=entry.removedAt;delete entry.snapshot;delete entry.categories;}
            addHistoryRecord('還原',restored,entry.kind==='trash'?'從垃圾桶還原':'還原筆記版本');
            autoSave(100);updateCategoryUi();noteBrowse.requestReveal(restored.id);filterNotes();
            if(status)status.textContent='已還原到筆記，正在自動同步。';showPreviewModeToast('已還原筆記，修改會自動同步。');return true;
        }catch(error){if(status)status.textContent='還原未完成：'+error.message;return false;}
        finally{busy=false;render();}
    }
    function remove() {
        const entry=entries.find(item=>item.id===selected&&!item.removedAt);if(!entry||busy)return;
        if(previewModeBlocksEditing())return;
        if(!confirm('確定移除此'+(entry.kind==='trash'?'垃圾桶項目':'版本')+'？這不會刪除目前的筆記。'))return;
        entry.removedAt=new Date().toISOString();entry.updatedAt=entry.removedAt;delete entry.snapshot;delete entry.categories;autoSave(100);render();
    }
    function initialize() {
        if(initialized)return;initialized=true;
        const button=document.createElement('button');button.id='note-recovery-open';button.type='button';button.textContent='垃圾桶與版本';button.addEventListener('click',()=>open());
        document.querySelector('.drive-workspace-top').append(button);
        const dialog=document.createElement('dialog');dialog.id='note-recovery-dialog';dialog.className='modal-overlay note-recovery-dialog';dialog.setAttribute('aria-labelledby','note-recovery-title');
        dialog.innerHTML='<div class="note-recovery-header"><h2 id="note-recovery-title">垃圾桶與筆記版本</h2><button type="button" data-recovery-close aria-label="關閉垃圾桶與版本">關閉</button></div><p class="note-recovery-hint">垃圾桶保留 30 天。版本每篇最多 10 份、全科目最多 200 份；還原前會保留目前內容。</p><div class="note-recovery-tools"><button type="button" data-recovery-tab="trash" aria-pressed="true">垃圾桶</button><button type="button" data-recovery-tab="version" aria-pressed="false">筆記版本</button><input type="search" data-recovery-filter placeholder="搜尋標題或內文" aria-label="搜尋垃圾桶或版本"></div><div class="note-recovery-grid"><div data-recovery-list aria-label="可還原的項目"></div><section data-recovery-preview aria-label="版本內容預覽"></section></div><p data-recovery-message role="status"></p><div class="note-recovery-actions"><button type="button" data-recovery-remove>移除此項目</button><button type="button" data-recovery-restore>還原選取內容</button></div>';
        document.body.append(dialog);
        dialog.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;if(target.hasAttribute('data-recovery-close')&&!busy)dialog.close();if(target.dataset.recoveryTab){tab=target.dataset.recoveryTab;selected=null;render();}if(target.dataset.recoveryEntry){selected=target.dataset.recoveryEntry;render();}if(target.hasAttribute('data-recovery-restore'))void restore();if(target.hasAttribute('data-recovery-remove'))remove();});
        dialog.querySelector('[data-recovery-filter]').addEventListener('input',render);
        dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
        dialog.addEventListener('close',()=>{dialog.classList.remove('active');opener?.focus?.({preventScroll:true});});
        updateBadge();
    }
    return {initialize,load,carriers,beforeEdit,trash,open,restore,render,entries:()=>copy(entries)};
})();

