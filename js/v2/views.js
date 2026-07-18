/**
 * V2.1 — Three view modes: table (list), card, word placeholder
 */
(function (global) {
    'use strict';

    const VIEW_LABELS = {
        list: '数据库视图',
        detail: '详细视图',
        card: '卡片视图',
        word: 'Word 阅读视图',
        timeline: '时间线视图'
    };

    let selectedInfoId = null;
    let wordActiveId = null;

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderCardView(pageEntries) {
        return `<div class="card-view">` + pageEntries.map(entry => {
            const selected = (typeof selectedAll !== 'undefined' && selectedAll) ||
                (typeof selectedEntryIds !== 'undefined' && selectedEntryIds.has(entry.id));
            const bulk = typeof bulkModeActive !== 'undefined' && bulkModeActive;
            const excerpt = V2Utils.excerpt(entry.content || entry.analysis, 120);
            const typeLabel = (window.V2SourceTypes && V2SourceTypes.typeName(entry.typeId)) || '';
            const citeText = (window.V2Citations && V2Citations.getDisplayCitation(entry)) || '';
            const tags = (entry.keywords || []).map(kw =>
                `<span class="keyword-tag" style="background:${V2Utils.tagColor(kw)};color:#fff;border:none" onclick="event.stopPropagation();filterByKeyword('${esc(kw).replace(/'/g, "\\'")}')">${esc(kw)}</span>`
            ).join('');

            const click = bulk
                ? `onclick="handleEntryItemClick(event, '${entry.id}')"`
                : `onclick="V2Views.selectEntry('${entry.id}')"`;

            return `<div class="card-entry ${bulk ? 'bulk-mode' : ''} ${selected ? 'selected' : ''}" data-id="${entry.id}" ${click}>
                <h3 class="card-entry-title">${esc(entry.title || '无标题')}${window.V2Events ? V2Events.eventBadgeHtml(entry) : ''}</h3>
                <div class="card-entry-meta">${esc(entry.id)} · ${esc(entry.date || '')}${typeLabel ? ` · <span class="v2-type-badge">${esc(typeLabel)}</span>` : ''}</div>
                ${citeText ? `<div class="v2-entry-citation">${esc(citeText)}</div>` : ''}
                <div class="card-entry-excerpt">${esc(excerpt || '暂无摘要')}</div>
                <div class="card-entry-tags">${tags}</div>
                <div class="card-entry-actions">
                    <button class="primary-btn btn-icon-only" onclick="event.stopPropagation();editEntry('${entry.id}')" title="编辑"><span class="material-icons">edit</span></button>
                    <button class="icon-btn" onclick="event.stopPropagation();V2Views.toggleStar('${entry.id}')" title="收藏"><span class="material-icons">${entry.starred ? 'star' : 'star_border'}</span></button>
                    <button class="danger-btn btn-icon-only" onclick="event.stopPropagation();deleteEntry('${entry.id}')" title="删除"><span class="material-icons">delete</span></button>
                </div>
                ${bulk ? `<input type="checkbox" class="select-entry" ${selected ? 'checked' : ''} onchange="handleEntrySelection('${entry.id}', this.checked)" style="display:none">` : ''}
            </div>`;
        }).join('') + `</div>`;
    }

    function renderWordView(pageEntries) {
        // Delegated to V2Word (V2.3). Kept as fallback placeholder.
        if (window.V2Word && typeof V2Word.render === 'function' && typeof getFilteredEntries === 'function') {
            V2Word.render(getFilteredEntries());
            return '';
        }
        return `<div class="word-view-placeholder">
            <span class="material-icons">menu_book</span>
            <h3>Word 阅读视图</h3>
            <p>正在加载 Word 模块…</p>
        </div>`;
    }

    function renderPage(pageEntries, totalPages) {
        const container = document.getElementById('entries-container');
        if (!container) return;

        const mode = (typeof currentViewMode !== 'undefined') ? currentViewMode : 'card';
        if (mode === 'word') {
            if (window.V2Word) {
                V2Word.render(typeof getFilteredEntries === 'function' ? getFilteredEntries() : pageEntries);
            }
            return;
        }

        document.body.classList.remove('word-mode-active');
        document.body.classList.remove('timeline-mode-active');
        const html = renderCardView(pageEntries);
        container.innerHTML = `<div class="${mode}-view entering" style="opacity:1;transform:none">${html}</div>`;

        if (typeof updatePagination === 'function') updatePagination(totalPages);
    }

    function setWordEntry(id) {
        if (window.V2Word) {
            V2Word.setActiveEntry(id);
            return;
        }
        wordActiveId = id;
        selectEntry(id);
        if (typeof renderEntries === 'function') renderEntries();
    }

    function selectEntry(id) {
        if (typeof V2Nav !== 'undefined') V2Nav.trackRecent(id);
        selectedInfoId = id;
        updateInfoPanel(id);
    }

    function openEntry(id) {
        selectEntry(id);
        if (typeof editEntry === 'function') editEntry(id);
    }

    async function toggleStar(id) {
        if (typeof entries === 'undefined' || typeof db === 'undefined' || typeof getProjectPath !== 'function') return;
        const entry = entries.find(e => e.id === id);
        if (!entry) return;
        entry.starred = !entry.starred;
        try {
            await db.ref(getProjectPath(`entries/${id}/starred`)).set(entry.starred || null);
        } catch (err) {
            console.error('收藏失败', err);
            entry.starred = !entry.starred;
            return;
        }
        if (typeof renderEntries === 'function') renderEntries();
        if (typeof V2Nav !== 'undefined') V2Nav.updateNavBadges();
        if (selectedInfoId === id) updateInfoPanel(id);
    }

    function updateInfoPanel(id) {
        const panel = document.getElementById('v2-info-content');
        const empty = document.getElementById('v2-info-empty');
        if (!panel) return;

        const entry = (typeof entries !== 'undefined' ? entries : []).find(e => e.id === id);
        if (!entry) {
            panel.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }

        if (empty) empty.style.display = 'none';
        panel.style.display = 'block';
        panel.innerHTML = `
            <h3 class="v2-info-title">${esc(entry.title || '无标题')}</h3>
            <div class="v2-info-meta">${esc(entry.id)} · ${esc(entry.date || '')}${(window.V2SourceTypes ? ' · ' + esc(V2SourceTypes.typeName(entry.typeId)) : '')}</div>
            ${((window.V2Citations && V2Citations.getDisplayCitation(entry)) || entry.citation) ? `
            <div class="v2-info-section">
                <div class="v2-info-section-label">引用</div>
                <div class="v2-info-excerpt" style="-webkit-line-clamp:4;line-clamp:4">${esc((window.V2Citations && V2Citations.getDisplayCitation(entry)) || entry.citation)}</div>
            </div>` : ''}
            <div class="v2-info-section">
                <div class="v2-info-section-label">原文摘要</div>
                <div class="v2-info-excerpt">${esc(V2Utils.excerpt(entry.content, 200) || '暂无')}</div>
            </div>
            <div class="v2-info-section">
                <div class="v2-info-section-label">标签</div>
                <div class="v2-info-tags">${(entry.keywords || []).map(kw =>
                    `<span class="keyword-tag" style="background:${V2Utils.tagColor(kw)};color:#fff;border:none;cursor:pointer" onclick="filterByKeyword('${esc(kw).replace(/'/g, "\\'")}')">${esc(kw)}</span>`
                ).join('') || '<span style="color:var(--text-secondary);font-size:0.85rem">无</span>'}</div>
            </div>
            <div class="v2-info-actions">
                <button class="primary-btn" onclick="editEntry('${entry.id}')"><span class="material-icons">edit</span> 编辑</button>
                <button class="primary-btn btn-outline" onclick="V2Views.toggleStar('${entry.id}')"><span class="material-icons">${entry.starred ? 'star' : 'star_border'}</span> ${entry.starred ? '取消收藏' : '收藏'}</button>
                <button class="primary-btn btn-outline" onclick="V2Views.copyCitation('${entry.id}')"><span class="material-icons">content_copy</span> 复制引用</button>
            </div>`;
    }

    function syncViewMenu(mode) {
        document.querySelectorAll('.v2-nav-item[data-view], #v2-view-menu [data-view]').forEach(el => {
            el.classList.toggle('active', el.dataset.view === mode);
        });
        const legacyBtn = document.getElementById('toggle-view-btn');
        if (legacyBtn) legacyBtn.style.display = 'none';
    }

    function bindViewMenu() {
        // View switching is handled by V2Nav sidebar items
    }

    function bindEntryInfoDelegation() {
        const container = document.getElementById('entries-container');
        if (!container || container.dataset.v2InfoBound) return;
        container.dataset.v2InfoBound = '1';
        container.addEventListener('click', (e) => {
            if (e.target.closest('button, a, input, .keyword-tag')) return;
            const row = e.target.closest('.entry-item, .detail-entry, .card-entry');
            if (!row || !row.dataset.id) return;
            selectEntry(row.dataset.id);
        });
    }

    function restoreViewMode() {
        try {
            const saved = localStorage.getItem('v2_view_mode');
            if (saved && ['list', 'detail', 'card', 'word', 'timeline'].includes(saved) && typeof changeViewMode === 'function') {
                if (typeof currentViewMode !== 'undefined' && currentViewMode !== saved) {
                    changeViewMode(saved);
                    return;
                }
            }
        } catch (e) {}
        syncViewMenu(typeof currentViewMode !== 'undefined' ? currentViewMode : 'list');
    }

    function initViews() {
        bindViewMenu();
        bindEntryInfoDelegation();
        restoreViewMode();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initViews);
    } else {
        initViews();
    }

    function copyCitation(id) {
        const entry = (typeof entries !== 'undefined' ? entries : []).find(e => e.id === id);
        if (!entry) return;
        const text = (window.V2Citations && V2Citations.getDisplayCitation(entry)) || entry.citation || entry.title || '';
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                if (typeof showAlert === 'function') showAlert('引用已复制', 'success');
            }).catch(() => {
                if (typeof showAlert === 'function') showAlert(text, 'info');
            });
        } else if (typeof showAlert === 'function') {
            showAlert(text, 'info');
        }
    }

    function refreshInfoPanelCitation() {
        if (selectedInfoId) updateInfoPanel(selectedInfoId);
    }

    global.V2Views = {
        renderCardView,
        renderWordView,
        renderWordPlaceholder: renderWordView,
        renderPage,
        openEntry,
        selectEntry,
        setWordEntry,
        toggleStar,
        updateInfoPanel,
        syncViewMenu,
        copyCitation,
        refreshInfoPanelCitation
    };
})(window);
