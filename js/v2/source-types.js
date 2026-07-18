/**
 * V2.2 — Source type store (Firebase + defaults)
 */
(function (global) {
    'use strict';

    const BUILTIN_STYLE_IDS = ['history-cn', 'modern-cn', 'gbt7714', 'chicago'];

    let types = [];
    let styles = [];
    let activeStyleId = 'history-cn';
    let loaded = false;
    let loadPromise = null;

    function projectPath(sub) {
        if (typeof getProjectPath === 'function') return getProjectPath(sub);
        return null;
    }

    function normalizeStyle(raw) {
        if (!raw || !raw.id) return null;
        const hasTemplates = raw.templates && typeof raw.templates === 'object' && !Array.isArray(raw.templates);
        const style = {
            id: String(raw.id),
            name: String(raw.name || raw.styleName || raw.id),
            description: String(raw.description || ''),
            schema: String(raw.schema || raw.version || '1.0'),
            source: raw.source || (hasTemplates ? 'json-import' : 'builtin')
        };
        if (hasTemplates) {
            style.templates = raw.templates;
            style.isCustom = true;
        } else if (raw.isCustom) {
            style.isCustom = true;
        }
        if (raw.globalRules && typeof raw.globalRules === 'object' && Object.keys(raw.globalRules).length) {
            style.globalRules = Object.assign({}, raw.globalRules);
        }
        if (raw.importedAt != null) style.importedAt = raw.importedAt;
        if (Array.isArray(raw.templateKeys)) {
            style.templateKeys = raw.templateKeys.slice();
        } else if (hasTemplates) {
            style.templateKeys = Object.keys(raw.templates);
        }
        return style;
    }

    function mergeLocalStyles() {
        if (!window.V2CitationImport || typeof V2CitationImport.readLocalStyles !== 'function') return;
        const local = V2CitationImport.readLocalStyles();
        local.forEach(raw => {
            const s = normalizeStyle(raw);
            if (!s) return;
            const idx = styles.findIndex(x => x.id === s.id);
            if (idx >= 0) styles[idx] = Object.assign({}, styles[idx], s);
            else styles.push(s);
        });
    }

    function ensureDefaults() {
        if (!types.length) types = V2SourceSchema.getDefaultTypes();
        if (!styles.length) styles = V2SourceSchema.getDefaultStyles();
        mergeLocalStyles();
        if (!styles.some(s => s.id === activeStyleId)) {
            activeStyleId = styles[0]?.id || 'history-cn';
        }
        types = types.map(V2SourceSchema.normalizeType).filter(Boolean)
            .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, 'zh'));
        styles = styles.map(normalizeStyle).filter(Boolean);
    }

    async function load() {
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            ensureDefaults();
            if (typeof db === 'undefined' || typeof getProjectPath !== 'function') {
                loaded = true;
                return getState();
            }
            const path = projectPath('v2');
            if (!path) {
                // 认证尚未就绪，稍后重试
                loadPromise = null;
                return getState();
            }
            try {
                const snap = await db.ref(path).once('value');
                const data = snap.val() || {};
                if (data.sourceTypes && typeof data.sourceTypes === 'object') {
                    const list = Object.values(data.sourceTypes).map(V2SourceSchema.normalizeType).filter(Boolean);
                    if (list.length) types = list;
                }
                if (data.citationStyles && typeof data.citationStyles === 'object') {
                    const list = Object.values(data.citationStyles).map(normalizeStyle).filter(Boolean);
                    if (list.length) styles = list;
                }
                if (data.settings && data.settings.activeCitationStyleId) {
                    activeStyleId = data.settings.activeCitationStyleId;
                }
                ensureDefaults();
                // 修复曾被导入覆盖的内置基础字段，并回填样式专属配置
                await repairBuiltinBaseFields(false);
                const hydrated = hydrateStyleProfilesFromStyles();
                if (data.sourceTypes || hydrated) {
                    await persistAll(false);
                }
                // Seed Firebase if empty
                if (!data.sourceTypes) {
                    await persistAll(false);
                }
            } catch (err) {
                console.warn('加载文献类型失败，使用默认预设', err);
                ensureDefaults();
            }
            loaded = true;
            return getState();
        })();
        return loadPromise;
    }

    async function persistAll(showToast) {
        if (typeof db === 'undefined' || typeof getProjectPath !== 'function') return;
        const path = projectPath('v2');
        if (!path) return;
        const sourceTypes = {};
        types.forEach(t => { sourceTypes[t.id] = t; });
        const citationStyles = {};
        styles.forEach(s => { citationStyles[s.id] = s; });

        const sanitize = (window.V2FirebaseUtils && V2FirebaseUtils.sanitizeForFirebase) ||
            (typeof sanitizeForFirebase === 'function' ? sanitizeForFirebase : (x) => x);

        const payload = sanitize({
            settings: { activeCitationStyleId: activeStyleId }
        });
        const cleanStyles = sanitize(citationStyles);
        const cleanTypes = sanitize(sourceTypes);

        await db.ref(path).update(payload);
        await db.ref(path + '/citationStyles').set(cleanStyles);
        await db.ref(path + '/sourceTypes').set(cleanTypes);
        if (showToast && typeof showAlert === 'function') {
            showAlert('文献类型已保存', 'success');
        }
    }

    function isBuiltinStyle(id) {
        return BUILTIN_STYLE_IDS.includes(id);
    }

    function getState() {
        return {
            types: types.slice(),
            styles: styles.slice(),
            activeStyleId,
            loaded
        };
    }

    function getTypes() {
        ensureDefaults();
        return types.slice();
    }

    function getType(id) {
        ensureDefaults();
        return types.find(t => t.id === (id || 'general')) || types.find(t => t.id === 'general') || types[0];
    }

    /** 精确查找，不存在则返回 null（不会回退到 general） */
    function getTypeExact(id) {
        ensureDefaults();
        if (!id) return null;
        return types.find(t => t.id === id) || null;
    }

    /** 按当前/指定引用样式合并后的类型（字段与模板隔离） */
    function getEffectiveType(id, styleId) {
        const base = getTypeExact(id) || getType(id);
        if (!base) return null;
        const sid = styleId || activeStyleId;
        if (window.V2SourceSchema && typeof V2SourceSchema.getEffectiveType === 'function') {
            return V2SourceSchema.getEffectiveType(base, sid);
        }
        return base;
    }

    /**
     * 当前样式下应展示的文献类型列表。
     * - 内置样式（无 JSON templates）：全部默认类型
     * - 导入/自定义样式：严格按该 JSON 的 templates 键数量展示（a 种 / b 种）
     */
    function getTypesForStyle(styleId) {
        ensureDefaults();
        const sid = styleId || activeStyleId;
        const style = getStyle(sid);

        const hasJsonTemplates = style && style.templates &&
            typeof style.templates === 'object' &&
            Object.keys(style.templates).length > 0;

        if (isBuiltinStyle(sid) && !hasJsonTemplates) {
            return getPickerTypes();
        }

        if (!hasJsonTemplates) {
            return getPickerTypes();
        }

        const keyToBuiltin = {
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

        const keys = (style.templateKeys && style.templateKeys.length)
            ? style.templateKeys
            : Object.keys(style.templates);

        return keys.map((key, index) => {
            const tpl = style.templates[key];
            if (!tpl) return null;

            const builtinId = keyToBuiltin[key];
            const base = getTypeExact(key)
                || (builtinId && getTypeExact(builtinId))
                || getTypeExact(builtinId)
                || null;

            const stub = base || {
                id: key,
                name: tpl.label || key,
                icon: 'category',
                fields: [],
                citationTemplates: {}
            };

            const eff = getEffectiveType(stub, sid) || stub;
            const label = tpl.label || eff.profileLabel || eff.name || key;

            return Object.assign({}, eff, {
                id: base ? base.id : key,
                name: label,
                profileLabel: label,
                icon: (base && base.icon) || 'category',
                sortOrder: (base && base.sortOrder != null) ? base.sortOrder : (index + 1),
                _templateKey: key
            });
        }).filter(Boolean);
    }

    /** 当前样式在 JSON 中定义的模板数量 */
    function getTemplateCountForStyle(styleId) {
        const style = getStyle(styleId || activeStyleId);
        if (!style || !style.templates) return 0;
        if (style.templateKeys && style.templateKeys.length) return style.templateKeys.length;
        return Object.keys(style.templates).length;
    }

    function getTypesByGroup(groupId, styleId) {
        const gid = groupId || 'general';
        return getTypesForStyle(styleId || activeStyleId).filter(t => {
            const g = t.group || (window.V2SourceSchema && V2SourceSchema.resolveTypeGroup(t)) || 'general';
            return g === gid;
        });
    }

    /**
     * 从已导入样式的 templates 回填 styleProfiles（兼容旧数据）
     */
    function hydrateStyleProfilesFromStyles() {
        let changed = 0;
        const keyToBuiltin = {
            book: 'monograph', monograph: 'monograph',
            journal: 'journal', article: 'journal',
            archive: 'archive', newspaper: 'newspaper',
            thesis: 'thesis', general: 'general',
            other: 'other', gazetteer: 'gazetteer'
        };

        styles.forEach(style => {
            if (!style || isBuiltinStyle(style.id) || !style.templates) return;
            Object.entries(style.templates).forEach(([key, tpl]) => {
                if (!tpl) return;
                const typeId = keyToBuiltin[key] || key;
                const idx = types.findIndex(t => t.id === typeId);
                if (idx < 0) return;
                const cur = types[idx];
                const profiles = Object.assign({}, cur.styleProfiles || {});
                if (profiles[style.id] && Array.isArray(profiles[style.id].fields) && profiles[style.id].fields.length) {
                    return;
                }
                const fields = Array.isArray(tpl.fields)
                    ? tpl.fields.map((f, i) => {
                        if (typeof f === 'string') {
                            return V2SourceSchema.field(f, f, { order: i + 1 });
                        }
                        if (f && f.key) {
                            return V2SourceSchema.field(f.key, f.label || f.key, Object.assign({}, f, { order: f.order != null ? f.order : i + 1 }));
                        }
                        return null;
                    }).filter(Boolean)
                    : [];
                profiles[style.id] = {
                    label: tpl.label || '',
                    fields: fields,
                    parseRules: {},
                    example: tpl.example || '',
                    templateKey: key,
                    rules: tpl.rules || {}
                };
                const citationTemplates = Object.assign({}, cur.citationTemplates || {});
                if (!citationTemplates[style.id] && (tpl.format || tpl.template)) {
                    citationTemplates[style.id] = tpl.format || tpl.template;
                }
                types[idx] = V2SourceSchema.normalizeType(Object.assign({}, cur, {
                    styleProfiles: profiles,
                    citationTemplates
                }));
                changed++;
            });
        });
        return changed;
    }

    /**
     * 修复：内置类型基础字段被导入覆盖时，恢复为默认字段（保留各样式模板与 profiles）
     */
    async function repairBuiltinBaseFields(persist) {
        const defaults = V2SourceSchema.getDefaultTypes();
        let changed = 0;
        defaults.forEach(def => {
            const idx = types.findIndex(t => t.id === def.id);
            if (idx < 0) return;
            const cur = types[idx];
            const next = Object.assign({}, cur, {
                name: def.name,
                icon: def.icon,
                group: def.group || cur.group,
                fields: V2SourceSchema.clone(def.fields),
                citationTemplates: Object.assign({}, def.citationTemplates || {}, cur.citationTemplates || {}),
                styleProfiles: Object.assign({}, cur.styleProfiles || {}),
                parseRules: (def.parseRules && Object.keys(def.parseRules).length)
                    ? def.parseRules
                    : (cur.parseRules || {})
            });
            Object.keys(def.citationTemplates || {}).forEach(sid => {
                if (!next.citationTemplates[sid]) {
                    next.citationTemplates[sid] = def.citationTemplates[sid];
                }
            });
            types[idx] = V2SourceSchema.normalizeType(next);
            changed++;
        });
        if (changed && persist) await persistAll(false);
        return changed;
    }

    function getStyles() {
        ensureDefaults();
        return styles.slice();
    }

    function getStyle(id) {
        ensureDefaults();
        return styles.find(s => s.id === id) || null;
    }

    function getActiveStyleId() {
        return activeStyleId;
    }

    async function setActiveStyleId(id) {
        if (!styles.some(s => s.id === id)) return;
        activeStyleId = id;
        try {
            const path = projectPath('v2/settings/activeCitationStyleId');
            if (path && typeof db !== 'undefined') {
                await db.ref(path).set(id);
            }
        } catch (e) {
            console.warn(e);
        }
        document.dispatchEvent(new CustomEvent('v2StyleChanged', { detail: { styleId: id } }));
    }

    async function saveStyle(styleDef) {
        const normalized = normalizeStyle(styleDef);
        if (!normalized) throw new Error('无效的引用样式');
        if (normalized.templates && window.V2CitationImport &&
            typeof V2CitationImport.validateStyleTemplates === 'function') {
            const check = V2CitationImport.validateStyleTemplates(normalized);
            if (!check.ok && !check.valid) {
                throw new Error(check.message || check.error || '引用样式模板不完整');
            }
            // 归一化：确保每个模板条目均写入 format 字段
            Object.keys(normalized.templates).forEach(key => {
                const tpl = normalized.templates[key];
                if (!tpl || typeof tpl !== 'object') return;
                const format = V2CitationImport.extractTemplateFormat(tpl);
                if (format) normalized.templates[key] = Object.assign({}, tpl, { format });
            });
        }
        const idx = styles.findIndex(s => s.id === normalized.id);
        if (idx >= 0) styles[idx] = Object.assign({}, styles[idx], normalized);
        else styles.push(normalized);
        ensureDefaults();
        if (window.V2CitationImport && typeof V2CitationImport.upsertLocalStyle === 'function') {
            V2CitationImport.upsertLocalStyle(normalized);
        }
        await persistAll(false);
        document.dispatchEvent(new CustomEvent('v2StyleChanged', { detail: { styleId: normalized.id } }));
        document.dispatchEvent(new CustomEvent('v2TypesChanged'));
        return normalized;
    }

    async function deleteStyle(id) {
        const styleId = String(id || '');
        const s = styles.find(x => x.id === styleId);
        if (!s) throw new Error('未找到该引用样式');
        if (isBuiltinStyle(styleId)) {
            throw new Error('内置引用样式不可删除');
        }

        styles = styles.filter(x => x.id !== styleId);

        // 清理各文献类型上挂载的该样式模板与专属配置
        types = types.map(t => {
            const hasTpl = t.citationTemplates && Object.prototype.hasOwnProperty.call(t.citationTemplates, styleId);
            const hasProfile = t.styleProfiles && Object.prototype.hasOwnProperty.call(t.styleProfiles, styleId);
            if (!hasTpl && !hasProfile) return t;
            const next = Object.assign({}, t, {
                citationTemplates: Object.assign({}, t.citationTemplates || {}),
                styleProfiles: Object.assign({}, t.styleProfiles || {})
            });
            delete next.citationTemplates[styleId];
            delete next.styleProfiles[styleId];
            if (next.styleRules) {
                next.styleRules = Object.assign({}, next.styleRules);
                delete next.styleRules[styleId];
            }
            return next;
        });

        if (activeStyleId === styleId) {
            activeStyleId = styles.some(x => x.id === 'history-cn')
                ? 'history-cn'
                : (styles[0] && styles[0].id) || 'history-cn';
        }

        if (window.V2CitationImport) {
            const rest = V2CitationImport.readLocalStyles().filter(x => x.id !== styleId);
            V2CitationImport.writeLocalStyles(rest);
        }

        ensureDefaults();
        styles = styles.filter(x => x.id !== styleId);

        await persistAll(false);

        try {
            const stylePath = projectPath('v2/citationStyles/' + styleId);
            if (stylePath && typeof db !== 'undefined') {
                await db.ref(stylePath).remove();
            }
        } catch (e) {
            console.warn('Firebase 删除样式键失败', e);
        }

        document.dispatchEvent(new CustomEvent('v2StyleChanged', { detail: { styleId: activeStyleId } }));
        document.dispatchEvent(new CustomEvent('v2TypesChanged'));
        document.dispatchEvent(new CustomEvent('v2StyleDeleted', { detail: { styleId } }));
        return { deletedId: styleId, activeStyleId };
    }

    async function saveType(typeDef, opts) {
        const silent = !!(opts && opts.silent);
        const normalized = V2SourceSchema.normalizeType(typeDef);
        if (!normalized) throw new Error('无效的文献类型');
        const idx = types.findIndex(t => t.id === normalized.id);
        if (idx >= 0) types[idx] = normalized;
        else types.push(normalized);
        ensureDefaults();
        if (!(opts && opts.skipPersist)) {
            await persistAll(!silent);
        }
        if (!silent) {
            document.dispatchEvent(new CustomEvent('v2TypesChanged'));
        }
        return normalized;
    }

    async function deleteType(id) {
        const t = types.find(x => x.id === id);
        if (!t) return;
        if (t.isBuiltin && ['general', 'monograph', 'archive', 'newspaper'].includes(id)) {
            throw new Error('内置核心类型不可删除（可编辑字段与模板）');
        }
        types = types.filter(x => x.id !== id);
        ensureDefaults();
        await persistAll(true);
        document.dispatchEvent(new CustomEvent('v2TypesChanged'));
    }

    async function resetToDefaults() {
        types = V2SourceSchema.getDefaultTypes();
        styles = V2SourceSchema.getDefaultStyles();
        activeStyleId = 'history-cn';
        if (window.V2CitationImport) {
            V2CitationImport.writeLocalStyles([]);
        }
        await persistAll(true);
        document.dispatchEvent(new CustomEvent('v2TypesChanged'));
        document.dispatchEvent(new CustomEvent('v2StyleChanged', { detail: { styleId: activeStyleId } }));
    }

    /**
     * 解析文献类型的展示名称：优先 name / profileLabel，缺失时使用 id（模板键名）。
     * @param {string|object} typeOrId — 类型 id 或类型对象
     * @param {string} [styleId] — 可选，指定引用样式以匹配 JSON 模板键
     */
    function resolveTypeDisplayName(typeOrId, styleId) {
        if (typeOrId == null || typeOrId === '') return '通用史料';
        if (typeof typeOrId === 'object') {
            const t = typeOrId;
            const id = t.id || t._templateKey || '';
            return t.profileLabel || t.name || id;
        }
        const id = String(typeOrId);
        const exact = getTypeExact(id);
        if (exact) return exact.name || id;
        const sid = styleId || activeStyleId;
        const styled = getTypesForStyle(sid).find(t => t.id === id || t._templateKey === id);
        if (styled) return styled.profileLabel || styled.name || id;
        return id;
    }

    function typeName(id) {
        return resolveTypeDisplayName(id);
    }

    /** 供表单选择：隐藏 book→monograph 等别名重复项 */
    function getPickerTypes() {
        ensureDefaults();
        const aliases = (window.V2SourceSchema && V2SourceSchema.TYPE_ALIASES) || {
            book: 'monograph',
            article: 'journal'
        };
        const ids = new Set(types.map(t => t.id));
        return types.filter(t => {
            const prefer = aliases[t.id];
            if (prefer && ids.has(prefer)) return false;
            return true;
        });
    }

    function getTypeGroups() {
        return (window.V2SourceSchema && V2SourceSchema.TYPE_GROUPS)
            ? V2SourceSchema.TYPE_GROUPS.slice()
            : [];
    }

    function resolveGroupId(typeId) {
        const t = getTypeExact(typeId) || getType(typeId);
        if (window.V2SourceSchema && typeof V2SourceSchema.resolveTypeGroup === 'function') {
            return V2SourceSchema.resolveTypeGroup(t || typeId);
        }
        return (t && t.group) || 'general';
    }

    // Auto-load when Firebase ready
    function boot() {
        load().catch(() => {});
    }
    document.addEventListener('v2AuthReady', () => {
        loadPromise = null;
        boot();
    });
    document.addEventListener('firebaseReady', () => setTimeout(boot, 400));
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 1200));
    } else {
        setTimeout(boot, 1200);
    }

    global.V2SourceTypes = {
        load,
        getState,
        getTypes,
        getType,
        getTypeExact,
        getEffectiveType,
        getTypesForStyle,
        getTemplateCountForStyle,
        getPickerTypes,
        getTypeGroups,
        getTypesByGroup,
        resolveGroupId,
        getStyles,
        getStyle,
        getActiveStyleId,
        setActiveStyleId,
        saveStyle,
        deleteStyle,
        isBuiltinStyle,
        BUILTIN_STYLE_IDS,
        saveType,
        deleteType,
        resetToDefaults,
        repairBuiltinBaseFields,
        hydrateStyleProfilesFromStyles,
        typeName,
        resolveTypeDisplayName,
        persistAll,
        normalizeStyle
    };
})(window);
