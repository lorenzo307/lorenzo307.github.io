/**
 * V2.2 — Default source types, citation styles, and schema helpers
 */
(function (global) {
    'use strict';

    function field(key, label, opts) {
        return Object.assign({
            key,
            label,
            type: 'text',
            required: false,
            showInForm: true,
            inCitation: true,
            order: 0
        }, opts || {});
    }

    const DEFAULT_STYLES = [
        { id: 'history-cn', name: '历史研究', description: '中文史书常见著录格式' },
        { id: 'modern-cn', name: '近代史研究', description: '近代史论著常用格式' },
        { id: 'gbt7714', name: 'GB/T 7714', description: '国家标准著录格式（简化）' },
        { id: 'chicago', name: 'Chicago', description: 'Chicago notes（简化）' }
    ];

    /** 文献类型大类（编辑条目时先选大类再选小类） */
    const TYPE_GROUPS = [
        {
            id: 'published',
            name: '图书文献',
            icon: 'menu_book',
            match: ['monograph', 'book', 'thesis', 'gazetteer']
        },
        {
            id: 'periodical',
            name: '报刊论文',
            icon: 'article',
            match: ['journal', 'newspaper', 'article']
        },
        {
            id: 'archival',
            name: '档案文献',
            icon: 'folder_special',
            match: ['archive']
        },
        {
            id: 'general',
            name: '通用其他',
            icon: 'category',
            match: ['general', 'other']
        }
    ];

    /** 导入别名 → 内置类型（避免 book/monograph 重复展示） */
    const TYPE_ALIASES = {
        book: 'monograph',
        article: 'journal'
    };

    function resolveTypeGroup(typeOrId) {
        const id = typeof typeOrId === 'string' ? typeOrId : (typeOrId && typeOrId.id);
        const explicit = typeof typeOrId === 'object' && typeOrId && typeOrId.group;
        if (explicit && TYPE_GROUPS.some(g => g.id === explicit)) return explicit;
        const category = typeof typeOrId === 'object' && typeOrId ? (typeOrId.category || '') : '';
        for (let i = 0; i < TYPE_GROUPS.length; i++) {
            const g = TYPE_GROUPS[i];
            if (g.match.includes(id) || g.match.includes(category)) return g.id;
        }
        return 'general';
    }

    const DEFAULT_TYPES = [
        {
            id: 'general',
            name: '通用史料',
            icon: 'description',
            group: 'general',
            sortOrder: 0,
            isBuiltin: true,
            fields: [
                field('source', '出处', { order: 1 }),
                field('pages', '页码', { order: 2 })
            ],
            citationTemplates: {
                'history-cn': '{title}{source?, ：{source}}{pages?, ，第{pages}页}。',
                'modern-cn': '{title}{source?, ，{source}}{pages?, ，页{pages}}。',
                'gbt7714': '{title}[Z]{source?, .{source}}{pages?, :{pages}}.',
                'chicago': '"{title}"{source?, , {source}}{pages?, , {pages}}.'
            }
        },
        {
            id: 'monograph',
            name: '专著',
            icon: 'menu_book',
            group: 'published',
            sortOrder: 1,
            isBuiltin: true,
            fields: [
                field('author', '作者', { required: true, order: 1 }),
                field('nationality', '国籍', { order: 2, inCitation: false }),
                field('volume', '卷', { order: 3 }),
                field('place', '出版地', { order: 4 }),
                field('publisher', '出版社', { required: true, order: 5 }),
                field('year', '出版时间', { order: 6 }),
                field('pages', '页码', { order: 7 })
            ],
            citationTemplates: {
                'history-cn': '{author}：《{title}》{volume?, ，{volume}}，{place}：{publisher}，{year}年{pages?, ，第{pages}页}。',
                'modern-cn': '{author}：《{title}》，{place}：{publisher}，{year}年{pages?, ，页{pages}}。',
                'gbt7714': '{author}. {title}[M]. {place}: {publisher}, {year}{pages?, :{pages}}.',
                'chicago': '{author}, {title} ({place}: {publisher}, {year}){pages?, , {pages}}.'
            }
        },
        {
            id: 'journal',
            name: '期刊',
            icon: 'article',
            group: 'periodical',
            sortOrder: 2,
            isBuiltin: true,
            fields: [
                field('author', '作者', { required: true, order: 1 }),
                field('journal', '期刊名', { required: true, order: 2 }),
                field('year', '年份', { order: 3 }),
                field('volume', '卷期', { order: 4 }),
                field('pages', '页码', { order: 5 })
            ],
            citationTemplates: {
                'history-cn': '{author}：《{title}》，《{journal}》{year}年{volume?, 第{volume}期}{pages?, ，第{pages}页}。',
                'modern-cn': '{author}：《{title}》，《{journal}》{year}年{volume}期。',
                'gbt7714': '{author}. {title}[J]. {journal}, {year}{volume?, , {volume}}{pages?, :{pages}}.',
                'chicago': '{author}, "{title}," {journal} {volume} ({year}){pages?, : {pages}}.'
            },
            parseRules: {
                author: '([^：:《\\n]+)[：:]',
                title: '《([^》]+)》',
                journal: '，《([^》]+)》',
                year: '(\\d{4})年',
                volume: '第(\\d+)期',
                pages: '第([\\d\\-－—]+)页'
            },
            example: '陈寅恪：《隋唐制度渊源略论稿》，《历史研究》1954年第2期，第15-30页。'
        },
        {
            id: 'thesis',
            name: '论文',
            icon: 'school',
            group: 'published',
            sortOrder: 3,
            isBuiltin: true,
            fields: [
                field('author', '作者', { required: true, order: 1 }),
                field('degree', '学位', { order: 2 }),
                field('institution', '授予单位', { order: 3 }),
                field('year', '年份', { order: 4 }),
                field('pages', '页码', { order: 5 })
            ],
            citationTemplates: {
                'history-cn': '{author}：《{title}》{degree?, （{degree}）}，{institution}，{year}年{pages?, ，第{pages}页}。',
                'modern-cn': '{author}：《{title}》，{institution}{degree}论文，{year}年。',
                'gbt7714': '{author}. {title}[D]. {institution}, {year}.',
                'chicago': '{author}, "{title}" ({degree}, {institution}, {year}){pages?, , {pages}}.'
            }
        },
        {
            id: 'newspaper',
            name: '报纸',
            icon: 'newspaper',
            group: 'periodical',
            sortOrder: 4,
            isBuiltin: true,
            fields: [
                field('newspaper', '报纸名', { required: true, order: 1 }),
                field('issueDate', '日期', { type: 'date', order: 2 }),
                field('edition', '版次', { order: 3 }),
                field('column', '栏目', { order: 4 }),
                field('author', '作者', { order: 5 }),
                field('pages', '页码', { order: 6 })
            ],
            citationTemplates: {
                'history-cn': '{author?, {author}：}《{title}》，《{newspaper}》{issueDate}{edition?, ，第{edition}版}。',
                'modern-cn': '《{newspaper}》{issueDate}，{title}。',
                'gbt7714': '{author?, {author}. }{title}[N]. {newspaper}, {issueDate}{edition?, ({edition})}.',
                'chicago': '{author?, {author}, }"{title}," {newspaper}, {issueDate}{edition?, , {edition}}.'
            }
        },
        {
            id: 'archive',
            name: '档案',
            icon: 'folder_special',
            group: 'archival',
            sortOrder: 5,
            isBuiltin: true,
            fields: [
                field('archive', '档案馆', { required: true, order: 1 }),
                field('fond', '全宗', { order: 2 }),
                field('catalog', '目录', { order: 3 }),
                field('file', '案卷', { order: 4 }),
                field('document', '文件', { order: 5 }),
                field('formedAt', '形成时间', { order: 6 }),
                field('pages', '页码', { order: 7 })
            ],
            citationTemplates: {
                'history-cn': '{archive}藏：{fond?, {fond}全宗}{catalog?, ，目录{catalog}}{file?, ，案卷{file}}{document?, ，{document}}{formedAt?, （{formedAt}）}{pages?, ，第{pages}页}。',
                'modern-cn': '{archive}，{fond}全宗{file?, /{file}}，{title}。',
                'gbt7714': '{title}[A]. {archive}{fond?, , {fond}}{file?, /{file}}.',
                'chicago': '{document?, {document}, }{archive}{fond?, , {fond}}{file?, /{file}}.'
            }
        },
        {
            id: 'gazetteer',
            name: '地方志',
            icon: 'map',
            group: 'published',
            sortOrder: 6,
            isBuiltin: true,
            fields: [
                field('gazetteer', '志书', { required: true, order: 1 }),
                field('volume', '卷', { order: 2 }),
                field('publisher', '出版社', { order: 3 }),
                field('year', '时间', { order: 4 }),
                field('pages', '页', { order: 5 })
            ],
            citationTemplates: {
                'history-cn': '《{gazetteer}》{volume?, 卷{volume}}{publisher?, ，{publisher}}{year?, ，{year}年}{pages?, ，第{pages}页}。',
                'modern-cn': '《{gazetteer}》{volume}，第{pages}页。',
                'gbt7714': '{gazetteer}[Z]. {publisher}, {year}{pages?, :{pages}}.',
                'chicago': '{gazetteer}{volume?, , vol. {volume}} ({publisher}, {year}){pages?, , {pages}}.'
            }
        },
        {
            id: 'other',
            name: '其它',
            icon: 'more_horiz',
            group: 'general',
            sortOrder: 99,
            isBuiltin: true,
            fields: [
                field('note', '说明', { order: 1, inCitation: true })
            ],
            citationTemplates: {
                'history-cn': '{title}{note?, （{note}）}。',
                'modern-cn': '{title}。',
                'gbt7714': '{title}[Z].',
                'chicago': '{title}.'
            }
        }
    ];

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function getDefaultTypes() {
        return clone(DEFAULT_TYPES);
    }

    function getDefaultStyles() {
        return clone(DEFAULT_STYLES);
    }

    function normalizeType(raw) {
        if (!raw || !raw.id) return null;
        const t = clone(raw);
        t.name = t.name || t.id;
        t.icon = t.icon || 'description';
        t.sortOrder = typeof t.sortOrder === 'number' ? t.sortOrder : 50;
        t.fields = Array.isArray(t.fields) ? t.fields.map((f, i) => field(f.key, f.label || f.key, Object.assign({}, f, { order: f.order != null ? f.order : i + 1 }))) : [];
        t.citationTemplates = t.citationTemplates || {};
        t.parseRules = t.parseRules && typeof t.parseRules === 'object' ? t.parseRules : {};
        t.styleProfiles = t.styleProfiles && typeof t.styleProfiles === 'object' && !Array.isArray(t.styleProfiles)
            ? t.styleProfiles
            : {};
        t.category = t.category || t.type || 'other';
        t.group = t.group || resolveTypeGroup(t);
        t.example = t.example || '';
        t.typeCode = t.typeCode || '';
        t.description = t.description || '';
        return t;
    }

    /**
     * 按引用样式合并「样式专属配置」，避免多套样式字段/模板互相覆盖。
     */
    function getEffectiveType(typeDef, styleId) {
        if (!typeDef) return null;
        const t = clone(typeDef);
        const sid = styleId || 'history-cn';
        const profile = t.styleProfiles && t.styleProfiles[sid];
        if (profile && typeof profile === 'object') {
            if (Array.isArray(profile.fields) && profile.fields.length) {
                t.fields = profile.fields.map((f, i) =>
                    field(f.key, f.label || f.key, Object.assign({}, f, { order: f.order != null ? f.order : i + 1 }))
                );
            }
            if (profile.parseRules && typeof profile.parseRules === 'object') {
                t.parseRules = Object.assign({}, profile.parseRules);
            }
            if (profile.label) t.profileLabel = String(profile.label);
            if (profile.example != null) t.example = String(profile.example);
            if (profile.description) t.description = String(profile.description);
            if (profile.typeCode) t.typeCode = String(profile.typeCode);
        }
        t._styleId = sid;
        return t;
    }

    global.V2SourceSchema = {
        DEFAULT_TYPES,
        DEFAULT_STYLES,
        TYPE_GROUPS,
        TYPE_ALIASES,
        field,
        getDefaultTypes,
        getDefaultStyles,
        normalizeType,
        getEffectiveType,
        resolveTypeGroup,
        clone
    };
})(window);
