/**
 * V2.2 — Source type manager UI
 */
(function (global) {
    'use strict';

    let selectedTypeId = null;
    let activeTab = 'types';

    function ensureModal() {
        if (document.getElementById('v2-type-manager')) return;

        const modal = document.createElement('div');
        modal.id = 'v2-type-manager';
        modal.className = 'form-popup v2-type-manager';
        modal.style.display = 'none';
        modal.innerHTML = `
            <h2>文献类型管理</h2>
            <div class="v2-tm-tabs">
                <button type="button" class="v2-tm-tab active" data-tab="types">类型编辑</button>
                <button type="button" class="v2-tm-tab" data-tab="compliance">合规中心</button>
                <button type="button" class="v2-tm-tab" data-tab="dashboard">合规统计</button>
            </div>
            <div class="v2-tm-panel" id="v2-tm-panel-types">
                <div class="v2-tm-toolbar">
                    <div class="v2-tm-style">
                        <label>当前引用样式</label>
                        <select id="v2-tm-style-select"></select>
                    </div>
                    <p class="v2-tm-hint" id="v2-tm-style-scope-hint" style="width:100%;margin:0 0 4px"></p>
                    <div class="v2-tm-actions">
                        <button type="button" class="primary-btn btn-outline" id="v2-tm-import-style" title="导入 JSON 引用样式（每个模板须含 format 字段）">导入样式</button>
                        <button type="button" class="primary-btn btn-outline" id="v2-tm-export-style" title="导出当前样式为 JSON">导出样式</button>
                        <button type="button" class="primary-btn btn-outline danger-outline" id="v2-tm-delete-style" title="删除当前引用样式">删除样式</button>
                        <input type="file" id="v2-tm-import-style-file" accept=".json,application/json" hidden>
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
            </div>
            <div class="v2-tm-panel" id="v2-tm-panel-compliance" hidden>
                <div class="v2-cc-upload">
                    <p class="v2-tm-hint">上传 Word 文档（.docx），系统将提取脚注并按选定格式校验合规性。</p>
                    <div class="v2-cc-upload-row">
                        <label>目标文献类型</label>
                        <select id="v2-cc-type-select"></select>
                    </div>
                    <div class="v2-cc-upload-row">
                        <label>引用样式</label>
                        <select id="v2-cc-style-select"></select>
                    </div>
                    <div class="v2-cc-upload-row">
                        <label>Word 文档</label>
                        <input type="file" id="v2-cc-word-file" accept=".docx">
                    </div>
                    <button type="button" class="primary-btn" id="v2-cc-run-validate">
                        <span class="material-icons">fact_check</span> 校验脚注
                    </button>
                </div>
            </div>
            <div class="v2-tm-panel" id="v2-tm-panel-dashboard" hidden>
                <div id="v2-tm-dashboard"></div>
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
            syncDeleteStyleButton();
            // 切换样式后刷新类型列表与编辑器（字段/模板按样式隔离）
            const list = V2SourceTypes.getTypesForStyle
                ? V2SourceTypes.getTypesForStyle(e.target.value)
                : V2SourceTypes.getTypes();
            if (!list.some(t => t.id === selectedTypeId)) {
                selectedTypeId = list[0]?.id || 'general';
            }
            render();
        };

        document.getElementById('v2-tm-import-style').onclick = () => {
            if (window.V2CitationImport) V2CitationImport.show();
            else document.getElementById('v2-tm-import-style-file').click();
        };
        document.getElementById('v2-tm-import-style-file').onchange = importJsonStyle;
        document.getElementById('v2-tm-export-style').onclick = exportJsonStyle;
        document.getElementById('v2-tm-delete-style').onclick = () => deleteActiveStyle();

        document.getElementById('v2-cc-run-validate').onclick = () => {
            const typeId = document.getElementById('v2-cc-type-select').value;
            const styleId = document.getElementById('v2-cc-style-select').value;
            V2CitationCompliance.runWordValidation(
                document.getElementById('v2-cc-word-file'),
                typeId,
                styleId
            );
        };

        modal.querySelectorAll('.v2-tm-tab').forEach(tab => {
            tab.onclick = () => {
                activeTab = tab.dataset.tab;
                render();
            };
        });
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
        document.querySelectorAll('.v2-tm-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === activeTab);
        });
        document.getElementById('v2-tm-panel-types').hidden = activeTab !== 'types';
        document.getElementById('v2-tm-panel-compliance').hidden = activeTab !== 'compliance';
        document.getElementById('v2-tm-panel-dashboard').hidden = activeTab !== 'dashboard';

        if (activeTab === 'types') renderTypesPanel();
        else if (activeTab === 'compliance') renderCompliancePanel();
        else if (activeTab === 'dashboard') renderDashboardPanel();
    }

    function syncDeleteStyleButton() {
        const styleId = V2SourceTypes.getActiveStyleId();
        const builtin = typeof V2SourceTypes.isBuiltinStyle === 'function'
            ? V2SourceTypes.isBuiltinStyle(styleId)
            : ['history-cn', 'modern-cn', 'gbt7714', 'chicago'].includes(styleId);
        const btn = document.getElementById('v2-tm-delete-style');
        if (!btn) return;
        btn.disabled = builtin;
        btn.title = builtin ? '内置引用样式不可删除' : '删除当前引用样式';
        btn.classList.toggle('is-disabled', builtin);
    }

    async function deleteActiveStyle() {
        const styleId = V2SourceTypes.getActiveStyleId();
        const style = V2SourceTypes.getStyle(styleId);
        if (!style) {
            if (typeof showAlert === 'function') showAlert('未找到当前引用样式', 'warning');
            return;
        }
        if (typeof V2SourceTypes.isBuiltinStyle === 'function' && V2SourceTypes.isBuiltinStyle(styleId)) {
            if (typeof showAlert === 'function') showAlert('内置引用样式不可删除', 'warning');
            return;
        }
        if (!confirm(`确定删除引用样式「${style.name}」？\n删除后不可恢复，相关自定义模板也会被清除。`)) {
            return;
        }
        try {
            await V2SourceTypes.deleteStyle(styleId);
            render();
            if (window.V2CitationSwitcher) await V2CitationSwitcher.syncToolbar();
            if (typeof showAlert === 'function') {
                showAlert(`已删除引用样式「${style.name}」`, 'success');
            }
        } catch (err) {
            if (typeof showAlert === 'function') {
                showAlert(err.message || '删除失败', 'error');
            }
        }
    }

    function renderTypesPanel() {
        const styles = V2SourceTypes.getStyles();
        const active = V2SourceTypes.getActiveStyleId();
        const sel = document.getElementById('v2-tm-style-select');
        if (sel) {
            sel.innerHTML = styles.map(s =>
                `<option value="${s.id}" ${s.id === active ? 'selected' : ''}>${esc(s.name)}</option>`
            ).join('');
        }
        syncDeleteStyleButton();

        const list = document.getElementById('v2-tm-list');
        const styleId = active;
        const types = V2SourceTypes.getTypesForStyle
            ? V2SourceTypes.getTypesForStyle(styleId)
            : V2SourceTypes.getTypes();
        const styleMeta = V2SourceTypes.getStyle(styleId);
        const isCustomStyle = styleMeta && styleMeta.isCustom;

        if (!types.some(t => t.id === selectedTypeId)) {
            selectedTypeId = types[0]?.id || null;
        }

        list.innerHTML = (types.length ? types.map(t => {
            const eff = V2SourceTypes.getEffectiveType
                ? V2SourceTypes.getEffectiveType(t.id, styleId)
                : t;
            const label = V2SourceTypes.resolveTypeDisplayName
                ? V2SourceTypes.resolveTypeDisplayName(Object.assign({}, t, eff || {}), styleId)
                : ((eff && eff.profileLabel) || t.name || t.id);
            return `
            <button type="button" class="v2-tm-item ${t.id === selectedTypeId ? 'active' : ''}" data-id="${t.id}">
                <span class="material-icons">${t.icon || 'description'}</span>
                <span>${esc(label)}</span>
            </button>`;
        }).join('') : `<p class="v2-tm-empty" style="padding:12px">当前样式暂无关联类型</p>`);

        const hint = document.getElementById('v2-tm-style-scope-hint');
        if (hint) {
            hint.textContent = isCustomStyle
                ? `正在编辑「${styleMeta.name}」专属类型与模板；切换到其他样式后内容会隔离显示。`
                : `内置样式「${styleMeta ? styleMeta.name : styleId}」：显示全部文献类型的基础配置。`;
        }

        list.querySelectorAll('.v2-tm-item').forEach(btn => {
            btn.onclick = () => {
                selectedTypeId = btn.dataset.id;
                render();
            };
        });

        renderTypeOverviewTable(types, styleId, styleMeta);

        renderEditor();
    }

    function truncate(str, len) {
        const s = String(str || '');
        return s.length > len ? s.slice(0, len) + '…' : s;
    }

    function renderTypeOverviewTable(types, styleId, styleMeta) {
        let wrap = document.getElementById('v2-tm-type-table-wrap');
        if (!wrap) {
            const panel = document.getElementById('v2-tm-panel-types');
            const body = panel && panel.querySelector('.v2-tm-body');
            if (!body) return;
            wrap = document.createElement('div');
            wrap.id = 'v2-tm-type-table-wrap';
            wrap.className = 'v2-tm-type-table-wrap';
            body.parentNode.insertBefore(wrap, body);
        }

        const styleLabel = styleMeta ? styleMeta.name : styleId;
        const rows = types.map(t => {
            const base = V2SourceTypes.getTypeExact(t.id) || t;
            const eff = V2SourceTypes.getEffectiveType
                ? V2SourceTypes.getEffectiveType(t.id, styleId)
                : t;
            const tpl = resolveTypeCitationTemplate(base, styleId);
            const fields = (eff && eff.fields) || t.fields || [];
            const fieldTags = fields.slice(0, 6).map(f =>
                `<span class="v2-tm-field-tag">${esc(f.key)}</span>`
            ).join('');
            const moreFields = fields.length > 6 ? `<span class="v2-tm-field-tag">+${fields.length - 6}</span>` : '';
            return `
                <tr class="${t.id === selectedTypeId ? 'is-selected' : ''}" data-select-type="${escAttr(t.id)}">
                    <td class="v2-tm-td-name">${esc(V2SourceTypes.resolveTypeDisplayName
                        ? V2SourceTypes.resolveTypeDisplayName(Object.assign({}, t, eff || {}), styleId)
                        : ((eff && eff.profileLabel) || t.name || t.id))}</td>
                    <td class="v2-tm-td-code">${esc((eff && eff.typeCode) || base.typeCode || '—')}</td>
                    <td class="v2-tm-td-tpl" title="${escAttr(tpl)}">${esc(truncate(tpl, 56))}</td>
                    <td class="v2-tm-td-fields">${fieldTags}${moreFields || '—'}</td>
                    <td class="v2-tm-td-actions">
                        <button type="button" class="icon-btn" data-select-type="${escAttr(t.id)}" title="编辑"><span class="material-icons">edit</span></button>
                    </td>
                </tr>`;
        }).join('');

        wrap.innerHTML = `
            <div class="v2-tm-table-head">
                <span>📋 当前样式「${esc(styleLabel)}」共 <strong>${types.length}</strong> 种文献类型</span>
                <span class="v2-tm-table-hint">类型与引用模板由 JSON 导入时自动创建/填充</span>
            </div>
            <div class="v2-tm-table-scroll">
                <table class="v2-tm-type-table">
                    <thead>
                        <tr>
                            <th>类型名称</th>
                            <th>代码</th>
                            <th>引用模板</th>
                            <th>字段</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="5" class="v2-tm-empty">暂无类型，请导入 JSON 引用样式</td></tr>'}</tbody>
                </table>
            </div>`;

        wrap.querySelectorAll('[data-select-type]').forEach(el => {
            el.onclick = () => {
                selectedTypeId = el.getAttribute('data-select-type');
                render();
            };
        });
    }

    function renderCompliancePanel() {
        const types = V2SourceTypes.getTypes();
        const styles = V2SourceTypes.getStyles();
        const typeSel = document.getElementById('v2-cc-type-select');
        const styleSel = document.getElementById('v2-cc-style-select');
        if (typeSel) {
            typeSel.innerHTML = types.map(t =>
                `<option value="${t.id}" ${t.id === (selectedTypeId || 'journal') ? 'selected' : ''}>${esc(V2SourceTypes.resolveTypeDisplayName ? V2SourceTypes.resolveTypeDisplayName(t) : (t.name || t.id))}</option>`
            ).join('');
        }
        if (styleSel) {
            const active = V2SourceTypes.getActiveStyleId();
            styleSel.innerHTML = styles.map(s =>
                `<option value="${s.id}" ${s.id === active ? 'selected' : ''}>${esc(s.name)}</option>`
            ).join('');
        }
    }

    function renderDashboardPanel() {
        const container = document.getElementById('v2-tm-dashboard');
        if (!container || !window.V2CitationCompliance) return;
        const styleId = V2SourceTypes.getActiveStyleId();
        container.innerHTML = V2CitationCompliance.renderComplianceDashboard(styleId);
        V2CitationCompliance.bindDashboardActions(container, styleId);
    }

    async function importJsonStyle(e) {
        const file = e.target.files?.[0];
        if (!file || !window.V2CitationImport) return;
        try {
            const style = await V2CitationImport.importFromFile(file);
            if (window.V2SourceTypes) {
                await V2SourceTypes.setActiveStyleId(style.id);
            }
            const filled = (style._typeImport && style._typeImport.filled) || [];
            const prefer = filled.find(f => f.typeId === 'monograph' || f.typeId === 'book' || f.typeId === 'journal')
                || filled[0];
            if (prefer) selectedTypeId = prefer.typeId;
            activeTab = 'types';
            render();
            if (typeof showAlert === 'function') {
                const n = style._typeImport ? style._typeImport.updated + style._typeImport.imported : 0;
                showAlert(
                    `已导入样式「${style.name}」，并同步 ${n || Object.keys(style.templates || {}).length} 个文献类型的字段与引用模板`,
                    'success'
                );
            }
        } catch (err) {
            if (typeof showAlert === 'function') showAlert(err.message || '导入失败', 'error');
        } finally {
            e.target.value = '';
        }
    }

    function exportJsonStyle() {
        const styleId = V2SourceTypes.getActiveStyleId();
        const style = V2SourceTypes.getStyle(styleId);
        if (!style) {
            if (typeof showAlert === 'function') showAlert('当前没有可导出的引用样式', 'warning');
            return;
        }

        let templates = style.templates;
        if (!templates || !Object.keys(templates).length) {
            templates = {};
            const aliasMap = { monograph: 'book', journal: 'journal', archive: 'archive', newspaper: 'newspaper', thesis: 'thesis', general: 'general' };
            V2SourceTypes.getTypes().forEach(type => {
                const key = aliasMap[type.id] || type.id;
                const format = (type.citationTemplates && type.citationTemplates[styleId]) || '';
                if (!format) return;
                templates[key] = {
                    label: type.name,
                    fields: (type.fields || []).map(f => f.key),
                    format
                };
            });
        }

        if (!Object.keys(templates).length) {
            if (typeof showAlert === 'function') showAlert('当前样式没有可导出的模板', 'warning');
            return;
        }

        const payload = {
            schema: style.schema || '1.0',
            styleName: style.name,
            description: style.description || '',
            templates,
            globalRules: style.globalRules || {
                note_type: 'footnote',
                numbering: 'continuous',
                repeat_citation: 'full',
                date_format: 'arabic'
            }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${style.id || 'citation-style'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof showAlert === 'function') showAlert('引用样式 JSON 已下载', 'success');
    }

    function resolveTypeCitationTemplate(type, styleId) {
        if (!type) return '';
        const fromType = type.citationTemplates && type.citationTemplates[styleId];
        if (fromType) return fromType;

        const style = V2SourceTypes.getStyle(styleId);
        const templates = style && style.templates;
        if (!templates) return '';

        const aliasMap = {
            monograph: 'book',
            book: 'book',
            journal: 'journal',
            article: 'journal',
            archive: 'archive',
            newspaper: 'newspaper',
            thesis: 'thesis',
            general: 'general',
            other: 'other',
            gazetteer: 'gazetteer'
        };
        const key = aliasMap[type.id] || type.category || type.id;
        const tpl = templates[key] || templates[type.id];
        return (tpl && (tpl.format || tpl.template)) || '';
    }

    function renderEditor() {
        const editor = document.getElementById('v2-tm-editor');
        const base = (V2SourceTypes.getTypeExact && V2SourceTypes.getTypeExact(selectedTypeId))
            || null;
        if (!base) {
            editor.innerHTML = '<p class="v2-tm-empty">选择左侧类型进行编辑</p>';
            return;
        }

        const styleId = V2SourceTypes.getActiveStyleId();
        const type = V2SourceTypes.getEffectiveType
            ? V2SourceTypes.getEffectiveType(selectedTypeId, styleId)
            : base;
        const template = resolveTypeCitationTemplate(base, styleId);
        const fields = (type.fields || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const styleName = V2SourceTypes.getStyles().find(s => s.id === styleId)?.name || styleId;
        const styleObj = V2SourceTypes.getStyle(styleId);
        const isCustomStyle = !!(styleObj && (styleObj.isCustom || styleObj.templates));
        const fromImport = !!(base.citationTemplates && base.citationTemplates[styleId]);
        const profile = base.styleProfiles && base.styleProfiles[styleId];
        const parseRules = (profile && profile.parseRules) || type.parseRules || {};
        const example = (profile && profile.example) || type.example || '';
        const displayName = V2SourceTypes.resolveTypeDisplayName
            ? V2SourceTypes.resolveTypeDisplayName(type, styleId)
            : (type.profileLabel || base.name || base.id);

        editor.innerHTML = `
            <div class="v2-tm-style-banner ${isCustomStyle ? 'is-custom' : 'is-builtin'}">
                当前样式：<strong>${esc(styleName)}</strong>
                ${isCustomStyle ? '（仅本样式的字段与引用模板）' : '（基础字段 + 本样式引用模板）'}
            </div>
            <div class="v2-tm-editor-head">
                <div class="form-row">
                    <label>名称</label>
                    <input type="text" id="v2-tm-name" value="${escAttr(displayName)}" ${base.isBuiltin && !isCustomStyle ? '' : ''}>
                </div>
                <div class="form-row">
                    <label>图标</label>
                    <input type="text" id="v2-tm-icon" value="${escAttr(base.icon || 'description')}" placeholder="Material Icon 名">
                </div>
                <div class="form-row">
                    <label>ID</label>
                    <input type="text" id="v2-tm-id" value="${escAttr(base.id)}" ${base.isBuiltin ? 'readonly' : ''}>
                </div>
            </div>

            <h4>字段模板${isCustomStyle ? `（${esc(styleName)}）` : ''}</h4>
            <div class="v2-tm-fields" id="v2-tm-fields">
                ${fields.map((f, i) => fieldRow(f, i)).join('') || '<p class="v2-tm-empty">暂无字段</p>'}
            </div>
            <button type="button" class="primary-btn btn-outline" id="v2-tm-add-field">＋ 新增字段</button>

            <h4>format 格式字符串（${esc(styleName)}）</h4>
            <p class="v2-tm-hint">引用输出由下方 format 字符串驱动（非系统枚举）。占位符：{字段名}；可选段：{字段名?, 有值时显示的内容}${fromImport ? ' · 已由导入样式自动填充' : ''}</p>
            <textarea id="v2-tm-template" rows="3" placeholder="{author}：《{title}》，{publisher}，{year}年。">${esc(template)}</textarea>
            <h4>脚注解析规则（parseRules）</h4>
            <p class="v2-tm-hint">JSON 对象，键为字段名，值为正则（含捕获组）。用于 Word 脚注校验与智能检测。</p>
            <textarea id="v2-tm-parse-rules" rows="4">${esc(JSON.stringify(parseRules || {}, null, 2))}</textarea>
            <div class="form-row">
                <label>示例引用</label>
                <input type="text" id="v2-tm-example" value="${escAttr(example)}" placeholder="如：陈寅恪：《...》">
            </div>
            <div class="v2-tm-preview-box">
                <span class="v2-tm-preview-label">预览</span>
                <div id="v2-tm-preview">${esc(previewSample(type, styleId, template))}</div>
            </div>

            <div class="action-buttons" style="margin-top:16px">
                <button type="button" class="primary-btn" id="v2-tm-save">保存类型</button>
                ${!base.isBuiltin || !['general','monograph','archive','newspaper'].includes(base.id)
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
            const eff = V2SourceTypes.getEffectiveType
                ? V2SourceTypes.getEffectiveType(t.id, styleId)
                : t;
            document.getElementById('v2-tm-preview').textContent =
                previewSample(eff, styleId, document.getElementById('v2-tm-template').value);
        };

        document.getElementById('v2-tm-save').onclick = saveCurrent;
        const del = document.getElementById('v2-tm-delete');
        if (del) del.onclick = async () => {
            if (!confirm(`确定删除类型「${V2SourceTypes.resolveTypeDisplayName ? V2SourceTypes.resolveTypeDisplayName(base) : (base.name || base.id)}」？`)) return;
            try {
                await V2SourceTypes.deleteType(base.id);
                selectedTypeId = V2SourceTypes.getTypes()[0]?.id;
                render();
            } catch (e) {
                if (typeof showAlert === 'function') showAlert(e.message, 'error');
            }
        };
        bindFieldRowActions();
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
        if (!wrap) return;
        wrap.dataset.bound = '1';
        wrap.onclick = (e) => {
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
        };
    }

    // Re-bind after each render via MutationObserver-ish: call after renderEditor
    const _origRenderEditor = renderEditor;
    // monkey patch local - actually just call bind at end of renderEditor by replacing

    function collectEditorType() {
        const old = (V2SourceTypes.getTypeExact && V2SourceTypes.getTypeExact(selectedTypeId))
            || V2SourceTypes.getType(selectedTypeId)
            || {};
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
        const styleObj = V2SourceTypes.getStyle(styleId);
        const isCustomStyle = !!(styleObj && (styleObj.isCustom || styleObj.templates));

        const citationTemplates = Object.assign({}, old.citationTemplates || {});
        citationTemplates[styleId] = document.getElementById('v2-tm-template')?.value || '';

        let parseRules = {};
        try {
            const raw = document.getElementById('v2-tm-parse-rules')?.value.trim();
            if (raw) parseRules = JSON.parse(raw);
        } catch (e) {
            throw new Error('parseRules 必须是合法 JSON');
        }

        const example = document.getElementById('v2-tm-example')?.value.trim() || '';
        const nameInput = document.getElementById('v2-tm-name')?.value.trim() || id;

        const styleProfiles = Object.assign({}, old.styleProfiles || {});
        // 自定义样式：字段/解析规则写入 styleProfiles，不污染基础字段
        // 内置样式：更新基础 fields，同时同步一份到 styleProfiles 便于一致性
        styleProfiles[styleId] = Object.assign({}, styleProfiles[styleId] || {}, {
            label: isCustomStyle ? nameInput : (styleProfiles[styleId] && styleProfiles[styleId].label) || '',
            fields: fields.slice(),
            parseRules: parseRules,
            example: example
        });

        const result = {
            id,
            name: (old.isBuiltin && isCustomStyle) ? (old.name || id) : nameInput,
            icon: document.getElementById('v2-tm-icon')?.value.trim() || 'description',
            sortOrder: old.sortOrder != null ? old.sortOrder : 50,
            isBuiltin: !!old.isBuiltin,
            category: old.category || 'other',
            group: old.group,
            example: isCustomStyle ? (old.example || '') : example,
            fields: isCustomStyle ? (old.fields || fields) : fields,
            citationTemplates,
            styleProfiles,
            parseRules: isCustomStyle ? (old.parseRules || {}) : parseRules
        };
        return result;
    }

    async function saveCurrent() {
        try {
            const t = collectEditorType();
            if (!t.id || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(t.id)) {
                throw new Error('类型 ID 需以字母开头，仅含字母数字_-');
            }
            const styleId = V2SourceTypes.getActiveStyleId();
            const formatStr = (t.citationTemplates && t.citationTemplates[styleId]) || '';
            if (!String(formatStr).trim()) {
                throw new Error('文献类型模板缺少必要的 format（格式字符串），无法保存');
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
