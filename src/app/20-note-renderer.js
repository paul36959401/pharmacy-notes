/* Source: 20-note-renderer.js */
    function optimizeRenderedImages(root) {
        root.querySelectorAll('img').forEach(image => {
            image.loading = 'lazy';
            image.decoding = 'async';
            image.draggable = false;
            if (!image.hasAttribute('alt')) image.alt = '筆記圖片';
        });
    }

    function setupNoteListInteractions() {
        const list = document.getElementById('note-list');
        if (!list || list.dataset.interactionsBound === '1') return;

        list.dataset.interactionsBound = '1';

        list.addEventListener('click', async event => {
            const internalLink = internalNoteLinkFromElement(event.target);

            if (internalLink) {
                event.preventDefault();
                event.stopPropagation();
                jumpToLinkedNote(internalLink.noteId);
                return;
            }

            const galleryFrame =
                event.target.closest('.note-image-frame[data-view-src]');

            if (galleryFrame) {
                event.preventDefault();
                event.stopPropagation();
                openImageViewer(()=>notePersistence.renderedImageSource(galleryFrame));
                return;
            }

            const inlineImage =
                event.target.closest('.note-text img.inline-note-image, .note-text .inline-note-image img, .note-text img[data-cloud-asset]');

            if (inlineImage) {
                event.preventDefault();
                event.stopPropagation();
                openImageViewer(()=>notePersistence.renderedImageSource(inlineImage));
            }
        });

        list.addEventListener('dblclick', event => {
            if (isPreviewMode) return;

            if (
                event.target.closest(
                    '.inline-note-image, .note-image-frame, img, ' +
                    '.note-category-chip, .note-category-add, ' +
                    '.star-icon, .note-star-button, .btn-delete, .note-internal-link, ' +
                    'a, button'
                )
            ) {
                return;
            }

            const noteItem = event.target.closest('.note-item[data-id]');
            if (!noteItem) return;

            event.preventDefault();
            event.stopPropagation();
            openEditModal(noteItem.dataset.id);
        });

        list.addEventListener(
            'error',
            event => {
                const image = event.target;
                if (!(image instanceof HTMLImageElement) || image.dataset.cloudAsset) return;

                const holder = image.closest(
                    '.note-image-frame, .inline-note-image'
                );
                holder?.classList.add('image-load-error');
                image.style.display = 'none';
            },
            true
        );
    }

    function renderNotes(dataToRender = notesData, options = {}) {
        dataToRender = noteBrowse.select(dataToRender);
        const list = document.getElementById('note-list');
        list.dataset.readerStablePage = dataToRender.length <= 20 ? '1' : '0';
        const update = noteSearchViewport.begin(list, dataToRender, options);
        if (update.unchanged) { notePersistence.prepareRenderedImages(list); noteImageSearch.markImages(list); noteSearchNavigation.decorate(list,{preserveViewport:options.background}); return; }
        if (!update.background) notePersistence.resetRenderedImages();
        const noteIndexMap = new Map(
            notesData.map((note, index) => [note.id, index])
        );

        dataToRender.forEach(note => {
            const absoluteIndex = noteIndexMap.get(note.id) ?? 0;
            if (noteSearchViewport.reuse(update, note)) return;
            const item = document.createElement('li');

            item.className = 'note-item';
            item.dataset.id = note.id;
            item.id = `note-${note.id}`;

            const imageSources =
                Array.isArray(note.images) && note.images.length
                    ? note.images
                    : (note.image ? [note.image] : []);

            const imagesHtml = imageSources.length
                ? `<div class="note-images-container">${
                    imageSources.map((source, index) => `
                        <div
                            class="note-image-frame"
                            data-view-src="${escapeAttribute(source)}"
                            title="點一下放大"
                        >
                            <img
                                src="${escapeAttribute(source)}"
                                loading="lazy"
                                decoding="async"
                                alt="筆記圖片 ${index + 1}"
                            >
                        </div>
                    `).join('')
                }</div>`
                : '';

            const starClass =
                note.starred ? 'fa-solid star-active' : 'fa-regular';

            const noteCategories = getNoteCategoryIds(note)
                .map(id => getCategoryById(id))
                .filter(Boolean);

            const categoryRailHtml = noteCategories
                .map(category => `
                    <button
                        type="button"
                        class="note-category-chip"
                        style="background:${escapeAttribute(category.color)};color:${categoryTextColor(category.color)}"
                        title="${escapeAttribute(category.name)}｜點擊只顯示此分類"
                        aria-label="${escapeAttribute(category.name)}"
                        data-on-click="applyCategoryFilter" data-args="[${inlineJsArgument(category.id)}]" data-stop
                    >${categoryVerticalLabelHtml(category)}</button>
                `)
                .join('');

            item.innerHTML = `
                <div class="note-number-container">
                    <div class="note-star-number-row">
                        <button type="button" class="note-star-button" data-note-star="${escapeAttribute(note.id)}" aria-label="${note.starred?'取消最愛':'加入最愛'}" aria-pressed="${!!note.starred}" data-on-click="toggleStar" data-args="[${inlineJsArgument(note.id)}]">
                            <svg viewBox="0 0 24 24" fill="${note.starred?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 3Z"/></svg>
                        </button>
                        <div class="note-number">${absoluteIndex + 1}.</div>
                    </div>
                    <div class="note-category-stack">${categoryRailHtml}</div>
                    <button
                        type="button"
                        class="note-category-add"
                        data-on-click="openNoteCategoryModal" data-args="[${inlineJsArgument(note.id)}]" data-stop
                        title="${noteCategories.length ? '修改分類' : '新增分類'}"
                        aria-label="${noteCategories.length ? '修改分類' : '新增分類'}"
                    >
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3h7l10 10-7 7L3 10Z"/><circle cx="7" cy="7" r="1"/></svg>
                    </button>
                </div>

                <div class="note-content-area">
                    ${
                        note.title
                            ? `<div class="note-title-display">${escapeHtml(note.title)}</div>`
                            : ''
                    }
                    ${
                        note.text
                            ? `<div class="note-text" id="text-${escapeAttribute(note.id)}">${sanitizeNoteHtml(note.text)}</div>`
                            : `<div class="note-text" id="text-${escapeAttribute(note.id)}" style="display:none;"></div>`
                    }
                    ${imagesHtml}
                </div>

                <div class="note-actions">
                    <button
                        class="btn-delete"
                        data-on-click="deleteNote" data-args="[${inlineJsArgument(note.id)}]" data-stop
                        title="移到垃圾桶（30 天內可還原）"
                        aria-label="將這則筆記移到垃圾桶"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>
                    </button>
                </div>
            `;

            notePersistence.prepareRenderedImages(item);
            noteSearchViewport.add(update, note, item);
        });

        noteSearchViewport.commit(update);
        optimizeRenderedImages(list);
        notePersistence.prepareRenderedImages(list);
        noteImageSearch.markImages(list);
        noteSearchNavigation.decorate(list,{preserveViewport:options.background});
    }

    function openGalleryImageViewer(index) {
        if (Date.now() < suppressGalleryImageClickUntil) return;
        const source = currentPastedImages[index];
        if (source) openImageViewer(source);
    }

    function renderPreviewGrid() {
        const grid = document.getElementById('preview-grid');
        const manager = document.getElementById(
            'legacy-gallery-manager'
        );
        const count = document.getElementById(
            'legacy-gallery-count'
        );

        if (!grid) return;

        if (count) count.textContent = currentPastedImages.length;

        if (manager) {
            manager.classList.toggle(
                'hidden',
                currentPastedImages.length === 0
            );
        }

        const fragment = document.createDocumentFragment();

        currentPastedImages.forEach((imageSource, index) => {
            const item = document.createElement('div');

            item.className = 'preview-item';
            item.dataset.index = String(index);
            item.innerHTML = `
                <button
                    type="button"
                    class="preview-drag-handle"
                    title="拖曳排序"
                >
                    <i class="fas fa-grip-vertical"></i>
                </button>

                <div
                    class="preview-image-box"
                    data-on-click="openGalleryImageViewer" data-args="[${index}]"
                    title="點一下放大；按住圖片可拖曳排序"
                >
                    <img
                        src="${escapeAttribute(imageSource)}"
                        loading="lazy"
                        decoding="async"
                        draggable="false"
                        alt="待儲存圖片 ${index + 1}"
                    >
                </div>

                <div class="preview-order">
                    第 ${index + 1} 張｜按住圖片拖曳排序
                </div>

                <div class="preview-actions">
                    <button type="button" class="btn-preview-edit" data-on-click="noteImageEditor.open" data-args="[{&quot;gallery&quot;:${index}}]">編輯／標記</button>
                    <button
                        type="button"
                        class="btn-preview-insert"
                        data-on-click="moveGalleryImageInline" data-args="[${index}]"
                    >
                        <i class="fas fa-arrow-up"></i> 移入文字
                    </button>

                    <button
                        type="button"
                        class="btn-preview-remove"
                        data-on-click="removeSingleImage" data-args="[${index}]"
                    >
                        <i class="fas fa-trash"></i> 移除
                    </button>
                </div>
            `;

            fragment.appendChild(item);
        });

        grid.replaceChildren(fragment);
        noteInstantEditor.prepareGallery();
    }

    window.removeSingleImage = function(index) {
        currentPastedImages.splice(index, 1);
        renderPreviewGrid();
    };

    window.moveGalleryImageInline = function(index) {
        const source = currentPastedImages[index];
        if (!source) return;

        currentPastedImages.splice(index, 1);
        renderPreviewGrid();
        const insertionRange = savedEditorRange?.cloneRange();
        if (insertionRange) insertionRange.collapse(false);
        insertInlineImage(source, insertionRange, currentGalleryImageEdits[noteImageEditor.galleryKey(source)]);
    };

    let noteOpenRequest = 0;
    function openAddModal() {
        noteOpenRequest++;
        editorSelectionRevision++;
        finishEditorColorChord();
        endEditorColorMemoryManagement();
        clearInlineImageSelection();
        if (previewModeBlocksEditing()) return;
        clearTableCellSelection();
        savedEditorFocusHost = null;
        editingNoteId = null;
        document.getElementById('note-title-input').value = '';
        document.getElementById('modal-text').innerHTML = ''; currentPastedImages = [];
        currentGalleryImageEdits = {};
        pendingCategoryIds = [];
        savedEditorRange = null;
        renderNoteCategoryPicker();
        renderPreviewGrid(); document.getElementById('noteModal').classList.add('active');
        prepareInlineImagesInEditor();
        prepareNoteTablesInEditor();
        document.getElementById('modal-text').focus();
        rememberEditorSelection();
        prepareArrowNoteLists();
        notePersistence.begin();
    }


