/**
 * V2.2 — Source type store (Firebase + defaults)
 */
(function (global) {
    'use strict';

    let types = [];
    let styles = [];
    let activeStyleId = 'history-cn';
    let loaded = false;
    let loadPromise = null;

    function projectPath(sub) {
        if (typeof getProjectPath === 'function') return getProjectPath(sub);
        return null;
    }

    function ensureDefaults() {
        if (!types.length) types = V2SourceSchema.getDefaultTypes();
        if (!styles.length) styles = V2SourceSchema.getDefaultStyles();
        if (!styles.some(s => s.id === activeStyleId)) {
            activeStyleId = styles[0]?.id || 'history-cn';
        }
        types = types.map(V2SourceSchema.normalizeType).filter(Boolean)
            .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, 'zh'));
    }

    async function load() {
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            ensureDefaults();
            if (typeof db === 'undefined' || typeof getProjectPath !== 'function') {
                loaded = true;
                return getState();
            }
            try {
                const path = projectPath('v2');
                if (!path) {
                    loaded = true;
                    return getState();
                }
                const snap = await db.ref(path).once('value');
                const data = snap.val() || {};
                if (data.sourceTypes && typeof data.sourceTypes === 'object') {
                    const list = Object.values(data.sourceTypes).map(V2SourceSchema.normalizeType).filter(Boolean);
                    if (list.length) types = list;
                }
                if (data.citationStyles && typeof data.citationStyles === 'object') {
                    const list = Object.values(data.citationStyles);
                    if (list.length) styles = list;
                }
                if (data.settings && data.settings.activeCitationStyleId) {
                    activeStyleId = data.settings.activeCitationStyleId;
                }
                ensureDefaults();
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
        await db.ref(path).update({
            sourceTypes,
            citationStyles,
            settings: { activeCitationStyleId: activeStyleId }
        });
        if (showToast && typeof showAlert === 'function') {
            showAlert('文献类型已保存', 'success');
        }
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

    function getStyles() {
        ensureDefaults();
        return styles.slice();
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

    async function saveType(typeDef) {
        const normalized = V2SourceSchema.normalizeType(typeDef);
        if (!normalized) throw new Error('无效的文献类型');
        const idx = types.findIndex(t => t.id === normalized.id);
        if (idx >= 0) types[idx] = normalized;
        else types.push(normalized);
        ensureDefaults();
        await persistAll(true);
        document.dispatchEvent(new CustomEvent('v2TypesChanged'));
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
        await persistAll(true);
        document.dispatchEvent(new CustomEvent('v2TypesChanged'));
    }

    function typeName(id) {
        return getType(id)?.name || id || '通用史料';
    }

    // Auto-load when Firebase ready
    function boot() {
        load().catch(() => {});
    }
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
        getStyles,
        getActiveStyleId,
        setActiveStyleId,
        saveType,
        deleteType,
        resetToDefaults,
        typeName,
        persistAll
    };
})(window);
