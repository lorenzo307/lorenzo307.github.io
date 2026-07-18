/**
 * V2.2 — Dynamic entry form (type picker + metadata fields + citation preview)
 * V2.1 — 大类 → 小类 两级文献类型选择
 */
(function (global) {
    'use strict';

    let currentTypeId = 'general';
    let currentGroupId = 'general';
    let patched = false;
    let patchAttempts = 0;

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function ensureFormShell() {
        const form = $('#entry-form form');
        if (!form) return false;

        if (form.dataset.v2Form === '1') {
            if ($('#v2-type-picker') && $('#v2-dynamic-fields') && $('#v2-citation-preview')) {
                return true;
            }
            form.dataset.v2Form = '';
            form.querySelectorAll('.v2-type-row, .v2-dynamic-fields, .v2-citation-preview-row').forEach(el => el.remove());
        }

        const typeRow = document.createElement('div');
        typeRow.className = 'form-row v2-type-row';
        typeRow.innerHTML = `
            <label>文献类型：</label>
            <div class="v2-type-picker" id="v2-type-picker"></div>
        `;

        const metaBlock = document.createElement('div');
        metaBlock.id = 'v2-dynamic-fields';
        metaBlock.className = 'v2-dynamic-fields';

        const citeBlock = document.createElement('div');
        citeBlock.className = 'form-row v2-citation-preview-row';
        citeBlock.innerHTML = `
            <label>自动引用：</label>
            <div class="v2-citation-preview-wrap">
                <div class="v2-citation-style-bar">
                    <select id="v2-form-style-select" title="引用样式"></select>
                    <button type="button" class="icon-btn" id="v2-copy-citation-btn" title="复制引用"><span class="material-icons">content_copy</span></button>
                </div>
                <div id="v2-citation-preview" class="v2-citation-preview">选择类型并填写字段后自动生成</div>
            </div>
        `;

        const dateRow = form.querySelector('.form-row');
        if (!dateRow) return false;

        form.insertBefore(typeRow, dateRow);
        const titleRow = form.querySelector('[name="title"]')?.closest('.form-row');
        if (titleRow && titleRow.nextSibling) {
            form.insertBefore(metaBlock, titleRow.nextSibling);
        } else {
            form.insertBefore(metaBlock, form.querySelector('.action-buttons') || null);
        }
        const actions = form.querySelector('.action-buttons');
        if (actions) form.insertBefore(citeBlock, actions);
        else form.appendChild(citeBlock);

        form.dataset.v2Form = '1';

        form.addEventListener('input', scheduleCitationPreview);
        form.addEventListener('change', scheduleCitationPreview);

        $('#v2-form-style-select')?.addEventListener('change', async (e) => {
            if (window.V2SourceTypes) await V2SourceTypes.setActiveStyleId(e.target.value);
            updateCitationPreview();
        });

        $('#v2-copy-citation-btn')?.addEventListener('click', () => {
            const text = $('#v2-citation-preview')?.textContent || '';
            if (!text) return;
            navigator.clipboard?.writeText(text).then(() => {
                if (typeof showAlert === 'function') showAlert('引用已复制', 'success');
            }).catch(() => {
                if (typeof showAlert === 'function') showAlert(text, 'info');
            });
        });

        return true;
    }

    function getGroups() {
        if (window.V2SourceTypes && typeof V2SourceTypes.getTypeGroups === 'function') {
            return V2SourceTypes.getTypeGroups();
        }
        return (window.V2SourceSchema && V2SourceSchema.TYPE_GROUPS) || [];
    }

    function typesInGroup(groupId) {
        const styleId = window.V2SourceTypes ? V2SourceTypes.getActiveStyleId() : null;
        if (window.V2SourceTypes && typeof V2SourceTypes.getTypesByGroup === 'function') {
            return V2SourceTypes.getTypesByGroup(groupId, styleId);
        }
        return (window.V2SourceTypes ? V2SourceTypes.getTypes() : []).filter(t =>
            (t.group || 'general') === groupId
        );
    }

    function syncGroupFromType(typeId) {
        if (window.V2SourceTypes && typeof V2SourceTypes.resolveGroupId === 'function') {
            currentGroupId = V2SourceTypes.resolveGroupId(typeId) || 'general';
        } else {
            currentGroupId = 'general';
        }
    }

    function bindTypePickerEvents(box) {
        if (!box || box.dataset.pickerBound === '1') return;
        box.dataset.pickerBound = '1';

        box.addEventListener('click', (e) => {
            const groupBtn = e.target.closest('[data-group]');
            if (!groupBtn || !box.contains(groupBtn)) return;
            e.preventDefault();
            e.stopPropagation();
            const gid = groupBtn.getAttribute('data-group');
            if (!gid || gid === currentGroupId) return;
            currentGroupId = gid;
            const subs = typesInGroup(gid);
            const nextId = (subs.find(t => t.id === currentTypeId) || subs[0] || {}).id || 'general';
            setType(nextId, true);
        });

        box.addEventListener('change', (e) => {
            const sel = e.target.closest('#v2-type-subselect');
            if (!sel || !box.contains(sel)) return;
            e.stopPropagation();
            if (sel.value) setType(sel.value, true);
        });
    }

    function renderTypePicker() {
        const box = $('#v2-type-picker');
        if (!box || !window.V2SourceTypes) return;

        syncGroupFromType(currentTypeId);
        const groups = getGroups();
        const subs = typesInGroup(currentGroupId);

        if (subs.length && !subs.some(t => t.id === currentTypeId)) {
            currentTypeId = subs[0].id;
        }

        box.innerHTML = `
            <div class="v2-type-level">
                <span class="v2-type-level-label">大类</span>
                <div class="v2-type-groups" role="group" aria-label="文献大类">
                    ${groups.map(g => `
                        <button type="button" class="v2-type-group-chip ${g.id === currentGroupId ? 'active' : ''}"
                            data-group="${escapeAttr(g.id)}" title="${escapeAttr(g.name)}">
                            <span class="material-icons">${g.icon || 'category'}</span>
                            ${escapeHtml(g.name)}
                        </button>
                    `).join('')}
                </div>
            </div>
            <div class="v2-type-level">
                <span class="v2-type-level-label">小类</span>
                <select id="v2-type-subselect" class="v2-type-subselect" aria-label="文献小类">
                    ${subs.length
                        ? subs.map(t => `
                            <option value="${escapeAttr(t.id)}" ${t.id === currentTypeId ? 'selected' : ''}>
                                ${escapeHtml(window.V2SourceTypes && V2SourceTypes.resolveTypeDisplayName
                                    ? V2SourceTypes.resolveTypeDisplayName(t)
                                    : (t.name || t.id))}
                            </option>
                        `).join('')
                        : '<option value="">（该大类暂无类型）</option>'}
                </select>
            </div>
        `;

        bindTypePickerEvents(box);
        const sel = $('#v2-type-subselect', box);
        if (sel && currentTypeId) sel.value = currentTypeId;
    }

    function renderStyleSelect() {
        const sel = $('#v2-form-style-select');
        if (!sel || !window.V2SourceTypes) return;
        const styles = V2SourceTypes.getStyles();
        const active = V2SourceTypes.getActiveStyleId();
        sel.innerHTML = styles.map(s =>
            `<option value="${s.id}" ${s.id === active ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
        ).join('');
    }

    function renderDynamicFields(preserveValues) {
        const container = $('#v2-dynamic-fields');
        if (!container || !window.V2SourceTypes) return;

        const prev = preserveValues ? collectMetadata() : {};
        const styleId = V2SourceTypes.getActiveStyleId();
        const type = (V2SourceTypes.getEffectiveType && V2SourceTypes.getEffectiveType(currentTypeId, styleId))
            || (V2SourceTypes.getTypeExact && V2SourceTypes.getTypeExact(currentTypeId))
            || V2SourceTypes.getType(currentTypeId);
        const fields = (type?.fields || []).filter(f => f.showInForm !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (!fields.length) {
            container.innerHTML = '';
            container.style.display = 'none';
            updateCitationPreview();
            return;
        }

        const typeLabel = (window.V2SourceTypes && V2SourceTypes.resolveTypeDisplayName)
            ? V2SourceTypes.resolveTypeDisplayName(type, styleId)
            : (type.profileLabel || type.name || currentTypeId);

        container.style.display = 'block';
        container.innerHTML = `
            <div class="v2-dynamic-fields-header">
                <span class="material-icons">tune</span>
                ${escapeHtml(typeLabel)} · 著录字段
            </div>
            ${fields.map(f => `
                <div class="form-row">
                    <label>${escapeHtml(f.label)}${f.required ? ' <span class="v2-req">*</span>' : ''}：</label>
                    <input type="${f.type === 'date' ? 'date' : 'text'}"
                        name="meta_${f.key}"
                        data-meta-key="${f.key}"
                        ${f.required ? 'required' : ''}
                        placeholder="${escapeHtml(f.label)}"
                        value="${escapeAttr(prev[f.key] || '')}">
                </div>
            `).join('')}
        `;
        updateCitationPreview();
    }

    function setType(typeId, preserveValues) {
        let id = typeId || 'general';
        if (window.V2SourceSchema && V2SourceSchema.TYPE_ALIASES) {
            const prefer = V2SourceSchema.TYPE_ALIASES[id];
            if (prefer && V2SourceTypes.getTypeExact && V2SourceTypes.getTypeExact(prefer)) {
                id = prefer;
            }
        }
        currentTypeId = id;
        syncGroupFromType(currentTypeId);
        renderTypePicker();
        renderDynamicFields(!!preserveValues);
    }

    function collectMetadata() {
        const meta = {};
        document.querySelectorAll('#v2-dynamic-fields [data-meta-key]').forEach(input => {
            const key = input.dataset.metaKey;
            const val = (input.value || '').trim();
            if (val) meta[key] = val;
        });
        return meta;
    }

    function fillMetadata(meta) {
        const data = meta || {};
        document.querySelectorAll('#v2-dynamic-fields [data-meta-key]').forEach(input => {
            input.value = data[input.dataset.metaKey] || '';
        });
        updateCitationPreview();
    }

    let previewTimer = null;
    function scheduleCitationPreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updateCitationPreview, 120);
    }

    function updateCitationPreview() {
        const el = $('#v2-citation-preview');
        if (!el || !window.V2Citations || !window.V2SourceTypes) return;
        const title = $('#entry-form [name="title"]')?.value || '';
        const styleId = $('#v2-form-style-select')?.value || V2SourceTypes.getActiveStyleId();
        const citation = V2Citations.previewFromForm(currentTypeId, title, collectMetadata(), styleId);
        el.textContent = citation || '（填写字段后生成引用）';
        el.dataset.citation = citation || '';
    }

    function getTypeId() {
        return currentTypeId || 'general';
    }

    function getCitation() {
        if (!window.V2Citations) return '';
        return $('#v2-citation-preview')?.dataset.citation ||
            V2Citations.previewFromForm(currentTypeId, $('#entry-form [name="title"]')?.value || '', collectMetadata());
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
    }

    function prepareFormUI(entry) {
        ensureFormShell();
        const ready = window.V2SourceTypes
            ? V2SourceTypes.load()
            : Promise.resolve();
        return ready.then(() => {
            ensureFormShell();
            renderStyleSelect();
            if (entry) {
                setType(entry.typeId || 'general', false);
                fillMetadata(entry.metadata || {});
            } else {
                setType(currentTypeId || 'general', false);
            }
            updateCitationPreview();
        }).catch(err => {
            console.warn('文献类型表单初始化失败', err);
            if (window.V2SourceTypes) {
                ensureFormShell();
                renderStyleSelect();
                setType(entry?.typeId || 'general', false);
                if (entry) fillMetadata(entry.metadata || {});
            }
        });
    }

    function patchLegacy() {
        if (patched) return true;
        if (typeof global.showForm !== 'function' || typeof global.getFormData !== 'function') {
            return false;
        }

        const origGetFormData = global.getFormData;
        global.getFormData = function () {
            const data = origGetFormData();
            data.typeId = getTypeId();
            data.metadata = collectMetadata();
            data.citation = getCitation();
            return data;
        };

        const origEdit = global.editEntry;
        if (typeof origEdit === 'function') {
            global.editEntry = function (id) {
                const entry = (typeof entries !== 'undefined' ? entries : []).find(e => e.id === id);
                const result = origEdit(id);
                prepareFormUI(entry || { typeId: 'general', metadata: {} });
                return result;
            };
        }

        const origShow = global.showForm;
        global.showForm = function () {
            const isNew = typeof editingId === 'undefined' || !editingId;
            const result = origShow();
            if (isNew) {
                currentTypeId = 'general';
                currentGroupId = 'general';
                prepareFormUI(null);
            } else {
                const entry = (typeof entries !== 'undefined' && editingId)
                    ? entries.find(e => e.id === editingId)
                    : null;
                prepareFormUI(entry);
            }
            return result;
        };

        const origPopulate = global.populateForm;
        if (typeof origPopulate === 'function') {
            global.populateForm = async function (data) {
                await origPopulate(data);
                await prepareFormUI(data || {});
            };
        }

        const origHidePerform = global.performCloseForm;
        if (typeof origHidePerform === 'function') {
            global.performCloseForm = function () {
                currentTypeId = 'general';
                currentGroupId = 'general';
                return origHidePerform();
            };
        }

        patched = true;
        return true;
    }

    function tryPatch() {
        if (patchLegacy()) return;
        patchAttempts++;
        if (patchAttempts < 40) {
            setTimeout(tryPatch, 50);
        } else {
            console.error('V2DynamicForm: 无法挂钩表单函数，文献类型功能未启用');
        }
    }

    function init() {
        ensureFormShell();
        tryPatch();
        document.addEventListener('v2TypesChanged', () => {
            const formEl = $('#entry-form');
            const visible = formEl && (formEl.style.display === 'block' || formEl.style.display === '');
            if (visible) {
                renderTypePicker();
                renderStyleSelect();
                renderDynamicFields(true);
            }
        });
        document.addEventListener('v2StyleChanged', () => {
            renderStyleSelect();
            renderTypePicker();
            updateCitationPreview();
            if (typeof renderEntries === 'function') renderEntries();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }

    document.addEventListener('firebaseReady', () => setTimeout(tryPatch, 100));

    global.V2DynamicForm = {
        ensureFormShell,
        setType,
        getTypeId,
        collectMetadata,
        fillMetadata,
        getCitation,
        updateCitationPreview,
        renderTypePicker,
        prepareFormUI,
        patchLegacy
    };
})(window);
