/**
 * V2.4 — Related sources + knowledge network visualization
 * Entry field: relatedSources: string[] (entry ids this item cites / links to)
 */
(function (global) {
    'use strict';

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function relatedOf(entry) {
        if (!entry) return [];
        const r = entry.relatedSources;
        if (Array.isArray(r)) return r.filter(Boolean);
        if (r && typeof r === 'object') return Object.keys(r).filter(k => r[k]);
        return [];
    }

    async function setRelated(entryId, ids) {
        if (typeof db === 'undefined' || typeof getProjectPath !== 'function') {
            throw new Error('数据库未就绪');
        }
        const clean = [...new Set((ids || []).filter(id => id && id !== entryId))];
        await db.ref(getProjectPath(`entries/${entryId}/relatedSources`)).set(clean);
        const entry = entries.find(e => e.id === entryId);
        if (entry) entry.relatedSources = clean;
        document.dispatchEvent(new CustomEvent('v2RelationsChanged', { detail: { entryId } }));
        return clean;
    }

    async function addRelation(fromId, toId) {
        const entry = entries.find(e => e.id === fromId);
        if (!entry) throw new Error('找不到条目');
        const list = relatedOf(entry);
        if (!list.includes(toId)) list.push(toId);
        return setRelated(fromId, list);
    }

    async function removeRelation(fromId, toId) {
        const entry = entries.find(e => e.id === fromId);
        if (!entry) return;
        return setRelated(fromId, relatedOf(entry).filter(id => id !== toId));
    }

    function buildGraph(list) {
        const nodes = new Map();
        const links = [];
        (list || entries || []).forEach(e => {
            nodes.set(e.id, {
                id: e.id,
                title: e.title || e.id,
                typeId: e.typeId || 'general',
                degree: 0
            });
        });
        nodes.forEach((_, id) => {
            const entry = entries.find(e => e.id === id);
            relatedOf(entry).forEach(to => {
                if (!nodes.has(to)) {
                    const t = entries.find(e => e.id === to);
                    if (t) {
                        nodes.set(to, {
                            id: to,
                            title: t.title || to,
                            typeId: t.typeId || 'general',
                            degree: 0
                        });
                    } else {
                        return;
                    }
                }
                links.push({ source: id, target: to });
                nodes.get(id).degree++;
                nodes.get(to).degree++;
            });
        });
        return { nodes: [...nodes.values()], links };
    }

    /* ---------- Relation editor (for form / info panel) ---------- */

    function renderRelationPicker(entryId, container) {
        if (!container) return;
        const entry = entries.find(e => e.id === entryId);
        const related = relatedOf(entry);
        const options = entries
            .filter(e => e.id !== entryId)
            .slice()
            .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));

        container.innerHTML = `
            <div class="v2-rel-editor">
                <div class="v2-rel-current">
                    ${related.length ? related.map(id => {
                        const t = entries.find(e => e.id === id);
                        return `<span class="v2-rel-chip">
                            <button type="button" class="v2-rel-open" data-id="${esc(id)}">${esc(t?.title || id)}</button>
                            <button type="button" class="v2-rel-del" data-id="${esc(id)}" title="移除">×</button>
                        </span>`;
                    }).join('') : '<span class="v2-rel-empty">暂无关联文献</span>'}
                </div>
                <div class="v2-rel-add-row">
                    <input type="search" class="v2-rel-search" placeholder="搜索并添加关联…">
                    <select class="v2-rel-select">
                        <option value="">选择史料…</option>
                        ${options.map(e => `<option value="${esc(e.id)}">${esc(e.title || e.id)}</option>`).join('')}
                    </select>
                    <button type="button" class="primary-btn btn-icon-only v2-rel-add-btn" title="添加"><span class="material-icons">add_link</span></button>
                </div>
            </div>
        `;

        const select = container.querySelector('.v2-rel-select');
        const search = container.querySelector('.v2-rel-search');
        search?.addEventListener('input', () => {
            const q = search.value.toLowerCase();
            [...select.options].forEach((opt, i) => {
                if (i === 0) return;
                opt.hidden = q && !opt.textContent.toLowerCase().includes(q);
            });
        });
        container.querySelector('.v2-rel-add-btn')?.addEventListener('click', async () => {
            const to = select.value;
            if (!to) return;
            try {
                await addRelation(entryId, to);
                renderRelationPicker(entryId, container);
                if (typeof showAlert === 'function') showAlert('已添加关联', 'success');
            } catch (err) {
                if (typeof showAlert === 'function') showAlert(err.message, 'error');
            }
        });
        container.querySelectorAll('.v2-rel-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                await removeRelation(entryId, btn.dataset.id);
                renderRelationPicker(entryId, container);
            });
        });
        container.querySelectorAll('.v2-rel-open').forEach(btn => {
            btn.addEventListener('click', () => openEntry(btn.dataset.id));
        });
    }

    function openEntry(id) {
        if (typeof currentViewMode !== 'undefined' && currentViewMode === 'word' && window.V2Word) {
            V2Word.setActiveEntry(id);
            return;
        }
        if (typeof editEntry === 'function') {
            // Prefer selecting in list; jump via filter
            if (window.V2Views) V2Views.selectEntry(id);
            const el = document.querySelector(`[data-id="${id}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else if (typeof editEntry === 'function') editEntry(id);
        }
    }

    /* ---------- Graph modal ---------- */

    function ensureModal() {
        if (document.getElementById('v2-knowledge-graph')) return;
        const modal = document.createElement('div');
        modal.id = 'v2-knowledge-graph';
        modal.className = 'form-popup v2-knowledge-graph';
        modal.style.display = 'none';
        modal.innerHTML = `
            <h2>知识网络</h2>
            <p class="v2-kg-desc">展示史料之间的「引用 / 关联」关系。点击节点可打开该条；在条目编辑中可添加关联。</p>
            <div class="v2-kg-toolbar">
                <label><input type="checkbox" id="v2-kg-filtered" checked> 仅当前筛选</label>
                <button type="button" class="primary-btn btn-outline" id="v2-kg-refresh">刷新</button>
                <button type="button" class="cancel-btn btn-icon-only" id="v2-kg-close" title="关闭"><span class="material-icons">close</span></button>
            </div>
            <div class="v2-kg-layout">
                <svg id="v2-kg-svg" class="v2-kg-svg"></svg>
                <aside class="v2-kg-side">
                    <div id="v2-kg-stats" class="v2-kg-stats"></div>
                    <div id="v2-kg-detail" class="v2-kg-detail">点击节点查看详情</div>
                </aside>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('v2-kg-close').onclick = hide;
        document.getElementById('v2-kg-refresh').onclick = () => draw();
        document.getElementById('v2-kg-filtered').onchange = () => draw();
    }

    function show() {
        ensureModal();
        const modal = document.getElementById('v2-knowledge-graph');
        modal.style.display = 'block';
        modal.classList.remove('closing');
        draw();
    }

    function hide() {
        const modal = document.getElementById('v2-knowledge-graph');
        if (!modal) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 180);
    }

    function draw() {
        const svg = document.getElementById('v2-kg-svg');
        const stats = document.getElementById('v2-kg-stats');
        if (!svg) return;

        const onlyFiltered = document.getElementById('v2-kg-filtered')?.checked;
        const base = onlyFiltered && typeof getFilteredEntries === 'function'
            ? getFilteredEntries()
            : (entries || []);
        const graph = buildGraph(base);

        const width = svg.clientWidth || 640;
        const height = Math.max(420, svg.clientHeight || 420);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = '';

        stats.innerHTML = `
            <div><strong>${graph.nodes.length}</strong> 节点</div>
            <div><strong>${graph.links.length}</strong> 关联</div>
            <div><strong>${graph.nodes.filter(n => n.degree === 0).length}</strong> 孤立</div>
        `;

        if (!graph.nodes.length) {
            svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="currentColor">暂无数据</text>`;
            return;
        }

        // Simple force-ish layout: circular + jitter for linked
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.36;
        const pos = new Map();
        graph.nodes.forEach((n, i) => {
            const angle = (i / graph.nodes.length) * Math.PI * 2 - Math.PI / 2;
            const r = n.degree > 0 ? radius : radius * 0.55;
            pos.set(n.id, {
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r
            });
        });

        // One relaxation pass toward linked neighbors
        for (let iter = 0; iter < 40; iter++) {
            graph.links.forEach(l => {
                const a = pos.get(l.source);
                const b = pos.get(l.target);
                if (!a || !b) return;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 120) * 0.02;
                a.x += dx / dist * force;
                a.y += dy / dist * force;
                b.x -= dx / dist * force;
                b.y -= dy / dist * force;
            });
            // Keep in bounds
            pos.forEach(p => {
                p.x = Math.max(40, Math.min(width - 40, p.x));
                p.y = Math.max(40, Math.min(height - 40, p.y));
            });
        }

        const gLinks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graph.links.forEach(l => {
            const a = pos.get(l.source);
            const b = pos.get(l.target);
            if (!a || !b) return;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', a.x);
            line.setAttribute('y1', a.y);
            line.setAttribute('x2', b.x);
            line.setAttribute('y2', b.y);
            line.setAttribute('class', 'v2-kg-link');
            // arrow
            line.setAttribute('marker-end', 'url(#v2-kg-arrow)');
            gLinks.appendChild(line);
        });

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `<marker id="v2-kg-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-secondary)" />
        </marker>`;
        svg.appendChild(defs);
        svg.appendChild(gLinks);

        const gNodes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graph.nodes.forEach(n => {
            const p = pos.get(n.id);
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'v2-kg-node');
            g.style.cursor = 'pointer';
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', Math.min(22, 10 + n.degree * 2));
            circle.setAttribute('class', 'v2-kg-circle');
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', p.x);
            label.setAttribute('y', p.y + 28);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('class', 'v2-kg-label');
            label.textContent = (n.title || '').slice(0, 10) + ((n.title || '').length > 10 ? '…' : '');
            g.appendChild(circle);
            g.appendChild(label);
            g.addEventListener('click', () => showNodeDetail(n.id));
            g.addEventListener('dblclick', () => {
                hide();
                openEntry(n.id);
            });
            gNodes.appendChild(g);
        });
        svg.appendChild(gNodes);
    }

    function showNodeDetail(id) {
        const box = document.getElementById('v2-kg-detail');
        const entry = entries.find(e => e.id === id);
        if (!box || !entry) return;
        const outs = relatedOf(entry);
        const ins = entries.filter(e => relatedOf(e).includes(id));
        const typeName = window.V2SourceTypes ? V2SourceTypes.typeName(entry.typeId) : '';
        box.innerHTML = `
            <h4>${esc(entry.title || '无标题')}</h4>
            <p class="v2-kg-meta">${esc(entry.id)} · ${esc(entry.date || '')}${typeName ? ' · ' + esc(typeName) : ''}</p>
            ${entry.citation ? `<p class="v2-kg-cite">${esc(entry.citation)}</p>` : ''}
            <div class="v2-kg-rel-block">
                <strong>引用了（${outs.length}）</strong>
                <ul>${outs.map(rid => {
                    const t = entries.find(e => e.id === rid);
                    return `<li><a href="#" data-open="${esc(rid)}">${esc(t?.title || rid)}</a></li>`;
                }).join('') || '<li class="muted">无</li>'}</ul>
            </div>
            <div class="v2-kg-rel-block">
                <strong>被引用（${ins.length}）</strong>
                <ul>${ins.map(e => `<li><a href="#" data-open="${esc(e.id)}">${esc(e.title || e.id)}</a></li>`).join('') || '<li class="muted">无</li>'}</ul>
            </div>
            <div class="v2-kg-detail-actions">
                <button type="button" class="primary-btn" data-edit="${esc(id)}">编辑</button>
                <button type="button" class="primary-btn btn-outline" data-jump="${esc(id)}">打开</button>
            </div>
        `;
        box.querySelectorAll('[data-open]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                showNodeDetail(a.dataset.open);
            });
        });
        box.querySelector('[data-edit]')?.addEventListener('click', () => {
            hide();
            editEntry(id);
        });
        box.querySelector('[data-jump]')?.addEventListener('click', () => {
            hide();
            openEntry(id);
        });
    }

    /* ---------- Inject into entry form & info panel ---------- */

    function ensureFormRelations() {
        const form = document.querySelector('#entry-form form');
        if (!form || form.dataset.v2Rel === '1') return;
        const row = document.createElement('div');
        row.className = 'form-row v2-rel-form-row';
        row.innerHTML = `
            <label>关联文献：</label>
            <div id="v2-form-relations" class="v2-form-relations"></div>
        `;
        const actions = form.querySelector('.action-buttons');
        if (actions) form.insertBefore(row, actions);
        else form.appendChild(row);
        form.dataset.v2Rel = '1';
    }

    function syncFormRelations() {
        ensureFormRelations();
        const box = document.getElementById('v2-form-relations');
        if (!box) return;
        if (typeof editingId !== 'undefined' && editingId) {
            renderRelationPicker(editingId, box);
        } else {
            box.innerHTML = '<span class="v2-rel-empty">保存条目后可添加关联文献</span>';
        }
    }

    function patchInfoPanel() {
        if (!window.V2Views || V2Views.updateInfoPanel._v24) return;
        const orig = V2Views.updateInfoPanel;
        V2Views.updateInfoPanel = function (id) {
            orig(id);
            const panel = document.getElementById('v2-info-content');
            if (!panel || panel.style.display === 'none') return;
            const entry = entries.find(e => e.id === id);
            if (!entry) return;
            let block = panel.querySelector('.v2-info-relations');
            if (!block) {
                block = document.createElement('div');
                block.className = 'v2-info-section v2-info-relations';
                const actions = panel.querySelector('.v2-info-actions');
                if (actions) panel.insertBefore(block, actions);
                else panel.appendChild(block);
            }
            const outs = relatedOf(entry);
            const ins = entries.filter(e => relatedOf(e).includes(id));
            block.innerHTML = `
                <div class="v2-info-section-label">关联文献</div>
                <div class="v2-info-rel-list">
                    ${outs.map(rid => {
                        const t = entries.find(e => e.id === rid);
                        return `<button type="button" class="v2-rel-link" onclick="V2Knowledge.openEntry('${rid}')">${esc(t?.title || rid)}</button>`;
                    }).join('') || '<span style="color:var(--text-secondary);font-size:0.85rem">无出链</span>'}
                </div>
                ${ins.length ? `<div class="v2-info-section-label" style="margin-top:8px">被引用</div>
                    <div class="v2-info-rel-list">${ins.map(e =>
                        `<button type="button" class="v2-rel-link" onclick="V2Knowledge.openEntry('${e.id}')">${esc(e.title || e.id)}</button>`
                    ).join('')}</div>` : ''}
                <button type="button" class="primary-btn btn-outline" style="margin-top:8px;width:100%" onclick="V2Knowledge.show()">打开知识网络</button>
            `;
        };
        V2Views.updateInfoPanel._v24 = true;
    }

    function wireNav() {
        document.querySelectorAll('.v2-nav-item[data-nav="network"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                show();
            });
        });
    }

    function patchEdit() {
        if (typeof global.editEntry === 'function' && !global.editEntry._v24rel) {
            const orig = global.editEntry;
            global.editEntry = function (id) {
                const r = orig(id);
                setTimeout(syncFormRelations, 80);
                return r;
            };
            global.editEntry._v24rel = true;
        }
        if (typeof global.showForm === 'function' && !global.showForm._v24rel) {
            const orig = global.showForm;
            global.showForm = function () {
                const r = orig();
                setTimeout(syncFormRelations, 80);
                return r;
            };
            global.showForm._v24rel = true;
        }
    }

    function tryPatchEdit(attempt) {
        patchEdit();
        if ((!global.editEntry || !global.editEntry._v24rel) && (attempt || 0) < 40) {
            setTimeout(() => tryPatchEdit((attempt || 0) + 1), 50);
        }
    }

    function init() {
        wireNav();
        tryPatchEdit(0);
        patchInfoPanel();
        setTimeout(patchInfoPanel, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }
    document.addEventListener('firebaseReady', () => setTimeout(() => tryPatchEdit(0), 400));

    global.V2Knowledge = {
        show,
        hide,
        draw,
        relatedOf,
        setRelated,
        addRelation,
        removeRelation,
        buildGraph,
        openEntry,
        renderRelationPicker,
        syncFormRelations
    };
})(window);
