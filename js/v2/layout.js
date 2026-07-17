/**
 * V2.1 — Layout initialization
 */
(function (global) {
    'use strict';

    function initLayout() {
        document.body.classList.add('v2-layout');

        const projectTitle = document.getElementById('projectTitle');
        const topTitle = document.getElementById('v2-project-title');
        if (projectTitle && topTitle) {
            const syncTitle = () => { topTitle.textContent = projectTitle.textContent; };
            syncTitle();
            new MutationObserver(syncTitle).observe(projectTitle, { childList: true, characterData: true, subtree: true });
        }

        bindToolbar();
        bindSidebarToggle();
    }

    function bindToolbar() {
        const pageSize = document.getElementById('pageSize');
        const pageCircle = document.querySelector('.v2-toolbar-row .page-size-circle');
        if (pageSize && pageCircle) {
            pageCircle.style.cursor = 'pointer';
            pageCircle.addEventListener('click', () => {
                pageSize.focus();
                if (typeof pageSize.showPicker === 'function') {
                    try { pageSize.showPicker(); } catch (e) { pageSize.click(); }
                } else {
                    pageSize.click();
                }
            });
            if (!pageSize.dataset.v2Bound) {
                pageSize.dataset.v2Bound = '1';
                pageSize.addEventListener('change', () => {
                    if (typeof changePageSize === 'function') changePageSize(pageSize.value);
                });
            }
        }

        const advBtn = document.getElementById('toggle-advanced-search-btn');
        if (advBtn && !advBtn.dataset.v2Bound) {
            advBtn.dataset.v2Bound = '1';
            advBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof toggleAdvancedSearch === 'function') toggleAdvancedSearch();
            });
        }

        document.querySelectorAll('.v2-toolbar-row [onclick*="scrollToTop"]').forEach(btn => {
            if (btn.dataset.v2Bound) return;
            btn.dataset.v2Bound = '1';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof scrollToTop === 'function') scrollToTop();
            });
        });
    }

    function bindSidebarToggle() {
        const toggle = document.getElementById('v2-sidebar-toggle');
        const sidebar = document.getElementById('v2-sidebar');
        const overlay = document.getElementById('v2-sidebar-overlay');

        const open = () => {
            sidebar?.classList.add('open');
            overlay?.classList.add('visible');
        };
        const close = () => {
            sidebar?.classList.remove('open');
            overlay?.classList.remove('visible');
        };

        if (toggle && !toggle.dataset.v2Bound) {
            toggle.dataset.v2Bound = '1';
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                if (sidebar?.classList.contains('open')) close();
                else open();
            });
        }

        if (overlay && !overlay.dataset.v2Bound) {
            overlay.dataset.v2Bound = '1';
            overlay.addEventListener('click', close);
        }
    }

    document.addEventListener('DOMContentLoaded', initLayout);
    document.addEventListener('firebaseReady', () => setTimeout(bindToolbar, 300));

    global.V2Layout = { initLayout, bindToolbar };
})(window);
