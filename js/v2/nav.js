/**
 * V2.1 — Left navigation & filters
 */
(function (global) {
    'use strict';

    let navFilter = 'all';
    let navTagFilter = null;
    let patched = false;

    function getRecentKey() {
        const pid = new URLSearchParams(location.search).get('project') ||
            localStorage.getItem('currentProject') || 'default';
        return 'v2_recent_' + pid;
    }

    function getRecentIds() {
        try {
            return JSON.parse(localStorage.getItem(getRecentKey()) || '[]');
        } catch (e) {
            return [];
        }
    }

    function trackRecent(entryId) {
        if (!entryId) return;
        let ids = getRecentIds().filter(id => id !== entryId);
        ids.unshift(entryId);
        ids = ids.slice(0, 30);
        try { localStorage.setItem(getRecentKey(), JSON.stringify(ids)); } catch (e) {}
        updateNavBadges();
    }

    function clearLegacyKeywordFilter() {
        if (typeof currentFilterKeyword !== 'undefined') {
            currentFilterKeyword = null;
        }
    }

    function closeMobileSidebar() {
        document.getElementById('v2-sidebar')?.classList.remove('open');
        document.getElementById('v2-sidebar-overlay')?.classList.remove('visible');
    }

    function setNavFilter(filter, tag) {
        navFilter = filter;
        navTagFilter = tag || null;

        if (filter !== 'tags') {
            clearLegacyKeywordFilter();
        }

        document.querySelectorAll('.v2-nav-item[data-nav]').forEach(el => {
            el.classList.toggle('active', el.dataset.nav === filter && !navTagFilter);
        });
        document.querySelectorAll('.v2-nav-tag').forEach(el => {
            el.classList.toggle('active', navTagFilter === el.dataset.tag);
        });

        if (filter === 'word' && typeof changeViewMode === 'function') {
            changeViewMode('word');
        } else if (typeof currentViewMode !== 'undefined' && (currentViewMode === 'word' || currentViewMode === 'timeline') && filter !== 'word' && typeof changeViewMode === 'function') {
            changeViewMode('list');
        }

        if (typeof currentPage !== 'undefined') currentPage = 1;
        if (typeof renderEntries === 'function') renderEntries();
        updateNavBadges();
    }

    function applyNavFilter(filtered) {
        if (navTagFilter) {
            return filtered.filter(e => (e.keywords || []).includes(navTagFilter));
        }
        switch (navFilter) {
            case 'starred':
                return filtered.filter(e => e.starred === true);
            case 'recent': {
                const ids = getRecentIds();
                const map = new Map(filtered.map(e => [e.id, e]));
                return ids.map(id => map.get(id)).filter(Boolean);
            }
            case 'export':
            case 'settings':
            case 'word':
                return filtered;
            default:
                return filtered;
        }
    }

    function updateNavBadges() {
        if (typeof entries === 'undefined') return;
        const starred = entries.filter(e => e.starred).length;
        const recent = getRecentIds().length;
        const elStar = document.getElementById('nav-badge-starred');
        const elRecent = document.getElementById('nav-badge-recent');
        if (elStar) elStar.textContent = starred || '';
        if (elRecent) elRecent.textContent = recent || '';
    }

    function renderNavTags() {
        const container = document.getElementById('v2-nav-tags');
        if (!container || typeof entries === 'undefined') return;

        const counts = {};
        entries.forEach(e => (e.keywords || []).forEach(k => {
            counts[k] = (counts[k] || 0) + 1;
        }));
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);

        container.innerHTML = sorted.map(([tag]) =>
            `<button type="button" class="v2-nav-tag${navTagFilter === tag ? ' active' : ''}" data-tag="${escapeAttr(tag)}" style="background:${V2Utils.tagColor(tag)}" onclick="V2Nav.filterByTag('${escapeJs(tag)}')">${escapeHtml(tag)}</button>`
        ).join('') +
            (Object.keys(counts).length > 12
                ? `<button type="button" class="v2-nav-tag v2-nav-tag-more" onclick="showKeywordEditor()">更多…</button>`
                : '');
    }

    function filterByTag(tag) {
        if (navTagFilter === tag) {
            setNavFilter('all');
            return;
        }
        navTagFilter = tag;
        navFilter = 'tags';
        if (typeof currentFilterKeyword !== 'undefined') currentFilterKeyword = null;
        document.querySelectorAll('.v2-nav-item[data-nav]').forEach(el => {
            el.classList.toggle('active', el.dataset.nav === 'tags');
        });
        document.querySelectorAll('.v2-nav-tag').forEach(el => {
            el.classList.toggle('active', el.dataset.tag === tag);
        });
        if (typeof currentPage !== 'undefined') currentPage = 1;
        if (typeof renderEntries === 'function') renderEntries();
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
    }

    function escapeJs(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function patchFilters() {
        if (patched) return;
        if (typeof global.getFilteredEntries !== 'function') return;
        const origGetFiltered = global.getFilteredEntries;
        global.getFilteredEntries = function () {
            return applyNavFilter(origGetFiltered());
        };

        if (typeof global.editEntry === 'function') {
            const origEdit = global.editEntry;
            global.editEntry = function (id) {
                trackRecent(id);
                if (window.V2Views) V2Views.updateInfoPanel(id);
                return origEdit(id);
            };
        }
        patched = true;
    }

    function runAction(action) {
        switch (action) {
            case 'add':
                if (typeof showForm === 'function') showForm();
                break;
            case 'import':
                if (typeof importExcel === 'function') importExcel();
                break;
            case 'export':
                if (window.V2Export) V2Export.show();
                else if (typeof exportEntries === 'function') exportEntries('excel');
                break;
            case 'types':
                if (window.V2TypeManager) V2TypeManager.show();
                break;
            case 'network':
                if (window.V2Knowledge) V2Knowledge.show();
                break;
            case 'bulk':
                if (typeof toggleBulkMode === 'function') toggleBulkMode();
                break;
            case 'advanced-search':
                if (typeof toggleAdvancedSearch === 'function') toggleAdvancedSearch();
                break;
            case 'bulk-edit':
                if (typeof showBulkEditForm === 'function') showBulkEditForm();
                break;
            case 'drafts':
                if (typeof showDraftBox === 'function') showDraftBox();
                break;
            case 'recycle':
                if (typeof showRecycleBin === 'function') showRecycleBin();
                break;
            case 'keywords':
                if (typeof showKeywordEditor === 'function') showKeywordEditor();
                break;
            case 'logs':
                if (typeof showLogViewer === 'function') showLogViewer();
                break;
            case 'duplicates':
                if (typeof scanDuplicates === 'function') scanDuplicates();
                break;
            case 'migrate':
                if (typeof migrateLegacyData === 'function') migrateLegacyData();
                break;
            case 'codes':
                if (typeof updateAllEntryCodes === 'function') updateAllEntryCodes();
                break;
            case 'stats':
                if (typeof showStatisticsPanel === 'function') showStatisticsPanel();
                break;
            case 'settings':
                if (window.V2TypeManager) V2TypeManager.show();
                else if (typeof toggleThemeOptions === 'function') toggleThemeOptions();
                break;
            default:
                break;
        }
        closeMobileSidebar();
    }

    function initNav() {
        patchFilters();

        document.querySelectorAll('.v2-nav-item[data-action]').forEach(btn => {
            btn.addEventListener('click', () => runAction(btn.dataset.action));
        });

        document.querySelectorAll('.v2-nav-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.view;
                if (typeof changeViewMode === 'function') changeViewMode(mode);
                if (mode === 'word') {
                    navFilter = 'word';
                } else if (navFilter === 'word') {
                    navFilter = 'all';
                    document.querySelectorAll('.v2-nav-item[data-nav]').forEach(el => {
                        el.classList.toggle('active', el.dataset.nav === 'all');
                    });
                }
                closeMobileSidebar();
            });
        });

        document.querySelectorAll('.v2-nav-item[data-nav]').forEach(btn => {
            btn.addEventListener('click', () => {
                const nav = btn.dataset.nav;
                if (nav === 'tags') {
                    document.getElementById('v2-nav-tags')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    document.querySelectorAll('.v2-nav-item[data-nav]').forEach(el => {
                        el.classList.toggle('active', el.dataset.nav === 'tags');
                    });
                    return;
                }
                setNavFilter(nav);
                closeMobileSidebar();
            });
        });

        document.addEventListener('firebaseReady', () => {
            setTimeout(() => {
                patchFilters();
                updateNavBadges();
                renderNavTags();
            }, 800);
        });

        setTimeout(patchFilters, 0);

        global._v2AfterRender = function () {
            renderNavTags();
            updateNavBadges();
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNav);
    } else {
        initNav();
    }

    global.V2Nav = {
        setNavFilter,
        applyNavFilter,
        trackRecent,
        updateNavBadges,
        renderNavTags,
        filterByTag,
        closeMobileSidebar,
        getNavFilter: () => navFilter,
        getNavTag: () => navTagFilter
    };
})(window);
