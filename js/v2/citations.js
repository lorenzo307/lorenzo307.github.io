/**
 * V2.2 — Citation template engine
 *
 * Syntax:
 *   {key}              insert value
 *   {key?, ...content} if key has value, insert content (may contain {key})
 */
(function (global) {
    'use strict';

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

    /**
     * Expand {key?, content} segments. Content may include simple {tokens}.
     * Scans brace depth so nested {x} works; nested optionals not supported.
     */
    function expandOptionals(template, ctx) {
        let src = String(template);
        let out = '';
        let i = 0;
        while (i < src.length) {
            if (src[i] === '{' ) {
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
            date: entry.date || meta.date || '',
            id: entry.id || ''
        });
    }

    function generateCitation(entry, typeDef, styleId) {
        if (!entry) return '';
        const style = styleId || (window.V2SourceTypes && V2SourceTypes.getActiveStyleId()) || 'history-cn';
        const type = typeDef || (window.V2SourceTypes && V2SourceTypes.getType(entry.typeId || 'general'));
        if (!type) return entry.citation || entry.title || '';
        const templates = type.citationTemplates || {};
        const template = templates[style] || templates['history-cn'] || '{title}。';
        return renderTemplate(template, buildContext(entry, entry.metadata));
    }

    function previewFromForm(typeId, title, metadata, styleId) {
        const type = window.V2SourceTypes && V2SourceTypes.getType(typeId);
        return generateCitation({ title: title || '', metadata: metadata || {}, typeId }, type, styleId);
    }

    global.V2Citations = {
        renderTemplate,
        generateCitation,
        previewFromForm,
        buildContext
    };
})(window);
