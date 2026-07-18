/**
 * V2.3 — Word footnote compliance: extract, validate, sniff, fix
 */
(function (global) {
    'use strict';

    let reportModal = null;

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function loadJSZip() {
        if (window.JSZip) return window.JSZip;
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        return window.JSZip;
    }

    function xmlText(node) {
        if (!node) return '';
        const texts = [];
        const walk = (n) => {
            if (n.nodeType === 3) texts.push(n.textContent);
            else if (n.childNodes) Array.from(n.childNodes).forEach(walk);
        };
        walk(node);
        return texts.join('').replace(/\s+/g, ' ').trim();
    }

    /**
     * Extract footnote bodies from .docx (word/footnotes.xml + endnotes.xml)
     */
    async function extractFootnotesFromDocx(file) {
        const JSZip = await loadJSZip();
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const footnotes = [];

        async function readXmlPart(path, label) {
            const entry = zip.file(path);
            if (!entry) return;
            const xml = await entry.async('string');
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
            doc.querySelectorAll('footnote, endnote').forEach((node, i) => {
                const id = node.getAttributeNS(ns, 'id') || node.getAttribute('w:id') || String(i + 1);
                if (id === '-1' || id === '0') return;
                const text = xmlText(node);
                if (text) footnotes.push({ index: footnotes.length + 1, id, text, source: label });
            });
            doc.querySelectorAll('*[local-name()="footnote"], *[local-name()="endnote"]').forEach((node, i) => {
                const id = node.getAttribute('w:id') || String(i + 1);
                if (id === '-1' || id === '0') return;
                const text = xmlText(node);
                if (text && !footnotes.some(f => f.text === text)) {
                    footnotes.push({ index: footnotes.length + 1, id, text, source: label });
                }
            });
        }

        await readXmlPart('word/footnotes.xml', 'footnote');
        await readXmlPart('word/endnotes.xml', 'endnote');

        if (!footnotes.length) {
            const docEntry = zip.file('word/document.xml');
            if (docEntry) {
                const xml = await docEntry.async('string');
                const plain = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const chunks = plain.match(/[^\n。；;]{20,200}[。；;]?/g) || [];
                chunks.slice(-20).forEach((text, i) => {
                    if (/《|》|第\d+页|出版社|档案馆/.test(text)) {
                        footnotes.push({ index: i + 1, id: String(i + 1), text: text.trim(), source: 'heuristic' });
                    }
                });
            }
        }

        return footnotes;
    }

    async function validateWordFootnotes(file, typeId, styleId) {
        await (window.V2SourceTypes && V2SourceTypes.load());
        const typeDef = window.V2SourceTypes && V2SourceTypes.getType(typeId || 'journal');
        if (!typeDef) throw new Error('未找到目标文献类型');

        const footnotes = await extractFootnotesFromDocx(file);
        if (!footnotes.length) throw new Error('未能从 Word 文档中提取脚注，请确认文档包含脚注或尾注');

        const sid = styleId || V2SourceTypes.getActiveStyleId();
        const report = footnotes.map(fn => {
            const v = V2Citations.validateFootnoteText(fn.text, typeDef, sid);
            const fix = v.status !== 'ok' ? V2Citations.suggestFix(fn.text, typeDef, sid) : null;
            return {
                index: fn.index,
                original: fn.text,
                status: v.status,
                missing: v.missing,
                fields: v.fields,
                suggested: fix ? fix.fixed : v.suggested,
                fix
            };
        });

        const sniff = !typeId ? V2Citations.sniffFormat(
            footnotes.map(f => f.text),
            V2SourceTypes.getTypes(),
            V2SourceTypes.getStyles().map(s => s.id)
        ) : null;

        return { report, sniff, typeDef, styleId: sid, footnoteCount: footnotes.length };
    }

    function statusIcon(status) {
        if (status === 'ok') return '<span class="v2-cc-ok">✅ 合规</span>';
        if (status === 'warning') return '<span class="v2-cc-warn">⚠️ 字段缺失</span>';
        return '<span class="v2-cc-err">❌ 无法解析</span>';
    }

    function ensureReportModal() {
        if (document.getElementById('v2-compliance-report')) return;
        const modal = document.createElement('div');
        modal.id = 'v2-compliance-report';
        modal.className = 'form-popup v2-compliance-report';
        modal.style.display = 'none';
        modal.innerHTML = `
            <h2>脚注合规性报告</h2>
            <div id="v2-cc-summary" class="v2-cc-summary"></div>
            <div id="v2-cc-sniff" class="v2-cc-sniff" hidden></div>
            <div class="v2-cc-table-wrap">
                <table class="v2-cc-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>原始文本</th>
                            <th>状态</th>
                            <th>缺失字段</th>
                            <th>建议修正</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="v2-cc-tbody"></tbody>
                </table>
            </div>
            <div class="action-buttons">
                <button type="button" class="primary-btn" id="v2-cc-copy-all">复制全部修正</button>
                <button type="button" class="cancel-btn btn-icon-only" id="v2-cc-close" title="关闭"><span class="material-icons">close</span></button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#v2-cc-close').onclick = () => { modal.style.display = 'none'; };
        reportModal = modal;
    }

    function showValidationReport(result) {
        ensureReportModal();
        const modal = document.getElementById('v2-compliance-report');
        const { report, sniff, typeDef, styleId, footnoteCount } = result;

        const ok = report.filter(r => r.status === 'ok').length;
        const warn = report.filter(r => r.status === 'warning').length;
        const err = report.filter(r => r.status === 'error').length;

        document.getElementById('v2-cc-summary').innerHTML = `
            <div class="v2-cc-stat-grid">
                <div class="v2-cc-stat"><strong>${footnoteCount}</strong><span>脚注总数</span></div>
                <div class="v2-cc-stat ok"><strong>${ok}</strong><span>完全合规</span></div>
                <div class="v2-cc-stat warn"><strong>${warn}</strong><span>字段缺失</span></div>
                <div class="v2-cc-stat err"><strong>${err}</strong><span>无法解析</span></div>
            </div>
            <p class="v2-cc-meta">校验标准：<strong>${esc(V2SourceTypes.resolveTypeDisplayName ? V2SourceTypes.resolveTypeDisplayName(typeDef, styleId) : (typeDef.name || typeDef.id))}</strong> · ${esc(V2SourceTypes.getStyles().find(s => s.id === styleId)?.name || styleId)}</p>
        `;

        const sniffEl = document.getElementById('v2-cc-sniff');
        if (sniff && sniff.avgScore > 0.2) {
            sniffEl.hidden = false;
            sniffEl.innerHTML = `
                <span class="material-icons">auto_awesome</span>
                智能检测：您的脚注与「<strong>${esc(sniff.typeName)}</strong>」格式匹配度 ${Math.round(sniff.avgScore * 100)}%
                （${sniff.okCount}/${sniff.total} 条合规）
                <button type="button" class="primary-btn btn-outline v2-cc-apply-sniff" data-type="${esc(sniff.typeId)}" data-style="${esc(sniff.styleId)}">应用此标准</button>
            `;
            sniffEl.querySelector('.v2-cc-apply-sniff')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                await V2SourceTypes.setActiveStyleId(btn.dataset.style);
                if (typeof showAlert === 'function') showAlert(`已切换为 ${sniff.typeName} 格式标准`, 'success');
            });
        } else {
            sniffEl.hidden = true;
        }

        const tbody = document.getElementById('v2-cc-tbody');
        tbody.innerHTML = report.map(row => `
            <tr class="v2-cc-row v2-cc-${row.status}">
                <td>${row.index}</td>
                <td class="v2-cc-original" title="${esc(row.original)}">${esc(row.original.slice(0, 80))}${row.original.length > 80 ? '…' : ''}</td>
                <td>${statusIcon(row.status)}</td>
                <td>${row.missing && row.missing.length ? esc(row.missing.join('、')) : '—'}</td>
                <td class="v2-cc-suggested">${row.suggested ? esc(row.suggested.slice(0, 100)) : '—'}</td>
                <td>
                    ${row.suggested ? `<button type="button" class="icon-btn v2-cc-copy-one" data-text="${esc(row.suggested).replace(/"/g, '&quot;')}" title="复制修正"><span class="material-icons">content_copy</span></button>` : ''}
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.v2-cc-copy-one').forEach(btn => {
            btn.onclick = () => {
                const text = btn.dataset.text;
                navigator.clipboard?.writeText(text).then(() => {
                    if (typeof showAlert === 'function') showAlert('已复制修正文本', 'success');
                });
            };
        });

        document.getElementById('v2-cc-copy-all').onclick = () => {
            const lines = report.filter(r => r.suggested).map((r, i) => `${i + 1}. ${r.suggested}`);
            navigator.clipboard?.writeText(lines.join('\n')).then(() => {
                if (typeof showAlert === 'function') showAlert(`已复制 ${lines.length} 条修正脚注`, 'success');
            });
        };

        modal.style.display = 'block';
    }

    async function runWordValidation(fileInput, typeId, styleId) {
        const file = fileInput?.files?.[0];
        if (!file) {
            if (typeof showAlert === 'function') showAlert('请选择 Word 文档', 'warning');
            return;
        }
        if (!/\.docx$/i.test(file.name)) {
            if (typeof showAlert === 'function') showAlert('请上传 .docx 格式文件', 'warning');
            return;
        }

        try {
            if (typeof showAlert === 'function') showAlert('正在解析脚注…', 'info');
            const result = await validateWordFootnotes(file, typeId, styleId);
            showValidationReport(result);
        } catch (e) {
            console.error(e);
            if (typeof showAlert === 'function') showAlert(e.message || '校验失败', 'error');
        } finally {
            if (fileInput) fileInput.value = '';
        }
    }

    function renderComplianceDashboard(styleId, typeId) {
        const stats = V2Citations.computeProjectCompliance(
            typeof entries !== 'undefined' ? entries : [],
            styleId,
            typeId || null
        );

        const issues = stats.items.filter(i => i.status !== 'ok');

        return `
            <div class="v2-cc-dashboard">
                <div class="v2-cc-dash-rate">
                    <div class="v2-cc-rate-ring" data-rate="${stats.rate}">
                        <span class="v2-cc-rate-num">${stats.rate}%</span>
                        <span class="v2-cc-rate-label">合规率</span>
                    </div>
                    <div class="v2-cc-dash-counts">
                        <div>共 <strong>${stats.total}</strong> 条引用</div>
                        <div class="v2-cc-ok">✅ ${stats.ok} 合规</div>
                        <div class="v2-cc-warn">⚠️ ${stats.warning} 缺失字段</div>
                        <div class="v2-cc-err">❌ ${stats.error} 无法解析</div>
                    </div>
                </div>
                ${issues.length ? `
                <h4>不合规条目 (${issues.length})</h4>
                <div class="v2-cc-issue-list">
                    ${issues.slice(0, 50).map(item => `
                        <div class="v2-cc-issue-item v2-cc-${item.status}">
                            <div class="v2-cc-issue-head">
                                <strong>${esc(item.entryTitle)}</strong>
                                ${statusIcon(item.status)}
                            </div>
                            <div class="v2-cc-issue-cite">${esc(item.citation.slice(0, 120))}${item.citation.length > 120 ? '…' : ''}</div>
                            ${item.missing && item.missing.length ? `<div class="v2-cc-issue-missing">缺失：${esc(item.missing.join('、'))}</div>` : ''}
                            <div class="v2-cc-issue-actions">
                                <button type="button" class="primary-btn btn-outline v2-cc-fix-entry" data-id="${esc(item.entryId)}">智能补全</button>
                                <button type="button" class="icon-btn v2-cc-open-entry" data-id="${esc(item.entryId)}" title="编辑条目"><span class="material-icons">edit</span></button>
                            </div>
                        </div>
                    `).join('')}
                    ${issues.length > 50 ? `<p class="v2-cc-more">还有 ${issues.length - 50} 条未显示</p>` : ''}
                </div>` : '<p class="v2-tm-empty">当前样式下所有条目引用均合规 🎉</p>'}
            </div>
        `;
    }

    function bindDashboardActions(container, styleId) {
        container.querySelectorAll('.v2-cc-fix-entry').forEach(btn => {
            btn.onclick = async () => {
                const entry = (typeof entries !== 'undefined' ? entries : []).find(e => e.id === btn.dataset.id);
                if (!entry) return;
                const typeDef = V2SourceTypes.getType(entry.typeId || 'general');
                const cite = V2Citations.getDisplayCitation(entry, styleId);
                const fix = V2Citations.suggestFix(cite, typeDef, styleId);
                if (!fix.fixed || fix.fixed === cite) {
                    if (typeof showAlert === 'function') showAlert('无法自动补全，请手动编辑', 'warning');
                    return;
                }
                entry.citation = fix.fixed;
                if (entry.metadata) Object.assign(entry.metadata, fix.fields);
                if (typeof db !== 'undefined' && typeof getProjectPath === 'function') {
                    await db.ref().update({
                        [getProjectPath(`entries/${entry.id}/citation`)]: fix.fixed,
                        [getProjectPath(`entries/${entry.id}/metadata`)]: entry.metadata
                    });
                }
                if (typeof showAlert === 'function') showAlert('已补全并保存引用', 'success');
                if (typeof renderEntries === 'function') renderEntries();
                container.innerHTML = renderComplianceDashboard(styleId);
                bindDashboardActions(container, styleId);
            };
        });
        container.querySelectorAll('.v2-cc-open-entry').forEach(btn => {
            btn.onclick = () => {
                if (typeof editEntry === 'function') editEntry(btn.dataset.id);
            };
        });
    }

    global.V2CitationCompliance = {
        extractFootnotesFromDocx,
        validateWordFootnotes,
        showValidationReport,
        runWordValidation,
        renderComplianceDashboard,
        bindDashboardActions
    };
})(window);
