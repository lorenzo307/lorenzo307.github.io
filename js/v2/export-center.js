/**
 * V2.4 — Export Center (Markdown / HTML / Word / PDF / BibTeX / RIS / CSV / JSON / Excel)
 */
(function (global) {
    'use strict';

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function strip(html) {
        if (window.V2Utils) return V2Utils.stripHtml(html || '');
        const d = document.createElement('div');
        d.innerHTML = html || '';
        return (d.textContent || '').trim();
    }

    function projectName() {
        return document.getElementById('projectTitle')?.textContent ||
            document.getElementById('v2-project-title')?.textContent ||
            '史料导出';
    }

    function stamp() {
        return new Date().toISOString().slice(0, 10);
    }

    function getTargetEntries(scope) {
        if (scope === 'selected' && typeof selectedEntryIds !== 'undefined' && selectedEntryIds.size) {
            return entries.filter(e => selectedEntryIds.has(e.id) || selectedAll);
        }
        if (typeof getFilteredEntries === 'function') return getFilteredEntries();
        return typeof entries !== 'undefined' ? entries.slice() : [];
    }

    function downloadBlob(content, filename, mime) {
        const blob = content instanceof Blob
            ? content
            : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function entryCitation(entry) {
        return (window.V2Citations && V2Citations.getDisplayCitation(entry)) || entry.citation || '';
    }

    function bibKey(entry) {
        const author = (entry.metadata && entry.metadata.author) || 'anon';
        const year = (entry.metadata && entry.metadata.year) || (entry.date || '').slice(0, 4) || 'nd';
        const slug = (entry.title || entry.id || 'item')
            .replace(/[^\w\u4e00-\u9fff]+/g, '')
            .slice(0, 12);
        return `${author.replace(/\s+/g, '')}${year}${slug}`.replace(/[^\w\u4e00-\u9fff]/g, '');
    }

    function bibType(entry) {
        const map = {
            monograph: 'book',
            journal: 'article',
            thesis: 'phdthesis',
            newspaper: 'article',
            archive: 'unpublished',
            gazetteer: 'book',
            general: 'misc',
            other: 'misc'
        };
        return map[entry.typeId] || 'misc';
    }

    function toBibTeX(list) {
        return list.map(entry => {
            const meta = entry.metadata || {};
            const fields = {
                title: entry.title || '',
                author: meta.author || '',
                year: meta.year || (entry.date || '').slice(0, 4),
                publisher: meta.publisher || '',
                address: meta.place || '',
                journal: meta.journal || meta.newspaper || '',
                volume: meta.volume || '',
                pages: meta.pages || '',
                note: entryCitation(entry) || meta.note || '',
                keywords: (entry.keywords || []).join(', '),
                url: (entry.links && entry.links[0]) || '',
                annote: strip(entry.analysis).slice(0, 500)
            };
            const lines = Object.entries(fields)
                .filter(([, v]) => v)
                .map(([k, v]) => `  ${k} = {${String(v).replace(/[{}]/g, '')}}`);
            return `@${bibType(entry)}{${bibKey(entry)},\n${lines.join(',\n')}\n}`;
        }).join('\n\n');
    }

    function toRIS(list) {
        const typeMap = {
            monograph: 'BOOK',
            journal: 'JOUR',
            thesis: 'THES',
            newspaper: 'NEWS',
            archive: 'MANSCPT',
            gazetteer: 'BOOK',
            general: 'GEN',
            other: 'GEN'
        };
        return list.map(entry => {
            const meta = entry.metadata || {};
            const lines = [
                `TY  - ${typeMap[entry.typeId] || 'GEN'}`,
                `TI  - ${entry.title || ''}`,
                meta.author ? `AU  - ${meta.author}` : '',
                (meta.year || entry.date) ? `PY  - ${(meta.year || entry.date || '').toString().slice(0, 4)}` : '',
                meta.publisher ? `PB  - ${meta.publisher}` : '',
                meta.place ? `CY  - ${meta.place}` : '',
                meta.journal ? `JO  - ${meta.journal}` : '',
                meta.newspaper ? `T2  - ${meta.newspaper}` : '',
                meta.volume ? `VL  - ${meta.volume}` : '',
                meta.pages ? `SP  - ${meta.pages}` : '',
                entryCitation(entry) ? `N1  - ${entryCitation(entry)}` : '',
                ...(entry.keywords || []).map(k => `KW  - ${k}`),
                ...(entry.links || []).map(u => `UR  - ${u}`),
                strip(entry.content) ? `AB  - ${strip(entry.content).slice(0, 2000)}` : '',
                `ID  - ${entry.id || ''}`,
                'ER  - '
            ].filter(Boolean);
            return lines.join('\n');
        }).join('\n\n');
    }

    function formatEvents(entry) {
        const list = window.V2Events
            ? V2Events.normalizeEvents(entry.events)
            : (Array.isArray(entry.events) ? entry.events : []);
        return list.map(ev => `${ev.date || ''} ${ev.description || ''}`.trim()).filter(Boolean).join('；');
    }

    function toCSV(list) {
        const headers = ['ID', '日期', '标题', '文献类型', '引用', '作者', '关键词', '关联事件', '原文', '分析', '关联文献'];
        const rows = list.map(e => {
            const meta = e.metadata || {};
            const typeName = window.V2SourceTypes ? V2SourceTypes.typeName(e.typeId) : (e.typeId || '');
            return [
                e.id, e.date, e.title, typeName, entryCitation(e),
                meta.author || '', (e.keywords || []).join('; '),
                formatEvents(e),
                strip(e.content), strip(e.analysis),
                (e.relatedSources || []).join('; ')
            ].map(cell => {
                const s = String(cell ?? '').replace(/"/g, '""');
                return `"${s}"`;
            }).join(',');
        });
        return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    }

    function toMarkdown(list) {
        let md = `# ${projectName()}\n\n`;
        md += `> 导出时间：${new Date().toLocaleString('zh-CN')}  \n`;
        md += `> 共 ${list.length} 条\n\n---\n\n`;
        list.forEach(e => {
            const typeName = window.V2SourceTypes ? V2SourceTypes.typeName(e.typeId) : '';
            md += `## ${e.title || '无标题'}\n\n`;
            md += `- **ID**：${e.id || ''}  \n`;
            md += `- **日期**：${e.date || ''}  \n`;
            if (typeName) md += `- **类型**：${typeName}  \n`;
            const cite = entryCitation(e);
            if (cite) md += `- **引用**：${cite}  \n`;
            if (e.keywords?.length) md += `- **标签**：${e.keywords.join('、')}  \n`;
            if (e.relatedSources?.length) md += `- **关联**：${e.relatedSources.join('、')}  \n`;
            const evText = formatEvents(e);
            if (evText) md += `- **关联事件**：${evText}  \n`;
            md += `\n### 原文\n\n${strip(e.content) || '（无）'}\n\n`;
            if (e.analysis) md += `### 分析\n\n${strip(e.analysis)}\n\n`;
            md += `---\n\n`;
        });
        return md;
    }

    function toHTML(list, forPrint) {
        const body = list.map(e => {
            const typeName = window.V2SourceTypes ? V2SourceTypes.typeName(e.typeId) : '';
            const cite = entryCitation(e);
            return `<article class="entry">
                <h2>${esc(e.title || '无标题')}</h2>
                <p class="meta">${esc(e.id)} · ${esc(e.date || '')}${typeName ? ' · ' + esc(typeName) : ''}</p>
                ${cite ? `<p class="cite"><em>${esc(cite)}</em></p>` : ''}
                <h3>原文</h3>
                <div class="content">${DOMPurify.sanitize(e.content || '<p>（无）</p>')}</div>
                ${e.analysis ? `<h3>分析</h3><div class="analysis">${DOMPurify.sanitize(e.analysis)}</div>` : ''}
                ${e.keywords?.length ? `<p class="tags">标签：${e.keywords.map(esc).join('、')}</p>` : ''}
            </article>`;
        }).join('\n<hr>\n');

        return `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<title>${esc(projectName())}</title>
<style>
  body{font-family:"Songti SC","SimSun",serif;line-height:1.8;max-width:800px;margin:40px auto;padding:0 24px;color:#222}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #bbb;padding:8px}img{max-width:100%;height:auto}figcaption{font-size:12px;color:#666}.research-footnote{font-size:.8em;background:#f5f2ea}
  h1{border-bottom:2px solid #333;padding-bottom:8px}
  h2{margin-top:1.6em;font-size:1.25rem}
  h3{font-size:1rem;color:#555;margin-top:1.2em}
  .meta,.tags{color:#666;font-size:0.9rem}
  .cite{border-left:3px solid #999;padding-left:12px;color:#444}
  hr{border:none;border-top:1px dashed #ccc;margin:2em 0}
  ${forPrint ? '@media print{body{margin:0;max-width:none}}' : ''}
</style></head><body>
<h1>${esc(projectName())}</h1>
<p>导出时间：${esc(new Date().toLocaleString('zh-CN'))} · 共 ${list.length} 条</p>
${body}
</body></html>`;
    }

    function toJSON(list) {
        return JSON.stringify({
            project: projectName(),
            exportedAt: new Date().toISOString(),
            count: list.length,
            entries: list.map(e => ({
                ...e,
                id: e.id,
                date: e.date,
                title: e.title,
                typeId: e.typeId || 'general',
                metadata: e.metadata || {},
                citation: entryCitation(e),
                content: e.content || '',
                analysis: e.analysis || '',
                keywords: e.keywords || [],
                links: e.links || [],
                events: window.V2Events ? V2Events.normalizeEvents(e.events) : (e.events || []),
                relatedSources: e.relatedSources || [],
                starred: !!e.starred,
                comments: e.comments || {},
                createdAt: e.createdAt,
                updatedAt: e.updatedAt
            }))
        }, null, 2);
    }

    async function exportFormat(format, scope) {
        const list = getTargetEntries(scope);
        if (!list.length) {
            if (typeof showAlert === 'function') showAlert('没有可导出的条目', 'warning');
            return;
        }
        const name = `${projectName()}_${stamp()}`;
        try {
            if (typeof showLoading === 'function') showLoading('正在导出…');
            switch (format) {
                case 'excel':
                    if (typeof exportExcel === 'function') {
                        await exportExcel(list, 'excel');
                        return;
                    }
                    throw new Error('Excel 导出不可用');
                case 'csv':
                    downloadBlob(toCSV(list), `${name}.csv`, 'text/csv;charset=utf-8');
                    break;
                case 'markdown':
                    downloadBlob(toMarkdown(list), `${name}.md`, 'text/markdown;charset=utf-8');
                    break;
                case 'html':
                    downloadBlob(toHTML(list, false), `${name}.html`, 'text/html;charset=utf-8');
                    break;
                case 'word':
                    // Word opens HTML .doc reliably without extra libs
                    downloadBlob(toHTML(list, false), `${name}.doc`, 'application/msword');
                    break;
                case 'pdf': {
                    const w = window.open('', '_blank');
                    if (!w) throw new Error('请允许弹出窗口以导出 PDF');
                    w.document.write(toHTML(list, true));
                    w.document.close();
                    setTimeout(() => { w.focus(); w.print(); }, 400);
                    break;
                }
                case 'bibtex':
                    downloadBlob(toBibTeX(list), `${name}.bib`, 'application/x-bibtex;charset=utf-8');
                    break;
                case 'ris':
                case 'endnote':
                    downloadBlob(toRIS(list), `${name}.ris`, 'application/x-research-info-systems;charset=utf-8');
                    break;
                case 'json':
                    downloadBlob(toJSON(list), `${name}.json`, 'application/json;charset=utf-8');
                    break;
                default:
                    throw new Error('未知格式: ' + format);
            }
            if (typeof showAlert === 'function' && format !== 'excel') {
                showAlert(`已导出 ${list.length} 条（${format.toUpperCase()}）`, 'success');
            }
        } catch (err) {
            console.error(err);
            if (typeof showAlert === 'function') showAlert('导出失败: ' + err.message, 'error');
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    }

    function ensureModal() {
        if (document.getElementById('v2-export-center')) return;
        const modal = document.createElement('div');
        modal.id = 'v2-export-center';
        modal.className = 'form-popup v2-export-center';
        modal.style.display = 'none';
        modal.innerHTML = `
            <h2>导出中心</h2>
            <p class="v2-export-desc">将当前筛选结果或选中条目导出为多种学术格式。</p>
            <div class="v2-export-scope">
                <label><input type="radio" name="v2-export-scope" value="filtered" checked> 当前筛选结果</label>
                <label><input type="radio" name="v2-export-scope" value="selected"> 仅选中条目</label>
            </div>
            <div class="v2-export-grid" id="v2-export-grid">
                ${[
                    ['excel', 'table_view', 'Excel', '表格，便于再编辑'],
                    ['csv', 'grid_on', 'CSV', '通用表格'],
                    ['markdown', 'notes', 'Markdown', '笔记 / Obsidian'],
                    ['html', 'language', 'HTML', '网页阅读'],
                    ['word', 'description', 'Word', '论文粘贴'],
                    ['pdf', 'picture_as_pdf', 'PDF', '打印另存'],
                    ['bibtex', 'menu_book', 'BibTeX', 'LaTeX / Zotero'],
                    ['ris', 'library_books', 'RIS', 'EndNote / Zotero'],
                    ['endnote', 'auto_stories', 'EndNote', 'RIS 兼容'],
                    ['json', 'data_object', 'JSON', '完整备份']
                ].map(([id, icon, title, tip]) => `
                    <button type="button" class="v2-export-card" data-format="${id}">
                        <span class="material-icons">${icon}</span>
                        <strong>${title}</strong>
                        <span>${tip}</span>
                    </button>
                `).join('')}
            </div>
            <div class="action-buttons">
                <button type="button" class="cancel-btn" id="v2-export-close">关闭</button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('v2-export-close').onclick = hide;
        modal.querySelectorAll('.v2-export-card').forEach(btn => {
            btn.onclick = () => {
                const scope = modal.querySelector('input[name="v2-export-scope"]:checked')?.value || 'filtered';
                exportFormat(btn.dataset.format, scope);
            };
        });
    }

    function show() {
        ensureModal();
        const modal = document.getElementById('v2-export-center');
        modal.style.display = 'block';
        modal.classList.remove('closing');
    }

    function hide() {
        const modal = document.getElementById('v2-export-center');
        if (!modal) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 180);
    }

    // Sidebar export is handled by V2Nav; keep wire as no-op for compatibility
    function wire() {}

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }

    // Patch legacy exportEntries to open center when called without specifics
    function patchLegacy() {
        if (typeof global.exportEntries === 'function' && !global.exportEntries._v24) {
            const orig = global.exportEntries;
            global.exportEntries = function (format) {
                if (!format || format === 'center') {
                    show();
                    return;
                }
                if (['excel', 'xlsx'].includes(format)) return orig(format);
                return exportFormat(format, 'filtered');
            };
            global.exportEntries._v24 = true;
        }
    }
    setTimeout(patchLegacy, 0);
    document.addEventListener('firebaseReady', () => setTimeout(patchLegacy, 300));

    global.V2Export = {
        show,
        hide,
        exportFormat,
        toBibTeX,
        toRIS,
        toMarkdown,
        toHTML,
        toCSV,
        toJSON
    };
})(window);
