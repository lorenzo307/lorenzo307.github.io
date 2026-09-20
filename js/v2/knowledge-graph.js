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

    async function addRelation(fromId, toId, mode='single') {
        if(fromId===toId)throw new Error('不能关联自身');
        if(mode==='double'){
            const a=entries.find(e=>e.id===fromId),b=entries.find(e=>e.id===toId);
            if(!a||!b)throw new Error('找不到条目');
            const left=[...new Set([...relatedOf(a),toId])],right=[...new Set([...relatedOf(b),fromId])];
            await db.ref(getProjectPath('entries')).update({[fromId+'/relatedSources']:left,[toId+'/relatedSources']:right});
            a.relatedSources=left;b.relatedSources=right;
            document.dispatchEvent(new CustomEvent('v2RelationsChanged',{detail:{entryId:fromId}}));return left;
        }
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
        const seen=new Set();const merged=[];
        links.forEach(l=>{const key=JSON.stringify([l.source,l.target].sort());if(seen.has(key))return;seen.add(key);merged.push({...l,bidirectional:links.some(r=>r.source===l.target&&r.target===l.source)});});
        return { nodes: [...nodes.values()], links:merged };
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
                            <button type="button" class="v2-rel-open" data-id="${esc(id)}">${relatedOf(t).includes(entryId)?'↔':'→'} ${esc(t?.title || id)}</button>
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
                    <select class="v2-rel-mode" aria-label="连接方式"><option value="single">单链 →</option><option value="double">双链 ↔</option></select><button type="button" class="primary-btn btn-icon-only v2-rel-add-btn" title="添加"><span class="material-icons">add_link</span></button>
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
                await addRelation(entryId, to, container.querySelector('.v2-rel-mode').value);
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
        return compareEntry(id);
    }
    async function compareEntry(id){
        const entry=entries.find(e=>e.id===id);if(!entry)return;
        await loadQuillScript();
        document.querySelector('.research-comparison')?.remove();
        const panel=document.createElement('aside');panel.className='research-comparison';panel.setAttribute('aria-label','关联文献对照');
        panel.innerHTML='<header><strong>关联文献 · 对照阅读</strong><button type="button" data-close>关闭对照</button></header><h2>'+esc(entry.title)+'</h2><p>'+esc(entry.date||'')+'</p><button type="button" data-edit>进入编辑界面</button><div class="research-comparison-body"><h3>原文摘抄</h3>'+ResearchHTML.clean(entry.content||'')+'<h3>研究分析</h3>'+ResearchHTML.clean(entry.analysis||'')+'</div>';
        const form=document.getElementById('entry-form'),inForm=form&&getComputedStyle(form).display!=='none';
        (inForm?form:document.body).append(panel);document.body.classList.add('research-comparing');
        const close=()=>{panel.remove();document.body.classList.remove('research-comparing');};panel.querySelector('[data-close]').onclick=close;
        panel.querySelector('[data-edit]').onclick=async()=>{if(window.ResearchWorkspace?.isDirty()){const ok=await ResearchWorkspace.persistLocal();if(!ok)return;}if(inForm)await ResearchWorkspace.close();close();hide();await editEntry(id);};
    }
    function navigateEntry(id) {
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
            <p class="v2-kg-desc">单链 → 表示单向关联，双链 ↔ 表示互相关联。点击节点可打开该条；在条目编辑中可添加关联。</p>
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

    let animationFrame;
    function hide() {
        cancelAnimationFrame(animationFrame);
        const modal = document.getElementById('v2-knowledge-graph');
        if (!modal) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 180);
    }

    function draw() {
        cancelAnimationFrame(animationFrame);
        const svg = document.getElementById('v2-kg-svg');
        const stats = document.getElementById('v2-kg-stats');
        if (!svg) return;

        const onlyFiltered = document.getElementById('v2-kg-filtered')?.checked;
        const base = onlyFiltered && typeof getFilteredEntries === 'function'
            ? getFilteredEntries()
            : (entries || []);
        const graph = buildGraph(base);

        const width = svg.clientWidth || 640;
        const columns = Math.max(2, Math.floor((width - 80) / 140));
        const rows = Math.ceil(graph.nodes.length / columns);
        const height = Math.max(480, Math.min(1800, rows * 135 + 100));
        svg.style.height = `${height}px`;
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

        // Spacious network layout: a circle for small sets and a loose grid for
        // larger sets, followed by link attraction and label-aware collision.
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.39;
        const pos = new Map();
        graph.nodes.forEach((n, i) => {
            if (graph.nodes.length > 8) {
                const col = i % columns;
                const row = Math.floor(i / columns);
                const cellWidth = (width - 120) / Math.max(1, columns - 1);
                const cellHeight = (height - 120) / Math.max(1, rows - 1);
                pos.set(n.id, {x: 60 + col * cellWidth, y: 55 + row * cellHeight});
                return;
            }
            const angle = (i / graph.nodes.length) * Math.PI * 2 - Math.PI / 2;
            const r = n.degree > 0 ? radius : radius * 0.7;
            pos.set(n.id, {
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r
            });
        });

        // Pull related nodes together without allowing labels to collide.
        const minimumDistance = 118;
        for (let iter = 0; iter < 80; iter++) {
            graph.links.forEach(l => {
                const a = pos.get(l.source);
                const b = pos.get(l.target);
                if (!a || !b) return;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 175) * 0.012;
                a.x += dx / dist * force;
                a.y += dy / dist * force;
                b.x -= dx / dist * force;
                b.y -= dy / dist * force;
            });
            for (let i = 0; i < graph.nodes.length; i++) {
                for (let j = i + 1; j < graph.nodes.length; j++) {
                    const a = pos.get(graph.nodes[i].id);
                    const b = pos.get(graph.nodes[j].id);
                    let dx = b.x - a.x;
                    let dy = b.y - a.y;
                    let dist = Math.hypot(dx, dy);
                    if (dist >= minimumDistance) continue;
                    if (dist < 0.01) { dx = 1; dy = 0; dist = 1; }
                    const push = (minimumDistance - dist) * 0.18;
                    a.x -= dx / dist * push;
                    a.y -= dy / dist * push;
                    b.x += dx / dist * push;
                    b.y += dy / dist * push;
                }
            }
            // Keep in bounds
            pos.forEach(p => {
                p.x = Math.max(62, Math.min(width - 62, p.x));
                p.y = Math.max(46, Math.min(height - 68, p.y));
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
            line.setAttribute('marker-end', 'url(#v2-kg-arrow)');if(l.bidirectional){line.setAttribute('marker-start','url(#v2-kg-arrow)');line.classList.add('is-double');}
            gLinks.appendChild(line);
        });

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `<marker id="v2-kg-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-secondary)" />
        </marker>`;
        svg.appendChild(defs);
        svg.appendChild(gLinks);

        const nodeRadius = n => Math.min(22, 10 + n.degree * 2);
        const labelLines = title => {
            const value = String(title || '无标题').replace(/\s+/g, ' ').trim();
            if (value.length <= 7) return [value];
            const first = value.slice(0, 7);
            const second = value.slice(7, 14) + (value.length > 14 ? '…' : '');
            return [first, second];
        };
        const gNodes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graph.nodes.forEach(n => {
            const p = pos.get(n.id);
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'v2-kg-node');
            g.style.cursor = 'pointer';
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', nodeRadius(n));
            circle.setAttribute('class', 'v2-kg-circle');
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', p.x);
            label.setAttribute('y', p.y + nodeRadius(n) + 10);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('class', 'v2-kg-label');
            labelLines(n.title).forEach((line, index) => {
                const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                span.setAttribute('x', p.x);
                span.setAttribute('dy', index ? '1.25em' : '0');
                span.textContent = line;
                label.appendChild(span);
            });
            const fullTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            fullTitle.textContent = n.title || '无标题';
            g.appendChild(circle);
            g.appendChild(label);
            g.appendChild(fullTitle);
            g.addEventListener('click', () => showNodeDetail(n.id));
            g.addEventListener('dblclick', () => {
                hide();
                openEntry(n.id);
            });
            gNodes.appendChild(g);
        });
        svg.appendChild(gNodes);
        const origins=new Map([...pos].map(([id,p])=>[id,{...p}]));
        function frame(time){
            if(!svg.isConnected||document.getElementById('v2-knowledge-graph').style.display==='none')return;
            graph.nodes.forEach((n,i)=>{const p=pos.get(n.id),o=origins.get(n.id);p.x=o.x+Math.sin(time/2200+i*1.7)*6;p.y=o.y+Math.cos(time/2600+i*1.3)*5;const g=gNodes.children[i],label=g.querySelector('text');g.querySelector('circle').setAttribute('cx',p.x);g.querySelector('circle').setAttribute('cy',p.y);label.setAttribute('x',p.x);label.setAttribute('y',p.y+nodeRadius(n)+10);label.querySelectorAll('tspan').forEach(span=>span.setAttribute('x',p.x));});
            graph.links.forEach((l,i)=>{const a=pos.get(l.source),b=pos.get(l.target),line=gLinks.children[i];const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;const ra=nodeRadius(graph.nodes.find(n=>n.id===l.source))+5,rb=nodeRadius(graph.nodes.find(n=>n.id===l.target))+6;line.setAttribute('x1',a.x+dx/dist*ra);line.setAttribute('y1',a.y+dy/dist*ra);line.setAttribute('x2',b.x-dx/dist*rb);line.setAttribute('y2',b.y-dy/dist*rb);});
            if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animationFrame=requestAnimationFrame(frame);
        }frame(0);
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
            <div class="v2-kg-source-preview">${window.DOMPurify?DOMPurify.sanitize(entry.content||''):esc(entry.content||'')}</div>
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
                compareEntry(a.dataset.open);
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
        if (!form) return;
        let row = form.querySelector('.v2-rel-form-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'form-row v2-rel-form-row';
            row.innerHTML = `
                <label>关联文献：</label>
                <div id="v2-form-relations" class="v2-form-relations"></div>
            `;
        }
        // Relations are entry metadata. Keeping them inside the metadata rail
        // prevents the row from creating an implicit second grid column in
        // fullscreen writing mode.
        const meta = form.querySelector('.ed-editor-meta');
        if (meta) meta.appendChild(row);
        else {
            const actions = form.querySelector('.action-buttons');
            if (actions) form.insertBefore(row, actions);
            else form.appendChild(row);
        }
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
