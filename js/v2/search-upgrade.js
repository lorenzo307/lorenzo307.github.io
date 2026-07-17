/**
 * V2.4 — Full-text search upgrade
 * Scopes: all / title / content / analysis / citation / comments / metadata / tags / type
 * Works across list / detail / card / word views
 */
(function (global) {
    'use strict';

    function commentsText(entry) {
        if (!entry || !entry.comments) return '';
        const list = window.V2Comments
            ? V2Comments.commentsOf(entry)
            : (Array.isArray(entry.comments) ? entry.comments : Object.values(entry.comments || {}));
        return list.map(c => {
            const replies = (c.replies || []);
            const replyText = Array.isArray(replies)
                ? replies.map(r => r.text || '').join(' ')
                : Object.values(replies).map(r => r.text || '').join(' ');
            return [c.text, c.quote, c.authorName, replyText].join(' ');
        }).join(' ');
    }

    function metadataText(entry) {
        if (!entry || !entry.metadata) return '';
        return Object.values(entry.metadata).join(' ');
    }

    function typeText(entry) {
        const id = entry.typeId || 'general';
        const name = window.V2SourceTypes ? V2SourceTypes.typeName(id) : id;
        return `${id} ${name}`;
    }

    function relatedText(entry) {
        const ids = window.V2Knowledge ? V2Knowledge.relatedOf(entry) : (entry.relatedSources || []);
        return ids.map(id => {
            const t = (typeof entries !== 'undefined') ? entries.find(e => e.id === id) : null;
            return `${id} ${t?.title || ''}`;
        }).join(' ');
    }

    function buildSearchCorpus(entry, scope) {
        const parts = {
            title: entry.title || '',
            content: entry.content || '',
            analysis: entry.analysis || '',
            citation: entry.citation || '',
            comments: commentsText(entry),
            metadata: metadataText(entry),
            tags: (entry.keywords || []).join(' '),
            type: typeText(entry),
            related: relatedText(entry)
        };
        switch (scope) {
            case 'title': return parts.title;
            case 'content': return parts.content;
            case 'analysis': return parts.analysis;
            case 'citation': return parts.citation;
            case 'comments': return parts.comments;
            case 'metadata': return parts.metadata;
            case 'tags': return parts.tags;
            case 'type': return parts.type;
            case 'related': return parts.related;
            case 'all':
            default:
                return Object.values(parts).join(' ');
        }
    }

    function expandScopeSelect() {
        const sel = document.getElementById('fulltext-scope');
        if (!sel || sel.dataset.v24 === '1') return;
        const extras = [
            ['citation', '引用'],
            ['comments', '批注'],
            ['metadata', '著录字段'],
            ['tags', '标签'],
            ['type', '文献类型'],
            ['related', '关联文献']
        ];
        extras.forEach(([v, label]) => {
            if (![...sel.options].some(o => o.value === v)) {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = label;
                sel.appendChild(opt);
            }
        });
        // Rename "全部内容"
        const all = [...sel.options].find(o => o.value === 'all');
        if (all) all.textContent = '全部字段';
        sel.dataset.v24 = '1';

        // Update hint
        const tip = document.querySelector('.fulltext-search-group .search-tips .tip, .fulltext-search-group .tip');
        // Add a small note under options if missing
        let note = document.getElementById('v2-search-note');
        if (!note) {
            note = document.createElement('div');
            note.id = 'v2-search-note';
            note.className = 'v2-search-note';
            note.textContent = 'V2.4：可检索引用、批注、著录字段、标签、类型与关联文献；适用于所有视图。';
            const group = document.querySelector('.fulltext-search-group');
            group?.appendChild(note);
        }
    }

    function patchFulltext() {
        if (typeof global.applyFulltextSearch !== 'function') return;
        if (global.applyFulltextSearch._v24) return;

        global.applyFulltextSearch = function () {
            expandScopeSelect();
            const input = document.getElementById('fulltext-search')?.value.trim();
            const logic = document.getElementById('fulltext-logic')?.value || 'AND';
            const scope = document.getElementById('fulltext-scope')?.value || 'all';

            if (!input) {
                if (typeof showAlert === 'function') showAlert('请输入检索词', 'warning');
                return;
            }

            fulltextSearch.query = input;
            fulltextSearch.logic = logic;
            fulltextSearch.scope = scope;

            if (logic === 'PHRASE') {
                fulltextSearch.terms = [input];
            } else {
                const phraseMatches = input.match(/"([^"]+)"/g);
                let remaining = input;
                const terms = [];
                if (phraseMatches) {
                    phraseMatches.forEach(match => {
                        terms.push(match.slice(1, -1));
                        remaining = remaining.replace(match, '');
                    });
                }
                terms.push(...remaining.trim().split(/\s+/).filter(Boolean));
                fulltextSearch.terms = terms;
            }

            performUpgradedSearch();
            if (typeof showFulltextResultsSummary === 'function') {
                showFulltextResultsSummary();
            } else if (typeof showAlert === 'function') {
                showAlert(`找到 ${fulltextSearch.results.length} 条结果`, 'success');
            }
            // Switch to detail if highlights matter, but don't force — keep current view
            if (typeof currentPage !== 'undefined') currentPage = 1;
            if (typeof renderEntries === 'function') renderEntries();
        };
        global.applyFulltextSearch._v24 = true;
    }

    function performUpgradedSearch() {
        fulltextSearch.results = [];
        fulltextSearch.highlights = {};

        (entries || []).forEach(entry => {
            const searchText = buildSearchCorpus(entry, fulltextSearch.scope);
            const textLower = searchText.toLowerCase();
            let isMatch = false;
            let highlights = [];

            if (fulltextSearch.logic === 'PHRASE') {
                const phrase = fulltextSearch.terms[0].toLowerCase();
                if (textLower.includes(phrase)) {
                    isMatch = true;
                    if (typeof findPhraseHighlights === 'function') {
                        highlights = findPhraseHighlights(searchText, phrase);
                    }
                }
            } else if (fulltextSearch.logic === 'AND') {
                isMatch = fulltextSearch.terms.every(term => textLower.includes(term.toLowerCase()));
                if (isMatch && typeof findWordHighlights === 'function') {
                    highlights = fulltextSearch.terms.flatMap(term => findWordHighlights(searchText, term));
                } else if (isMatch && typeof findPhraseHighlights === 'function') {
                    highlights = fulltextSearch.terms.flatMap(term => findPhraseHighlights(searchText, term));
                }
            } else {
                isMatch = fulltextSearch.terms.some(term => textLower.includes(term.toLowerCase()));
                if (isMatch && typeof findWordHighlights === 'function') {
                    highlights = fulltextSearch.terms.flatMap(term => {
                        if (textLower.includes(term.toLowerCase())) {
                            return findWordHighlights(searchText, term);
                        }
                        return [];
                    });
                } else if (isMatch && typeof findPhraseHighlights === 'function') {
                    highlights = fulltextSearch.terms.flatMap(term => {
                        if (textLower.includes(term.toLowerCase())) {
                            return findPhraseHighlights(searchText, term);
                        }
                        return [];
                    });
                }
            }

            if (isMatch) {
                fulltextSearch.results.push(entry.id);
                fulltextSearch.highlights[entry.id] = highlights;
            }
        });
    }

    function patchGetFiltered() {
        // Ensure fulltext filter applies in all views when results are active
        if (typeof global.getFilteredEntries !== 'function') return;
        if (global.getFilteredEntries._v24search) return;

        const orig = global.getFilteredEntries;
        global.getFilteredEntries = function () {
            // Temporarily force fulltext to apply regardless of view:
            // We wrap by post-filtering if needed, but original checks currentViewMode !== 'detail'.
            // So monkey-patch: call orig after setting a flag... easier to re-filter.

            // Call through the chain (includes V2Nav filter)
            // But orig's internal fulltextMatch ignores non-detail. Fix by:
            const savedMode = typeof currentViewMode !== 'undefined' ? currentViewMode : 'list';
            const hasFT = typeof fulltextSearch !== 'undefined' &&
                fulltextSearch.results && fulltextSearch.results.length > 0;

            let result;
            if (hasFT && savedMode !== 'detail') {
                // Pretend detail so legacy includes fulltext filter
                try {
                    currentViewMode = 'detail';
                    result = orig();
                } finally {
                    currentViewMode = savedMode;
                }
            } else {
                result = orig();
            }

            // Also upgrade quick search corpus for searchQuery (already partly done in legacy)
            return result;
        };
        global.getFilteredEntries._v24search = true;
    }

    function patchQuickSearch() {
        // Broaden searchMatch fields already in legacy; add comments + related via wrapping search input
        const input = document.getElementById('search-input');
        if (input && !input.dataset.v24placeholder) {
            input.placeholder = '搜索标题/原文/分析/标签/引用/批注/著录…';
            input.dataset.v24placeholder = '1';
        }

        // Patch the filter used when searchQuery is set — enhance getFilteredEntries' search
        // by replacing searchQuery matching: we intercept via wrapping orig again if needed.
        if (typeof global.getFilteredEntries === 'function' && !global.getFilteredEntries._v24quick) {
            const prev = global.getFilteredEntries;
            global.getFilteredEntries = function () {
                if (!searchQuery) return prev();
                const saved = searchQuery;
                searchQuery = '';
                let base;
                try {
                    base = prev();
                } finally {
                    searchQuery = saved;
                }
                const q = String(saved).toLowerCase();
                return base.filter(entry =>
                    buildSearchCorpus(entry, 'all').toLowerCase().includes(q)
                );
            };
            global.getFilteredEntries._v24quick = true;
            global.getFilteredEntries._v24search = true; // keep flag
        }
    }

    function init() {
        expandScopeSelect();
        patchFulltext();
        patchGetFiltered();
        patchQuickSearch();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 50));
    } else {
        setTimeout(init, 50);
    }
    document.addEventListener('firebaseReady', () => setTimeout(init, 400));

    global.V2Search = {
        buildSearchCorpus,
        commentsText,
        expandScopeSelect,
        performUpgradedSearch
    };
})(window);
