/**
 * V2.3 — Global citation style switcher (toolbar)
 * V2.1 — Merges builtin + localStorage/Firebase custom JSON styles
 */
(function (global) {
    'use strict';

    let inited = false;

    function ensureToolbarSwitcher() {
        if (document.getElementById('citation-style-switcher')) return;

        const toolbar = document.querySelector('.v2-toolbar-row');
        if (!toolbar) return;

        const wrap = document.createElement('div');
        wrap.className = 'v2-citation-switcher-wrap';
        wrap.innerHTML = `
            <span class="material-icons v2-citation-switcher-icon" title="引用格式">format_quote</span>
            <select id="citation-style-switcher" title="切换引用格式" aria-label="引用格式">
                <option value="">加载中…</option>
            </select>
        `;

        const pageSize = toolbar.querySelector('.page-size-wrapper');
        if (pageSize) toolbar.insertBefore(wrap, pageSize);
        else toolbar.appendChild(wrap);

        const sel = document.getElementById('citation-style-switcher');
        sel.addEventListener('change', async () => {
            await applyCustomStyle(sel.value);
        });
    }

    /**
     * Apply a citation style by id (builtin or JSON-imported).
     */
    async function applyCustomStyle(styleId) {
        if (!styleId) return;
        if (typeof switchCitationStyle === 'function') {
            await switchCitationStyle(styleId);
        } else if (window.V2SourceTypes) {
            await V2SourceTypes.setActiveStyleId(styleId);
            await syncToolbar(styleId);
        }
        if (typeof renderEntries === 'function') renderEntries();
        if (window.V2DynamicForm && typeof V2DynamicForm.updateCitationPreview === 'function') {
            V2DynamicForm.updateCitationPreview();
        }
    }

    async function syncToolbar(styleId) {
        ensureToolbarSwitcher();
        const sel = document.getElementById('citation-style-switcher');
        if (!sel || !window.V2SourceTypes) return;

        await V2SourceTypes.load();
        const styles = V2SourceTypes.getStyles();
        const active = styleId || V2SourceTypes.getActiveStyleId();

        sel.innerHTML = styles.map(s =>
            `<option value="${escapeAttr(s.id)}" ${s.id === active ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
        ).join('');
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
    }

    function onStyleChanged(e) {
        syncToolbar(e.detail && e.detail.styleId);
        if (typeof renderEntries === 'function') renderEntries();
        if (window.V2Views && typeof V2Views.refreshInfoPanelCitation === 'function') {
            V2Views.refreshInfoPanelCitation();
        }
        if (window.V2Word && typeof currentViewMode !== 'undefined' && currentViewMode === 'word') {
            if (typeof getFilteredEntries === 'function' && typeof V2Word.render === 'function') {
                const filtered = getFilteredEntries();
                const totalPages = Math.ceil(filtered.length / (typeof ENTRIES_PER_PAGE !== 'undefined' ? ENTRIES_PER_PAGE : 10));
                V2Word.render(filtered, totalPages);
            }
        }
    }

    async function init() {
        if (inited) return;
        inited = true;
        ensureToolbarSwitcher();
        if (window.V2SourceTypes) {
            await V2SourceTypes.load();
            syncToolbar();
        }
        document.addEventListener('v2StyleChanged', onStyleChanged);
        document.addEventListener('v2TypesChanged', () => syncToolbar());
        document.addEventListener('v2StyleImported', (e) => {
            syncToolbar(e.detail && e.detail.style && e.detail.style.id);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 600));
    } else {
        setTimeout(init, 600);
    }
    document.addEventListener('firebaseReady', () => setTimeout(init, 900));

    global.V2CitationSwitcher = {
        init,
        syncToolbar,
        ensureToolbarSwitcher,
        applyCustomStyle
    };
})(window);
