/**
 * V2.3 — Full Word reading mode: TOC + body + annotations
 */
(function (global) {
    'use strict';

    const SORT_OPTIONS = [
        { id: 'title', label: '标题' },
        { id: 'pinyin', label: '拼音' },
        { id: 'author', label: '作者' },
        { id: 'date', label: '出版/史料日期' },
        { id: 'created', label: '创建时间' },
        { id: 'updated', label: '最近修改' },
        { id: 'type', label: '文献类型' }
    ];

    let activeId = null;
    let sortBy = 'title';
    let sortAsc = true;
    let tagFilter = '';
    let tocPage = 1;
    let tocPageSize = 10;
    let syncTocPageToActive = false;
    let commentFilter = '';
    let showResolved = true;
    let activeCommentId = null;
    let pendingSelection = null;
    let bound = false;
    let lastRenderedId = null;

    function panelExpanded(kind) {
        return matchMedia('(max-width: 900px)').matches
            ? document.body.classList.contains('reader-' + kind + '-open')
            : !document.body.classList.contains('reader-' + kind + '-hidden');
    }
    function syncPanels() {
        ['toc', 'notes'].forEach(kind => {
            document.querySelectorAll('[data-reader-panel="' + kind + '"]').forEach(b => b.setAttribute('aria-expanded', String(panelExpanded(kind))));
            const panel = document.querySelector('.word-' + kind + '-panel');
            if (panel) panel.inert = !panelExpanded(kind);
        });
    }
    function togglePanel(kind) {
        if (!['toc', 'notes'].includes(kind)) return;
        const mobile = matchMedia('(max-width: 900px)').matches;
        document.body.classList.toggle('reader-' + kind + (mobile ? '-open' : '-hidden'));
        if (mobile) document.body.classList.remove('reader-' + (kind === 'toc' ? 'notes' : 'toc') + '-open');
        syncPanels();
    }
    window.addEventListener('resize', syncPanels);
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || !document.body.classList.contains('word-mode-active') || document.querySelector('dialog[open]')) return;
        const kind = ['toc', 'notes'].find(k => document.body.classList.contains('reader-' + k + '-open'));
        if (kind) {
            document.body.classList.remove('reader-' + kind + '-open');
            syncPanels();
            document.querySelector('[data-reader-panel="' + kind + '"]')?.focus();
        }
    });

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function loadSortPref() {
        try {
            const s = JSON.parse(localStorage.getItem('v2_word_sort') || '{}');
            if (s.by) sortBy = s.by;
            if (typeof s.asc === 'boolean') sortAsc = s.asc;
            tagFilter = localStorage.getItem('v2_word_tag') || '';
            const savedPageSize = Number(localStorage.getItem('v2_word_page_size'));
            if (Number.isSafeInteger(savedPageSize) && savedPageSize >= 1 && savedPageSize <= 100) tocPageSize = savedPageSize;
        } catch (e) {}
    }

    function saveSortPref() {
        try { localStorage.setItem('v2_word_sort', JSON.stringify({ by: sortBy, asc: sortAsc })); } catch (e) {}
    }

    function saveTagPref() {
        try { localStorage.setItem('v2_word_tag', tagFilter); } catch (e) {}
    }

    function savePageSizePref() {
        try { localStorage.setItem('v2_word_page_size', String(tocPageSize)); } catch (e) {}
    }

    function setTagFilter(tag) {
        tagFilter = String(tag || '');
        saveTagPref();
        activeId = null;
        tocPage = 1;
        refresh();
    }

    function authorOf(entry) {
        return (entry.metadata && (entry.metadata.author || entry.metadata.编者)) || '';
    }

    function sortEntries(list) {
        const arr = list.slice();
        const dir = sortAsc ? 1 : -1;
        arr.sort((a, b) => {
            let cmp = 0;
            switch (sortBy) {
                case 'author':
                    cmp = authorOf(a).localeCompare(authorOf(b), 'zh-CN');
                    break;
                case 'date':
                    cmp = (ResearchDates.parse(a.date)?.start || '9999').localeCompare(ResearchDates.parse(b.date)?.start || '9999');
                    break;
                case 'created':
                    cmp = (a.createdAt || 0) - (b.createdAt || 0);
                    break;
                case 'updated':
                    cmp = (a.updatedAt || 0) - (b.updatedAt || 0);
                    break;
                case 'type': {
                    const ta = (window.V2SourceTypes && V2SourceTypes.typeName(a.typeId)) || a.typeId || '';
                    const tb = (window.V2SourceTypes && V2SourceTypes.typeName(b.typeId)) || b.typeId || '';
                    cmp = ta.localeCompare(tb, 'zh-CN');
                    break;
                }
                case 'pinyin':
                case 'title':
                default:
                    cmp = String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
                    break;
            }
            if (cmp === 0) cmp = String(a.id || '').localeCompare(String(b.id || ''));
            return cmp * dir;
        });
        return arr;
    }

    /* ---------- Text range helpers ---------- */

    function textWalker(root){return document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest('[data-note],[data-comment-marker]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});}
    function getPlainOffset(root, node, offset) {
        const walker = textWalker(root);
        let count = 0;
        let n;
        while ((n = walker.nextNode())) {
            if (n === node) return count + offset;
            count += n.textContent.length;
        }
        return count;
    }

    function unwrapHighlights(root) {
        root.querySelectorAll('mark.word-hl').forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
            parent.normalize();
        });
    }

    function wrapRange(root, start, end, commentId, color) {
        if (start == null || end == null || end <= start) return;
        const walker = textWalker(root);
        let count = 0;
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) {
            const len = n.textContent.length;
            const nodeStart = count;
            const nodeEnd = count + len;
            if (nodeEnd > start && nodeStart < end) {
                nodes.push({ node: n, nodeStart, nodeEnd });
            }
            count = nodeEnd;
        }
        nodes.reverse().forEach(({ node, nodeStart }) => {
            const localStart = Math.max(0, start - nodeStart);
            const localEnd = Math.min(node.textContent.length, end - nodeStart);
            if (localEnd <= localStart) return;
            const text = node.textContent;
            const before = text.slice(0, localStart);
            const mid = text.slice(localStart, localEnd);
            const after = text.slice(localEnd);
            const mark = document.createElement('mark');
            mark.className = 'word-hl word-hl-' + (color || 'yellow');
            mark.dataset.cid = commentId;
            mark.textContent = mid;
            const parent = node.parentNode;
            const frag = document.createDocumentFragment();
            if (before) frag.appendChild(document.createTextNode(before));
            frag.appendChild(mark);
            if (after) frag.appendChild(document.createTextNode(after));
            parent.replaceChild(frag, node);
        });
    }

    function applyHighlights(bodyEl, comments) {
        bodyEl.querySelectorAll('[data-comment-marker]').forEach(e=>e.remove());
        bodyEl.querySelectorAll('[data-note][data-comment-id]').forEach(el=>{if(!comments.some(c=>c.id===el.dataset.commentId))el.remove();});
        unwrapHighlights(bodyEl);
        const walker=textWalker(bodyEl);let plain='',node;while(node=walker.nextNode())plain+=node.textContent;
        const section=bodyEl.classList.contains('word-analysis')?'analysis':'content';
        comments.filter(c => (c.section||'content')===section).forEach(c => {
            let s = c.startOffset;
            let e = c.endOffset;
            c.anchorLost = false;
            if (c.quote && (s == null || e == null || plain.slice(s, e) !== c.quote)) {
                const idx = plain.indexOf(c.quote);
                if (idx >= 0 && plain.indexOf(c.quote, idx + 1) === -1) { s = idx; e = idx + c.quote.length; }
                else { s = null; e = null; c.anchorLost = true; }
            }
            if (s != null && e != null && !c.resolved) wrapRange(bodyEl, s, e, c.id, c.color);
            const old=[...bodyEl.querySelectorAll('[data-comment-id]')].find(el=>el.dataset.commentId===c.id);
            if(old){old.dataset.cid=c.id;old.title=c.text;old.setAttribute('aria-label','打开批注：'+c.text);}
            else {const marks=[...bodyEl.querySelectorAll('mark.word-hl')].filter(el=>el.dataset.cid===c.id);const last=marks.at(-1);if(last){const b=document.createElement('button');b.type='button';b.className='research-footnote';b.dataset.commentMarker='true';b.dataset.cid=c.id;b.textContent='▤';b.title=c.text;b.setAttribute('aria-label','打开批注：'+c.text);last.after(b);}}
        });
    }

    /* ---------- Render ---------- */

    function render(pageEntries, totalPages) {
        loadSortPref();
        document.body.classList.add('word-mode-active');

        const container = document.getElementById('entries-container');
        if (!container) return;

        const source = pageEntries || [];
        const tagCounts = new Map();
        source.forEach(entry => (entry.keywords || []).forEach(tag => {
            if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }));
        const availableTags = [...tagCounts.keys()].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        const list = sortEntries(source.filter(entry => !tagFilter || (entry.keywords || []).includes(tagFilter)));
        if (!list.length) {
            container.innerHTML = `<div class="word-view entering" style="opacity:1">
                <div class="word-view-placeholder">
                    <span class="material-icons">menu_book</span>
                    <h3>阅读视图</h3>
                    <p>${tagFilter ? `当前没有带“${esc(tagFilter)}”标签的史料。` : '当前筛选下没有史料。请先添加条目或调整筛选条件。'}</p>
                    ${tagFilter ? '<button type="button" class="primary-btn" id="word-clear-tag-filter">显示全部标签</button>' : ''}
                </div>
            </div>`;
            document.getElementById('word-clear-tag-filter')?.addEventListener('click', () => setTagFilter(''));
            hideSelectionToolbar();
            return;
        }

        if (!activeId || !list.some(e => e.id === activeId)) {
            activeId = list[0].id;
            tocPage = 1;
        }

        if (syncTocPageToActive) {
            const activeIndex = list.findIndex(e => e.id === activeId);
            if (activeIndex >= 0) tocPage = Math.floor(activeIndex / tocPageSize) + 1;
            syncTocPageToActive = false;
        }
        const tocTotalPages = Math.max(1, Math.ceil(list.length / tocPageSize));
        tocPage = Math.max(1, Math.min(tocPage, tocTotalPages));
        const tocEntries = list.slice((tocPage - 1) * tocPageSize, tocPage * tocPageSize);

        const entry = list.find(e => e.id === activeId) || list[0];
        activeId = entry.id;

        if (typeof V2Nav !== 'undefined') V2Nav.trackRecent(entry.id);

        const citation = (window.V2Citations && V2Citations.getDisplayCitation(entry)) || entry.citation || entry.title || '';
        const typeLabel = (window.V2SourceTypes && V2SourceTypes.typeName(entry.typeId)) || '';
        const tags = (entry.keywords || []).map(kw =>
            `<span class="keyword-tag" style="background:${V2Utils.tagColor(kw)};color:#fff;border:none">#${esc(kw)}</span>`
        ).join(' ');
        const comments = V2Comments.commentsOf(entry);
        const commentCount = comments.filter(c => !c.resolved).length;

        container.innerHTML = `
            <div class="word-view entering" style="opacity:1;transform:none">
                <div class="word-mode">
                    <aside class="word-toc-panel" id="reader-toc-panel">
                        <div class="word-toc-toolbar">
                            <div class="word-toc-title-row">
                                <span>目录</span>
                                <span class="word-toc-count">${list.length}</span>
                            </div>
                            <div class="word-toc-sort">
                                <select id="word-sort-by" title="排序">
                                    ${SORT_OPTIONS.map(o => `<option value="${o.id}" ${o.id === sortBy ? 'selected' : ''}>${o.label}</option>`).join('')}
                                </select>
                                <button type="button" class="icon-btn" id="word-sort-dir" title="${sortAsc ? '升序' : '降序'}">
                                    <span class="material-icons">${sortAsc ? 'arrow_upward' : 'arrow_downward'}</span>
                                </button>
                            </div>
                            <label class="word-toc-tag-filter">
                                <span>显示标签</span>
                                <select id="word-tag-filter" aria-label="按标签筛选阅读条目">
                                    <option value="">全部标签（${source.length}）</option>
                                    ${availableTags.map(tag => `<option value="${esc(tag)}" ${tag === tagFilter ? 'selected' : ''}>${esc(tag)}（${tagCounts.get(tag)}）</option>`).join('')}
                                </select>
                            </label>
                        </div>
                        <div class="word-toc-list" id="word-toc-list">
                            ${tocEntries.map(e => {
                                const n = V2Comments.commentsOf(e).filter(c => !c.resolved).length;
                                return `<button type="button" class="word-toc-item ${e.id === entry.id ? 'active' : ''}" data-id="${e.id}">
                                    <span class="word-toc-item-title">${esc(e.title || '无标题')}</span>
                                    <span class="word-toc-item-meta">
                                        ${esc(authorOf(e) || e.date || e.id)}
                                        ${n ? `<span class="word-toc-badge">${n}</span>` : ''}
                                    </span>
                                </button>`;
                            }).join('')}
                        </div>
                        <div class="word-toc-pagination" aria-label="阅读目录分页">
                            <div class="word-toc-page-nav">
                                <button type="button" id="word-toc-prev" aria-label="上一页" title="上一页" ${tocPage === 1 ? 'disabled' : ''}><span class="material-icons">chevron_left</span></button>
                                <span><strong>${tocPage}</strong> / ${tocTotalPages}</span>
                                <button type="button" id="word-toc-next" aria-label="下一页" title="下一页" ${tocPage === tocTotalPages ? 'disabled' : ''}><span class="material-icons">chevron_right</span></button>
                            </div>
                            <label class="word-toc-page-size">每页 <input id="word-toc-page-size" type="number" inputmode="numeric" min="1" max="100" step="1" value="${tocPageSize}" aria-label="阅读目录每页条数"> 条</label>
                        </div>
                    </aside>

                    <section class="word-doc-panel${lastRenderedId !== entry.id ? ' reader-content-enter' : ''}">
                        <header class="word-doc-header">
                            ${typeLabel ? `<span class="v2-type-badge">${esc(typeLabel)}</span>` : ''}
                            <h1 class="word-doc-title">${esc(entry.title || '无标题')}</h1>
                            <div class="word-doc-citation">${esc(citation)}</div>
                            <div class="word-doc-actions">
                                <button type="button" class="reader-panel-toggle" data-reader-panel="toc" aria-controls="reader-toc-panel" aria-expanded="${panelExpanded('toc')}" onclick="V2Word.togglePanel('toc')" title="展开或收起目录"><span class="material-icons">list</span>目录</button>
                                <button type="button" class="reader-panel-toggle" data-reader-panel="notes" aria-controls="reader-notes-panel" aria-expanded="${panelExpanded('notes')}" onclick="V2Word.togglePanel('notes')" title="展开或收起批注"><span class="material-icons">edit_note</span>批注</button>
                                <button type="button" class="icon-btn" onclick="editEntry('${entry.id}')" title="编辑"><span class="material-icons">edit</span></button>
                                <button type="button" class="icon-btn" onclick="V2Views.toggleStar('${entry.id}')" title="收藏"><span class="material-icons">${entry.starred ? 'star' : 'star_border'}</span></button>
                                <button type="button" class="icon-btn" onclick="V2Views.copyCitation('${entry.id}')" title="复制引用"><span class="material-icons">content_copy</span></button>
                            </div>
                        </header>
                        <article class="word-doc-paper">
                            <div class="word-doc-hint">选中文字后可添加批注</div>
                            <div id="word-body" class="word-body" data-entry-id="${entry.id}">${entry.content || '<p>（暂无原文）</p>'}</div>
                            ${tags ? `<div class="word-view-section-label">标签</div><div class="word-doc-tags">${tags}</div>` : ''}
                            ${entry.analysis ? `<div class="word-view-section-label">分析</div><div class="word-body word-analysis">${entry.analysis}</div>` : ''}
                        </article>
                    </section>

                    <aside class="word-notes-panel" id="reader-notes-panel">
                        <div class="word-notes-toolbar">
                            <div class="word-notes-title-row">
                                <span>批注</span>
                                <span class="word-toc-count">${commentCount}</span>
                            </div>
                            <input type="search" id="word-comment-search" placeholder="搜索批注…" value="${esc(commentFilter)}">
                            <label class="word-notes-toggle">
                                <input type="checkbox" id="word-show-resolved" ${showResolved ? 'checked' : ''}>
                                显示已解决
                            </label>
                            <div class="word-author-row">
                                <span class="material-icons">person</span>
                                <input type="text" id="word-author-name" value="${esc(V2Comments.getAuthorName())}" placeholder="署名" title="批注署名">
                            </div>
                        </div>
                        <div class="word-notes-list" id="word-notes-list">
                            ${renderCommentsList(comments)}
                        </div>
                    </aside>
                </div>
            </div>
            <div id="word-sel-toolbar" class="word-sel-toolbar" style="display:none">
                <button type="button" id="word-add-comment-btn"><span class="material-icons">add_comment</span> 添加批注</button>
            </div>
            <div id="word-comment-dialog" class="word-comment-dialog" style="display:none"></div>
        `;

        lastRenderedId = entry.id;
        const bodyEl = document.getElementById('word-body');
        if (bodyEl) applyHighlights(bodyEl, comments);
        const analysisEl=document.querySelector('.word-analysis');if(analysisEl)applyHighlights(analysisEl,comments);
        const noteList = document.getElementById('word-notes-list');
        if (noteList) noteList.innerHTML = renderCommentsList(comments);

        bindWordUi(list, tocTotalPages);
        syncPanels();
        if (typeof updatePagination === 'function' && totalPages) {
            updatePagination(totalPages);
        }
        if (window.V2Views) V2Views.updateInfoPanel(entry.id);
    }

    function renderCommentsList(comments) {
        const q = (commentFilter || '').toLowerCase();
        let list = comments.slice();
        if (!showResolved) list = list.filter(c => !c.resolved);
        if (q) {
            list = list.filter(c =>
                (c.text || '').toLowerCase().includes(q) ||
                (c.quote || '').toLowerCase().includes(q) ||
                (c.authorName || '').toLowerCase().includes(q) ||
                (c.replies || []).some(r => (r.text || '').toLowerCase().includes(q))
            );
        }
        if (!list.length) {
            return `<div class="word-notes-empty">暂无批注。在正文中选中文字即可添加。</div>`;
        }
        return list.map(c => {
            const collapsed = c.collapsed;
            return `<div class="word-note ${c.resolved ? 'resolved' : ''} ${c.id === activeCommentId ? 'active' : ''} word-note-${c.color || 'yellow'}" data-cid="${c.id}">
                <div class="word-note-head" onclick="V2Word.focusComment('${c.id}')">
                    <span class="word-note-color" data-color="${c.color || 'yellow'}"></span>
                    <strong>${esc(c.authorName || '匿名')}</strong>
                    <time>${formatTime(c.createdAt)}</time>
                    <button type="button" class="icon-btn word-note-fold" onclick="event.stopPropagation();V2Word.toggleCollapse('${c.id}')" title="折叠">
                        <span class="material-icons">${collapsed ? 'unfold_more' : 'unfold_less'}</span>
                    </button>
                </div>
                ${c.anchorLost ? `<p class="ed-anchor-lost">原文已变化。选中正确原文后，<button type="button" onclick="V2Word.reanchor('${c.id}')">重新关联</button></p>` : ''}
                ${c.quote ? `<div class="word-note-quote" onclick="V2Word.focusComment('${c.id}')">“${esc(c.quote)}”</div>` : ''}
                ${collapsed ? '' : `
                    <div class="word-note-text">${esc(c.text)}</div>
                    <div class="word-note-replies">
                        ${(c.replies || []).map(r => `
                            <div class="word-reply">
                                <strong>${esc(r.authorName)}</strong>
                                <span>${esc(r.text)}</span>
                                <button type="button" class="icon-btn" onclick="V2Word.removeReply('${c.id}','${r.id}')" title="删除回复"><span class="material-icons">close</span></button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="word-note-actions">
                        <button type="button" class="icon-btn" onclick="V2Word.replyTo('${c.id}')" title="回复"><span class="material-icons">reply</span></button>
                        <button type="button" class="icon-btn" onclick="V2Word.editComment('${c.id}')" title="修改"><span class="material-icons">edit</span></button>
                        <button type="button" class="icon-btn" onclick="V2Word.toggleResolve('${c.id}')" title="${c.resolved ? '重开' : '解决'}">
                            <span class="material-icons">${c.resolved ? 'restart_alt' : 'check_circle'}</span>
                        </button>
                        <div class="word-color-picks">
                            ${V2Comments.COLORS.map(col => `
                                <button type="button" class="word-color-dot word-hl-${col} ${c.color === col ? 'on' : ''}"
                                    onclick="V2Word.setColor('${c.id}','${col}')" title="${col}"></button>
                            `).join('')}
                        </div>
                        <button type="button" class="icon-btn" onclick="V2Word.removeComment('${c.id}')" title="删除"><span class="material-icons">delete</span></button>
                    </div>
                `}
            </div>`;
        }).join('');
    }

    function formatTime(ts) {
        if (!ts) return '';
        try {
            return new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ''; }
    }

    function bindWordUi(list, tocTotalPages) {
        document.getElementById('word-sort-by')?.addEventListener('change', (e) => {
            sortBy = e.target.value;
            saveSortPref();
            refresh();
        });
        document.getElementById('word-sort-dir')?.addEventListener('click', () => {
            sortAsc = !sortAsc;
            saveSortPref();
            refresh();
        });
        document.getElementById('word-tag-filter')?.addEventListener('change', (e) => {
            setTagFilter(e.target.value);
        });
        const changeTocPage = next => {
            const page = Math.max(1, Math.min(Number(next) || 1, tocTotalPages));
            if (page === tocPage) return;
            tocPage = page;
            refresh();
        };
        document.getElementById('word-toc-prev')?.addEventListener('click', () => changeTocPage(tocPage - 1));
        document.getElementById('word-toc-next')?.addEventListener('click', () => changeTocPage(tocPage + 1));
        const pageSizeInput = document.getElementById('word-toc-page-size');
        const applyPageSize = () => {
            const size = Number(pageSizeInput?.value);
            if (!Number.isSafeInteger(size) || size < 1 || size > 100) {
                pageSizeInput?.reportValidity();
                return;
            }
            if (size === tocPageSize) return;
            const firstVisibleIndex = (tocPage - 1) * tocPageSize;
            tocPageSize = size;
            tocPage = Math.floor(firstVisibleIndex / tocPageSize) + 1;
            savePageSizePref();
            refresh();
        };
        pageSizeInput?.addEventListener('change', applyPageSize);
        pageSizeInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyPageSize(); } });
        document.getElementById('word-toc-list')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.word-toc-item');
            if (!btn) return;
            activeId = btn.dataset.id;
            pendingSelection = null;
            activeCommentId = null;
            if (matchMedia('(max-width: 900px)').matches) document.body.classList.remove('reader-toc-open');
            refresh();
        });
        document.getElementById('word-comment-search')?.addEventListener('input', (e) => {
            commentFilter = e.target.value;
            const entry = entries.find(x => x.id === activeId);
            const listEl = document.getElementById('word-notes-list');
            if (listEl && entry) listEl.innerHTML = renderCommentsList(V2Comments.commentsOf(entry));
        });
        document.getElementById('word-show-resolved')?.addEventListener('change', (e) => {
            showResolved = e.target.checked;
            refreshNotesOnly();
        });
        document.getElementById('word-author-name')?.addEventListener('change', (e) => {
            V2Comments.setAuthorName(e.target.value);
        });

        for(const body of document.querySelectorAll('#word-body,.word-analysis')) {
            body.addEventListener('mouseup', onBodyMouseUp);
            body.addEventListener('click', (e) => {
                const mark = e.target.closest('[data-cid]');
                if (mark && mark.dataset.cid) focusComment(mark.dataset.cid);
            });
        }

        document.getElementById('word-add-comment-btn')?.addEventListener('click', openAddDialog);

        if (!bound) {
            document.addEventListener('mousedown', (e) => {
                if (!e.target.closest('#word-sel-toolbar') && !e.target.closest('#word-comment-dialog')) {
                    // keep selection until dialog; toolbar hide on outside except body
                    if (!e.target.closest('#word-body') && !e.target.closest('#word-sel-toolbar')) {
                        hideSelectionToolbar();
                    }
                }
            });
            bound = true;
        }
    }

    function onBodyMouseUp(e) {
        const body = e.currentTarget;
        const sel = window.getSelection();
        if (!body || !sel || sel.isCollapsed || !sel.rangeCount) {
            hideSelectionToolbar();
            return;
        }
        const range = sel.getRangeAt(0);
        if (!body.contains(range.commonAncestorContainer)) {
            hideSelectionToolbar();
            return;
        }
        const quote = sel.toString().trim();
        if (!quote) {
            hideSelectionToolbar();
            return;
        }
        const startOffset = getPlainOffset(body, range.startContainer, range.startOffset);
        const endOffset = getPlainOffset(body, range.endContainer, range.endOffset);
        pendingSelection = { quote, startOffset, endOffset,section:body.classList.contains('word-analysis')?'analysis':'content' };
        showSelectionToolbar(e.clientX, e.clientY);
    }

    function showSelectionToolbar(x, y) {
        const bar = document.getElementById('word-sel-toolbar');
        if (!bar) return;
        bar.style.display = 'flex';
        const left = Math.min(window.innerWidth - 160, Math.max(8, x - 40));
        const top = Math.max(8, y - 48);
        bar.style.left = left + 'px';
        bar.style.top = top + 'px';
    }

    function hideSelectionToolbar() {
        const bar = document.getElementById('word-sel-toolbar');
        if (bar) bar.style.display = 'none';
    }

    function openAddDialog() {
        if (!pendingSelection || !activeId) return;
        hideSelectionToolbar();
        const dialog = document.getElementById('word-comment-dialog');
        if (!dialog) return;
        dialog.style.display = 'block';
        dialog.innerHTML = `
            <h3>添加批注</h3>
            <div class="word-note-quote">“${esc(pendingSelection.quote.slice(0, 200))}${pendingSelection.quote.length > 200 ? '…' : ''}”</div>
            <div class="word-color-picks" id="word-new-colors">
                ${V2Comments.COLORS.map((col, i) => `
                    <button type="button" class="word-color-dot word-hl-${col} ${i === 0 ? 'on' : ''}" data-color="${col}"></button>
                `).join('')}
            </div>
            <textarea id="word-new-text" rows="4" placeholder="写下你的批注…"></textarea>
            <div class="action-buttons">
                <button type="button" class="primary-btn" id="word-new-save">保存</button>
                <button type="button" class="cancel-btn" id="word-new-cancel">取消</button>
            </div>
        `;
        let color = 'yellow';
        dialog.querySelectorAll('#word-new-colors .word-color-dot').forEach(btn => {
            btn.onclick = () => {
                color = btn.dataset.color;
                dialog.querySelectorAll('.word-color-dot').forEach(b => b.classList.toggle('on', b === btn));
            };
        });
        document.getElementById('word-new-cancel').onclick = () => { dialog.style.display = 'none'; };
        document.getElementById('word-new-save').onclick = async () => {
            const text = document.getElementById('word-new-text').value;
            try {
                const c = await V2Comments.addComment(activeId, Object.assign({}, pendingSelection, { text, color }));
                pendingSelection = null;
                dialog.style.display = 'none';
                activeCommentId = c.id;
                window.getSelection()?.removeAllRanges();
                refresh();
            } catch (err) {
                if (typeof showAlert === 'function') showAlert(err.message, 'error');
            }
        };
        setTimeout(() => document.getElementById('word-new-text')?.focus(), 50);
    }

    function refresh() {
        if (typeof renderEntries === 'function') {
            renderEntries();
        }
    }

    function refreshNotesOnly() {
        const entry = (typeof entries !== 'undefined') ? entries.find(e => e.id === activeId) : null;
        const listEl = document.getElementById('word-notes-list');
        if (listEl && entry) listEl.innerHTML = renderCommentsList(V2Comments.commentsOf(entry));
        const body = document.getElementById('word-body');
        if (body && entry) applyHighlights(body, V2Comments.commentsOf(entry));
        const analysis=document.querySelector('.word-analysis');if(analysis&&entry)applyHighlights(analysis,V2Comments.commentsOf(entry));
    }

    function focusComment(cid) {
        activeCommentId = cid;
        if(!panelExpanded('notes'))togglePanel('notes');
        refreshNotesOnly();
        const note = document.querySelector(`.word-note[data-cid="${cid}"]`);
        note?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        note?.classList.add('active');
        const mark = document.querySelector(`mark.word-hl[data-cid="${cid}"]`);
        if (mark) {
            mark.classList.add('word-hl-flash');
            mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setTimeout(() => mark.classList.remove('word-hl-flash'), 1200);
        }
    }

    async function toggleCollapse(cid) {
        const entry = entries.find(e => e.id === activeId);
        const c = V2Comments.commentsOf(entry).find(x => x.id === cid);
        if (!c) return;
        await V2Comments.updateComment(activeId, cid, { collapsed: !c.collapsed });
        refreshNotesOnly();
    }

    async function toggleResolve(cid) {
        const entry = entries.find(e => e.id === activeId);
        const c = V2Comments.commentsOf(entry).find(x => x.id === cid);
        if (!c) return;
        await V2Comments.updateComment(activeId, cid, { resolved: !c.resolved });
        refresh();
    }

    async function setColor(cid, color) {
        await V2Comments.updateComment(activeId, cid, { color });
        refreshNotesOnly();
    }

    async function removeComment(cid) {
        if (!confirm('确定删除该批注？')) return;
        await V2Comments.deleteComment(activeId, cid);
        if (activeCommentId === cid) activeCommentId = null;
        refresh();
    }

    async function editComment(cid) {
        const entry = entries.find(e => e.id === activeId);
        const c = V2Comments.commentsOf(entry).find(x => x.id === cid);
        if (!c) return;
        const text = prompt('修改批注内容：', c.text);
        if (text == null) return;
        if (!text.trim()) {
            if (typeof showAlert === 'function') showAlert('内容不能为空', 'warning');
            return;
        }
        await V2Comments.updateComment(activeId, cid, { text: text.trim() });
        refreshNotesOnly();
    }

    async function replyTo(cid) {
        const text = prompt('回复：');
        if (text == null || !text.trim()) return;
        await V2Comments.addReply(activeId, cid, text.trim());
        refreshNotesOnly();
    }

    async function removeReply(cid, rid) {
        if (!confirm('删除这条回复？')) return;
        await V2Comments.deleteReply(activeId, cid, rid);
        refreshNotesOnly();
    }

    function setActiveEntry(id) {
        activeId = id;
        syncTocPageToActive = true;
        refresh();
    }

    function exitWordMode() {
        document.body.classList.remove('word-mode-active');
        hideSelectionToolbar();
    }

    // When leaving word view, clean up
    const origChange = global.changeViewMode;
    function patchChangeView() {
        if (typeof global.changeViewMode !== 'function') return;
        if (global.changeViewMode._v2WordPatched) return;
        const prev = global.changeViewMode;
        global.changeViewMode = function (mode) {
            if (mode !== 'word') exitWordMode();
            return prev.apply(this, arguments);
        };
        global.changeViewMode._v2WordPatched = true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(patchChangeView, 0));
    } else {
        setTimeout(patchChangeView, 0);
    }
    document.addEventListener('firebaseReady', () => setTimeout(patchChangeView, 200));

    async function reanchor(id) {
        if (!pendingSelection || !activeId) { showAlert('请先在正文选中新的批注位置', 'info'); return; }
        await V2Comments.updateComment(activeId, id, { ...pendingSelection, anchorLost: false });
        pendingSelection = null; refresh();
    }
    global.V2Word = { reanchor, togglePanel,
        render,
        refresh,
        setTagFilter,
        setActiveEntry,
        focusComment,
        toggleCollapse,
        toggleResolve,
        setColor,
        removeComment,
        editComment,
        replyTo,
        removeReply,
        exitWordMode,
        getActiveId: () => activeId,
        getTagFilter: () => tagFilter
    };
})(window);
