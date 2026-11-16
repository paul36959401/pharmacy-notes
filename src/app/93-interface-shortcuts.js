/* Source: 93-interface-shortcuts.js */
/* Shared note dialog shortcuts and lazy optional assets. */
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (document.getElementById('noteLinkModal').classList.contains('active')) closeNoteLinkModal();
        else if (document.getElementById('tableCreateModal').classList.contains('active')) closeTableCreateModal();
        else if (document.getElementById('randomDrawModal').classList.contains('active')) closeRandomDrawModal();
        else if (document.getElementById('categoryAssignModal').classList.contains('active')) closeCategoryAssignModal();
        else if (document.getElementById('categoryOverviewModal').classList.contains('active')) closeCategoryOverviewModal();
        else if (document.getElementById('imageViewer').classList.contains('active')) closeImageViewer();
        else if (document.getElementById('historyModal').classList.contains('active')) closeHistoryModal();
    });


/* Optional editor assets */
(function () {
    var fonts = false, sort = false;
    document.addEventListener('pointerdown', function () {
        if (!fonts) { fonts = true; var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'; document.head.appendChild(link); }
        if (!sort && document.getElementById('noteModal').classList.contains('active')) { sort = true; var script = document.createElement('script'); script.async = true; script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js'; script.onload = function () { setupPreviewSorting(); }; document.head.appendChild(script); }
    }, {capture:true});
}());

