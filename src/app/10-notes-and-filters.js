/* Source: 10-notes-and-filters.js */
    function setSyncStatus(status, message = '') {
        const dot = document.getElementById('status-dot'), label = document.getElementById('status-text');
        dot.className = 'status-dot dot-' + (status === 'success' ? 'success' : status === 'error' ? 'error' : 'syncing');
        label.textContent = message || (status === 'success' ? '同步完成' : status === 'error' ? '同步失敗' : '同步中…');
        label.style.color = status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#555';
        const control = document.getElementById('sync-status');
        control.dataset.syncState = status;
        control.setAttribute('aria-label', '雲端同步：' + label.textContent);
    }

    function normalizeLoadedData(data) {
        let rawNotes = [];
        if (Array.isArray(data)) rawNotes = data;
        else if (data && Array.isArray(data.notes)) rawNotes = data.notes;

        noteRecovery.load(rawNotes.filter(isRecoveryCarrier));
        const historyCarrier = rawNotes.find(item => item && (item.id === HISTORY_SYSTEM_ID || item._type === 'system-history'));
        const categoryCarrier = rawNotes.find(item => item && (item.id === CATEGORY_SYSTEM_ID || item._type === 'system-categories'));
        editHistory = Array.isArray(historyCarrier?.records) ? historyCarrier.records : (Array.isArray(data?.editHistory) ? data.editHistory : []);
        const rawCategoryDefinitions = Array.isArray(categoryCarrier?.records)
            ? categoryCarrier.records
            : (Array.isArray(data?.categories) ? data.categories : []);
        categoryDefinitions = rawCategoryDefinitions
            .filter(item => item && item.id && item.name)
            .map(item => {
                const name = String(item.name).trim().slice(0, 30);
                return {
                    id: String(item.id),
                    name,
                    abbr: normalizeCategoryAbbr(item.abbr ?? item.shortLabel ?? item.shortName ?? '', name),
                    color: normalizeCategoryColor(item.color)
                };
            });

        notesData = rawNotes
            .filter(item => item && !isRecoveryCarrier(item) && item.id !== HISTORY_SYSTEM_ID && item._type !== 'system-history' && item.id !== CATEGORY_SYSTEM_ID && item._type !== 'system-categories')
            .map(note => noteSafeContent.note(note));
        notesData.forEach(note => {
            note.title = cleanNoteTitle(note.title || '');

            if (Object.prototype.hasOwnProperty.call(note, 'imageAnnotations')) {
                delete note.imageAnnotations;
                removedLegacyDrawingData = true;
            }

            const cleanedText = sanitizeNoteHtml(stripLegacyImageDrawingMarkup(note.text || ''));
            if (cleanedText !== (note.text || '')) {
                note.text = cleanedText;
                removedLegacyDrawingData = true;
            }
        });

        // 相容未來或舊版可能使用的 categories 欄位；分類名稱也會自動建立成正式分類。
        notesData.forEach(note => {
            const rawIds = Array.isArray(note.categoryIds) ? note.categoryIds : (Array.isArray(note.categories) ? note.categories : []);
            note.categoryIds = rawIds.map(value => {
                const raw = String(value);
                const byId = categoryDefinitions.find(category => category.id === raw);
                if (byId) return byId.id;
                const byName = categoryDefinitions.find(category => category.name === raw);
                if (byName) return byName.id;
                if (!raw.trim()) return null;
                const created = createCategoryDefinition(raw.trim(), nextCategoryColor(), false);
                return created?.id || null;
            }).filter((id, index, arr) => id && arr.indexOf(id) === index);
            delete note.categories;
        });
        pruneHistory();
    }

    window.noteDriveStart = async function () {
        for (const initialize of [initializeNoteToolbar, initializeEditorColorMemory, initializeEditorColorShortcuts, initializeDismissibleNotePanels, initializePreviewMode, setupUpperSideMouseAddShortcut, setupLowerSideMouseBackShortcut, setupNoteListInteractions, setupImageImport, setupInlineImageEditor, setupNoteTableEditor, setupPreviewSorting]) {
            try { initialize(); } catch (error) { console.error('編輯功能初始化未完成：', error.name); }
        }
        noteBrowse.initialize();
        noteSearchNavigation.initialize();
        noteRecovery.initialize();
        initializeDriveWorkspace();
        noteInstantEditor.initialize();
        noteFloatingKeyboard.initialize();
        noteImageSearch.start();
        await notePersistence.start();
    };

    let autoSaveTimer = null;
    let autoSaveInFlight = false;
    let autoSaveQueued = false;

    function buildSavePayload() {
        pruneHistory();

        return [
            ...notesData,
            ...noteRecovery.carriers(),
            {
                id: HISTORY_SYSTEM_ID,
                _type: 'system-history',
                records: editHistory
            },
            {
                id: CATEGORY_SYSTEM_ID,
                _type: 'system-categories',
                records: categoryDefinitions
            }
        ];
    }

    function autoSave(delay = null) { notePersistence.queueSave(delay); }
    function flushAutoSave() { return notePersistence.flush(); }

    function readPreviewModePreference() {
        try {
            return localStorage.getItem(PREVIEW_MODE_STORAGE_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function savePreviewModePreference() {
        try {
            localStorage.setItem(
                PREVIEW_MODE_STORAGE_KEY,
                isPreviewMode ? '1' : '0'
            );
        } catch (error) {}
    }

    function showPreviewModeToast(message) {
        const toast = document.getElementById('preview-mode-toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('active');

        if (previewToastTimer) clearTimeout(previewToastTimer);
        previewToastTimer = setTimeout(() => {
            toast.classList.remove('active');
        }, 1600);
    }

    function resetEditingFiltersForPreview() {
        clearRandomDraw(false);

        if (isStarFilterActive) {
            isStarFilterActive = false;
            const button = document.getElementById('btn-filter-star');
            if (button) {
                button.classList.remove('active');
                renderStarFilterControl();
            }
        }

        /* 不清除 activeCategoryFilterId：
           預覽模式必須保留並允許分類標籤篩選。 */
        updateCategoryUi();
    }

    function updatePreviewModeUi(options = {}) {
        const showToast = !!options.showToast;

        document.body.classList.toggle('preview-mode', isPreviewMode);

        const previewButton =
            document.getElementById('fab-preview-toggle');
        const previewIcon =
            document.getElementById('fab-preview-icon');

        previewButton?.classList.toggle(
            'preview-active',
            isPreviewMode
        );
        previewButton?.setAttribute(
            'aria-pressed',
            String(isPreviewMode)
        );

        if (previewIcon) previewIcon.innerHTML = noteToolbarIcon(isPreviewMode ? 'edit' : 'eye');
        const previewLabel = isPreviewMode ? '返回編輯模式' : '預覽模式';
        if (previewButton) {
            previewButton.dataset.toolLabel = previewLabel;
            previewButton.setAttribute('aria-label', previewLabel);
        }
        for (const id of ['fab-history', 'btn-category-overview', 'fab-sort-move', 'fab-add', 'btn-filter-star', 'btn-random-draw']) {
            const button = document.getElementById(id);
            if (button) button.disabled = isPreviewMode;
        }

        if (showToast) {
            showPreviewModeToast(
                isPreviewMode
                    ? '已進入預覽模式：可搜尋及點分類標籤篩選'
                    : '已返回編輯模式'
            );
        }
    }

    function initializePreviewMode() {
        isPreviewMode = readPreviewModePreference();

        if (isPreviewMode) {
            resetEditingFiltersForPreview();
        }

        updatePreviewModeUi();
    }


    function capturePreviewViewportAnchor() {
        const viewportX = Math.max(
            10,
            Math.min(window.innerWidth - 10, window.innerWidth * 0.5)
        );
        const viewportY = Math.max(
            10,
            Math.min(window.innerHeight - 10, window.innerHeight * 0.45)
        );

        const anchorNote = document
            .elementsFromPoint(viewportX, viewportY)
            .map(element => element.closest?.('.note-item[data-id]'))
            .find(Boolean);

        return {
            noteId: anchorNote?.dataset?.id || null,
            noteTop: anchorNote?.getBoundingClientRect().top ?? null,
            scrollX: window.scrollX,
            scrollY: window.scrollY
        };
    }

    function restorePreviewViewportAnchor(anchor) {
        if (!anchor) return;
        if (anchor.noteId) noteBrowse.reveal(anchor.noteId);

        const restore = () => {
            if (anchor.noteId && Number.isFinite(anchor.noteTop)) {
                const note = document.querySelector(
                    `.note-item[data-id="${CSS.escape(anchor.noteId)}"]`
                );

                if (note) {
                    const newTop = note.getBoundingClientRect().top;
                    window.scrollBy({
                        left: 0,
                        top: newTop - anchor.noteTop,
                        behavior: 'auto'
                    });
                    return;
                }
            }

            window.scrollTo({
                left: anchor.scrollX,
                top: anchor.scrollY,
                behavior: 'auto'
            });
        };

        /* body class、上方工具列與筆記重新渲染都完成後再復原位置。 */
        requestAnimationFrame(() => {
            requestAnimationFrame(restore);
        });
    }

    function togglePreviewMode() {
        const viewportAnchor = capturePreviewViewportAnchor();

        isPreviewMode = !isPreviewMode;

        if (isPreviewMode) {
            resetEditingFiltersForPreview();
            closeMoveModal();
        }

        savePreviewModePreference();
        updatePreviewModeUi({ showToast: true });
        filterNotes();
        restorePreviewViewportAnchor(viewportAnchor);
    }

    function previewModeBlocksEditing() {
        if (!isPreviewMode) return false;

        showPreviewModeToast(
            '目前是預覽模式，請先按上方預覽圖示返回編輯'
        );
        return true;
    }

    const ADD_NOTE_MOUSE_BUTTON = 4;
    let lastUpperSideMouseAddAt = 0;

    function upperSideMouseButtonPressed(event) {
        return (
            event.button === ADD_NOTE_MOUSE_BUTTON ||
            (event.buttons & 16) === 16
        );
    }

    function handleUpperSideMouseAddShortcut(event) {
        if (!upperSideMouseButtonPressed(event)) return;

        /* 阻止瀏覽器把側邊上鍵當成上一頁／下一頁。 */
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        const now = Date.now();

        /* mousedown、mouseup、auxclick 可能連續觸發，只執行一次。 */
        if (now - lastUpperSideMouseAddAt < 450) return;
        lastUpperSideMouseAddAt = now;

        if (event.type !== 'mousedown') return;

        const noteModal = document.getElementById('noteModal');
        const noteModalActive =
            noteModal?.classList.contains('active');

        const activeOverlays = Array.from(
            document.querySelectorAll('.modal-overlay.active')
        );

        /* 編輯／新增筆記時，側邊上鍵直接等同「儲存筆記」。
           若上面另有表格、圖片或其他子視窗，則先不誤觸儲存。 */
        if (
            noteModalActive &&
            activeOverlays.length === 1 &&
            activeOverlays[0] === noteModal
        ) {
            saveNote();
            return;
        }

        /* 其他視窗開啟時，不執行新增或儲存。 */
        if (activeOverlays.length > 0) return;

        if (isPreviewMode) {
            showPreviewModeToast(
                '預覽模式不會新增筆記，請先返回編輯模式'
            );
            return;
        }

        openAddModal();
    }

    function setupUpperSideMouseAddShortcut() {
        if (setupUpperSideMouseAddShortcut.done) return;
        setupUpperSideMouseAddShortcut.done = true;

        ['mousedown', 'mouseup', 'auxclick'].forEach(type => {
            window.addEventListener(
                type,
                handleUpperSideMouseAddShortcut,
                true
            );
        });
    }


    const BACK_MOUSE_BUTTON = 3;
    let lastLowerSideMouseBackAt = 0;

    function lowerSideMouseButtonPressed(event) {
        return (
            event.button === BACK_MOUSE_BUTTON ||
            (event.buttons & 8) === 8
        );
    }

    function closeActiveOverlayForMouseBack() {
        const actions = [
            ['noteImageEditModal', () => noteImageEditor.close()],
            ['noteLinkModal', () => closeNoteLinkModal()],
            ['tableCreateModal', () => closeTableCreateModal()],
            ['randomDrawModal', () => closeRandomDrawModal()],
            ['categoryAssignModal', () => closeCategoryAssignModal()],
            ['categoryOverviewModal', () => closeCategoryOverviewModal()],
            ['imageViewer', () => closeImageViewer()],
            ['historyModal', () => closeHistoryModal()],
            ['moveModal', () => closeMoveModal()],
            ['noteModal', () => closeModal()]
        ];

        for (const [id, closeAction] of actions) {
            const element = document.getElementById(id);
            if (element?.classList.contains('active')) {
                closeAction();
                return true;
            }
        }

        return false;
    }

    function returnOneStepInNoteWebsite() {
        /* 第一優先：退出目前正在編輯或開啟的視窗。 */
        if (closeActiveOverlayForMouseBack()) return;

        /* 分類篩選先解除；在預覽模式中仍留在預覽模式。 */
        if (activeCategoryFilterId) {
            clearCategoryFilter();
            showPreviewModeToast('已取消分類篩選，顯示全部筆記');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        /* 若目前是星號篩選，也回到全部筆記。 */
        if (isStarFilterActive) {
            isStarFilterActive = false;
            const button = document.getElementById('btn-filter-star');
            if (button) {
                button.classList.remove('active');
                renderStarFilterControl();
            }
            filterNotes();
            showPreviewModeToast('已取消星號篩選');
            return;
        }

        /* 有搜尋內容時，先清除搜尋。 */
        const searchInput = document.getElementById('search-input');
        if (searchInput?.value) {
            searchInput.value = '';
            filterNotes();
            showPreviewModeToast('已清除搜尋，顯示全部筆記');
            return;
        }

        /* 預覽模式沒有其他上一層時，返回完整編輯模式。 */
        if (isPreviewMode) {
            togglePreviewMode();
            return;
        }

        showPreviewModeToast('目前沒有可返回的上一步');
    }

    function handleLowerSideMouseBackShortcut(event) {
        if (!lowerSideMouseButtonPressed(event)) return;

        /* 阻止瀏覽器把側邊下鍵當成上一頁，避免離開筆記網站。 */
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        if (event.type !== 'mousedown') return;

        const now = Date.now();
        if (now - lastLowerSideMouseBackAt < 420) return;
        lastLowerSideMouseBackAt = now;

        returnOneStepInNoteWebsite();
    }

    function setupLowerSideMouseBackShortcut() {
        if (setupLowerSideMouseBackShortcut.done) return;
        setupLowerSideMouseBackShortcut.done = true;

        ['mousedown', 'mouseup', 'auxclick'].forEach(type => {
            window.addEventListener(
                type,
                handleLowerSideMouseBackShortcut,
                true
            );
        });
    }


    function localDateKey(value = new Date()) {
        const d = value instanceof Date ? value : new Date(value);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function stripHtml(html = '') { return notePlainText(html); }

    function notePreview(note) {
        const title = cleanNoteTitle(note?.title || '');
        const text = stripHtml(note?.text || '');
        if (title && text) return `${title}｜${text}`.slice(0,160);
        if (title) return title.slice(0,160);
        if (text) return text.slice(0,160);
        const galleryCount = Array.isArray(note?.images) ? note.images.length : (note?.image ? 1 : 0);
        const temp = document.createElement('div');
        temp.innerHTML = note?.text || '';
        const inlineCount = temp.querySelectorAll('[data-inline-image="1"], .inline-note-image').length;
        const total = galleryCount + inlineCount;
        return total ? `純圖片筆記（共 ${total} 張；行內 ${inlineCount} 張）` : '空白筆記';
    }

    function pruneHistory() {
        const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        editHistory = editHistory
            .filter(record => record && record.timestamp && new Date(record.timestamp).getTime() >= cutoff)
            .slice(-HISTORY_MAX_RECORDS);
    }

    function addHistoryRecord(action, note, detail = '') {
        editHistory.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            action,
            noteId: note?.id || '',
            preview: notePreview(note),
            detail
        });
        pruneHistory();
        updateHistoryBadge();
    }

    function getHistoryForDate(dateKey) {
        return editHistory.filter(record => localDateKey(record.timestamp) === dateKey);
    }

    function updateHistoryBadge() {
        const badge = document.getElementById('today-history-count');
        if (!badge) return;
        const todayRecords = getHistoryForDate(localDateKey());
        const uniqueNoteIds = new Set(todayRecords.map(r => r.noteId).filter(Boolean));
        badge.textContent = uniqueNoteIds.size;
        badge.title = `今天共有 ${todayRecords.length} 次內容異動，涉及 ${uniqueNoteIds.size} 則筆記`;
    }

    function escapeHtml(value = '') {
        return String(value).replace(/[&<>'"]/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }

    function escapeAttribute(value = '') {
        return escapeHtml(value);
    }


    const CATEGORY_PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#d946ef','#ec4899','#64748b'];

    function normalizeCategoryColor(color) {
        const value = String(color || '').trim();
        return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#8b5cf6';
    }

    function nextCategoryColor() {
        return CATEGORY_PALETTE[categoryDefinitions.length % CATEGORY_PALETTE.length];
    }

    function categoryGraphemes(value) {
        const clean = String(value || '').trim();
        if (!clean) return [];

        try {
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                const segmenter = new Intl.Segmenter(
                    'zh-TW',
                    { granularity: 'grapheme' }
                );
                return Array.from(
                    segmenter.segment(clean),
                    item => item.segment
                );
            }
        } catch (error) {}

        return Array.from(clean);
    }

    function takeCategoryGraphemes(value, limit = 4) {
        return categoryGraphemes(value)
            .slice(0, Math.max(1, limit))
            .join('');
    }

    function normalizeCategoryAbbr(value, fallbackName = '') {
        const custom = takeCategoryGraphemes(value, 4);
        const fallback = takeCategoryGraphemes(fallbackName, 4);

        /* 舊版只有一個字的簡寫，會自動升級成分類名稱前四個字。
           若使用者輸入兩至四個字，則保留自訂內容。 */
        if (categoryGraphemes(custom).length >= 2) return custom;
        return fallback || custom || '分類';
    }

    function categoryDisplayAbbr(category) {
        return takeCategoryGraphemes(
            category?.abbr || category?.name || '分類',
            4
        ) || '分類';
    }

    function categoryVerticalLabelHtml(category) {
        return categoryGraphemes(categoryDisplayAbbr(category))
            .map(character => (
                `<span class="note-category-character">${
                    escapeHtml(character)
                }</span>`
            ))
            .join('');
    }

    function categoryTextColor() {
        /* 分類標籤統一使用白色文字，避免同一組標籤黑白混雜。 */
        return '#ffffff';
    }

    function getCategoryById(id) {
        return categoryDefinitions.find(category => category.id === id) || null;
    }

    function getNoteCategoryIds(note) {
        return Array.isArray(note?.categoryIds) ? note.categoryIds.filter(id => getCategoryById(id)) : [];
    }

    function createCategoryDefinition(name, color, refresh = true, abbreviation = '') {
        const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        if (!cleanName) return null;
        const duplicate = categoryDefinitions.find(category => category.name.toLowerCase() === cleanName.toLowerCase());
        if (duplicate) return duplicate;
        const category = {
            id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: cleanName,
            abbr: normalizeCategoryAbbr(abbreviation, cleanName),
            color: normalizeCategoryColor(color || nextCategoryColor())
        };
        categoryDefinitions.push(category);
        if (refresh) {
            updateCategoryUi();
            renderCategoryOverview();
            renderNoteCategoryPicker();
            renderCategoryAssignList();
        }
        return category;
    }

    function updateCategoryUi() {
        const badge = document.getElementById('category-count-badge');

        if (badge) badge.textContent = categoryDefinitions.length;

        const active = getCategoryById(activeCategoryFilterId);
        if (activeCategoryFilterId && !active) activeCategoryFilterId = null;
        const bar = document.getElementById('active-category-filter-bar');
        const button = document.getElementById('btn-category-overview');
        if (active) {
            bar?.classList.remove('hidden');
            const name = document.getElementById('active-category-name');
            const dot = document.getElementById('active-category-dot');
            if (name) name.textContent = active.name;
            if (dot) dot.style.background = active.color;
            button?.classList.add('active');
        } else {
            bar?.classList.add('hidden');
            button?.classList.remove('active');
        }
    }

    function categoryChipHtml(category, extraClass = '', attrs = '') {
        return `<button type="button" class="category-choice ${extraClass}" style="background:${escapeAttribute(category.color)};color:${categoryTextColor(category.color)}" ${attrs}>${escapeHtml(category.name)}</button>`;
    }

    function openCategoryOverviewModal() {
        renderCategoryOverview();
        document.getElementById('categoryOverviewModal').classList.add('active');
    }

    function closeCategoryOverviewModal() {
        document.getElementById('categoryOverviewModal').classList.remove('active');
    }

    function renderCategoryOverview() {
        const grid = document.getElementById('category-overview-grid');
        const manager = document.getElementById('category-manager-list');
        if (!grid || !manager) return;
        if (!categoryDefinitions.length) {
            grid.innerHTML = '<div class="category-empty-hint">目前還沒有分類。請在下方先建立「抗體藥」、「心血管用藥」或「要再複習」等分類。</div>';
        } else {
            grid.innerHTML = categoryDefinitions.map(category => {
                const count = notesData.filter(note => getNoteCategoryIds(note).includes(category.id)).length;
                return `<button type="button" class="category-overview-card ${activeCategoryFilterId === category.id ? 'active' : ''}" onclick="applyCategoryFilter(${inlineJsArgument(category.id)})">
                    <div class="category-card-color" style="background:${escapeAttribute(category.color)}"></div>
                    <div class="category-card-main">
                        <span class="category-card-abbr" style="background:${escapeAttribute(category.color)};color:${categoryTextColor(category.color)}">${escapeHtml(categoryDisplayAbbr(category))}</span>
                        <div>
                            <div class="category-card-name">${escapeHtml(category.name)}</div>
                            <div class="category-card-count">${count} 則筆記｜點擊直接篩選</div>
                        </div>
                    </div>
                </button>`;
            }).join('');
        }
        manager.innerHTML = categoryDefinitions.length ? categoryDefinitions.map(category => `
            <div class="category-manager-row" data-category-id="${escapeAttribute(category.id)}">
                <input type="color" id="category-color-${escapeAttribute(category.id)}" value="${escapeAttribute(category.color)}" title="調整顏色">
                <input class="category-abbr-input" type="text" id="category-abbr-${escapeAttribute(category.id)}" value="${escapeAttribute(category.abbr)}" maxlength="4" title="左側直排顯示最多四個字">
                <input type="text" id="category-name-${escapeAttribute(category.id)}" value="${escapeAttribute(category.name)}" maxlength="30" title="完整分類名稱">
                <button type="button" class="btn-category-save" onclick="updateCategoryDefinition(${inlineJsArgument(category.id)})">儲存</button>
                <button type="button" class="btn-category-delete" onclick="deleteCategoryDefinition(${inlineJsArgument(category.id)})">刪除</button>
            </div>`).join('') : '<div class="category-empty-hint">建立後可在這裡改名、換顏色或刪除。</div>';
    }

    function createCategoryFromManager() {
        const abbrInput = document.getElementById('category-manager-new-abbr');
        const nameInput = document.getElementById('category-manager-new-name');
        const colorInput = document.getElementById('category-manager-new-color');
        const category = createCategoryDefinition(nameInput.value, colorInput.value, true, abbrInput?.value);
        if (!category) return alert('請輸入分類名稱。');
        if (abbrInput) abbrInput.value = '';
        nameInput.value = '';
        colorInput.value = nextCategoryColor();
        autoSave();
    }

    function updateCategoryDefinition(id) {
        const category = getCategoryById(id);
        if (!category) return;
        const abbrInput = document.getElementById(`category-abbr-${id}`);
        const nameInput = document.getElementById(`category-name-${id}`);
        const colorInput = document.getElementById(`category-color-${id}`);
        const cleanName = String(nameInput?.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        if (!cleanName) return alert('分類名稱不能是空白。');
        const duplicate = categoryDefinitions.find(item => item.id !== id && item.name.toLowerCase() === cleanName.toLowerCase());
        if (duplicate) return alert('已經有相同名稱的分類。');
        category.name = cleanName;
        category.abbr = normalizeCategoryAbbr(abbrInput?.value, cleanName);
        category.color = normalizeCategoryColor(colorInput?.value);
        updateCategoryUi();
        renderCategoryOverview();
        renderNoteCategoryPicker();
        renderCategoryAssignList();
        filterNotes();
        autoSave();
    }

    function deleteCategoryDefinition(id) {
        const category = getCategoryById(id);
        if (!category) return;
        const affected = notesData.filter(note => getNoteCategoryIds(note).includes(id));
        if (!confirm(`確定要刪除分類「${category.name}」嗎？\n這會從 ${affected.length} 則筆記移除該分類，但不會刪除筆記。`)) return;
        affected.forEach(note => {
            noteRecovery.beforeEdit(note);
            note.categoryIds = getNoteCategoryIds(note).filter(categoryId => categoryId !== id);
            note.updatedAt = new Date().toISOString();
            addHistoryRecord('編輯', note, `移除已刪除的分類「${category.name}」`);
        });
        categoryDefinitions = categoryDefinitions.filter(item => item.id !== id);
        pendingCategoryIds = pendingCategoryIds.filter(categoryId => categoryId !== id);
        categoryAssignPendingIds = categoryAssignPendingIds.filter(categoryId => categoryId !== id);
        if (activeCategoryFilterId === id) activeCategoryFilterId = null;
        updateCategoryUi();
        renderCategoryOverview();
        renderNoteCategoryPicker();
        renderCategoryAssignList();
        filterNotes();
        autoSave();
    }

    function applyCategoryFilter(id) {
        if (!getCategoryById(id)) return;
        clearRandomDraw(false);
        // 點分類時直接顯示該分類的全部筆記，避免先前搜尋字或星號篩選把結果又縮小。
        document.getElementById('search-input').value = '';
        if (isStarFilterActive) {
            isStarFilterActive = false;
            const starButton = document.getElementById('btn-filter-star');
            starButton.classList.remove('active');
            renderStarFilterControl();
        }
        activeCategoryFilterId = id;
        closeCategoryOverviewModal();
        updateCategoryUi();
        filterNotes();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function clearCategoryFilter() {
        clearRandomDraw(false);
        activeCategoryFilterId = null;
        updateCategoryUi();
        filterNotes();
    }

    function renderNoteCategoryPicker() {
        const picker = document.getElementById('note-category-picker');
        if (!picker) return;
        if (!categoryDefinitions.length) {
            picker.innerHTML = '<div class="category-empty-hint">尚未建立分類；可在下方直接輸入名稱建立。</div>';
            return;
        }
        picker.innerHTML = categoryDefinitions.map(category => categoryChipHtml(
            category,
            pendingCategoryIds.includes(category.id) ? 'selected' : '',
            `onclick="togglePendingCategory(${inlineJsArgument(category.id)})" title="點擊勾選／取消"`
        )).join('');
    }

    function togglePendingCategory(id) {
        if (pendingCategoryIds.includes(id)) pendingCategoryIds = pendingCategoryIds.filter(categoryId => categoryId !== id);
        else pendingCategoryIds.push(id);
        renderNoteCategoryPicker();
    }

    function createCategoryFromNoteEditor() {
        const abbrInput = document.getElementById('note-category-new-abbr');
        const nameInput = document.getElementById('note-category-new-name');
        const colorInput = document.getElementById('note-category-new-color');
        const category = createCategoryDefinition(nameInput.value, colorInput.value, true, abbrInput?.value);
        if (!category) return alert('請輸入分類名稱。');
        if (!pendingCategoryIds.includes(category.id)) pendingCategoryIds.push(category.id);
        if (abbrInput) abbrInput.value = '';
        nameInput.value = '';
        colorInput.value = nextCategoryColor();
        renderNoteCategoryPicker();
        autoSave();
    }

    function openNoteCategoryModal(noteId) {
        if (previewModeBlocksEditing()) return;
        const note = resolveLinkedNote(noteId);
        if (!note) return;

        categoryAssignTargetNoteId = note.id;
        categoryAssignPendingIds = [...getNoteCategoryIds(note)];
        categoryAssignEditingId = null;

        const abbrInput = document.getElementById('category-assign-new-abbr');
        const nameInput = document.getElementById('category-assign-new-name');
        const colorInput = document.getElementById('category-assign-new-color');

        if (abbrInput) abbrInput.value = '';
        if (nameInput) nameInput.value = '';
        if (colorInput) colorInput.value = nextCategoryColor();

        renderCategoryAssignList();
        document.getElementById('categoryAssignModal').classList.add('active');

        requestAnimationFrame(() => nameInput?.focus());
    }

    function closeCategoryAssignModal() {
        document.getElementById('categoryAssignModal').classList.remove('active');
        categoryAssignTargetNoteId = null;
        categoryAssignPendingIds = [];
        categoryAssignEditingId = null;
    }

    function renderCategoryAssignList() {
        const list = document.getElementById('category-assign-list');
        if (!list) return;

        if (!categoryDefinitions.length) {
            list.innerHTML = '<div class="category-empty-hint">還沒有分類，可在下方直接建立。</div>';
            return;
        }

        list.innerHTML = categoryDefinitions.map(category => {
            const categoryId = escapeAttribute(category.id);

            if (categoryAssignEditingId === category.id) {
                return `<div class="category-assign-row editing" data-category-id="${categoryId}">
                    <input type="color" id="assign-category-color-${categoryId}" value="${escapeAttribute(category.color)}" title="分類顏色">
                    <input class="category-abbr-input" type="text" id="assign-category-abbr-${categoryId}" value="${escapeAttribute(category.abbr)}" maxlength="4" title="左側直排顯示最多四個字" onkeydown="handleAssignCategoryEditKeydown(event, ${inlineJsArgument(category.id)})">
                    <input type="text" id="assign-category-name-${categoryId}" value="${escapeAttribute(category.name)}" maxlength="30" title="完整分類名稱" onkeydown="handleAssignCategoryEditKeydown(event, ${inlineJsArgument(category.id)})">
                    <div class="category-assign-edit-actions">
                        <button type="button" class="category-assign-edit-save" onclick="saveCategoryEditFromAssignModal(${inlineJsArgument(category.id)})">儲存</button>
                        <button type="button" class="category-assign-edit-cancel" onclick="cancelCategoryEditFromAssignModal()">取消</button>
                        <button type="button" class="category-assign-edit-delete" onclick="deleteCategoryFromAssignModal(${inlineJsArgument(category.id)})">刪除</button>
                    </div>
                </div>`;
            }

            const selected = categoryAssignPendingIds.includes(category.id);
            return `<div class="category-assign-row ${selected ? 'selected' : ''}" data-category-id="${categoryId}">
                ${categoryChipHtml(
                    category,
                    selected ? 'selected' : '',
                    `onclick="toggleAssignCategory(${inlineJsArgument(category.id)})" title="點擊勾選／取消"`
                )}
                <div class="category-assign-row-actions">
                    <button type="button" class="category-assign-icon-button" onclick="beginCategoryEditFromAssignModal(${inlineJsArgument(category.id)})" title="編輯分類" aria-label="編輯分類"><i class="fas fa-pen"></i></button>
                    <button type="button" class="category-assign-icon-button delete" onclick="deleteCategoryFromAssignModal(${inlineJsArgument(category.id)})" title="刪除分類" aria-label="刪除分類"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    }


    function beginCategoryEditFromAssignModal(id) {
        if (!getCategoryById(id)) return;
        categoryAssignEditingId = id;
        renderCategoryAssignList();

        requestAnimationFrame(() => {
            const input = document.getElementById(`assign-category-name-${id}`);
            input?.focus();
            input?.select();
        });
    }

    function cancelCategoryEditFromAssignModal() {
        categoryAssignEditingId = null;
        renderCategoryAssignList();
    }

    function handleAssignCategoryEditKeydown(event, id) {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveCategoryEditFromAssignModal(id);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelCategoryEditFromAssignModal();
        }
    }

    function saveCategoryEditFromAssignModal(id) {
        const category = getCategoryById(id);
        if (!category) return;

        const abbrInput = document.getElementById(`assign-category-abbr-${id}`);
        const nameInput = document.getElementById(`assign-category-name-${id}`);
        const colorInput = document.getElementById(`assign-category-color-${id}`);

        const cleanName = String(nameInput?.value || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 30);

        if (!cleanName) {
            alert('分類名稱不能是空白。');
            nameInput?.focus();
            return;
        }

        const duplicate = categoryDefinitions.find(item =>
            item.id !== id &&
            item.name.toLowerCase() === cleanName.toLowerCase()
        );

        if (duplicate) {
            alert('已經有相同名稱的分類。');
            nameInput?.focus();
            return;
        }

        category.name = cleanName;
        category.abbr = normalizeCategoryAbbr(
            abbrInput?.value,
            cleanName
        );
        category.color = normalizeCategoryColor(colorInput?.value);

        categoryAssignEditingId = null;

        updateCategoryUi();
        renderCategoryOverview();
        renderNoteCategoryPicker();
        renderCategoryAssignList();
        filterNotes();
        autoSave();
    }

    function deleteCategoryFromAssignModal(id) {
        categoryAssignEditingId = null;
        deleteCategoryDefinition(id);
    }

    function toggleAssignCategory(id) {
        if (categoryAssignPendingIds.includes(id)) categoryAssignPendingIds = categoryAssignPendingIds.filter(categoryId => categoryId !== id);
        else categoryAssignPendingIds.push(id);
        renderCategoryAssignList();
    }

    function handleCategoryAssignQuickCreateKeydown(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        saveCategoryAssignment();
    }

    function createCategoryFromAssignModal(options = {}) {
        const {
            silentIfEmpty = false,
            clearInputs = true
        } = options;

        const abbrInput = document.getElementById('category-assign-new-abbr');
        const nameInput = document.getElementById('category-assign-new-name');
        const colorInput = document.getElementById('category-assign-new-color');

        const nameValue = String(nameInput?.value || '').trim();
        const abbrValue = String(abbrInput?.value || '').trim();

        if (!nameValue) {
            if (abbrValue && !silentIfEmpty) {
                alert('請輸入完整分類名稱。');
                nameInput?.focus();
            }
            return null;
        }

        const category = createCategoryDefinition(
            nameValue,
            colorInput?.value,
            true,
            abbrValue
        );

        if (!category) {
            if (!silentIfEmpty) {
                alert('請輸入分類名稱。');
                nameInput?.focus();
            }
            return null;
        }

        if (!categoryAssignPendingIds.includes(category.id)) {
            categoryAssignPendingIds.push(category.id);
        }

        if (clearInputs) {
            if (abbrInput) abbrInput.value = '';
            if (nameInput) nameInput.value = '';
            if (colorInput) colorInput.value = nextCategoryColor();
        }

        renderCategoryAssignList();
        autoSave();
        return category;
    }

    function saveCategoryAssignment() {
        const note = notesData.find(
            item => item.id === categoryAssignTargetNoteId
        );

        if (!note) {
            closeCategoryAssignModal();
            return;
        }

        const abbrInput = document.getElementById('category-assign-new-abbr');
        const nameInput = document.getElementById('category-assign-new-name');
        const hasDraftName = !!String(nameInput?.value || '').trim();
        const hasDraftAbbr = !!String(abbrInput?.value || '').trim();

        /* 快速新增欄只要有輸入名稱，就先建立並自動勾選，
           接著立刻套用到目前筆記，不需要再點兩次。 */
        if (hasDraftName) {
            const created = createCategoryFromAssignModal({
                silentIfEmpty: false,
                clearInputs: true
            });
            if (!created) return;
        } else if (hasDraftAbbr) {
            alert('請輸入完整分類名稱。');
            nameInput?.focus();
            return;
        }

        const oldIds = getNoteCategoryIds(note);
        const newIds = categoryAssignPendingIds.filter(
            id => getCategoryById(id)
        );

        if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
            noteRecovery.beforeEdit(note);
            note.categoryIds = [...newIds];
            note.updatedAt = new Date().toISOString();

            const names = newIds
                .map(id => getCategoryById(id)?.name)
                .filter(Boolean);

            addHistoryRecord(
                '編輯',
                note,
                `分類改為：${names.length ? names.join('、') : '未分類'}`
            );
            autoSave();
        }

        closeCategoryAssignModal();
        filterNotes();
    }

    function openHistoryModal() {
        const input = document.getElementById('history-date');
        if (!input.value) input.value = localDateKey();
        renderHistory();
        document.getElementById('historyModal').classList.add('active');
    }

    function closeHistoryModal() { document.getElementById('historyModal').classList.remove('active'); }

    function setHistoryDateToday() {
        document.getElementById('history-date').value = localDateKey();
        renderHistory();
    }

    function renderHistory() {
        const dateKey = document.getElementById('history-date').value || localDateKey();
        const records = getHistoryForDate(dateKey).slice().reverse();
        const list = document.getElementById('history-list');
        const summary = document.getElementById('history-summary');
        const uniqueNoteIds = new Set(records.map(r => r.noteId).filter(Boolean));
        summary.textContent = `${dateKey}：共 ${records.length} 次內容異動，涉及 ${uniqueNoteIds.size} 則筆記（保留最近 ${HISTORY_RETENTION_DAYS} 天）`;

        if (records.length === 0) {
            list.innerHTML = '<div class="history-empty"><i class="far fa-calendar-check" style="font-size:2rem; margin-bottom:8px;"></i><br>這一天沒有新增、編輯或刪除紀錄。</div>';
            return;
        }

        list.innerHTML = records.map(record => {
            const noteIndex = notesData.findIndex(n => n.id === record.noteId);
            const stillExists = noteIndex !== -1;
            const actionClass = record.action === '新增' ? 'add' : record.action === '刪除' ? 'delete' : 'edit';
            const timeText = new Date(record.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return `
                <div class="history-item ${actionClass}">
                    <div class="history-head">
                        <span class="history-action">${escapeHtml(record.action)}${stillExists ? `｜目前第 ${noteIndex + 1} 則` : ''}</span>
                        <span class="history-time">${escapeHtml(timeText)}</span>
                    </div>
                    <div class="history-preview">${escapeHtml(record.preview || '（無文字預覽）')}</div>
                    ${record.detail ? `<div class="history-detail">變更：${escapeHtml(record.detail)}</div>` : ''}
                    ${stillExists ? `<button class="btn-locate-note" onclick="locateHistoryNote(${inlineJsArgument(record.noteId)})"><i class="fas fa-location-crosshairs"></i> 定位筆記</button>` : '<div class="history-detail">此筆記目前已被刪除</div>'}
                </div>`;
        }).join('');
    }

    function locateHistoryNote(id) {
        closeHistoryModal();
        clearRandomDraw(false);
        noteBrowse.requestReveal(id);
        document.getElementById('search-input').value = '';
        if (isStarFilterActive) {
            isStarFilterActive = false;
            const btn = document.getElementById('btn-filter-star');
            btn.classList.remove('active');
            renderStarFilterControl();
        }
        activeCategoryFilterId = null;
        updateCategoryUi();
        renderNotes();
        requestAnimationFrame(() => {
            const item = document.querySelector(`.note-item[data-id="${CSS.escape(id)}"]`);
            if (!item) return;
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.classList.remove('history-flash');
            void item.offsetWidth;
            item.classList.add('history-flash');
        });
    }

    function openImageViewer(src) {
        return noteImageViewer.open(src);
    }

    function closeImageViewer() {
        noteImageViewer.close();
    }

    window.toggleStar = function(id) {
        if (previewModeBlocksEditing()) return;
        const note = resolveLinkedNote(id);
        if (note) { noteRecovery.beforeEdit(note); note.starred = !note.starred; filterNotes(); autoSave(); }
    };

    function toggleStarFilter() {
        clearRandomDraw(false);
        isStarFilterActive = !isStarFilterActive;
        renderStarFilterControl();
        filterNotes();
    }

    const noteSearchCache = new WeakMap();
    let searchRenderTimer = null;

    function searchableNoteText(note) {
        const categoryNames = getNoteCategoryIds(note)
            .map(id => getCategoryById(id)?.name || '')
            .join(' ');

        const imageText=noteImageSearch.text(note);
        const signature = [
            imageText,
            note.title || '',
            note.text || '',
            categoryNames
        ].join('\u0001');

        const cached = noteSearchCache.get(note);
        if (cached?.signature === signature) return cached.value;

        const value = normalizeSearchText(`${imageText} ${note.title || ''} ${
            notePlainText(note.text || '')
        } ${categoryNames}`);

        noteSearchCache.set(note, { signature, value });
        return value;
    }

    function getNormallyFilteredNotes() {
        const query = normalizeSearchText(document.getElementById('search-input').value);

        return notesData.filter(note => {
            const categoryIds = getNoteCategoryIds(note);

            return (
                (!query || searchableNoteText(note).includes(query)) &&
                (!isStarFilterActive || note.starred) &&
                (
                    !activeCategoryFilterId ||
                    categoryIds.includes(activeCategoryFilterId)
                )
            );
        });
    }

    function filterNotes(options = {}) {
        options = noteSearchViewport.filterOptions(options);
        if (randomDrawState.active) {
            renderNotes(
                randomDrawState.selectedIds
                    .map(id => notesData.find(note => note.id === id))
                    .filter(Boolean), options
            );
            updateRandomFilterBar();
            return;
        }

        renderNotes(getNormallyFilteredNotes(), options);
        updateRandomFilterBar();
    }

    function handleSearchInput(event) {
        if (event?.isComposing) return;
        savedNoteFocusSession++;
        clearRandomDraw(false);

        if (searchRenderTimer) {
            clearTimeout(searchRenderTimer);
        }

        searchRenderTimer = setTimeout(filterNotes, 90);
    }
    function getRandomCandidates(scope='filtered'){if(scope==='all')return [...notesData];if(scope==='starred')return notesData.filter(n=>n.starred);if(scope==='category')return activeCategoryFilterId?notesData.filter(n=>getNoteCategoryIds(n).includes(activeCategoryFilterId)):[];return getNormallyFilteredNotes()}
    function openRandomDrawModal(){const s=document.getElementById('random-draw-scope');s.value=activeCategoryFilterId?'category':(randomDrawState.scope||'filtered');document.getElementById('random-draw-count').value=randomDrawState.count||1;updateRandomCandidateHint();document.getElementById('randomDrawModal').classList.add('active')}
    function closeRandomDrawModal(){document.getElementById('randomDrawModal').classList.remove('active')}
    function updateRandomCandidateHint(){const scope=document.getElementById('random-draw-scope')?.value||'filtered',c=getRandomCandidates(scope),count=Math.max(1,Math.min(50,Number(document.getElementById('random-draw-count')?.value)||1)),cat=getCategoryById(activeCategoryFilterId),label={filtered:'目前篩選結果',all:'全部筆記',starred:'星號筆記',category:cat?`分類「${cat.name}」`:'目前分類（尚未選取分類）'}[scope];document.getElementById('random-candidate-hint').textContent=`${label}共有 ${c.length} 則；本次最多會抽出 ${Math.min(count,c.length)} 則。`}
    function shuffledCopy(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
    function performRandomDraw(reuse=false){const scope=reuse?randomDrawState.scope:(document.getElementById('random-draw-scope')?.value||'filtered'),count=reuse?randomDrawState.count:Math.max(1,Math.min(50,Number(document.getElementById('random-draw-count')?.value)||1)),c=getRandomCandidates(scope);if(!c.length)return alert(scope==='category'&&!activeCategoryFilterId?'請先在分類總覽選擇一個分類。':'目前範圍內沒有可以抽取的筆記。');const selected=shuffledCopy(c).slice(0,Math.min(count,c.length));randomDrawState={active:true,selectedIds:selected.map(n=>n.id),count,scope};closeRandomDrawModal();renderNotes(selected);updateRandomFilterBar();window.scrollTo({top:0,behavior:'smooth'})}
    function repeatRandomDraw(){randomDrawState.active?performRandomDraw(true):openRandomDrawModal()}
    function clearRandomDraw(refresh=true){randomDrawState.active=false;randomDrawState.selectedIds=[];updateRandomFilterBar();if(refresh)filterNotes()}
    function updateRandomFilterBar(){const bar=document.getElementById('active-random-filter-bar');if(!bar)return;bar.classList.toggle('hidden',!randomDrawState.active);if(!randomDrawState.active)return;const count=randomDrawState.selectedIds.filter(id=>notesData.some(n=>n.id===id)).length,cat=getCategoryById(activeCategoryFilterId),label={filtered:'目前篩選結果',all:'全部筆記',starred:'星號筆記',category:cat?`分類「${cat.name}」`:'分類筆記'}[randomDrawState.scope]||'筆記';document.getElementById('active-random-summary').textContent=`已從${label}隨機抽出 ${count} 則完整筆記`}

    function executeSwap() {
        if (previewModeBlocksEditing()) return;
        const idx1 = parseInt(document.getElementById('swap-idx-1').value) - 1;
        const idx2 = parseInt(document.getElementById('swap-idx-2').value) - 1;
        if (isNaN(idx1) || isNaN(idx2)) return alert("請輸入完整的編號數字！");
        if (idx1 < 0 || idx1 >= notesData.length || idx2 < 0 || idx2 >= notesData.length) return alert(`編號超出範圍！目前共有 ${notesData.length} 則筆記。`);
        if (idx1 === idx2) return;
        const temp = notesData[idx1]; notesData[idx1] = notesData[idx2]; notesData[idx2] = temp;
        document.getElementById('swap-idx-1').value = ''; document.getElementById('swap-idx-2').value = '';
        filterNotes(); autoSave();
    }

    function openMoveModal() {
        if (previewModeBlocksEditing()) return;
        document.getElementById('total-notes-hint').innerText = `(目前總數：${notesData.length})`;
        document.getElementById('moveModal').classList.add('active');
    }
    function closeMoveModal() { document.getElementById('moveModal').classList.remove('active'); }

    function executeAdvancedMove(actionType) {
        if (previewModeBlocksEditing()) return;
        const targetIdx = parseInt(document.getElementById('move-target').value) - 1;
        if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= notesData.length) return alert(`請輸入正確的目標筆記編號 (1 ~ ${notesData.length})`);
        
        let newIdx; const itemToMove = notesData[targetIdx];
        if (actionType === 'top') newIdx = 0;
        else if (actionType === 'bottom') newIdx = notesData.length - 1;
        else {
            const step = parseInt(document.getElementById('move-step').value);
            if (isNaN(step) || step <= 0) return alert("請輸入要移動的正確格數 X (必須大於 0)！");
            if (actionType === 'up') newIdx = Math.max(0, targetIdx - step);
            else if (actionType === 'down') newIdx = Math.min(notesData.length - 1, targetIdx + step);
        }
        if (targetIdx === newIdx) { closeMoveModal(); return; }
        
        notesData.splice(targetIdx, 1); notesData.splice(newIdx, 0, itemToMove);
        document.getElementById('move-target').value = ''; closeMoveModal(); filterNotes(); autoSave();
    }


