/**
 * V2.1 — Tag color utilities
 */
(function (global) {
    'use strict';

    const TAG_COLORS = [
        'var(--tag-color-0)', 'var(--tag-color-1)', 'var(--tag-color-2)',
        'var(--tag-color-3)', 'var(--tag-color-4)', 'var(--tag-color-5)',
        'var(--tag-color-6)', 'var(--tag-color-7)'
    ];

    function hashTag(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) {
            h = ((h << 5) - h) + name.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    function tagColor(name) {
        return TAG_COLORS[hashTag(name || '') % TAG_COLORS.length];
    }

    function stripHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return (div.textContent || div.innerText || '').trim();
    }

    function excerpt(text, maxLen) {
        const plain = stripHtml(text);
        if (plain.length <= maxLen) return plain;
        return plain.slice(0, maxLen) + '…';
    }

    global.V2Utils = { tagColor, stripHtml, excerpt, hashTag };
})(window);
