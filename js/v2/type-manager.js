/**
 * V2.2 — Source type manager UI
 */
(function (global) {
    'use strict';

    let selectedTypeId = null;

    function ensureModal() {
        if (document.getElementById('v2-type-manager')) return;

        const modal = document.createElement('div');
        modal.id = 'v2-type-manager';
        modal.className = 'form-popup v2-type-manager';
        modal.style.display = 'none';
        modal.innerHTML = `
            <h2>文献类型管理</h2>
            <div class="v2-tm-toolbar">
                <div class="v2-tm-style">
                    <label>当前引用样式</label>
                    <select id="v2-tm-style-select"></select>
                </div>
                <div class="v2-tm-actions">
                    <button type="button" class="primary-btn" id="v2-tm-add">新增类型</button>
                    <button type="button" class="primary-btn btn-outline" id="v2-tm-regen" title="按当前样式重算全部条目引用">重算引用</button>
                    <button type="button" class="primary-btn btn-outline" id="v2-tm-reset">恢复默认</button>
                    <button type="button" class="cancel-btn btn-icon-only" id="v2-tm-close" title="关闭"><span class="material-icons">close</span></button>
                </div>
            </div>
            <div class="v2-tm-body">
                <aside class="v2-tm-list" id="v2-tm-list"></aside>
                <section class="v2-tm-editor" id="v2-tm-editor">
                    <p class="v2-tm-empty">选择左侧类型进行编辑</p>
                </section>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('v2-tm-close').onclick = hide;
        document.getElementById('v2-tm-add').onclick = () => createType();
        document.getElementById('v2-tm-regen').onclick = () => regenerateAllCitations();
        document.getElementById('v2-tm-reset').onclick = async () => {
            if (!confirm('确定恢复全部默认文献类型与引用模板？自定义类型将被覆盖。')) return;
            await V2SourceTypes.resetToDefaults();
            selectedTypeId = 'monograph';
            render();
            if (typeof showAlert === 'function') showAlert('已恢复默认预设', 'success');
        };
        document.getElementById('v2-tm-style-select').onchange = async (e) => {
            await V2SourceTypes.setActiveStyleId(e.target.value);
            renderEditor();
        };
    }

    async function show() {
        ensureModal();
        await V2SourceTypes.load();
        const modal = document.getElementById('v2-type-manager');
        modal.style.display = 'block';
        modal.classList.remove('closing');
        if (!selectedTypeId) selectedTypeId = V2SourceTypes.getTypes()[0]?.id || 'general';
        render();
    }

    function hide() {
        const modal = document.getElementById('v2-type-manager');
        if (!modal) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 180);
    }

    function render() {
        const styles = V2SourceTypes.getStyles();
        const active = V2SourceTypes.getActiveStyleId();
        const sel = document.getElementById('v2-tm-style-select');
        if (sel) {
            sel.innerHTML = styles.map(s =>
                `<option value="${s.id}" ${s.id === active ? 'selected' : ''}>${esc(s.name)}</option>`
            ).join('');
        }

        const list = document.getElementById('v2-tm-list');
        const types = V2SourceTypes.getTypes();
        list.innerHTML = types.map(t => `
            <button type="button" class="v2-tm-item ${t.id === selectedTypeId ? 'active' : ''}" data-id="${t.id}">
                <span class="material-icons">${t.icon || 'description'}</span>
                <span>${esc(t.name)}</span>
            </button>
        `).join('');

        list.querySelectorAll('.v2-tm-item').forEach(btn => {
            btn.onclick = () => {
                selectedTypeId = btn.dataset.id;
                render();
            };
        });

        renderEditor();
    }

    function renderEditor() {
        const editor = document.getElementById('v2-tm-editor');
        const type = V2SourceTypes.getType(selectedTypeId);
        if (!type) {
            editor.innerHTML = '<p class="v2-tm-empty">选择左侧类型进行编辑</p>';
            return;
        }

        const styleId = V2SourceTypes.getActiveStyleId();
        const template = (type.citationTemplates && type.citationTemplates[styleId]) || '';
        const fields = (type.fields || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

        editor.innerHTML = `
            <div class="v2-tm-editor-head">
                <div class="form-row">
                    <label>名称</label>
                    <input type="text" id="v2-tm-name" value="${escAttr(type.name)}">
                </div>
                <div class="form-row">
                    <label>图标</label>
                    <input type="text" id="v2-tm-icon" value="${escAttr(type.icon || 'description')}" placeholder="Material Icon 名">
                </div>
                <div class="form-row">
                    <label>ID</label>
                    <input type="text" id="v2-tm-id" value="${escAttr(type.id)}" ${type.isBuiltin ? 'readonly' : ''}>
                </div>
            </div>

            <h4>字段模板</h4>
            <div class="v2-tm-fields" id="v2-tm-fields">
                ${fields.map((f, i) => fieldRow(f, i)).join('') || '<p class="v2-tm-empty">暂无字段</p>'}
            </div>
            <button type="button" class="primary-btn btn-outline" id="v2-tm-add-field">＋ 新增字段</button>

            <h4>引用模板（${esc(V2SourceTypes.getStyles().find(s => s.id === styleId)?.name || styleId)}）</h4>
            <p class="v2-tm-hint">占位符：{字段名}；可选段：{字段名?, 有值时显示的内容}</p>
            <textarea id="v2-tm-template" rows="3">${esc(template)}</textarea>
            <div class="v2-tm-preview-box">
                <span class="v2-tm-preview-label">预览</span>
                <div id="v2-tm-preview">${esc(previewSample(type, styleId, template))}</div>
            </div>

            <div class="action-buttons" style="margin-top:16px">
                <button type="button" class="primary-btn" id="v2-tm-save">保存类型</button>
                ${!type.isBuiltin || !['general','monograph','archive','newspaper'].includes(type.id)
                    ? `<button type="button" class="danger-btn" id="v2-tm-delete">删除</button>` : ''}
            </div>
        `;

        document.getElementById('v2-tm-add-field').onclick = () => {
            const wrap = document.getElementById('v2-tm-fields');
            const idx = wrap.querySelectorAll('.v2-tm-field-row').length;
            wrap.insertAdjacentHTML('beforeend', fieldRow({
                key: 'field' + (idx + 1),
                label: '新字段',
                type: 'text',
                required: false,
                showInForm: true,
                inCitation: true,
                order: idx + 1
            }, idx));
        };

        document.getElementById('v2-tm-template').oninput = () => {
            const t = collectEditorType();
            document.getElementById('v2-tm-preview').textContent =
                previewSample(t, styleId, document.getElementById('v2-tm-template').value);
        };

        document.getElementById('v2-tm-save').onclick = saveCurrent;
        const del = document.getElementById('v2-tm-delete');
        if (del) del.onclick = async () => {
            if (!confirm(`确定删除类型「${type.name}」？`)) return;
            try {
                await V2SourceTypes.deleteType(type.id);
                selectedTypeId = V2SourceTypes.getTypes()[0]?.id;
                render();
            } catch (e) {
                if (typeof showAlert === 'function') showAlert(e.message, 'error');
            }
        };
    }

    function fieldRow(f, i) {
        return `
            <div class="v2-tm-field-row" data-index="${i}">
                <input type="text" class="f-key" value="${escAttr(f.key)}" placeholder="字段键" title="字段键">
                <input type="text" class="f-label" value="${escAttr(f.label)}" placeholder="显示名" title="显示名">
                <label class="f-check" title="必填"><input type="checkbox" class="f-req" ${f.required ? 'checked' : ''}>必填</label>
                <label class="f-check" title="显示"><input type="checkbox" class="f-show" ${f.showInForm !== false ? 'checked' : ''}>显示</label>
                <label class="f-check" title="引用"><input type="checkbox" class="f-cite" ${f.inCitation !== false ? 'checked' : ''}>引用</label>
                <button type="button" class="icon-btn f-up" title="上移"><span class="material-icons">arrow_upward</span></button>
                <button type="button" class="icon-btn f-down" title="下移"><span class="material-icons">arrow_downward</span></button>
                <button type="button" class="icon-btn f-del" title="删除"><span class="material-icons">close</span></button>
            </div>
        `;
    }

    function bindFieldRowActions() {
        const wrap = document.getElementById('v2-tm-fields');
        if (!wrap || wrap.dataset.bound) return;
        wrap.dataset.bound = '1';
        wrap.addEventListener('click', (e) => {
            const row = e.target.closest('.v2-tm-field-row');
            if (!row) return;
            if (e.target.closest('.f-del')) {
                row.remove();
                return;
            }
            if (e.target.closest('.f-up') && row.previousElementSibling) {
                row.parentNode.insertBefore(row, row.previousElementSibling);
            }
            if (e.target.closest('.f-down') && row.nextElementSibling) {
                row.parentNode.insertBefore(row.nextElementSibling, row);
            }
        });
    }

    // Re-bind after each render via MutationObserver-ish: call after renderEditor
    const _origRenderEditor = renderEditor;
    // monkey patch local - actually just call bind at end of renderEditor by replacing

    function collectEditorType() {
        const old = V2SourceTypes.getType(selectedTypeId) || {};
        const id = document.getElementById('v2-tm-id')?.value.trim() || selectedTypeId;
        const fields = [];
        document.querySelectorAll('#v2-tm-fields .v2-tm-field-row').forEach((row, i) => {
            const key = row.querySelector('.f-key')?.value.trim();
            if (!key) return;
            fields.push({
                key,
                label: row.querySelector('.f-label')?.value.trim() || key,
                type: 'text',
                required: !!row.querySelector('.f-req')?.checked,
                showInForm: !!row.querySelector('.f-show')?.checked,
                inCitation: !!row.querySelector('.f-cite')?.checked,
                order: i + 1
            });
        });
        const styleId = V2SourceTypes.getActiveStyleId();
        const citationTemplates = Object.assign({}, old.citationTemplates || {});
        citationTemplates[styleId] = document.getElementById('v2-tm-template')?.value || '';
        return {
            id,
            name: document.getElementById('v2-tm-name')?.value.trim() || id,
            icon: document.getElementById('v2-tm-icon')?.value.trim() || 'description',
            sortOrder: old.sortOrder != null ? old.sortOrder : 50,
            isBuiltin: !!old.isBuiltin,
            fields,
            citationTemplates
        };
    }

    async function saveCurrent() {
        try {
            const t = collectEditorType();
            if (!t.id || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(t.id)) {
                throw new Error('类型 ID 需以字母开头，仅含字母数字_-');
            }
            await V2SourceTypes.saveType(t);
            selectedTypeId = t.id;
            render();
        } catch (e) {
            if (typeof showAlert === 'function') showAlert(e.message, 'error');
        }
    }

    async function regenerateAllCitations() {
        if (typeof entries === 'undefined' || typeof db === 'undefined' || typeof getProjectPath !== 'function') {
            if (typeof showAlert === 'function') showAlert('数据库未就绪', 'error');
            return;
        }
        if (!entries.length) {
            if (typeof showAlert === 'function') showAlert('暂无条目', 'info');
            return;
        }
        if (!confirm(`按当前引用样式重算 ${entries.length} 条史料的引用？`)) return;
        try {
            const updates = {};
            const styleId = V2SourceTypes.getActiveStyleId();
            entries.forEach(entry => {
                const citation = V2Citations.generateCitation(entry, null, styleId);
                entry.citation = citation;
                if (!entry.typeId) entry.typeId = 'general';
                updates[getProjectPath(`entries/${entry.id}/citation`)] = citation;
                updates[getProjectPath(`entries/${entry.id}/typeId`)] = entry.typeId;
            });
            await db.ref().update(updates);
            if (typeof renderEntries === 'function') renderEntries();
            if (typeof showAlert === 'function') showAlert('引用已全部重算', 'success');
        } catch (e) {
            console.error(e);
            if (typeof showAlert === 'function') showAlert('重算失败: ' + e.message, 'error');
        }
    }

    async function createType() {
        const id = 'custom_' + Date.now().toString(36);
        await V2SourceTypes.saveType({
            id,
            name: '自定义类型',
            icon: 'category',
            sortOrder: 80,
            isBuiltin: false,
            fields: [
                { key: 'author', label: '作者', required: false, showInForm: true, inCitation: true, order: 1 },
                { key: 'note', label: '备注', required: false, showInForm: true, inCitation: true, order: 2 }
            ],
            citationTemplates: {
                'history-cn': '{author?, {author}：}《{title}》{note?, ，{note}}。',
                'modern-cn': '{title}。',
                'gbt7714': '{title}[Z].',
                'chicago': '{title}.'
            }
        });
        selectedTypeId = id;
        render();
    }

    function previewSample(type, styleId, template) {
        const sampleMeta = {};
        (type.fields || []).forEach(f => {
            sampleMeta[f.key] = f.label === '作者' || f.key === 'author' ? '王汎森'
                : f.key === 'place' ? '北京'
                : f.key === 'publisher' ? '中华书局'
                : f.key === 'year' ? '2015'
                : f.key === 'pages' ? '35'
                : f.key === 'newspaper' ? '申报'
                : f.key === 'archive' ? '广东省档案馆'
                : f.key === 'gazetteer' ? '广州府志'
                : f.key === 'journal' ? '历史研究'
                : '示例';
        });
        return V2Citations.renderTemplate(template || '', Object.assign({ title: '中国近代思想与学术的系谱' }, sampleMeta));
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escAttr(s) {
        return esc(s).replace(/"/g, '&quot;');
    }

    // Fix: attach field row actions after each editor render
    const realRenderEditor = renderEditor;
    // Override by rewriting renderEditor end - use MutationObserver on editor
    document.addEventListener('DOMContentLoaded', () => {
        // wrap show to bind
    });

    // Patch renderEditor to bind actions - redefine via wrapping in show/render
    const _render = render;
    // We'll call bindFieldRowActions after renderEditor inside render:
    // Replace renderEditor calls - simplest: setInterval or event delegation on document
    document.addEventListener('click', (e) => {
        const row = e.target.closest('#v2-tm-fields .v2-tm-field-row');
        if (!row) return;
        if (e.target.closest('.f-del')) {
            row.remove();
            e.preventDefault();
            return;
        }
        if (e.target.closest('.f-up') && row.previousElementSibling) {
            row.parentNode.insertBefore(row, row.previousElementSibling);
            e.preventDefault();
        }
        if (e.target.closest('.f-down') && row.nextElementSibling) {
            row.parentNode.insertBefore(row.nextElementSibling, row);
            e.preventDefault();
        }
    });

    // Wire nav / overflow (HTML already has 文献类型; avoid duplicates)
    function wireNav() {
        document.querySelectorAll('.v2-nav-item[data-nav="types"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                show();
            });
        });

        document.querySelectorAll('.v2-nav-item[data-nav="settings"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                show();
            }, true);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireNav);
    } else {
        wireNav();
    }

    global.V2TypeManager = { show, hide, render };
})(window);
