/**
 * V2.3 — Markdown template import/export for source types
 *
 * Format: YAML Front Matter + optional Markdown body (ignored on import)
 */
(function (global) {
    'use strict';

    function slugId(name) {
        const base = String(name || 'custom')
            .trim()
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fff]+/g, '_')
            .replace(/^_+|_+$/g, '');
        if (/^[a-zA-Z]/.test(base)) return base.slice(0, 40);
        return 'custom_' + Date.now().toString(36);
    }

    /** Minimal YAML parser for front matter (objects, arrays, scalars) */
    function parseSimpleYaml(text) {
        const lines = String(text).replace(/\r\n/g, '\n').split('\n');
        const root = {};
        const stack = [{ indent: -1, obj: root, key: null }];
        let i = 0;

        function countIndent(line) {
            const m = line.match(/^(\s*)/);
            return m ? m[1].length : 0;
        }

        function parseScalar(raw) {
            const v = String(raw).trim();
            if (v === 'true') return true;
            if (v === 'false') return false;
            if (v === 'null' || v === '~') return null;
            if (/^-?\d+$/.test(v)) return parseInt(v, 10);
            if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
            const q = v.match(/^["'](.*)["']$/);
            if (q) return q[1];
            return v;
        }

        while (i < lines.length) {
            const line = lines[i];
            i++;
            if (!line.trim() || line.trim().startsWith('#')) continue;

            const indent = countIndent(line);
            const trimmed = line.trim();

            while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
                stack.pop();
            }
            const cur = stack[stack.length - 1];

            if (trimmed.startsWith('- ')) {
                const itemText = trimmed.slice(2);
                let arr = cur.obj;
                if (cur.key != null) {
                    if (!Array.isArray(cur.obj[cur.key])) cur.obj[cur.key] = [];
                    arr = cur.obj[cur.key];
                }
                if (itemText.includes(':')) {
                    const obj = {};
                    const [k, ...rest] = itemText.split(':');
                    const val = rest.join(':').trim();
                    if (val) obj[k.trim()] = parseScalar(val);
                    arr.push(obj);
                    stack.push({ indent, obj, key: null });
                    stack[stack.length - 1].obj = obj;
                } else {
                    arr.push(parseScalar(itemText));
                }
                continue;
            }

            const colon = trimmed.indexOf(':');
            if (colon < 0) continue;
            const key = trimmed.slice(0, colon).trim();
            let val = trimmed.slice(colon + 1).trim();

            if (!val) {
                const next = lines[i];
                if (next && (next.trim().startsWith('- ') || countIndent(next) > indent)) {
                    cur.obj[key] = [];
                    stack.push({ indent, obj: cur.obj, key });
                } else {
                    cur.obj[key] = {};
                    stack.push({ indent, obj: cur.obj[key], key: null });
                }
                continue;
            }

            if (val.startsWith('[') && val.endsWith(']')) {
                cur.obj[key] = val.slice(1, -1).split(',').map(s => parseScalar(s.trim())).filter(s => s !== '');
            } else {
                cur.obj[key] = parseScalar(val);
            }
        }

        return root;
    }

    function parseFrontMatter(text) {
        const src = String(text || '').replace(/^\uFEFF/, '');
        const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) throw new Error('缺少 YAML Front Matter（文件需以 --- 开头）');
        const data = parseSimpleYaml(match[1]);
        const body = src.slice(match[0].length).replace(/^\s+/, '');
        return { data, body };
    }

    function inferParseRules(fields, template) {
        const rules = {};
        const keys = (fields || []).map(f => f.key);
        if (keys.includes('author')) rules.author = '([^：:《\\n]+)[：:]';
        if (keys.includes('title')) rules.title = '《([^》]+)》';
        if (keys.includes('journal')) rules.journal = '，《([^》]+)》';
        if (keys.includes('year')) rules.year = '(\\d{4})年';
        if (keys.includes('issue') || keys.includes('volume')) rules.issue = '第(\\d+)期';
        if (keys.includes('pages')) rules.pages = '第([\\d\\-－—]+)页';
        if (keys.includes('place')) rules.place = '，([^：:]+)[：:]';
        if (keys.includes('publisher')) rules.publisher = '[：:]([^，,\\d]+)[，,]?\\s*(\\d{4})';
        if (keys.includes('publisher') && !rules.publisher) rules.publisher = '[：:]([^，。]+)';
        return rules;
    }

    function normalizeImportedFields(rawFields) {
        if (!Array.isArray(rawFields)) return [];
        return rawFields.map((f, i) => ({
            key: String(f.key || f.name || 'field' + (i + 1)).trim(),
            label: String(f.label || f.key || '字段').trim(),
            type: f.type || 'text',
            required: !!f.required,
            showInForm: f.showInForm !== false,
            inCitation: f.inCitation !== false,
            order: f.order != null ? f.order : i + 1
        })).filter(f => f.key);
    }

    /**
     * Convert parsed Markdown front matter → V2 source type definition
     */
    function markdownToTypeDef(text, activeStyleId) {
        const { data, body } = parseFrontMatter(text);
        if (!data.name) throw new Error('模板缺少 name 字段');

        const styleId = activeStyleId || 'history-cn';
        const fields = normalizeImportedFields(data.fields);
        const template = data.template || '';
        if (!template) throw new Error('模板缺少 template 字段');
        if (!fields.length) throw new Error('模板缺少 fields 定义');

        const id = data.id || slugId(data.name);
        const parseRules = data.parseRules && typeof data.parseRules === 'object'
            ? data.parseRules
            : inferParseRules(fields, template);

        const citationTemplates = {};
        citationTemplates[styleId] = template;

        return {
            id,
            name: String(data.name),
            icon: data.icon || 'category',
            category: data.type || data.category || 'other',
            sortOrder: 80,
            isBuiltin: false,
            isPublic: !!data.isPublic,
            example: data.example || '',
            fields,
            citationTemplates,
            parseRules,
            _markdownBody: body
        };
    }

    function yamlEscape(str) {
        const s = String(str || '');
        if (/[:#\n"'\\]/.test(s) || s.startsWith(' ')) return JSON.stringify(s);
        return s;
    }

    function fieldsToYaml(fields) {
        return (fields || []).map(f => {
            const parts = [
                `  - key: ${yamlEscape(f.key)}`,
                `    label: ${yamlEscape(f.label || f.key)}`,
                `    type: ${yamlEscape(f.type || 'text')}`
            ];
            if (f.required) parts.push('    required: true');
            return parts.join('\n');
        }).join('\n');
    }

    function parseRulesToYaml(rules) {
        if (!rules || !Object.keys(rules).length) return '';
        return Object.entries(rules).map(([k, v]) => `  ${k}: ${JSON.stringify(String(v))}`).join('\n');
    }

    /**
     * Export type definition → Markdown file content
     */
    function typeToMarkdown(typeDef, styleId) {
        const type = typeDef || {};
        const sid = styleId || 'history-cn';
        const template = (type.citationTemplates && type.citationTemplates[sid]) || '';
        const fieldsYaml = fieldsToYaml(type.fields);
        const rulesYaml = parseRulesToYaml(type.parseRules);

        let front = `---
name: ${yamlEscape(type.name || type.id)}
id: ${yamlEscape(type.id)}
type: ${yamlEscape(type.category || 'other')}
fields:
${fieldsYaml}
template: ${yamlEscape(template)}`;

        if (type.example) front += `\nexample: ${yamlEscape(type.example)}`;
        if (rulesYaml) front += `\nparseRules:\n${rulesYaml}`;
        if (type.isPublic) front += `\nisPublic: true`;
        front += '\n---\n';

        const body = `# ${type.name || type.id} 引用格式说明

> 由史料数据库导出的文献类型模板。修改后可通过「导入 Markdown 模板」重新导入。

${type.example ? `## 示例\n\n${type.example}\n` : ''}
## 字段说明

${(type.fields || []).map(f => `- **${f.label}** (\`${f.key}\`)${f.required ? ' — 必填' : ''}`).join('\n')}
`;

        return front + '\n' + body;
    }

    function downloadMarkdown(filename, content) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    global.V2TemplateMarkdown = {
        parseFrontMatter,
        markdownToTypeDef,
        typeToMarkdown,
        downloadMarkdown,
        inferParseRules,
        slugId
    };
})(window);
