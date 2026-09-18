/**
 * V2 — Entry events + event-centric timeline
 */
(function (global) {
    'use strict';

    let PX_PER_DAY = 1;
    const MIN_SAME_DAY_GAP = 32;
    const TIMELINE_PAD_TOP = 48;
    const TIMELINE_PAD_BOTTOM = 80;

    let formEvents = [];
    let editingEventId = null;
    let patched = false;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function genEventId() {
        return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function normalizeEvents(raw) {
        if (!raw) return [];
        const list = Array.isArray(raw) ? raw : Object.values(raw);
        return list
            .filter(e => e && typeof e === 'object')
            .map(e => ({
                id: e.id || genEventId(),
                date: String(e.date || ''),
                description: String(e.description || '').trim(),
                createdAt: e.createdAt || Date.now()
            }))
            .filter(e => e.date && e.description);
    }

    function isValidDate(d) {
        return !!window.ResearchDates?.parse(d);
    }

    function setFormEvents(list) {
        formEvents = normalizeEvents(list);
        editingEventId = null;
        hideEditor();
        renderList();
    }

    function getFormEvents() {
        return formEvents.map(e => ({
            id: e.id,
            date: e.date,
            description: e.description,
            createdAt: e.createdAt || Date.now()
        }));
    }

    function listEl() {
        return document.getElementById('v2-events-list');
    }

    function editorEl() {
        return document.getElementById('v2-events-editor');
    }

    function hideEditor() {
        const ed = editorEl();
        if (!ed) return;
        ed.style.display = 'none';
        editingEventId = null;
        const date = document.getElementById('v2-event-date');
        const desc = document.getElementById('v2-event-desc');
        if (date) date.value = '';
        if (desc) desc.value = '';
    }

    function showEditor(event) {
        const ed = editorEl();
        if (!ed) return;
        ed.style.display = 'block';
        editingEventId = event ? event.id : null;
        const date = document.getElementById('v2-event-date');
        const desc = document.getElementById('v2-event-desc');
        if (date) date.value = event ? event.date : '';
        if (desc) desc.value = event ? event.description : '';
        if (date) date.focus();
    }

    function renderList() {
        const el = listEl();
        if (!el) return;

        if (!formEvents.length) {
            el.innerHTML = '<div class="v2-events-empty">暂无关联事件</div>';
            return;
        }

        const sorted = [...formEvents].sort((a, b) => String(a.date).localeCompare(String(b.date)));
        el.innerHTML = sorted.map(ev => `
            <div class="v2-event-item" data-id="${esc(ev.id)}">
                <div class="v2-event-item-main">
                    <span class="v2-event-item-date">${esc(ev.date)}</span>
                    <span class="v2-event-item-desc">${esc(ev.description)}</span>
                </div>
                <div class="v2-event-item-actions">
                    <button type="button" class="icon-btn" data-action="edit" title="编辑"><span class="material-icons">edit</span></button>
                    <button type="button" class="icon-btn" data-action="delete" title="删除"><span class="material-icons">delete</span></button>
                </div>
            </div>
        `).join('');
    }

    function saveEditor() {
        const date = (document.getElementById('v2-event-date')?.value || '').trim();
        const description = (document.getElementById('v2-event-desc')?.value || '').trim();

        if (!isValidDate(date)) {
            if (typeof showAlert === 'function') showAlert('请填写有效事件日期，可用年月日、年份、区间或“不详”', 'warning');
            return;
        }
        if (!description) {
            if (typeof showAlert === 'function') showAlert('事件描述不能为空', 'warning');
            return;
        }

        if (editingEventId) {
            const idx = formEvents.findIndex(e => e.id === editingEventId);
            if (idx >= 0) {
                formEvents[idx] = {
                    ...formEvents[idx],
                    date,
                    description
                };
            }
        } else {
            formEvents.push({
                id: genEventId(),
                date,
                description,
                createdAt: Date.now()
            });
        }

        hideEditor();
        renderList();
    }

    function deleteEvent(id) {
        if (!confirm('确定删除该关联事件？')) return;
        formEvents = formEvents.filter(e => e.id !== id);
        if (editingEventId === id) hideEditor();
        renderList();
    }

    function bindFormUI() {
        const list = listEl();
        if (list && !list.dataset.v2Bound) {
            list.dataset.v2Bound = '1';
            list.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                const item = e.target.closest('.v2-event-item');
                if (!btn || !item) return;
                const id = item.dataset.id;
                const ev = formEvents.find(x => x.id === id);
                if (btn.dataset.action === 'edit' && ev) showEditor(ev);
                if (btn.dataset.action === 'delete') deleteEvent(id);
            });
        }

        const addBtn = document.getElementById('v2-event-add-btn');
        if (addBtn && !addBtn.dataset.v2Bound) {
            addBtn.dataset.v2Bound = '1';
            addBtn.addEventListener('click', () => showEditor(null));
        }

        const saveBtn = document.getElementById('v2-event-save-btn');
        if (saveBtn && !saveBtn.dataset.v2Bound) {
            saveBtn.dataset.v2Bound = '1';
            saveBtn.addEventListener('click', saveEditor);
        }

        const cancelBtn = document.getElementById('v2-event-cancel-btn');
        if (cancelBtn && !cancelBtn.dataset.v2Bound) {
            cancelBtn.dataset.v2Bound = '1';
            cancelBtn.addEventListener('click', hideEditor);
        }
    }

    function dateToMs(dateStr) {
        if (!ResearchDates.parse(dateStr)?.start) return null;
        return Date.parse(ResearchDates.parse(dateStr).start + 'T00:00:00Z');
    }

    function daysBetween(d1, d2) {
        const ms1 = dateToMs(d1);
        const ms2 = dateToMs(d2);
        if (ms1 == null || ms2 == null) return 0;
        return (ms2 - ms1) / 86400000;
    }

    function collectAllEvents() {
        const all = [];
        const source = typeof getFilteredEntries === 'function'
            ? getFilteredEntries()
            : (typeof entries !== 'undefined' ? entries : []);
        source.forEach(entry => {
            normalizeEvents(entry.events).filter(ev => dateToMs(ev.date) !== null).forEach(ev => {
                all.push({
                    ...ev,
                    entryId: entry.id,
                    entryTitle: entry.title || '无标题'
                });
            });
        });
        all.sort((a, b) => {
            const c = dateToMs(a.date) - dateToMs(b.date);
            if (c !== 0) return c;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });
        return all;
    }

    function openEntryFromTimeline(entryId) {
        if (typeof editEntry === 'function') editEntry(entryId);
    }

    function buildTimelineLayout(events) {
        if (!events.length) {
            return { height: 0, positions: [], markers: [], rangeLabel: '' };
        }

        const positions = [];
        events.forEach((ev,i) => {
            const gap = i ? Math.min(600, Math.max(150, daysBetween(events[i-1].date, ev.date) * PX_PER_DAY)) : TIMELINE_PAD_TOP;
            positions.push((i ? positions[i-1] : 0) + gap);
        });
        const seen = new Set(), markers = [];
        events.forEach((ev,i) => { const year = ResearchDates.parse(ev.date).start.slice(0,4); if (!seen.has(year)) { seen.add(year); markers.push({year,top:Math.max(0,positions[i]-30)}); } });
        return { height: positions.at(-1) + 240, positions, markers, rangeLabel: events[0].date + ' — ' + events.at(-1).date, spanDays: daysBetween(events[0].date,events.at(-1).date) };
    }

    function renderTimelineItems(events, layout) {
        return events.map((ev, index) => {
            const side = index % 2 === 0 ? 'left' : 'right';
            return `
                <div class="timeline-item ${side} v2-timeline-item-proportional"
                     style="top:${layout.positions[index]}px"
                     data-event-id="${esc(ev.id)}" data-year="${ResearchDates.parse(ev.date)?.start?.slice(0,4) || ''}">
                    <div class="timeline-date">${esc(ev.date)}${ResearchDates.parse(ev.date)?.precision !== 'day' || ResearchDates.parse(ev.date)?.approximate ? '<small class="ed-date-uncertain"> · 非精确日期</small>' : ''}</div>
                    <div class="timeline-content v2-timeline-event-card" role="button" tabindex="0" title="点击查看所属条目">
                        <p class="v2-timeline-event-desc">${esc(ev.description)}</p>
                        <div class="v2-timeline-entry-source" hidden>
                            <span class="v2-timeline-entry-label">来自：</span>
                            <button type="button" class="v2-timeline-entry-link" data-entry-id="${esc(ev.entryId)}">《${esc(ev.entryTitle)}》</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderTimelineMarkers(markers) {
        return markers.map(m => `
            <div class="v2-timeline-year-mark" style="top:${m.top}px">
                <span class="v2-timeline-year-label">${m.year}</span>
            </div>
        `).join('');
    }

    function bindTimelineInteractions(root) {
        if (!root || root.dataset.v2TimelineBound) return;
        root.dataset.v2TimelineBound = '1';
        root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.v2-timeline-event-card')) { e.preventDefault(); e.target.click(); } });

        root.addEventListener('click', (e) => {
            const link = e.target.closest('.v2-timeline-entry-link');
            if (link?.dataset.entryId) {
                e.stopPropagation();
                openEntryFromTimeline(link.dataset.entryId);
                return;
            }

            const card = e.target.closest('.v2-timeline-event-card');
            if (!card) return;

            const source = card.querySelector('.v2-timeline-entry-source');
            if (!source) return;

            root.querySelectorAll('.v2-timeline-event-card.is-open').forEach(el => {
                if (el === card) return;
                el.classList.remove('is-open');
                const s = el.querySelector('.v2-timeline-entry-source');
                if (s) s.hidden = true;
            });

            const open = card.classList.toggle('is-open');
            source.hidden = !open;
        });
    }

    function exitTimelineMode() {
        document.body.classList.remove('timeline-mode-active');
    }

    function render() {
        document.body.classList.remove('word-mode-active');
        document.body.classList.add('timeline-mode-active');

        const container = document.getElementById('entries-container');
        if (!container) return;

        const allEvents = collectAllEvents();

        if (!allEvents.length) {
            container.innerHTML = `
                <div class="v2-timeline-view entering" style="opacity:1;transform:none">
                    <div class="v2-timeline-empty">
                        <span class="material-icons">timeline</span>
                        <p>暂无关联事件</p>
                        <p class="v2-timeline-empty-hint">在条目编辑中添加关联事件后显示时间轴。日期不详的事件保留在条目中。</p>
                    </div>
                </div>`;
            return;
        }

        const layout = buildTimelineLayout(allEvents);
        const scaleHint = layout.spanDays > 0
            ? `时间跨度 ${Math.round(layout.spanDays)} 天 · 长间隔压缩显示`
            : '同日事件';

        container.innerHTML = `
            <div class="v2-timeline-view entering" style="opacity:1;transform:none">
                <header class="v2-timeline-header">
                    <div class="v2-timeline-header-main">
                        <h2 class="v2-timeline-title">时间线视图</h2>
                        <span class="v2-timeline-count">共 ${allEvents.length} 个事件</span>
                    </div>
                    <div class="v2-timeline-meta">
                        <span class="v2-timeline-range">${esc(layout.rangeLabel)}</span>
                        <span class="v2-timeline-scale">${esc(scaleHint)}</span>
                        <label>跳转年份 <select id="ed-timeline-year">${layout.markers.map(m=>`<option value="${m.year}">${m.year}年</option>`).join('')}</select></label>
                        <label>间距 <input id="ed-timeline-zoom" aria-label="时间线间距" type="range" min="0.2" max="3" step="0.2" value="${PX_PER_DAY}"></label>
                    </div>
                </header>
                <div class="v2-timeline-body">
                    <div class="v2-timeline-track" style="height:${layout.height}px">
                        <div class="v2-timeline-axis-line" style="height:${layout.height}px"></div>
                        ${renderTimelineMarkers(layout.markers)}
                        <div class="timeline-container v2-timeline-proportional" style="height:${layout.height}px">
                            ${renderTimelineItems(allEvents, layout)}
                        </div>
                    </div>
                </div>
            </div>`;

        bindTimelineInteractions(container.querySelector('.v2-timeline-view'));
        document.getElementById('ed-timeline-year')?.addEventListener('change', e => container.querySelector(`[data-year="${e.target.value}"]`)?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
        document.getElementById('ed-timeline-zoom')?.addEventListener('change', e => { PX_PER_DAY = +e.target.value; render(); });
    }

    function showTimelineView() {
        if (typeof changeViewMode === 'function') {
            changeViewMode('timeline');
            return;
        }
        render();
    }

    function patchChangeViewMode() {
        if (typeof global.changeViewMode !== 'function') return;
        if (global.changeViewMode._v2TimelinePatched) return;
        const prev = global.changeViewMode;
        global.changeViewMode = function (mode) {
            if (mode !== 'timeline') exitTimelineMode();
            return prev.apply(this, arguments);
        };
        global.changeViewMode._v2TimelinePatched = true;
    }

    function eventBadgeHtml(entry) {
        const n = normalizeEvents(entry.events).length;
        if (!n) return '';
        return `<span class="v2-event-badge" title="${n} 个关联事件"><span class="material-icons">event</span>${n}</span>`;
    }

    function patchLegacy() {
        if (patched) return true;
        if (typeof global.getFormData !== 'function') return false;

        const origGet = global.getFormData;
        global.getFormData = function () {
            const data = origGet();
            const events = getFormEvents();
            // Firebase RTDB 对空数组不落库，用 null 表示清空
            data.events = events.length ? events : null;
            return data;
        };

        if (typeof global.editEntry === 'function') {
            const origEdit = global.editEntry;
            global.editEntry = function (id) {
                const entry = (typeof entries !== 'undefined' ? entries : []).find(e => e.id === id);
                const result = origEdit(id);
                setFormEvents(entry?.events || []);
                bindFormUI();
                return result;
            };
        }

        // 侧栏「新增史料」走 showForm；关闭后 performCloseForm 已清空 events
        // 若直接点新增且上次异常未关表，确保新建时不残留旧事件
        const addBtn = document.querySelector('.v2-nav-item[data-action="add"]');
        if (addBtn && !addBtn.dataset.v2EventsBound) {
            addBtn.dataset.v2EventsBound = '1';
            addBtn.addEventListener('click', () => setFormEvents([]), true);
        }

        if (typeof global.showForm === 'function') {
            const origShow = global.showForm;
            global.showForm = function () {
                const result = origShow();
                bindFormUI();
                renderList();
                return result;
            };
        }

        if (typeof global.populateForm === 'function') {
            const origPop = global.populateForm;
            global.populateForm = async function (data) {
                await origPop(data);
                setFormEvents(data?.events || []);
                bindFormUI();
            };
        }

        if (typeof global.performCloseForm === 'function') {
            const origClose = global.performCloseForm;
            global.performCloseForm = function () {
                setFormEvents([]);
                return origClose();
            };
        }

        global.showTimelineView = showTimelineView;
        patchChangeViewMode();
        patched = true;
        return true;
    }

    function tryPatch() {
        if (patchLegacy()) {
            bindFormUI();
            patchChangeViewMode();
            return;
        }
        setTimeout(tryPatch, 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryPatch);
    } else {
        tryPatch();
    }

    global.V2Events = {
        normalizeEvents,
        getFormEvents,
        setFormEvents,
        eventBadgeHtml,
        collectAllEvents,
        render,
        showTimelineView,
        openEntryFromTimeline,
        exitTimelineMode
    };
})(window);
