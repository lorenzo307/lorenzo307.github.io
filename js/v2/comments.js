/**
 * V2.3 — Comments / annotations store
 * Stored at: entries/{id}/comments/{commentId}
 */
(function (global) {
    'use strict';

    const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'];

    function uid() {
        return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function getAuthorName() {
        try {
            const saved = localStorage.getItem('v2_author_name');
            if (saved && saved.trim()) return saved.trim();
        } catch (e) {}
        const u = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
        if (u?.displayName) return u.displayName;
        if (u?.email) return u.email.split('@')[0];
        return '研究者';
    }

    function setAuthorName(name) {
        try { localStorage.setItem('v2_author_name', (name || '').trim()); } catch (e) {}
    }

    function getAuthorUid() {
        const u = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
        return u?.uid || 'local';
    }

    function normalizeComments(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.filter(Boolean);
        return Object.keys(raw).map(k => {
            const c = raw[k] || {};
            c.id = c.id || k;
            if (c.replies && !Array.isArray(c.replies)) {
                c.replies = Object.keys(c.replies).map(rk => {
                    const r = c.replies[rk] || {};
                    r.id = r.id || rk;
                    return r;
                }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            } else {
                c.replies = c.replies || [];
            }
            return c;
        }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }

    function commentsOf(entry) {
        return normalizeComments(entry && entry.comments);
    }

    async function persist(entryId, commentsArr) {
        if (typeof db === 'undefined' || typeof getProjectPath !== 'function') {
            throw new Error('数据库未就绪');
        }
        const map = {};
        (commentsArr || []).forEach(c => {
            const replies = {};
            (c.replies || []).forEach(r => { replies[r.id] = r; });
            map[c.id] = Object.assign({}, c, { replies });
        });
        await db.ref(getProjectPath(`entries/${entryId}/comments`)).set(map);
        const entry = (typeof entries !== 'undefined') ? entries.find(e => e.id === entryId) : null;
        if (entry) entry.comments = map;
    }

    async function addComment(entryId, payload) {
        const entry = entries.find(e => e.id === entryId);
        if (!entry) throw new Error('找不到条目');
        const list = commentsOf(entry);
        const comment = {
            id: uid(),
            authorName: getAuthorName(),
            authorUid: getAuthorUid(),
            text: (payload.text || '').trim(),
            quote: payload.quote || '',
            startOffset: typeof payload.startOffset === 'number' ? payload.startOffset : null,
            endOffset: typeof payload.endOffset === 'number' ? payload.endOffset : null,
            color: COLORS.includes(payload.color) ? payload.color : 'yellow',
            resolved: false,
            collapsed: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            replies: []
        };
        if (!comment.text) throw new Error('请输入批注内容');
        list.push(comment);
        await persist(entryId, list);
        return comment;
    }

    async function updateComment(entryId, commentId, patch) {
        const entry = entries.find(e => e.id === entryId);
        if (!entry) throw new Error('找不到条目');
        const list = commentsOf(entry);
        const idx = list.findIndex(c => c.id === commentId);
        if (idx < 0) throw new Error('找不到批注');
        list[idx] = Object.assign({}, list[idx], patch, { updatedAt: Date.now() });
        await persist(entryId, list);
        return list[idx];
    }

    async function deleteComment(entryId, commentId) {
        const entry = entries.find(e => e.id === entryId);
        if (!entry) throw new Error('找不到条目');
        const list = commentsOf(entry).filter(c => c.id !== commentId);
        await persist(entryId, list);
    }

    async function addReply(entryId, commentId, text) {
        const entry = entries.find(e => e.id === entryId);
        if (!entry) throw new Error('找不到条目');
        const list = commentsOf(entry);
        const c = list.find(x => x.id === commentId);
        if (!c) throw new Error('找不到批注');
        const reply = {
            id: uid(),
            authorName: getAuthorName(),
            authorUid: getAuthorUid(),
            text: (text || '').trim(),
            createdAt: Date.now()
        };
        if (!reply.text) throw new Error('请输入回复');
        c.replies = c.replies || [];
        c.replies.push(reply);
        c.updatedAt = Date.now();
        await persist(entryId, list);
        return reply;
    }

    async function deleteReply(entryId, commentId, replyId) {
        const entry = entries.find(e => e.id === entryId);
        if (!entry) throw new Error('找不到条目');
        const list = commentsOf(entry);
        const c = list.find(x => x.id === commentId);
        if (!c) return;
        c.replies = (c.replies || []).filter(r => r.id !== replyId);
        c.updatedAt = Date.now();
        await persist(entryId, list);
    }

    global.V2Comments = {
        COLORS,
        getAuthorName,
        setAuthorName,
        commentsOf,
        addComment,
        updateComment,
        deleteComment,
        addReply,
        deleteReply,
        persist
    };
})(window);
