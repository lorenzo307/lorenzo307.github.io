/**
 * V2 — Firebase Realtime Database write helpers
 * Firebase rejects `undefined` anywhere in the payload tree.
 */
(function (global) {
    'use strict';

    /**
     * Recursively remove undefined properties (arrays/objects preserved).
     * @param {*} obj
     * @returns {*}
     */
    function sanitizeForFirebase(obj) {
        if (obj === undefined) return undefined;
        if (obj === null || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj
                .map(item => sanitizeForFirebase(item))
                .filter(item => item !== undefined);
        }

        const result = {};
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (value === undefined) return;
            const cleaned = sanitizeForFirebase(value);
            if (cleaned !== undefined) result[key] = cleaned;
        });
        return result;
    }

    /**
     * Sanitize then write via Firebase compat ref.update / set.
     */
    async function firebaseUpdate(ref, data) {
        const clean = sanitizeForFirebase(data);
        await ref.update(clean);
        return clean;
    }

    async function firebaseSet(ref, data) {
        const clean = sanitizeForFirebase(data);
        await ref.set(clean);
        return clean;
    }

    global.V2FirebaseUtils = {
        sanitizeForFirebase,
        firebaseUpdate,
        firebaseSet
    };

    global.sanitizeForFirebase = sanitizeForFirebase;
})(window);
