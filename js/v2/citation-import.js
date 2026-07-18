/**
 * V2.1 — JSON citation style import (replaces Markdown style docs)
 *
 * Schema: { schema, styleName, description?, templates|types, globalRules? }
 */
(function (global) {
    'use strict';

    const LS_KEY = 'citationStyles';

    const TYPE_KEY_ALIASES = {
        book: 'book',
        monograph: 'book',
        journal: 'journal',
        article: 'journal',
        archive: 'archive',
        newspaper: 'newspaper',
        thesis: 'thesis',
        general: 'general',
        other: 'other',
        gazetteer: 'gazetteer'
    };

    /** JSON template key → 内置文献类型 id（兼容已有条目 typeId） */
    const TEMPLATE_KEY_TO_BUILTIN = {
        book: 'monograph',
        monograph: 'monograph',
        journal: 'journal',
        article: 'journal',
        archive: 'archive',
        newspaper: 'newspaper',
        thesis: 'thesis',
        general: 'general',
        other: 'other',
        gazetteer: 'gazetteer'
    };

    const TYPE_ICONS = {
        book: 'menu_book',
        monograph: 'menu_book',
        journal: 'article',
        article: 'article',
        archive: 'folder_special',
        newspaper: 'newspaper',
        thesis: 'school',
        gazetteer: 'map',
        general: 'description',
        other: 'more_horiz'
    };

    const FIELD_LABELS = {
        author: '作者',
        title: '标题',
        volume: '卷/册',
        publisher: '出版社',
        year: '年份',
        pages: '页码',
        journal: '期刊名',
        issue: '期号',
        place: '出版地',
        date: '日期',
        repository: '馆藏单位',
        collection: '全宗/馆藏',
        file_no: '档号',
        file: '案卷',
        archive: '档案馆',
        fond: '全宗',
        catalog: '目录',
        document: '文件',
        formedAt: '形成时间',
        newspaper: '报纸名',
        edition: '版次',
        city: '城市',
        degree: '学位',
        institution: '授予单位',
        source: '出处',
        note: '备注',
        gazetteer: '志书'
    };

    function fieldLabel(key) {
        return FIELD_LABELS[key] || key;
    }

    function iconForType(typeId) {
        return TYPE_ICONS[typeId] || 'category';
    }

    function normalizeTemplateFields(rawFields) {
        if (!Array.isArray(rawFields)) return [];
        return rawFields.map((f, i) => {
            if (typeof f === 'string') {
                const key = f.trim();
                if (!key) return null;
                if (window.V2SourceSchema) {
                    return V2SourceSchema.field(key, fieldLabel(key), {
                        required: ['author', 'title', 'journal', 'archive'].includes(key),
                        showInForm: true,
                        inCitation: true,
                        order: i + 1
                    });
                }
                return {
                    key,
                    label: fieldLabel(key),
                    type: 'text',
                    required: false,
                    showInForm: true,
                    inCitation: true,
                    order: i + 1
                };
            }
            if (f && typeof f === 'object' && f.key) {
                return Object.assign({
                    type: 'text',
                    required: false,
                    showInForm: true,
                    inCitation: true,
                    order: i + 1
                }, f, {
                    key: String(f.key),
                    label: String(f.label || fieldLabel(f.key))
                });
            }
            return null;
        }).filter(Boolean);
    }

    function inferParseRulesFromTemplate(tpl, fields) {
        if (window.V2TemplateMarkdown && typeof V2TemplateMarkdown.inferParseRules === 'function') {
            const list = (fields || []).map(f => ({ key: f.key || f }));
            return V2TemplateMarkdown.inferParseRules(list, extractTemplateFormat(tpl));
        }
        return {};
    }

    function buildTypeFromTemplate(typeId, tpl, styleId, existing, templateKey) {
        const format = extractTemplateFormat(tpl);
        const fields = normalizeTemplateFields(tpl.fields);
        const isBuiltin = !!(existing && existing.isBuiltin);

        // 保留内置类型的基础字段/名称，不因导入而被永久覆盖
        const next = Object.assign({}, existing || {}, {
            id: typeId,
            name: (existing && existing.name)
                || (tpl.label && String(tpl.label).trim())
                || typeId,
            icon: (existing && existing.icon) || iconForType(templateKey || typeId),
            sortOrder: (existing && existing.sortOrder != null) ? existing.sortOrder : 100,
            isBuiltin: isBuiltin,
            category: (existing && existing.category) || templateKey || typeId,
            group: (window.V2SourceSchema && V2SourceSchema.resolveTypeGroup
                ? V2SourceSchema.resolveTypeGroup({
                    id: typeId,
                    category: templateKey || typeId,
                    group: existing && existing.group
                })
                : (existing && existing.group)) || 'general',
            citationTemplates: Object.assign({}, (existing && existing.citationTemplates) || {}),
            styleProfiles: Object.assign({}, (existing && existing.styleProfiles) || {})
        });

        // 新建类型：使用 JSON 中的 label 作为名称
        if (!existing) {
            next.name = (tpl.label && String(tpl.label).trim()) || typeId;
            next.fields = fields.length ? fields : [];
            next.isBuiltin = false;
        }

        if (tpl.typeCode) next.typeCode = String(tpl.typeCode);

        // ★ 样式专属配置：字段/解析规则/标签按 styleId 隔离
        const parseRules = inferParseRulesFromTemplate(tpl, fields.length ? fields : (existing && existing.fields) || []);
        next.styleProfiles[styleId] = {
            label: tpl.label ? String(tpl.label).trim() : '',
            fields: fields.length ? fields : ((existing && existing.fields) || []).slice(),
            parseRules: parseRules,
            example: tpl.example ? String(tpl.example) : '',
            description: tpl.description ? String(tpl.description) : '',
            typeCode: tpl.typeCode ? String(tpl.typeCode) : '',
            templateKey: templateKey || typeId,
            rules: tpl.rules && typeof tpl.rules === 'object' ? Object.assign({}, tpl.rules) : {}
        };

        if (format && styleId) {
            next.citationTemplates[styleId] = format;
        }

        if (tpl.rules && Object.keys(tpl.rules).length) {
            next.styleRules = Object.assign({}, next.styleRules || {});
            next.styleRules[styleId] = Object.assign({}, tpl.rules);
        }

        return next;
    }

    /**
     * 将 JSON templates 完整同步到文献类型：
     * - 每个模板键创建/更新对应类型
     * - 同时写入内置别名类型（book → monograph），保证已有条目可用
     * - 强制填充该样式下的「引用模板」与字段
     */
    async function importTemplatesToTypes(styleDef) {
        if (!window.V2SourceTypes || !styleDef || !styleDef.templates) {
            return { total: 0, imported: 0, updated: 0, filled: [] };
        }

        const styleId = styleDef.id;
        const templates = styleDef.templates;
        const keys = Object.keys(templates);
        let imported = 0;
        let updated = 0;
        const filled = [];
        const touched = new Set();
        let sortBase = 80;

        function findExact(typeId) {
            if (typeof V2SourceTypes.getTypeExact === 'function') {
                return V2SourceTypes.getTypeExact(typeId);
            }
            return V2SourceTypes.getTypes().find(t => t.id === typeId) || null;
        }

        async function upsertType(typeId, tpl, templateKey) {
            if (!typeId || touched.has(typeId)) return;
            touched.add(typeId);

            const existing = findExact(typeId);
            const isNew = !existing;
            const next = buildTypeFromTemplate(typeId, tpl, styleId, existing, templateKey);

            if (isNew) {
                next.sortOrder = sortBase + filled.length;
                next.isBuiltin = false;
            }

            // 再保险：确保引用模板已写入（来源于模板 format 字符串）
            next.citationTemplates = Object.assign({}, next.citationTemplates || {});
            next.citationTemplates[styleId] = extractTemplateFormat(tpl);

            await V2SourceTypes.saveType(next, { silent: true, skipPersist: true });

            // 校验内存中确实写上了
            const saved = findExact(typeId);
            const ok = saved && saved.citationTemplates && saved.citationTemplates[styleId];
            filled.push({
                typeId,
                templateKey,
                name: next.name,
                isNew,
                templateFilled: !!ok
            });

            if (isNew) imported++;
            else updated++;
        }

        for (const key of keys) {
            const tpl = templates[key];
            if (!tpl || !extractTemplateFormat(tpl)) continue;

            // 每个 JSON 模板键都创建/更新对应文献类型（保证种类数与 JSON 一致）
            await upsertType(key, tpl, key);

            // 同步内置别名，兼容已有条目 typeId（如 book → monograph）
            const builtinId = TEMPLATE_KEY_TO_BUILTIN[key];
            if (builtinId && builtinId !== key) {
                await upsertType(builtinId, tpl, key);
            }
        }

        if (imported || updated) {
            await V2SourceTypes.persistAll(false);
            document.dispatchEvent(new CustomEvent('v2TypesChanged', {
                detail: { styleId, imported, updated, total: keys.length, filled }
            }));
        }

        return { total: keys.length, imported, updated, filled };
    }

    function slugId(name) {
        const base = String(name || 'custom-style')
            .trim()
            .toLowerCase()
            .replace(/[《》【】\[\]（）()\s]+/g, '')
            .replace(/[^\w\u4e00-\u9fff]+/g, '_')
            .replace(/^_+|_+$/g, '');
        if (!base) return 'style_' + Date.now().toString(36);
        if (/^[a-zA-Z]/.test(base)) return base.slice(0, 48);
        return 'style_' + base.slice(0, 40);
    }

    function getTemplatesRoot(data) {
        if (!data || typeof data !== 'object') return null;
        // Schema 1.0 以 templates 为准；types 仅作兼容别名
        if (data.templates != null) {
            if (typeof data.templates === 'object' && !Array.isArray(data.templates)) {
                return data.templates;
            }
            return null;
        }
        if (data.types != null && typeof data.types === 'object' && !Array.isArray(data.types)) {
            return data.types;
        }
        return null;
    }

    /**
     * 从模板对象提取 format 字符串（Schema 1.0 以 format 为准；template 仅作兼容别名）。
     * 所有引用输出均来源于此字符串，而非系统内置枚举。
     */
    function extractTemplateFormat(raw) {
        if (!raw || typeof raw !== 'object') return '';
        const fromFormat = typeof raw.format === 'string' ? raw.format.trim() : '';
        if (fromFormat) return fromFormat;
        const fromTemplate = typeof raw.template === 'string' ? raw.template.trim() : '';
        return fromTemplate;
    }

    function formatMissingMessage(keys) {
        const list = (keys || []).filter(Boolean);
        if (list.length === 1) {
            return `文献类型模板「${list[0]}」缺少必要的 "format"（格式字符串），导入失败`;
        }
        return `以下文献类型模板缺少必要的 "format"（格式字符串），导入失败：\n${list.join('、')}\n\n请为每个模板补全 format 字段。`;
    }

    function formatEmptyMessage(keys) {
        const list = (keys || []).filter(Boolean);
        if (list.length === 1) {
            return `文献类型模板「${list[0]}」的 "format" 为空，导入失败`;
        }
        return `以下文献类型模板的 "format" 为空，导入失败：\n${list.join('、')}\n\n请填写有效的格式字符串。`;
    }

    function failValidation(message, extra) {
        const result = Object.assign({
            ok: false,
            valid: false,
            error: message,
            message: message
        }, extra || {});
        return result;
    }

    function passValidation(data, templates) {
        const templateCount = Object.keys(templates).length;
        const message = `校验通过，共 ${templateCount} 个模板。`;
        return {
            ok: true,
            valid: true,
            data,
            templates,
            styleName: String(data.styleName || data.name).trim(),
            templateCount,
            message,
            error: null
        };
    }

    /**
     * 核心校验器：验证 JSON 是否符合 Schema 1.0 且包含可用 templates。
     * 兼容返回字段：ok / valid / error / message / templateCount
     */
    function validateCitationJSON(data) {
        if (data == null || typeof data !== 'object' || Array.isArray(data)) {
            return failValidation('数据为空或格式无效：根节点必须是 JSON 对象。');
        }

        const styleName = data.styleName != null ? data.styleName : data.name;
        if (styleName == null || typeof styleName !== 'string' || !styleName.trim()) {
            return failValidation('缺少 "styleName" 字段（样式名称）。');
        }

        // ★ 核心：必须存在 templates（或兼容 types）
        if (data.templates == null && data.types == null) {
            return failValidation(
                '未找到 "templates"（引用模板）字段。\n\n' +
                '请确保 JSON 包含类似以下结构：\n' +
                '"templates": { "book": { "format": "...", "fields": [...] } }'
            );
        }

        if (data.templates != null && (typeof data.templates !== 'object' || Array.isArray(data.templates))) {
            return failValidation('"templates" 必须是对象（不能是数组或字符串）。');
        }

        if (data.templates == null && data.types != null &&
            (typeof data.types !== 'object' || Array.isArray(data.types))) {
            return failValidation('"types" 必须是对象（不能是数组或字符串）。建议改用 "templates"。');
        }

        const templates = getTemplatesRoot(data);
        if (!templates) {
            return failValidation(
                '未找到可用的 "templates"（引用模板）字段。\n\n' +
                '请确保 JSON 包含类似以下结构：\n' +
                '"templates": { "book": { "format": "...", "fields": [...] } }'
            );
        }

        const templateKeys = Object.keys(templates);
        if (templateKeys.length === 0) {
            return failValidation('"templates" 对象为空，未定义任何文献类型模板。');
        }

        // ★ 深度校验：每个模板必须是对象且包含非空 format 字符串（Schema 1.0）
        const invalidShape = [];
        const missingFormat = [];
        const emptyFormat = [];

        for (const [key, template] of Object.entries(templates)) {
            if (!template || typeof template !== 'object' || Array.isArray(template)) {
                invalidShape.push(key);
                continue;
            }
            const formatStr = extractTemplateFormat(template);
            if (!formatStr) {
                const hasFormatField = typeof template.format === 'string';
                const hasTemplateAlias = typeof template.template === 'string';
                if (!hasFormatField && !hasTemplateAlias) {
                    missingFormat.push(key);
                } else {
                    emptyFormat.push(key);
                }
            }
        }

        if (invalidShape.length) {
            return failValidation(
                `以下文献类型模板不是有效对象，导入失败：\n${invalidShape.join('、')}\n\n请补全模板定义。`
            );
        }
        if (missingFormat.length) {
            return failValidation(formatMissingMessage(missingFormat));
        }
        if (emptyFormat.length) {
            return failValidation(formatEmptyMessage(emptyFormat));
        }

        return passValidation(data, templates);
    }

    function normalizeTemplateEntry(raw) {
        const format = extractTemplateFormat(raw);
        const fields = Array.isArray(raw.fields)
            ? raw.fields.map(f => (typeof f === 'string' ? f : f && f.key)).filter(Boolean)
            : [];
        return {
            label: String(raw.label || '').trim(),
            fields,
            format,
            typeCode: raw.typeCode != null ? String(raw.typeCode) : '',
            example: raw.example != null ? String(raw.example) : '',
            description: raw.description != null ? String(raw.description) : '',
            rules: raw.rules && typeof raw.rules === 'object' ? Object.assign({}, raw.rules) : {}
        };
    }

    /**
     * Convert validated JSON → internal style definition.
     */
    function jsonToStyleDef(data, options) {
        const opts = options || {};
        const styleName = String(data.styleName || data.name).trim();
        const id = opts.id || data.id || slugId(styleName);
        const root = getTemplatesRoot(data);
        const templates = {};
        Object.entries(root).forEach(([key, tpl]) => {
            templates[key] = normalizeTemplateEntry(tpl);
        });

        return {
            id,
            name: styleName,
            description: String(data.description || '').trim(),
            schema: String(data.schema || data.version || '1.0'),
            templates,
            templateKeys: Object.keys(templates),
            globalRules: data.globalRules && typeof data.globalRules === 'object'
                ? Object.assign({}, data.globalRules)
                : {},
            isCustom: true,
            source: 'json-import',
            importedAt: Date.now()
        };
    }

    function readLocalStyles() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return Object.values(parsed);
        } catch (e) {
            console.warn('读取 localStorage citationStyles 失败', e);
        }
        return [];
    }

    function writeLocalStyles(list) {
        try {
            const map = {};
            (list || []).forEach(s => {
                if (s && s.id) map[s.id] = s;
            });
            localStorage.setItem(LS_KEY, JSON.stringify(map));
        } catch (e) {
            console.warn('写入 localStorage citationStyles 失败', e);
        }
    }

    function upsertLocalStyle(styleDef) {
        const map = {};
        readLocalStyles().forEach(s => { if (s && s.id) map[s.id] = s; });
        map[styleDef.id] = styleDef;
        writeLocalStyles(Object.values(map));
    }

    function findConflict(styleDef) {
        if (!window.V2SourceTypes) return null;
        const styles = V2SourceTypes.getStyles();
        return styles.find(s =>
            s.id === styleDef.id ||
            String(s.name || '').trim() === String(styleDef.name || '').trim()
        ) || null;
    }

    async function resolveConflict(styleDef, existing) {
        const choice = window.confirm(
            `样式「${existing.name}」已存在。\n\n确定 = 覆盖\n取消 = 重命名为「${styleDef.name}（导入）」`
        );
        if (choice) {
            styleDef.id = existing.id;
            return styleDef;
        }
        styleDef.name = styleDef.name + '（导入）';
        styleDef.id = slugId(styleDef.name) + '_' + Date.now().toString(36).slice(-4);
        return styleDef;
    }

    /**
     * Mirror style templates onto matching source types for type-manager / fallback.
     */
    async function syncTemplatesToTypes(styleDef) {
        return importTemplatesToTypes(styleDef);
    }

    async function persistStyle(styleDef) {
        upsertLocalStyle(styleDef);
        if (window.V2SourceTypes && typeof V2SourceTypes.saveStyle === 'function') {
            await V2SourceTypes.saveStyle(styleDef);
        }
        document.dispatchEvent(new CustomEvent('v2StyleImported', { detail: { style: styleDef } }));
        document.dispatchEvent(new CustomEvent('v2TypesChanged'));
        if (window.V2CitationSwitcher) {
            await V2CitationSwitcher.syncToolbar(styleDef.id);
        }
    }

    function notifyError(message) {
        const text = String(message || '导入失败');
        if (typeof showAlert === 'function') showAlert(text, 'error');
        else window.alert('引用样式导入失败！\n\n原因：' + text);
    }

    function notifySuccess(styleDef, templateCount) {
        const count = templateCount != null
            ? templateCount
            : Object.keys((styleDef && styleDef.templates) || {}).length;
        const ti = styleDef && styleDef._typeImport;
        let typeMsg = '';
        if (ti && (ti.imported || ti.updated)) {
            typeMsg = ` 已同步文献类型：新增 ${ti.imported}、更新 ${ti.updated}，引用模板已自动填充。`;
        } else if (ti && ti.total) {
            typeMsg = ` 已识别 ${ti.total} 种模板并写入对应类型。`;
        }
        const text = `引用样式「${styleDef.name}」导入成功！共识别 ${count} 种模板。${typeMsg}`;
        if (typeof showAlert === 'function') showAlert(text, 'success');
        else window.alert(text);
    }

    /**
     * Import a parsed JSON object (or string). Returns the saved style def.
     * 校验失败时立即抛错，不会写入存储。
     */
    async function importCitationStyleJSON(input, options) {
        let data = input;
        if (typeof input === 'string') {
            try {
                data = JSON.parse(input);
            } catch (e) {
                throw new Error(
                    '文件解析失败！请确保上传的是有效的 JSON 文件。\n错误详情：' +
                    (e && e.message ? e.message : String(e))
                );
            }
        }

        const validated = validateCitationJSON(data);
        if (!validated.ok && !validated.valid) {
            throw new Error(validated.message || validated.error || '无效的样式配置文件');
        }

        let styleDef = jsonToStyleDef(validated.data, options);
        const existing = findConflict(styleDef);
        if (existing && !(options && options.forceOverwrite && existing.id === styleDef.id)) {
            if (options && options.skipConflictPrompt) {
                styleDef.id = existing.id;
            } else {
                styleDef = await resolveConflict(styleDef, existing);
            }
        }

        await persistStyle(styleDef);

        let typeResult = { total: 0, imported: 0, updated: 0 };
        if (!(options && options.skipTypeSync)) {
            try {
                typeResult = await importTemplatesToTypes(styleDef);
            } catch (e) {
                console.warn('同步文献类型失败（样式已保存）', e);
            }
        }

        styleDef._templateCount = validated.templateCount;
        styleDef._typeImport = typeResult;
        return styleDef;
    }

    async function importFromFile(file) {
        if (!file) throw new Error('未选择文件');
        const name = String(file.name || '').toLowerCase();
        if (name && !name.endsWith('.json')) {
            throw new Error('请选择 .json 格式的引用样式文件（当前文件：' + (file.name || '未知') + '）');
        }
        let text;
        try {
            text = await file.text();
        } catch (e) {
            throw new Error('无法读取文件内容：' + (e && e.message ? e.message : String(e)));
        }
        if (!String(text || '').trim()) {
            throw new Error('文件内容为空，无法导入。');
        }
        return importCitationStyleJSON(text);
    }

    /**
     * HTML <input type="file" onchange="V2CitationImport.importCitationStyle(event)">
     */
    async function importCitationStyle(event) {
        const file = event && event.target && event.target.files && event.target.files[0];
        if (!file) return null;
        try {
            const style = await importFromFile(file);
            notifySuccess(style, style._templateCount);
            if (window.V2SourceTypes) await V2SourceTypes.setActiveStyleId(style.id);
            if (window.V2CitationSwitcher) await V2CitationSwitcher.syncToolbar(style.id);
            if (window.V2Citations && typeof V2Citations.refreshAllDisplays === 'function') {
                V2Citations.refreshAllDisplays();
            } else if (typeof renderEntries === 'function') {
                renderEntries();
            }
            return style;
        } catch (err) {
            notifyError(err.message || '导入失败');
            return null;
        } finally {
            if (event && event.target) event.target.value = '';
        }
    }

    function ensureModal() {
        if (document.getElementById('v2-citation-import-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'v2-citation-import-modal';
        modal.className = 'form-popup v2-citation-import-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <h2>导入引用样式</h2>
            <p class="v2-ci-hint">上传符合 Schema 1.0 的 <code>.json</code> 样式文件。每个文献类型模板必须包含非空的 <code>format</code>（格式字符串），否则导入失败。导入后将出现在「引用格式」下拉菜单中。</p>
            <div class="v2-ci-dropzone" id="v2-ci-dropzone" tabindex="0" role="button" aria-label="选择或拖放 JSON 文件">
                <span class="material-icons">style</span>
                <div class="v2-ci-drop-title">拖放 JSON 文件到此处</div>
                <div class="v2-ci-drop-sub">或点击选择文件（仅 .json）</div>
                <input type="file" id="v2-ci-file" accept=".json,application/json" hidden>
            </div>
            <div class="v2-ci-status" id="v2-ci-status" hidden></div>
            <div class="v2-ci-styles-block">
                <div class="v2-ci-styles-head">
                    <span>已导入的自定义样式</span>
                </div>
                <ul class="v2-ci-styles-list" id="v2-ci-styles-list"></ul>
            </div>
            <div class="action-buttons">
                <button type="button" class="primary-btn" id="v2-ci-pick">选择文件</button>
                <button type="button" class="cancel-btn" id="v2-ci-close">关闭</button>
            </div>
        `;
        document.body.appendChild(modal);

        const drop = document.getElementById('v2-ci-dropzone');
        const fileInput = document.getElementById('v2-ci-file');
        const status = document.getElementById('v2-ci-status');

        function setStatus(msg, type) {
            status.hidden = !msg;
            status.textContent = msg || '';
            status.className = 'v2-ci-status' + (type ? ' is-' + type : '');
        }

        async function handleFile(file) {
            if (!file) return;
            setStatus('正在校验并导入…', 'info');
            try {
                const style = await importFromFile(file);
                const count = style._templateCount != null
                    ? style._templateCount
                    : Object.keys(style.templates || {}).length;
                setStatus(`导入成功：「${style.name}」（${count} 种模板）`, 'success');
                notifySuccess(style, count);
                if (window.V2SourceTypes) {
                    await V2SourceTypes.setActiveStyleId(style.id);
                }
                renderCustomStylesList();
            } catch (err) {
                const msg = err.message || '导入失败';
                setStatus(msg, 'error');
                notifyError(msg);
            } finally {
                fileInput.value = '';
            }
        }

        document.getElementById('v2-ci-close').onclick = hide;
        document.getElementById('v2-ci-pick').onclick = () => fileInput.click();
        drop.onclick = (e) => {
            if (e.target === fileInput) return;
            fileInput.click();
        };
        fileInput.onchange = () => handleFile(fileInput.files && fileInput.files[0]);

        ['dragenter', 'dragover'].forEach(ev => {
            drop.addEventListener(ev, e => {
                e.preventDefault();
                e.stopPropagation();
                drop.classList.add('is-dragover');
            });
        });
        ['dragleave', 'drop'].forEach(ev => {
            drop.addEventListener(ev, e => {
                e.preventDefault();
                e.stopPropagation();
                drop.classList.remove('is-dragover');
            });
        });
        drop.addEventListener('drop', e => {
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            handleFile(file);
        });

        document.getElementById('v2-ci-styles-list').addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-delete-style]');
            if (!btn) return;
            const styleId = btn.getAttribute('data-delete-style');
            await deleteStyleById(styleId);
            renderCustomStylesList();
        });
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getCustomStyles() {
        if (!window.V2SourceTypes) return readLocalStyles();
        return V2SourceTypes.getStyles().filter(s =>
            s && s.id && !(typeof V2SourceTypes.isBuiltinStyle === 'function'
                ? V2SourceTypes.isBuiltinStyle(s.id)
                : false)
        );
    }

    function renderCustomStylesList() {
        const list = document.getElementById('v2-ci-styles-list');
        if (!list) return;
        const customs = getCustomStyles();
        if (!customs.length) {
            list.innerHTML = '<li class="v2-ci-styles-empty">暂无自定义样式</li>';
            return;
        }
        list.innerHTML = customs.map(s => {
            const count = s.templates ? Object.keys(s.templates).length : 0;
            return `
                <li class="v2-ci-style-item">
                    <div class="v2-ci-style-meta">
                        <span class="v2-ci-style-name">${escapeHtml(s.name)}</span>
                        <span class="v2-ci-style-sub">${count ? count + ' 种模板' : '自定义'}</span>
                    </div>
                    <button type="button" class="icon-btn v2-ci-delete-btn" data-delete-style="${escapeHtml(s.id)}" title="删除此样式" aria-label="删除 ${escapeHtml(s.name)}">
                        <span class="material-icons">delete</span>
                    </button>
                </li>
            `;
        }).join('');
    }

    async function deleteStyleById(styleId) {
        if (!styleId || !window.V2SourceTypes) return;
        const style = V2SourceTypes.getStyle(styleId);
        if (!style) {
            notifyError('未找到该引用样式');
            return;
        }
        if (typeof V2SourceTypes.isBuiltinStyle === 'function' && V2SourceTypes.isBuiltinStyle(styleId)) {
            notifyError('内置引用样式不可删除');
            return;
        }
        if (!confirm(`确定删除引用样式「${style.name}」？\n删除后不可恢复。`)) return;
        try {
            await V2SourceTypes.deleteStyle(styleId);
            if (window.V2CitationSwitcher) await V2CitationSwitcher.syncToolbar();
            if (typeof showAlert === 'function') {
                showAlert(`已删除引用样式「${style.name}」`, 'success');
            } else {
                window.alert(`已删除引用样式「${style.name}」`);
            }
        } catch (err) {
            notifyError(err.message || '删除失败');
        }
    }

    function show() {
        ensureModal();
        const modal = document.getElementById('v2-citation-import-modal');
        const status = document.getElementById('v2-ci-status');
        if (status) {
            status.hidden = true;
            status.textContent = '';
        }
        renderCustomStylesList();
        modal.style.display = 'block';
        modal.classList.remove('closing');
    }

    function hide() {
        const modal = document.getElementById('v2-citation-import-modal');
        if (!modal) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 180);
    }

    /** Quiet file picker (no modal) — used by type-manager button */
    function pickAndImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e) => importCitationStyle(e);
        input.click();
    }

    /**
     * 校验已持久化的样式对象是否包含完整 templates.format（供 saveStyle 等复用）。
     */
    function validateStyleTemplates(styleDef) {
        if (!styleDef || !styleDef.templates) {
            return { ok: true, valid: true };
        }
        return validateCitationJSON({
            styleName: styleDef.name || styleDef.id || 'custom-style',
            templates: styleDef.templates,
            schema: styleDef.schema
        });
    }

    global.V2CitationImport = {
        LS_KEY,
        TYPE_KEY_ALIASES,
        extractTemplateFormat,
        validateCitationJSON,
        validateStyleTemplates,
        jsonToStyleDef,
        importCitationStyleJSON,
        importCitationStyle,
        importFromFile,
        importTemplatesToTypes,
        readLocalStyles,
        writeLocalStyles,
        upsertLocalStyle,
        deleteStyleById,
        renderCustomStylesList,
        show,
        hide,
        pickAndImport,
        slugId,
        getTemplatesRoot,
        notifyError,
        notifySuccess
    };
})(window);
