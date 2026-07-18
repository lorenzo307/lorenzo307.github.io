/**
 * V2.3 — Citation template engine + footnote parsing / validation
 * V2.1 — Supports JSON-imported style.templates (book/journal/archive…)
 */
(function (global) {
    'use strict';

    const TYPE_TO_TEMPLATE_KEY = {
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

    function hasValue(v) {
        return v != null && String(v).trim() !== '';
    }

    function getValue(ctx, key) {
        if (Object.prototype.hasOwnProperty.call(ctx, key) && hasValue(ctx[key])) {
            return String(ctx[key]).trim();
        }
        return '';
    }

    function expandSimpleTokens(text, ctx) {
        return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => getValue(ctx, key));
    }

    function expandOptionals(template, ctx) {
        let src = String(template);
        let out = '';
        let i = 0;
        while (i < src.length) {
            if (src[i] === '{') {
                const optMatch = src.slice(i).match(/^\{([a-zA-Z0-9_]+)\?,/);
                if (optMatch) {
                    const key = optMatch[1];
                    let j = i + optMatch[0].length;
                    let depth = 1;
                    while (j < src.length && depth > 0) {
                        if (src[j] === '{') depth++;
                        else if (src[j] === '}') depth--;
                        if (depth > 0) j++;
                    }
                    const content = src.slice(i + optMatch[0].length, j);
                    if (hasValue(ctx[key])) {
                        out += expandSimpleTokens(content, ctx);
                    }
                    i = j + 1;
                    continue;
                }
            }
            out += src[i];
            i++;
        }
        return out;
    }

    function renderTemplate(template, ctx) {
        if (!template) return '';
        let out = expandOptionals(String(template), ctx);
        out = expandSimpleTokens(out, ctx);
        out = out
            .replace(/\s{2,}/g, ' ')
            .replace(/，{2,}/g, '，')
            .replace(/,{2,}/g, ',')
            .replace(/：\s*，/g, '：')
            .replace(/:\s*,/g, ':')
            .replace(/\(\s*\)/g, '')
            .replace(/（\s*）/g, '')
            .replace(/\s+([，。,.])/g, '$1')
            .replace(/^[,，、：:\s]+/, '')
            .trim();
        return out;
    }

    function buildContext(entry, metadata) {
        const meta = metadata || entry.metadata || {};
        return Object.assign({}, meta, {
            title: entry.title || meta.title || '',
            date: entry.date || meta.date || meta.formedAt || '',
            id: entry.id || '',
            // aliases used by journal / archive JSON schemas
            repository: meta.repository || meta.archive || '',
            collection: meta.collection || meta.fond || '',
            file_no: meta.file_no || meta.file || '',
            issue: meta.issue || meta.volume || '',
            archive: meta.archive || meta.repository || '',
            fond: meta.fond || meta.collection || '',
            file: meta.file || meta.file_no || '',
            formedAt: meta.formedAt || meta.date || entry.date || ''
        });
    }

    function resolveStyleId(entry, styleId) {
        if (entry && entry.citationStyleOverride) return entry.citationStyleOverride;
        if (styleId) return styleId;
        return (window.V2SourceTypes && V2SourceTypes.getActiveStyleId()) || 'history-cn';
    }

    function getStyleDef(styleId) {
        if (!window.V2SourceTypes || typeof V2SourceTypes.getStyle !== 'function') return null;
        return V2SourceTypes.getStyle(styleId);
    }

    function resolveTemplateKey(typeDef, styleDef) {
        const typeId = (typeDef && typeDef.id) || 'general';
        const category = (typeDef && typeDef.category) || '';
        const templates = (styleDef && styleDef.templates) || {};
        const candidates = [
            TYPE_TO_TEMPLATE_KEY[typeId],
            typeId,
            TYPE_TO_TEMPLATE_KEY[category],
            category,
            'general',
            'other'
        ].filter(Boolean);
        for (const key of candidates) {
            if (templates[key] && (templates[key].format || templates[key].template)) {
                return key;
            }
        }
        return null;
    }

    function formatAuthors(authorStr, rules) {
        const raw = String(authorStr || '').trim();
        if (!raw) return '';
        const limit = rules && rules.author_limit != null ? Number(rules.author_limit) : 0;
        const etAl = (rules && rules.et_al) || '等';
        if (!limit || limit < 1) return raw;

        const parts = raw.split(/[、,，;；\/]/).map(s => s.trim()).filter(Boolean);
        if (parts.length <= limit) return parts.join('、');
        return parts.slice(0, limit).join('、') + etAl;
    }

    function applyPageConnector(pages, connector) {
        if (!hasValue(pages)) return '';
        const conn = connector || '—';
        return String(pages).replace(/[\-－—–~～至到]+/g, conn);
    }

    function applyStyleRules(ctx, rules) {
        const next = Object.assign({}, ctx);
        const r = rules || {};
        if (hasValue(next.author)) {
            next.author = formatAuthors(next.author, r);
        }
        if (hasValue(next.pages) && r.page_connector) {
            next.pages = applyPageConnector(next.pages, r.page_connector);
        }
        if (hasValue(next.year) && r.year_suffix) {
            const y = String(next.year);
            const suffix = String(r.year_suffix);
            if (!y.includes(suffix.replace(/^年/, '')) && !y.endsWith(suffix)) {
                // format string usually embeds suffix; keep year numeric unless template lacks it
                next.year = y.replace(/年版$|年$/, '');
            }
        }
        if (r.city_prefix && hasValue(next.place) && hasValue(next.journal)) {
            // optional place prefix for journals — only when place provided
            if (!String(next.journal).includes(String(next.place))) {
                next.journal = next.place + next.journal;
            }
        }
        return next;
    }

    /**
     * Generate citation from a JSON style definition (style.templates).
     */
    function generateCitationFromStyle(entry, typeDef, styleDef) {
        const key = resolveTemplateKey(typeDef, styleDef);
        if (!key) return '';
        const tpl = styleDef.templates[key];
        const format = tpl.format || tpl.template || '';
        if (!format) return '';
        const mergedRules = Object.assign({}, styleDef.globalRules || {}, tpl.rules || {});
        const ctx = applyStyleRules(buildContext(entry, entry.metadata), mergedRules);
        return renderTemplate(format, ctx);
    }

    function resolveTypeForCitation(entry, typeDef, styleId) {
        const sid = resolveStyleId(entry, styleId);
        if (typeDef) {
            if (window.V2SourceTypes && typeof V2SourceTypes.getEffectiveType === 'function' && typeDef.id) {
                return V2SourceTypes.getEffectiveType(typeDef.id, sid) || typeDef;
            }
            return typeDef;
        }
        const typeId = entry.typeId || 'general';
        if (window.V2SourceTypes && typeof V2SourceTypes.getEffectiveType === 'function') {
            return V2SourceTypes.getEffectiveType(typeId, sid) || V2SourceTypes.getType(typeId);
        }
        return window.V2SourceTypes ? V2SourceTypes.getType(typeId) : null;
    }

    function generateCitation(entry, typeDef, styleId) {
        if (!entry) return '';
        const sid = resolveStyleId(entry, styleId);
        const type = resolveTypeForCitation(entry, typeDef, sid);
        if (!type) return entry.citation || entry.title || '';

        const styleDef = getStyleDef(sid);
        if (styleDef && styleDef.templates && Object.keys(styleDef.templates).length) {
            const fromStyle = generateCitationFromStyle(entry, type, styleDef);
            if (fromStyle) return fromStyle;
        }

        const templates = type.citationTemplates || {};
        const template = templates[sid] || templates['history-cn'] || '{title}。';
        const profileRules = (type.styleProfiles && type.styleProfiles[sid] && type.styleProfiles[sid].rules) || {};
        const ctx = applyStyleRules(
            buildContext(entry, entry.metadata),
            Object.assign({}, styleDef && styleDef.globalRules, profileRules)
        );
        return renderTemplate(template, ctx);
    }

    function getDisplayCitation(entry, styleId) {
        const generated = generateCitation(entry, null, styleId);
        if (generated) return generated;
        return entry.title || '';
    }

    function previewFromForm(typeId, title, metadata, styleId) {
        const sid = styleId || (window.V2SourceTypes && V2SourceTypes.getActiveStyleId());
        const type = window.V2SourceTypes && typeof V2SourceTypes.getEffectiveType === 'function'
            ? V2SourceTypes.getEffectiveType(typeId, sid)
            : (window.V2SourceTypes && V2SourceTypes.getType(typeId));
        return generateCitation({ title: title || '', metadata: metadata || {}, typeId }, type, sid);
    }

    function parseFootnoteByRules(text, typeDef) {
        const rules = (typeDef && typeDef.parseRules) || {};
        const fields = {};
        let matchedCount = 0;

        Object.entries(rules).forEach(([key, pattern]) => {
            try {
                const re = new RegExp(pattern);
                const m = String(text).match(re);
                fields[key] = m && m[1] != null ? String(m[1]).trim() : '';
                if (fields[key]) matchedCount++;
            } catch (e) {
                fields[key] = '';
            }
        });

        return { fields, matchedCount };
    }

    function getRequiredFieldKeys(typeDef) {
        return (typeDef && typeDef.fields || [])
            .filter(f => f.required)
            .map(f => f.key);
    }

    function fieldLabel(typeDef, key) {
        const f = (typeDef.fields || []).find(x => x.key === key);
        return f ? f.label : key;
    }

    /**
     * Validate a footnote/citation string against a type's parse rules + required fields.
     * @returns {{ status: 'ok'|'warning'|'error', fields: object, missing: string[], suggested: string, original: string, score: number }}
     */
    function validateFootnoteText(text, typeDef, styleId) {
        const original = String(text || '').trim();
        if (!original) {
            return { status: 'error', fields: {}, missing: [], suggested: '', original, score: 0 };
        }

        const sid = styleId || (window.V2SourceTypes && V2SourceTypes.getActiveStyleId()) || 'history-cn';
        let effective = typeDef;
        if (typeDef && typeDef.id && window.V2SourceTypes && typeof V2SourceTypes.getEffectiveType === 'function') {
            effective = V2SourceTypes.getEffectiveType(typeDef.id, sid) || typeDef;
        }

        const parsed = parseFootnoteByRules(original, effective);
        const required = getRequiredFieldKeys(effective);
        const missing = required.filter(k => !hasValue(parsed.fields[k]));
        const templates = (effective && effective.citationTemplates) || {};
        const template = templates[sid] || templates['history-cn'] || '';
        const suggested = parsed.matchedCount > 0
            ? renderTemplate(template, Object.assign({ title: parsed.fields.title || '' }, parsed.fields))
            : '';

        let status = 'ok';
        if (parsed.matchedCount === 0) status = 'error';
        else if (missing.length) status = 'warning';

        const score = parsed.matchedCount / Math.max(1, Object.keys(effective.parseRules || {}).length || required.length || 1);

        return {
            status,
            fields: parsed.fields,
            missing: missing.map(k => fieldLabel(effective, k)),
            missingKeys: missing,
            suggested,
            original,
            score,
            matchedCount: parsed.matchedCount
        };
    }

    /**
     * Auto-detect best matching type + style for a set of footnotes.
     */
    function sniffFormat(footnotes, types, styleIds) {
        const texts = (footnotes || []).map(f => (typeof f === 'string' ? f : f.text)).filter(Boolean);
        if (!texts.length || !types || !types.length) return null;

        const styles = styleIds || (window.V2SourceTypes && V2SourceTypes.getStyles().map(s => s.id)) || ['history-cn'];
        let best = null;

        types.forEach(typeDef => {
            if (!typeDef.parseRules || !Object.keys(typeDef.parseRules).length) return;
            styles.forEach(styleId => {
                let totalScore = 0;
                let okCount = 0;
                texts.forEach(text => {
                    const r = validateFootnoteText(text, typeDef, styleId);
                    totalScore += r.score;
                    if (r.status === 'ok') okCount++;
                });
                const avg = totalScore / texts.length;
                const candidate = {
                    typeId: typeDef.id,
                    typeName: (window.V2SourceTypes && V2SourceTypes.resolveTypeDisplayName)
                        ? V2SourceTypes.resolveTypeDisplayName(typeDef, styleId)
                        : (typeDef.name || typeDef.id),
                    styleId,
                    avgScore: avg,
                    okCount,
                    total: texts.length
                };
                if (!best || avg > best.avgScore || (avg === best.avgScore && okCount > best.okCount)) {
                    best = candidate;
                }
            });
        });

        return best;
    }

    /**
     * Attempt to fix/split fields and regenerate citation text.
     */
    function suggestFix(text, typeDef, styleId) {
        const result = validateFootnoteText(text, typeDef, styleId);
        const fields = Object.assign({}, result.fields);

        if (!fields.place && !fields.publisher && text.includes('：')) {
            const pubMatch = text.match(/([^：]+)[：:]([^，,]+)[，,]\s*(\d{4})/);
            if (pubMatch) {
                fields.place = fields.place || pubMatch[1].trim();
                fields.publisher = fields.publisher || pubMatch[2].trim();
                fields.year = fields.year || pubMatch[3];
            }
        }

        const sid = styleId || (window.V2SourceTypes && V2SourceTypes.getActiveStyleId()) || 'history-cn';
        const template = (typeDef.citationTemplates && typeDef.citationTemplates[sid]) || '';
        const fixed = renderTemplate(template, Object.assign({ title: fields.title || '' }, fields));

        return {
            fields,
            fixed,
            before: text,
            status: fixed && fixed !== text ? 'fixed' : result.status
        };
    }

    /**
     * Compute project-wide compliance stats for entries.
     */
    function computeProjectCompliance(entries, styleId, typeIdFilter) {
        const list = entries || (typeof global.entries !== 'undefined' ? global.entries : []);
        const sid = styleId || (window.V2SourceTypes && V2SourceTypes.getActiveStyleId()) || 'history-cn';
        const results = [];

        list.forEach(entry => {
            const typeDef = window.V2SourceTypes && V2SourceTypes.getType(entry.typeId || 'general');
            if (typeIdFilter && typeDef && typeDef.id !== typeIdFilter) return;

            const citation = getDisplayCitation(entry, sid);
            if (!citation) return;

            const report = validateFootnoteText(citation, typeDef, sid);
            results.push({
                entryId: entry.id,
                entryTitle: entry.title || entry.id,
                typeId: entry.typeId,
                typeName: typeDef
                    ? ((window.V2SourceTypes && V2SourceTypes.resolveTypeDisplayName)
                        ? V2SourceTypes.resolveTypeDisplayName(typeDef, sid)
                        : (typeDef.name || typeDef.id))
                    : '',
                citation,
                ...report
            });
        });

        const ok = results.filter(r => r.status === 'ok').length;
        const warn = results.filter(r => r.status === 'warning').length;
        const err = results.filter(r => r.status === 'error').length;

        return {
            styleId: sid,
            total: results.length,
            ok,
            warning: warn,
            error: err,
            rate: results.length ? Math.round((ok / results.length) * 100) : 100,
            items: results
        };
    }

    global.V2Citations = {
        renderTemplate,
        generateCitation,
        generateCitationFromStyle,
        getDisplayCitation,
        previewFromForm,
        buildContext,
        resolveStyleId,
        parseFootnoteByRules,
        validateFootnoteText,
        sniffFormat,
        suggestFix,
        computeProjectCompliance,
        formatAuthors,
        applyPageConnector,
        TYPE_TO_TEMPLATE_KEY,
        refreshAllDisplays
    };

    global.switchCitationStyle = async function (styleId) {
        if (!window.V2SourceTypes) return;
        await V2SourceTypes.setActiveStyleId(styleId);
        if (window.V2CitationSwitcher) V2CitationSwitcher.syncToolbar(styleId);
        refreshAllDisplays();
    };

    function refreshAllDisplays() {
        if (typeof renderEntries === 'function') renderEntries();
        if (window.V2Views && typeof V2Views.refreshInfoPanelCitation === 'function') {
            V2Views.refreshInfoPanelCitation();
        }
        if (window.V2DynamicForm && typeof V2DynamicForm.updateCitationPreview === 'function') {
            V2DynamicForm.updateCitationPreview();
        }
        if (window.V2Word && typeof currentViewMode !== 'undefined' && currentViewMode === 'word') {
            if (typeof getFilteredEntries === 'function' && typeof V2Word.render === 'function') {
                const filtered = getFilteredEntries();
                const perPage = typeof ENTRIES_PER_PAGE !== 'undefined' ? ENTRIES_PER_PAGE : 10;
                V2Word.render(filtered, Math.ceil(filtered.length / perPage) || 1);
            }
        }
    }
})(window);
