        // 等待 Firebase SDK 加载完成后再初始化
        (function() {
            const firebaseConfig = {
                apiKey: "AIzaSyC5zQ6We55GvT8xexlQOLPpoTZip9Xac9k",
                authDomain: "slsj-54760.firebaseapp.com",
                databaseURL: "https://slsj-54760-default-rtdb.firebaseio.com",
                projectId: "slsj-54760",
                storageBucket: "slsj-54760.firebasestorage.app",
                messagingSenderId: "890890573955",
                appId: "1:890890573955:web:328c0ed09af23d634b23b6"
            };

            // 等待 Firebase 加载完成
            function initFirebase() {
                if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
                    window.app = firebase.initializeApp(firebaseConfig);
                    window.auth = firebase.auth();
                    window.db = firebase.database();
                    
                    // 触发 Firebase 就绪事件
                    window.dispatchEvent(new CustomEvent('firebaseReady'));
                } else if (typeof firebase !== 'undefined') {
                    // Firebase 已加载，直接初始化
                    window.app = firebase.initializeApp(firebaseConfig);
                    window.auth = firebase.auth();
                    window.db = firebase.database();
                    window.dispatchEvent(new CustomEvent('firebaseReady'));
                } else {
                    // 延迟重试
                    setTimeout(initFirebase, 50);
                }
            }

            // 如果 DOM 已加载，立即尝试初始化；否则等待
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initFirebase);
            } else {
                initFirebase();
            }
        })();

        // 全局数据监听器
        let unsubscribeEntries = null;

        /* 性能模式：减弱模糊/阴影、隐藏 3D 背景，降低内存与重绘 */
        function enablePerformanceMode() {
            document.body.classList.add('performance-mode');
            try { localStorage.setItem('performanceMode', '1'); } catch (e) {}
        }
        function disablePerformanceMode() {
            document.body.classList.remove('performance-mode');
            try { localStorage.removeItem('performanceMode'); } catch (e) {}
        }
        window.enablePerformanceMode = enablePerformanceMode;
        window.disablePerformanceMode = disablePerformanceMode;
        (function initPerformanceMode() {
            try {
                if (localStorage.getItem('performanceMode') === '1') {
                    enablePerformanceMode();
                    return;
                }
                var c = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 4;
                var m = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : 4;
                if (c < 4 || m < 4) enablePerformanceMode();
            } catch (e) {}
        })();

        // 获取项目路径 - 优化：优先使用 sessionStorage 中的预加载项目ID
        function getProjectPath(subPath = "") {
            if (!window.auth) {
                console.warn('认证未初始化');
                return '';
            }
            const user = window.auth.currentUser;
            if (!user) {
                alert("用户未登录，即将跳转");
                window.location.href = "login.html";
                return;
            }
            
            // 优先级：1. sessionStorage（预加载） 2. URL参数 3. localStorage 4. default
            let projectId = sessionStorage.getItem('pendingProjectId');
            
            if (!projectId) {
                const urlParams = new URLSearchParams(window.location.search);
                projectId = urlParams.get('project');
            }
            
            if (!projectId) {
                projectId = localStorage.getItem('currentProject');
            }
            
            if (!projectId) {
                console.error("无法确定项目 ID！");
                projectId = 'default';
            }
            
            // 清理 sessionStorage（已使用）
            if (sessionStorage.getItem('pendingProjectId')) {
                sessionStorage.removeItem('pendingProjectId');
            }
            
            // 保存当前项目 ID 到 localStorage
            localStorage.setItem('currentProject', projectId);

            return `users/${user.uid}/projects/${projectId}/${subPath}`;
        }

        // 初始化数据监听
        function initDataListeners() {
            if (!window.db) {
                console.warn('数据库未初始化，延迟初始化数据监听器');
                setTimeout(initDataListeners, 100);
                return;
            }
            
            let initialEntriesLoaded = false;
            let renderEntriesDebounceTimer = null;
            const debouncedRenderEntries = () => {
                if (renderEntriesDebounceTimer) clearTimeout(renderEntriesDebounceTimer);
                renderEntriesDebounceTimer = setTimeout(() => {
                    renderEntriesDebounceTimer = null;
                    renderEntries();
                }, 80);
            };
            unsubscribeEntries = window.db.ref(getProjectPath('entries')).on('value', (snapshot) => {
                try {
                    entries = snapshot.val() ? Object.values(snapshot.val()).map(entry => ({
                        links: [], keywords: [], analysis: '', ...entry
                    })) : [];
                    debouncedRenderEntries();

                    // 将最新 entries 压缩为“轻量索引”，写入本地缓存，供下次秒开使用
                    (function debounceCacheWrite() {
                        if (window._cacheWriteTimer) clearTimeout(window._cacheWriteTimer);
                        window._cacheWriteTimer = setTimeout(() => {
                            window._cacheWriteTimer = null;
                            const write = () => {
                                try {
                                    const indexEntries = entries.map(e => ({
                                        id: e.id, date: e.date, title: e.title || '', keywords: e.keywords || []
                                    }));
                                    const fullPath = getProjectPath();
                                    const match = fullPath && fullPath.match(/projects\/([^\/]+)\//);
                                    const projectId = match ? match[1] : (localStorage.getItem('currentProject') || 'default');
                                    localStorage.setItem(`entries_index_${projectId}`, JSON.stringify({
                                        version: 1, projectId, timestamp: Date.now(), entries: indexEntries
                                    }));
                                } catch (e) { console.warn('写入 entries 索引缓存失败:', e); }
                            };
                            (typeof requestIdleCallback !== 'undefined')
                                ? requestIdleCallback(write, { timeout: 1000 })
                                : setTimeout(write, 0);
                        }, 2000);
                    })();
                    window._flushEntriesCache = function() {
                        if (window._cacheWriteTimer) { clearTimeout(window._cacheWriteTimer); window._cacheWriteTimer = null; }
                        try {
                            const idx = entries.map(e => ({ id: e.id, date: e.date, title: e.title || '', keywords: e.keywords || [] }));
                            const m = getProjectPath() && getProjectPath().match(/projects\/([^\/]+)\//);
                            const pid = m ? m[1] : (localStorage.getItem('currentProject') || 'default');
                            localStorage.setItem('entries_index_' + pid, JSON.stringify({ version: 1, projectId: pid, timestamp: Date.now(), entries: idx }));
                        } catch (e) {}
                    };
                } catch (error) {
                    console.error('渲染条目失败:', error);
                }
                if (!initialEntriesLoaded) {
                    hideLoading(); // 首次加载完成隐藏提示
                    initialEntriesLoaded = true;
                }
            }, (error) => {
                console.error('加载条目数据失败:', error);
                hideLoading();
                showAlert('加载数据失败: ' + error.message, 'error');
            });

        }

        // 等待 Firebase 就绪后再初始化认证监听
        function initAuthListener() {
            if (window.auth && window.db) {
                window.auth.onAuthStateChanged(async user => {
                    if (user) {
                        // 1. 统一确定项目 ID（优先 sessionStorage → URL → localStorage）
                        let projectId = sessionStorage.getItem('pendingProjectId');
                        if (!projectId) {
                            const urlParams = new URLSearchParams(window.location.search);
                            projectId = urlParams.get('project');
                        }
                        if (!projectId) {
                            projectId = localStorage.getItem('currentProject');
                        }
                        if (!projectId) {
                            projectId = 'default';
                        }
                        localStorage.setItem('currentProject', projectId);

                        // 2. 优先尝试读取本地缓存的“轻量 entries 列表”，实现秒开
                        try {
                            const cacheKey = `entries_index_${projectId}`;
                            const cached = localStorage.getItem(cacheKey);
                            if (cached) {
                                const data = JSON.parse(cached);
                                const isFresh = Date.now() - data.timestamp < 5 * 60 * 1000; // 5 分钟内
                                if (isFresh && Array.isArray(data.entries)) {
                                    entries = data.entries;
                                    currentPage = 1;
                                    renderEntries(); // 立即渲染上次的列表
                                }
                            }
                        } catch (e) {
                            console.warn('读取 entries 索引缓存失败:', e);
                        }

                        // 3. 启动实时数据监听，在后台同步最新数据
                        showLoading('正在同步最新数据...');
                        initDataListeners();
                        // initTimeTracking(); // 暂时注释掉，函数未定义
                        restoreCachedSessions();

                        // 4. 异步获取项目名称并更新标题，不阻塞列表渲染
                        try {
                            const projectRef = window.db.ref(`users/${user.uid}/projects/${projectId}`);
                            const snapshot = await projectRef.once('value');
                            const projectName = snapshot.exists() ? snapshot.val().name : '未命名课题';

                            document.title = `${projectName} - 史料数据库`;
                            const titleEl = document.getElementById('projectTitle');
                            if (titleEl) titleEl.textContent = projectName;
                        } catch (nameError) {
                            console.warn('获取项目名称失败:', nameError);
                        }
                     
                    } else {
                        // 用户未登录，跳转到登录页面
                        window.location.href = 'login.html';
                        if (typeof clearInterval === 'function' && typeof trackingInterval !== 'undefined') {
                            clearInterval(trackingInterval);
                        }
                        localStorage.removeItem('currentSession');
                    }
                });
            } else {
                // Firebase 尚未就绪，延迟重试
                setTimeout(initAuthListener, 50);
            }
        }

        // 监听 Firebase 就绪事件
        window.addEventListener('firebaseReady', initAuthListener);
        
        // 如果 Firebase 已经就绪（在事件监听器添加之前），立即初始化
        if (window.auth && window.db) {
            initAuthListener();
        }

        // 全局变量
        let entries = [];
        let quill = null; // 恢复 Quill 实例
        let logQuill = null; // 恢复 Quill 实例
        let currentPage = 1;
        let editingId = null;
        let editingLogId = null;
        let searchQuery = '';
        let currentFilterKeyword = null;
        let ENTRIES_PER_PAGE = 10;
        let LOGS_PER_PAGE = 10;
        let logs = [];
        let filteredLogs = [];
        let currentLogPage = 1;
        let currentLogFilterDate = null;
        let entryDraft = null; // 当前编辑的草稿
        let currentDraftId = null; // 当前草稿ID
        let autoSaveTimer;      // 自动保存定时器
        let lastSaveTimestamp = 0; // 上次保存时间戳
        let isSaving = false;   // 防止重复保存
        let advancedFilter = {
            startDate: null,
            endDate: null,
            tags: [],
            tagLogic: 'AND' // 标签交叉检索逻辑：AND/OR
        };
        // 快速筛选行已移除：不再使用 currentQuickFilter
        
        // 全文检索状态
        let fulltextSearch = {
            query: '',
            terms: [],
            logic: 'AND',
            scope: 'all',
            results: [],
            highlights: {}
        };
        
        // --- 新增加载提示函数 - 顶部进度条形式 ---
        function showLoading(message = '加载中...') {
            const loader = document.getElementById('loading-overlay');
            if (loader) {
                loader.classList.add('active');
                // 可选：在控制台显示加载消息（用于调试）
                if (message && message !== '加载中...') {
                    console.log(message);
                }
            }
        }

        function hideLoading() {
            const loader = document.getElementById('loading-overlay');
            if (loader) {
                // 延迟移除，让进度条完成动画
                setTimeout(() => {
                    loader.classList.remove('active');
                }, 300);
            }
        }
        // --- 结束加载提示函数 ---

        // 批量操作相关变量
        let bulkModeActive = false;
        let selectedEntryIds = new Set();
        let selectedAll = false;
        let currentViewMode = 'list'; // 默认目录视图
        const BULK_ALLOWED_VIEWS = ['list', 'card', 'detail'];

        function isBulkViewAllowed() {
            return BULK_ALLOWED_VIEWS.includes(currentViewMode);
        }

        function exitBulkMode() {
            if (!bulkModeActive) return;
            bulkModeActive = false;
            const bulkBar = document.getElementById('bulk-actions-bar');
            if (bulkBar) bulkBar.style.display = 'none';
            selectedEntryIds.clear();
            selectedAll = false;
            updateSelectedCount();
            renderEntries();
        }
        
        // 切换批量操作模式
        function toggleBulkMode() {
            if (!bulkModeActive && !isBulkViewAllowed()) {
                showAlert('批量操作仅适用于数据库、卡片和详细视图', 'warning');
                return;
            }

            bulkModeActive = !bulkModeActive;
            const bulkBar = document.getElementById('bulk-actions-bar');
            
            if (bulkModeActive) {
                bulkBar.style.display = 'flex';
                // 清空已选择的条目
                selectedEntryIds.clear();
                selectedAll = false;
                
                // 更新选择计数
                updateSelectedCount();
                
                // 重新渲染条目以显示复选框
                renderEntries();
            } else {
                bulkBar.style.display = 'none';
                selectedEntryIds.clear();
                selectedAll = false;
                // 重新渲染条目以隐藏复选框
                renderEntries();
            }
        }
        
        // 更新已选择条目计数
        function updateSelectedCount() {
            const countElem = document.getElementById('selected-count');
            if (!countElem) return;
            
            // 如果是全选模式，计算所有符合筛选条件的条目数量
            if (selectedAll) {
                const totalCount = getFilteredEntries().length;
                countElem.textContent = totalCount;
                return;
            }
            
            // 否则显示手动选择的条目数量
            countElem.textContent = selectedEntryIds.size;
        }
        
        // 批量删除选中的条目
        async function bulkDelete() {
            let entriesToDelete = [];
            
            if (selectedAll) {
                // 全选模式：获取所有符合筛选条件的条目
                entriesToDelete = getFilteredEntries();
            } else {
                // 手动选择模式：获取所有已勾选的条目
                entriesToDelete = entries.filter(entry => selectedEntryIds.has(entry.id));
            }
            
            if (entriesToDelete.length === 0) {
                showAlert('未选择任何条目', 'warning');
                return;
            }
            
            // 确认删除
            if (!confirm(`确定要删除选中的 ${entriesToDelete.length} 条记录吗？这些记录将被移动到回收站。`)) {
                return;
            }
            
            try {
                showAlert(`正在删除 ${entriesToDelete.length} 条记录...`, 'info');
                
                // 构建多路径更新对象
                const updates = {};
                entriesToDelete.forEach(entry => {
                    // 标记在 entries 中删除
                    updates[getProjectPath(`entries/${entry.id}`)] = null;
                    
                    // 添加到 trash 中
                    entry.deletedAt = Date.now();
                    updates[getProjectPath(`trash/${entry.id}`)] = entry;
                });

                // 一次性执行所有更新
                await db.ref().update(updates);
                
                // 重置选择状态
                selectedEntryIds.clear();
                selectedAll = false;
                updateSelectedCount();
                
                showAlert(`成功删除 ${entriesToDelete.length} 条记录并移至回收站`, 'success');
            } catch (error) {
                console.error('批量删除失败:', error);
                showAlert(`批量删除失败: ${error.message}`, 'error');
            }
        }
        
        // 处理条目选择
        function handleEntrySelection(id, checked) {
            if (checked) {
                selectedEntryIds.add(id);
            } else {
                selectedEntryIds.delete(id);
                // 如果取消选中任何条目，则退出全选模式
                selectedAll = false;
                document.getElementById('select-all').checked = false;
            }
            
            // 更新UI显示效果
            const entryElement = document.querySelector(
                `.entry-item[data-id="${id}"], .detail-entry[data-id="${id}"], .card-entry[data-id="${id}"]`
            );
            if (entryElement) {
                entryElement.classList.toggle('selected', checked);
            }
            
            // 检查当前页是否全选
            const allPageCheckboxes = document.querySelectorAll('.select-entry');
            const allChecked = Array.from(allPageCheckboxes).every(cb => cb.checked);
            document.getElementById('select-page').checked = allChecked;
            
            // 更新计数
            updateSelectedCount();
        }

        // 批量模式下：点击整条史料条目切换选中状态（去掉可见圈圈）
        function handleEntryItemClick(event, id) {
            if (!bulkModeActive) return;

            // 点击编辑 / 删除等操作按钮时，不改变选中状态
            if (event.target.closest('.entry-actions, .card-entry-actions')) {
                return;
            }

            const currentlySelected = selectedAll || selectedEntryIds.has(id);
            const newChecked = !currentlySelected;

            // 同步隐藏复选框状态（仍然保留逻辑所需的 checkbox，但对用户不可见）
            const wrapper = document.querySelector(
                `.entry-item[data-id="${id}"], .detail-entry[data-id="${id}"], .card-entry[data-id="${id}"]`
            );
            if (wrapper) {
                const checkbox = wrapper.querySelector('.select-entry');
                if (checkbox) {
                    checkbox.checked = newChecked;
                }
            }

            handleEntrySelection(id, newChecked);
        }

        // 新增页面条数改变函数
        function changePageSize(size) {
            ENTRIES_PER_PAGE = parseInt(size, 10) || 10;
            currentPage = 1;
            renderEntries();
            const perPageEl = document.getElementById('entriesPerPage');
            if (perPageEl) perPageEl.textContent = size;
            const circleLabel = document.getElementById('pageSizeDisplay');
            if (circleLabel) circleLabel.textContent = size;
        }

        // --- Quill 懒加载：首次打开表单时才加载脚本 ---
        let quillScriptPromise = null;
        function loadQuillScript() {
            if (typeof Quill !== 'undefined') return Promise.resolve();
            if (quillScriptPromise) return quillScriptPromise;
            quillScriptPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => { quillScriptPromise = null; reject(new Error('Quill 加载失败')); };
                document.head.appendChild(script);
            });
            return quillScriptPromise;
        }

        function initQuill() {
             // --- 将 Font 和 Size 定义移到函数开头 ---
             const Font = Quill.import('formats/font');
             // 更新字体白名单
             Font.whitelist = ['SimSun', 'STFangsong', 'KaiTi', 'STZhongsong', 'Times New Roman', 'Arial']; // 添加 STZhongsong
             Quill.register(Font, true);

             const Size = Quill.import('attributors/style/size');
             Size.whitelist = Size.whitelist || [
                 '10px', '12px', '14px', '16px', '18px', '20px', 
                 '24px', '28px', '32px', '36px', '48px', '72px'
             ];
             Quill.register(Size, true);
             // --- 结束移动 ---

             if (!quill) {
                 /* // 原来的定义位置 (移除)
                 const Font = Quill.import('formats/font');
                 Font.whitelist = ['宋体', '楷体', '仿宋', '黑体', 'Arial', 'Courier New', 'Times New Roman']; 
                 Quill.register(Font, true);

                 const Size = Quill.import('attributors/style/size');
                 Size.whitelist = [
                     '10px', '12px', '14px', '16px', '18px', '20px', 
                     '24px', '28px', '32px', '36px', '48px', '72px'
                 ];
                 Quill.register(Size, true);
                 */

                 quill = new Quill('#editor-container', {
                     modules: {
                         toolbar: [
                             [{ 'font': Font.whitelist }], // 使用扩展后的字体列表
                             [{ 'size': Size.whitelist }],
                             [{ 'header': [1, 2, 3, 4, 5, 6, false] }], // 添加更多标题级别
                             ['bold', 'italic', 'underline', 'strike'], // 添加删除线
                             [{ 'script': 'sub'}, { 'script': 'super' }], // 添加上下标
                             [{ 'color': [] }, { 'background': [] }], // 颜色和背景色
                             ['blockquote', 'code-block'],
                             [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                             [{ 'indent': '-1'}, { 'indent': '+1' }], // 缩进
                             [{ 'align': [] }], // 对齐方式
                             ['link', 'image', 'video'], // 链接、图片、视频
                             ['clean'] // 清除格式
                         ]
                     },
                     theme: 'snow'
                 });
                 console.log("Quill 实例 (原文) 已创建:", quill); // 添加日志
             }
             
             if (!window.analysisQuill) {
                 window.analysisQuill = new Quill('#analysis-editor-container', {
                      modules: {
                          toolbar: [
                             [{ 'font': Font.whitelist }],
                             [{ 'size': Size.whitelist }],
                              [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                              ['bold', 'italic', 'underline', 'strike'],
                              [{ 'script': 'sub'}, { 'script': 'super' }],
                              [{ 'color': [] }, { 'background': [] }],
                              ['blockquote', 'code-block'],
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              [{ 'indent': '-1'}, { 'indent': '+1' }],
                              [{ 'align': [] }],
                              ['link', 'image', 'video'],
                              ['clean']
                          ]
                      },
                     theme: 'snow'
                 });
                 console.log("Quill 实例 (分析) 已创建:", window.analysisQuill); // 添加日志
                 analysisQuill.container.style.height = '300px';
                 analysisQuill.container.style.overflowY = 'auto';
             }
             
             // 添加自动保存监听
             if (quill) {
                 // 输入内容变化时重置倒计时器，保持固定间隔
                 quill.on('text-change', () => {
                     // 不重置时间戳，保持严格的30秒周期
                     // 但是要更新UI显示新内容待保存
                     const statusEl = document.getElementById('draft-status');
                     if(statusEl) statusEl.style.display = 'flex';
                 });
             }
             if (window.analysisQuill) {
                 window.analysisQuill.on('text-change', () => {
                     // 保持相同的处理方式
                     const statusEl = document.getElementById('draft-status');
                     if(statusEl) statusEl.style.display = 'flex';
                 });
             }
         }

         const fontStyle = document.createElement('style');
         fontStyle.textContent = `
             /* 更新字体样式 */
             .ql-font-SimSun { font-family: SimSun, "宋体", serif !important; }
             .ql-font-STFangsong { font-family: STFangsong, "华文仿宋", FangSong, "仿宋", serif !important; }
             .ql-font-KaiTi { font-family: KaiTi, "楷体", serif !important; }
             .ql-font-STZhongsong { font-family: STZhongsong, "华文中宋", SimSun, serif !important; } /* 添加华文中宋 */
             .ql-font-TimesNewRoman { font-family: "Times New Roman", Times, serif !important; }
             .ql-font-Arial { font-family: Arial, Helvetica, sans-serif !important; }
             /* 移除不再需要的字体 */
             /* .ql-font-仿宋 { font-family: FangSong, "仿宋", serif !important; } */
             /* .ql-font-黑体 { font-family: SimHei, "黑体", sans-serif !important; } */
             /* .ql-font-Courier New { font-family: Courier New, Courier, monospace !important; } */
             
             /* 更新字体选择器预览样式 */
             .ql-picker.ql-font .ql-picker-item[data-value="SimSun"]::before { font-family: SimSun, "宋体", serif !important; content: "宋体" !important; }
             .ql-picker.ql-font .ql-picker-item[data-value="STFangsong"]::before { font-family: STFangsong, "华文仿宋", FangSong, serif !important; content: "华文仿宋" !important; }
             .ql-picker.ql-font .ql-picker-item[data-value="KaiTi"]::before { font-family: KaiTi, "楷体", serif !important; content: "楷体" !important; }
             .ql-picker.ql-font .ql-picker-item[data-value="STZhongsong"]::before { font-family: STZhongsong, "华文中宋", SimSun, serif !important; content: "华文中宋" !important; } /* 添加 */
             .ql-picker.ql-font .ql-picker-item[data-value="Times New Roman"]::before { font-family: "Times New Roman", Times, serif !important; content: "Times New Roman" !important; }
             .ql-picker.ql-font .ql-picker-item[data-value="Arial"]::before { font-family: Arial, Helvetica, sans-serif !important; content: "Arial" !important; }
             /* 移除旧样式 */
             /* .ql-picker.ql-font .ql-picker-item[data-value="仿宋"]::before { ... } */
             /* .ql-picker.ql-font .ql-picker-item[data-value="黑体"]::before { ... } */
             /* .ql-picker.ql-font .ql-picker-item[data-value="Courier New"]::before { ... } */

             /* 更新字体选择器标签样式 (当前选中字体) */
             .ql-picker.ql-font .ql-picker-label[data-value="SimSun"]::before { font-family: SimSun, "宋体", serif !important; content: "宋体" !important; }
             .ql-picker.ql-font .ql-picker-label[data-value="STFangsong"]::before { font-family: STFangsong, "华文仿宋", FangSong, serif !important; content: "华文仿宋" !important; }
             .ql-picker.ql-font .ql-picker-label[data-value="KaiTi"]::before { font-family: KaiTi, "楷体", serif !important; content: "楷体" !important; }
             .ql-picker.ql-font .ql-picker-label[data-value="STZhongsong"]::before { font-family: STZhongsong, "华文中宋", SimSun, serif !important; content: "华文中宋" !important; } /* 添加 */
             .ql-picker.ql-font .ql-picker-label[data-value="Times New Roman"]::before { font-family: "Times New Roman", Times, serif !important; content: "Times New Roman" !important; }
             .ql-picker.ql-font .ql-picker-label[data-value="Arial"]::before { font-family: Arial, Helvetica, sans-serif !important; content: "Arial" !important; }
             /* 移除旧样式 */
             /* .ql-picker.ql-font .ql-picker-label[data-value="仿宋"]::before { ... } */
             /* .ql-picker.ql-font .ql-picker-label[data-value="黑体"]::before { ... } */
             /* .ql-picker.ql-font .ql-picker-label[data-value="Courier New"]::before { ... } */

              /* 字号样式 (保持不变) */
              .ql-size-10px { font-size: 10px !important; }
              /* ... (其他字号样式) ... */
              .ql-size-72px { font-size: 72px !important; }
              .ql-picker.ql-size .ql-picker-item[data-value="10px"]::before { font-size: 10px !important; }
              /* ... (其他字号选择器样式) ... */
              .ql-picker.ql-size .ql-picker-item[data-value="72px"]::before { font-size: 72px !important; }
              .ql-picker.ql-size .ql-picker-label[data-value="10px"]::before { font-size: 10px !important; }
              /* ... (其他字号选择器标签样式) ... */
              .ql-picker.ql-size .ql-picker-label[data-value="72px"]::before { font-size: 72px !important; }
         `;
         document.head.appendChild(fontStyle);
        // --- 结束恢复 ---

        // --- 恢复 CKEditor 初始化函数 (注释掉) ---
        /*
        async function initCKEditor(elementId, existingEditorInstance) {
             // ... (CKEditor code) ...
        }
        */
        // --- 结束恢复 ---

        // 表单操作
        function showForm() {
            const form = document.getElementById('entry-form');
            form.style.display = 'block';
            form.classList.remove('closing'); // 确保移除关闭动画类
            
            // 初始化编辑器并等待完成
            ensureEditorsInitialized().then(() => {
                updateSubCats();
                
                // 修复：在编辑模式下也设置 currentDraftId
                if (editingId) {
                    // 编辑模式：使用条目ID作为草稿ID
                    currentDraftId = editingId;
                } else {
                    // 新建模式：生成新的草稿ID
                    currentDraftId = localStorage.getItem('currentDraftId') || `NEW_${Date.now()}`;
                    localStorage.setItem('currentDraftId', currentDraftId);
                }
                
                // 显示草稿状态栏
                document.getElementById('draft-status').style.display = 'flex';
                
                // 初始化自动保存系统
                lastSaveTimestamp = Date.now();
                startAutoSaveSystem();
                
                // 如果是新建条目，清理可能存在的旧草稿绑定
                if (!editingId) {
                    localStorage.removeItem('lastDraftId');
                    entryDraft = currentDraftId;
                }
                
                // 检查草稿
                checkDraft();
            }).catch(error => {
                console.error('表单初始化失败:', error);
                showAlert('表单初始化失败: ' + error.message, 'error');
            });
        }

        async function hideForm() {
            // 检查是否有未保存内容
            const hasUnsavedChanges = checkUnsavedChanges();
            
            // 如果有未保存的更改，自动保存到草稿箱
            if (hasUnsavedChanges) {
                saveDraft().then(() => {
                    showAlert('已自动保存到草稿箱', 'info');
                    // 保留草稿ID以便下次恢复
                    if (currentDraftId && !editingId) {
                        localStorage.setItem('currentDraftId', currentDraftId);
                    }
                    performCloseForm();
                }).catch(error => {
                    console.error('自动保存草稿失败:', error);
                    // 即使保存失败也关闭表单
                    performCloseForm();
                });
            } else {
                // 如果没有未保存的更改，清理草稿ID
                if (currentDraftId && !editingId) {
                    localStorage.removeItem('currentDraftId');
                    currentDraftId = null;
                }
                performCloseForm();
            }
        }

        function performCloseForm() {
            const form = document.getElementById('entry-form');
            form.classList.add('closing');
            
            // 清理自动保存系统
            clearInterval(autoSaveTimer);
            document.getElementById('countdown-tip').classList.remove('danger-pulse');
            
            setTimeout(() => {
                form.style.display = 'none';
                document.querySelector('#entry-form form').reset();
                if (quill) quill.root.innerHTML = '';
                if (window.analysisQuill) window.analysisQuill.root.innerHTML = '';
                editingId = null;
                entryDraft = null;
                form.classList.remove('closing');
            }, 200);
        }
        
        // 启动固定间隔保存系统
        function startAutoSaveSystem() {
            clearInterval(autoSaveTimer);
            
            // 立即显示初始状态
            updateCountdownDisplay();
            
            // 2分30秒 = 150000毫秒
            const AUTOSAVE_INTERVAL = 150000;
            const FINAL_COUNTDOWN = 10000; // 最后10秒
            
            autoSaveTimer = setInterval(() => {
                const currentTime = Date.now();
                const elapsed = currentTime - lastSaveTimestamp;
                const remaining = AUTOSAVE_INTERVAL - elapsed;
                
                // 更新倒计时显示
                updateCountdownDisplay(remaining);
                
                // 如果进入最后10秒，清除当前定时器，启动更频繁的更新
                if (remaining <= FINAL_COUNTDOWN && remaining > 0) {
                    clearInterval(autoSaveTimer);
                    startFinalCountdown(remaining);
                }
                
                // 到达2分30秒立即保存
                if(elapsed >= AUTOSAVE_INTERVAL) {
                    triggerAutoSave();
                }
            }, 10000); // 每10秒更新一次显示
        }

        // 最后10秒的倒计时处理
        function startFinalCountdown(initialRemaining) {
            autoSaveTimer = setInterval(() => {
                const currentTime = Date.now();
                const elapsed = currentTime - lastSaveTimestamp;
                const remaining = 150000 - elapsed; // 2分30秒 = 150000毫秒
                
                if (remaining <= 0) {
                    clearInterval(autoSaveTimer);
                    triggerAutoSave();
                    return;
                }
                
                updateCountdownDisplay(remaining);
            }, 1000); // 每秒更新一次显示
        }

        // 更新倒计时显示
        function updateCountdownDisplay(remaining = 150000 - (Date.now() - lastSaveTimestamp)) {
            const countdownEl = document.getElementById('countdown');
            const countdownTip = document.getElementById('countdown-tip');
            
            if(!countdownEl || !countdownTip) return;

            const seconds = Math.ceil(remaining / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            const text = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
            countdownEl.textContent = text;
            
            // 最后10秒变红闪烁
            if(seconds <= 10) {
                countdownEl.style.color = 'var(--danger-bg)';
                countdownTip.classList.add('danger-pulse');
            } else {
                countdownEl.style.color = 'var(--accent-1)';
                countdownTip.classList.remove('danger-pulse');
            }
        }

        // ---------- 移动端搜索切换 ----------
        function initMobileSearch() {
            const isMobile = window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            if (!isMobile) return;

            const searchIcon = document.getElementById('mobile-search-icon');
            const searchCancel = document.getElementById('mobile-search-cancel');
            const searchBox = document.getElementById('search-box');
            const searchInput = document.getElementById('search-input');
            const toolbar = document.querySelector('.action-buttons');

            if (!searchIcon || !searchCancel || !searchBox || !searchInput) return;

            // 点击搜索图标：激活搜索模式
            searchIcon.addEventListener('click', function() {
                toolbar.classList.add('mobile-search-active');
                searchBox.style.display = 'flex';
                searchBox.style.flex = '1';
                setTimeout(() => searchInput.focus(), 100); // 自动聚焦
            });

            // 点击取消按钮：退出搜索模式
            searchCancel.addEventListener('click', function() {
                toolbar.classList.remove('mobile-search-active');
                searchBox.style.display = 'none';
                searchInput.value = '';          // 清空搜索词
                searchQuery = '';               // 重置全局搜索变量
                renderEntries();               // 刷新列表
            });

            // 按回车执行搜索并自动收起（可选）
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchQuery = this.value;
                    renderEntries();
                    // 自动退出搜索模式（延迟一点让用户看到结果）
                    setTimeout(() => {
                        if (toolbar.classList.contains('mobile-search-active')) {
                            searchCancel.click();
                        }
                    }, 300);
                }
            });

            // 点击外部自动收起？简单起见，由取消按钮控制
        }

        // ---------- 移动倒计时同步 ----------
        // 增强原 updateCountdownDisplay 函数，添加移动钟表更新
        const originalUpdateCountdown = updateCountdownDisplay;
        window.updateCountdownDisplay = function(remaining) {
            // 调用原函数（桌面倒计时）
            if (typeof originalUpdateCountdown === 'function') {
                originalUpdateCountdown(remaining);
            }

            // 移动钟表更新
            const mobileCount = document.getElementById('mobile-countdown');
            const mobileTimer = document.querySelector('.mobile-draft-timer');
            if (mobileCount) {
                const baseRemaining = (remaining !== undefined)
                    ? remaining
                    : 150000 - (Date.now() - lastSaveTimestamp);
                const seconds = Math.ceil(baseRemaining / 1000);
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                mobileCount.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
                
                if (mobileTimer) {
                    if (seconds <= 10) {
                        mobileTimer.classList.add('danger');
                    } else {
                        mobileTimer.classList.remove('danger');
                    }
                }
            }
        };

        // ---------- 移动端侧边栏折叠功能 ----------
        function initMobileSidebarFold() {
            const isMobile = window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            if (!isMobile) return;

            const statsTrigger = document.getElementById('mobile-stats-trigger');
            const manageTrigger = document.getElementById('mobile-manage-trigger');
            const statsPanel = document.getElementById('mobile-stats-panel');
            const managePanel = document.getElementById('mobile-manage-panel');

            if (!statsTrigger || !manageTrigger || !statsPanel || !managePanel) return;

            // 关闭所有面板
            function closeAllPanels() {
                statsPanel.style.display = 'none';
                managePanel.style.display = 'none';
            }

            // 点击统计图标
            statsTrigger.addEventListener('click', function(e) {
                e.stopPropagation();
                if (statsPanel.style.display === 'block') {
                    statsPanel.style.display = 'none';
                } else {
                    closeAllPanels();
                    statsPanel.style.display = 'block';
                    // 更新移动统计面板数据
                    updateMobileStats();
                }
            });

            // 点击管理图标
            manageTrigger.addEventListener('click', function(e) {
                e.stopPropagation();
                if (managePanel.style.display === 'block') {
                    managePanel.style.display = 'none';
                } else {
                    closeAllPanels();
                    managePanel.style.display = 'block';
                }
            });

            // 点击页面其他区域关闭面板
            document.addEventListener('click', function(e) {
                if (!statsTrigger.contains(e.target) && !statsPanel.contains(e.target)) {
                    statsPanel.style.display = 'none';
                }
                if (!manageTrigger.contains(e.target) && !managePanel.contains(e.target)) {
                    managePanel.style.display = 'none';
                }
            });

            // 阻止面板内点击事件冒泡到 document
            statsPanel.addEventListener('click', function(e) { e.stopPropagation(); });
            managePanel.addEventListener('click', function(e) { e.stopPropagation(); });
        }

        // 更新移动统计卡片：直接复用侧边栏统计结果，确保数值一致
        function updateMobileStats() {
            const desktopTotal = document.getElementById('stat-total');
            const desktopWordcount = document.getElementById('stat-wordcount');
            const desktopKeywords = document.getElementById('stat-keywords');
            if (!desktopTotal || !desktopKeywords) return;

            const totalEl = document.getElementById('mobile-stat-total');
            const wordEl = document.getElementById('mobile-stat-wordcount');
            const keywordEl = document.getElementById('mobile-stat-keywords');

            if (totalEl) totalEl.textContent = desktopTotal.textContent || '0';
            if (wordEl && desktopWordcount) wordEl.textContent = desktopWordcount.textContent || '0';
            if (keywordEl) keywordEl.textContent = desktopKeywords.textContent || '0';
        }

        // 包装原有统计更新函数，增加移动端同步
        const originalUpdateStats = updateStatisticsPanel;
        window.updateStatisticsPanel = function() {
            if (typeof originalUpdateStats === 'function') originalUpdateStats();
            if (window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) {
                updateMobileStats();
            }
        };

        // 初始化移动搜索与移动侧边栏折叠（页面加载后执行）
        document.addEventListener('DOMContentLoaded', function () {
            initMobileSearch();
            initMobileSidebarFold();
        });

        // 执行自动保存
        async function triggerAutoSave() {
            if(isSaving) return;
            isSaving = true;
            
            try {
                const formData = getFormData();
                
                // 如果没有内容，不保存草稿
                if(!formData.title && !formData.content) {
                    isSaving = false;
                    return;
                }

                // 生成时间字符串
                const now = new Date();
                const timeString = now.toLocaleString('zh-CN', { 
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }).replace(/\//g, '-');

                // 更新保存状态
                const statusEl = document.getElementById('draft-status');
                if (statusEl) {
                    statusEl.classList.add('save-pulse');
                    const lastSaveEl = document.getElementById('last-save-time');
                    if (lastSaveEl) {
                        lastSaveEl.innerHTML = `
                            <span class="material-icons" style="color:#4CAF50;">schedule</span>
                            自动保存：${timeString}
                        `;
                    }
                }

                // 确定草稿ID
                let draftId;
                if (editingId) {
                    // 编辑模式：使用现有条目ID
                    draftId = editingId;
                    currentDraftId = draftId; // 确保 currentDraftId 被设置
                } else {
                    // 新建模式：使用现有的草稿ID或生成新的
                    draftId = currentDraftId || localStorage.getItem('currentDraftId') || `DRAFT_${Date.now()}`;
                    currentDraftId = draftId;
                    localStorage.setItem('currentDraftId', draftId);
                }

                // 保存到Firebase
                const draftData = {
                    ...formData,
                    updatedAt: now.getTime(),
                    version: (Date.now()).toString(36),
                    originalId: editingId || null,
                    draftType: editingId ? 'edit' : 'new'
                };
                
                await db.ref(getProjectPath(`drafts/${draftId}`)).set(draftData);
                
                // 更新最后保存时间戳
                lastSaveTimestamp = Date.now();
                
                // 重置倒计时显示
                updateCountdownDisplay(150000);
                
                // 重新启动常规更新定时器
                startAutoSaveSystem();
                
            } catch (error) {
                console.error('保存草稿失败:', error);
                const lastSaveEl = document.getElementById('last-save-time');
                if (lastSaveEl) {
                    lastSaveEl.innerHTML = `
                        <span class="material-icons" style="color:var(--danger-bg)">error</span>
                        自动保存失败
                    `;
                }
            } finally {
                setTimeout(() => {
                    const statusEl = document.getElementById('draft-status');
                    if (statusEl) statusEl.classList.remove('save-pulse');
                }, 1500);
                isSaving = false;
            }
        }

        // 查找已存在的条目
        async function findExistingEntry(baseId) {
            const entriesRef = db.ref(getProjectPath('entries'));
            const snapshot = await entriesRef.orderByKey()
                .startAt(baseId)
                .endAt(baseId + '\uf8ff')
                .once('value');
            
            const entries = snapshot.val();
            return entries ? Object.values(entries)[0] : null;
        }

        // 检查草稿
        async function checkDraft() {
            try {
                let draftId = null;
                let baseId = null;
                
                // 编辑模式：使用条目ID
                if (editingId) {
                    draftId = editingId;
                    baseId = editingId.split('-').slice(0, -1).join('-');
                } 
                // 新建模式：不再根据主类/子类生成 entryBaseId，仅尝试使用当前草稿ID
                else {
                    draftId = currentDraftId || localStorage.getItem('currentDraftId') || null;
                }
                
                if (draftId) {
                    const draftRef = db.ref(getProjectPath(`drafts/${draftId}`));
                    const snapshot = await draftRef.once('value');
                    
                    if (snapshot.exists()) {
                        const draft = snapshot.val();
                        const saveTime = new Date(draft.updatedAt).toLocaleString();
                        const message = editingId ? 
                            `检测到本条目（${draftId}）的未提交修改（最后保存：${saveTime}），是否恢复？` :
                            `检测到未提交草稿（最后保存：${saveTime}），是否恢复？`;
                            
                        if (confirm(message)) {
                            await populateForm(draft);
                            entryDraft = draftId;
                            currentDraftId = draftId;
                            
                            // 初始化保存时间显示
                            document.getElementById('last-save-time').innerHTML = `
                                <span class="material-icons">history</span>
                                已恢复草稿（${draftId}）：${saveTime}
                            `;
                        } else if (!editingId) {
                            // 如果用户选择不恢复，且是新建模式，清理草稿ID
                            localStorage.removeItem('currentDraftId');
                            currentDraftId = null;
                        }
                    }
                }
            } catch (error) {
                console.error('检查草稿失败:', error);
                showAlert('检查草稿失败: ' + error.message, 'error');
            }
        }

        function checkUnsavedChanges() {
            const currentData = getFormData();
            return currentData.title || 
                   currentData.content || 
                   currentData.analysis ||
                   currentData.keywords.length > 0;
        }

        // 分类管理
        function showCategoryManager() {}

        function hideCategoryManager() {}

        // ========== 关键词编辑器 ==========
        let keywordEditorSelectedKeyword = null;
        let keywordEditorSelectedIds = new Set();

        function showKeywordEditor() {
            const editor = document.getElementById('keyword-editor');
            editor.style.display = 'block';
            editor.classList.remove('closing');
            keywordEditorSelectedKeyword = null;
            keywordEditorSelectedIds.clear();
            renderKeywordEditorList();
            document.getElementById('keyword-editor-entries').innerHTML = '<p style="color: var(--text-secondary);">请选择一个关键词</p>';
            document.getElementById('keyword-editor-actions').style.display = 'none';
            if (!document.getElementById('keyword-editor-list')._delegationBound) {
                document.getElementById('keyword-editor-list')._delegationBound = true;
                document.getElementById('keyword-editor-list').addEventListener('click', function(e) {
                    const tag = e.target.closest('.keyword-editor-tag');
                    if (tag && tag.dataset.keyword) keywordEditorSelectKeyword(tag.dataset.keyword);
                });
            }
        }

        function hideKeywordEditor() {
            const editor = document.getElementById('keyword-editor');
            editor.classList.add('closing');
            setTimeout(() => {
                editor.style.display = 'none';
                editor.classList.remove('closing');
            }, 200);
        }

        function keywordEditorEscapeHtml(s) {
            return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function renderKeywordEditorList() {
            const keywordCount = {};
            entries.forEach(e => (e.keywords || []).forEach(kw => { keywordCount[kw] = (keywordCount[kw] || 0) + 1; }));
            const sorted = Object.entries(keywordCount).sort((a, b) => b[1] - a[1]);
            const container = document.getElementById('keyword-editor-list');
            container.innerHTML = sorted.map(([kw, count]) => {
                const esc = keywordEditorEscapeHtml(kw);
                const active = keywordEditorSelectedKeyword === kw ? 'active' : '';
                return `<span class="keyword-tag keyword-editor-tag ${active}" data-keyword="${esc}">${esc} (${count})</span>`;
            }).join('');
        }

        function keywordEditorSelectKeyword(kw) {
            keywordEditorSelectedKeyword = kw;
            keywordEditorSelectedIds.clear();
            renderKeywordEditorList();
            renderKeywordEditorEntries();
        }

        function renderKeywordEditorEntries() {
            const header = document.getElementById('keyword-editor-header');
            const entriesContainer = document.getElementById('keyword-editor-entries');
            const actionsDiv = document.getElementById('keyword-editor-actions');
            if (!keywordEditorSelectedKeyword) return;
            const matched = entries.filter(e => (e.keywords || []).includes(keywordEditorSelectedKeyword));
            header.innerHTML = `<strong>关键词：${keywordEditorEscapeHtml(keywordEditorSelectedKeyword)}</strong>（共 ${matched.length} 条）`;
            if (matched.length === 0) {
                entriesContainer.innerHTML = '<p style="color: var(--text-secondary);">无条目</p>';
            } else {
                entriesContainer.innerHTML = matched.map(entry => {
                    const escId = keywordEditorEscapeHtml(entry.id);
                    const escTitle = keywordEditorEscapeHtml(entry.title || '(无标题)');
                    return `<label class="keyword-editor-entry-row" style="display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; border-bottom: 1px solid var(--glass-border);">
                        <input type="checkbox" class="keyword-editor-entry-cb" data-id="${escId}">
                        <span class="entry-id" style="min-width: 140px;">${escId}</span>
                        <span style="flex:1; overflow: hidden; text-overflow: ellipsis;">${escTitle}</span>
                    </label>`;
                }).join('');
            }
            if (!entriesContainer._cbBound) {
                entriesContainer._cbBound = true;
                entriesContainer.addEventListener('change', function(e) {
                    if (e.target.classList.contains('keyword-editor-entry-cb')) {
                        keywordEditorToggleEntry(e.target.dataset.id, e.target.checked);
                    }
                });
            }
            actionsDiv.style.display = 'block';
            updateKeywordEditorSelectedCount();
        }

        function keywordEditorToggleEntry(id, checked) {
            if (checked) keywordEditorSelectedIds.add(id);
            else keywordEditorSelectedIds.delete(id);
            updateKeywordEditorSelectedCount();
        }

        function updateKeywordEditorSelectedCount() {
            const el = document.getElementById('keyword-editor-selected-count');
            if (el) el.textContent = keywordEditorSelectedIds.size;
        }

        async function keywordEditorMoveTo() {
            const targetKw = prompt('请输入目标关键词（将把当前关键词替换为目标关键词）：', '');
            if (!targetKw || !targetKw.trim()) return;
            const target = targetKw.trim();
            if (keywordEditorSelectedIds.size === 0) {
                showAlert('请先勾选要操作的条目', 'warning');
                return;
            }
            try {
                showLoading('正在更新...');
                const updates = {};
                const toEdit = entries.filter(e => keywordEditorSelectedIds.has(e.id));
                toEdit.forEach(entry => {
                    let kwList = [...(entry.keywords || [])];
                    kwList = kwList.filter(k => k !== keywordEditorSelectedKeyword);
                    if (!kwList.includes(target)) kwList.push(target);
                    updates[getProjectPath(`entries/${entry.id}/keywords`)] = kwList;
                    updates[getProjectPath(`entries/${entry.id}/updatedAt`)] = Date.now();
                });
                await db.ref().update(updates);
                showAlert(`已将 ${toEdit.length} 条从「${keywordEditorSelectedKeyword}」移动到「${target}」`, 'success');
                keywordEditorSelectKeyword(keywordEditorSelectedKeyword);
            } catch (e) {
                showAlert('更新失败: ' + e.message, 'error');
            } finally {
                hideLoading();
            }
        }

        async function keywordEditorRemoveFromSelected() {
            if (keywordEditorSelectedIds.size === 0) {
                showAlert('请先勾选要操作的条目', 'warning');
                return;
            }
            try {
                showLoading('正在更新...');
                const updates = {};
                const toEdit = entries.filter(e => keywordEditorSelectedIds.has(e.id));
                toEdit.forEach(entry => {
                    const kwList = (entry.keywords || []).filter(k => k !== keywordEditorSelectedKeyword);
                    updates[getProjectPath(`entries/${entry.id}/keywords`)] = kwList;
                    updates[getProjectPath(`entries/${entry.id}/updatedAt`)] = Date.now();
                });
                await db.ref().update(updates);
                showAlert(`已从 ${toEdit.length} 条中删除「${keywordEditorSelectedKeyword}」`, 'success');
                keywordEditorSelectKeyword(keywordEditorSelectedKeyword);
            } catch (e) {
                showAlert('更新失败: ' + e.message, 'error');
            } finally {
                hideLoading();
            }
        }

        // 分类管理相关功能已移除

        /**
         * 批量更新所有条目的 ID，使其符合新规则：YYYYMMDD-序号（按条目日期每天单独计数）
         * 注意：仅适用于已经迁移到以 date 为基础的 ID 方案的项目。
         * 增强：使用弹窗实时显示更新进度。
         */
        async function updateAllEntryCodes() {
            if (!confirm('此操作将根据条目日期重新生成所有条目的编号（格式：YYYYMMDD-序号）。\n建议先导出备份，再执行。是否继续？')) {
                return;
            }

            // 创建或获取进度弹窗
            let dialog = document.getElementById('update-codes-dialog');
            if (!dialog) {
                dialog = document.createElement('div');
                dialog.className = 'form-popup';
                dialog.id = 'update-codes-dialog';
                dialog.style.display = 'block';
                dialog.style.width = '90%';
                dialog.style.maxWidth = '600px';
                dialog.innerHTML = `
                    <h2>更新条目代码</h2>
                    <div class="form-content" style="max-height: 50vh; overflow-y: auto;">
                        <p id="update-codes-status">正在准备...</p>
                        <p id="update-codes-detail" style="color: var(--text-secondary); font-size: 0.9em;"></p>
                        <div id="update-codes-progress-bar" style="margin-top: 12px; height: 6px; border-radius: 999px; background: rgba(0,0,0,0.08); overflow: hidden;">
                            <div id="update-codes-progress-inner" style="width:0%; height:100%; background: linear-gradient(90deg, var(--accent-1), var(--accent-2)); transition: width 0.2s;"></div>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="primary-btn" id="update-codes-close-btn" disabled>正在执行，请稍候...</button>
                    </div>
                `;
                document.body.appendChild(dialog);
            } else {
                dialog.style.display = 'block';
                dialog.classList.remove('closing');
            }

            const statusEl = dialog.querySelector('#update-codes-status');
            const detailEl = dialog.querySelector('#update-codes-detail');
            const progressInner = dialog.querySelector('#update-codes-progress-inner');
            const closeBtn = dialog.querySelector('#update-codes-close-btn');

            const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };
            const setDetail = (text) => { if (detailEl) detailEl.textContent = text; };
            const setProgress = (ratio) => {
                if (progressInner) {
                    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
                    progressInner.style.width = `${percent}%`;
                }
            };

            const enableCloseButton = () => {
                if (!closeBtn) return;
                closeBtn.disabled = false;
                closeBtn.textContent = '关闭';
                closeBtn.onclick = () => {
                    dialog.classList.add('closing');
                    setTimeout(() => {
                        if (dialog && dialog.parentElement) {
                            dialog.parentElement.removeChild(dialog);
                        }
                    }, 200);
                };
            };

            try {
                setStatus('正在读取条目数据...');
                setDetail('');
                setProgress(0);

                const entriesRef = db.ref(getProjectPath('entries'));
                const snapshot = await entriesRef.once('value');
                const entriesData = snapshot.val() || {};

                const idPattern = /^\d{8}-\d{2}$/; // 新 ID 格式：20250315-01
                const updates = {};
                const removals = [];

                // 为每个日期单独维护一个计数器，避免依赖数据库 counters 旧状态
                const dateCounters = {};

                const allEntries = Object.entries(entriesData);
                const total = allEntries.length;
                let processed = 0;
                let regenerated = 0;
                let skipped = 0;

                for (const [oldId, entry] of allEntries) {
                    processed++;

                    // 已经是新格式的 ID，则跳过
                    if (idPattern.test(oldId)) {
                        skipped++;
                        continue;
                    }

                    if (!entry.date) {
                        console.warn('条目缺少日期，无法重新生成 ID，已跳过：', oldId, entry);
                        skipped++;
                        continue;
                    }

                    const dateObj = new Date(entry.date);
                    if (isNaN(dateObj.getTime())) {
                        console.warn('条目日期无效，无法重新生成 ID，已跳过：', oldId, entry.date);
                        skipped++;
                        continue;
                    }

                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const datePart = `${year}${month}${day}`;

                    // 本次迁移过程中的临时计数器（不依赖原有 counters 节点）
                    if (!dateCounters[datePart]) {
                        dateCounters[datePart] = 1;
                    } else {
                        dateCounters[datePart] += 1;
                    }

                    const seq = dateCounters[datePart];
                    const newId = `${datePart}-${seq.toString().padStart(2, '0')}`;

                    // 如果新旧 ID 相同，跳过
                    if (newId === oldId) {
                        skipped++;
                        continue;
                    }

                    const newEntry = { ...entry, id: newId };
                    updates[newId] = newEntry;
                    removals.push(oldId);
                    regenerated++;

                    // 定期刷新进度显示，避免阻塞 UI
                    if (processed % 50 === 0 || processed === total) {
                        setStatus(`正在处理条目 ${processed}/${total} ...`);
                        setDetail(`已重新生成 ${regenerated} 条，跳过 ${skipped} 条`);
                        setProgress(total > 0 ? processed / total : 1);
                        // 让出事件循环以刷新界面
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }

                setStatus('正在写入数据库...');
                setDetail(`准备写入 ${regenerated} 条新编号...`);
                setProgress(0.95);

                // 批量写入新条目
                if (Object.keys(updates).length > 0) {
                    await entriesRef.update(updates);
                }

                setStatus('正在清理旧编号...');
                // 批量删除旧 ID
                if (removals.length > 0) {
                    await Promise.all(removals.map(id => entriesRef.child(id).remove()));
                }

                setProgress(1);
                setStatus('条目编号更新完成');
                setDetail(`本次共重新生成 ${regenerated} 个条目的 ID，跳过 ${skipped} 条。`);
                enableCloseButton();

                // 重新拉取并渲染最新数据
                if (typeof debouncedRenderEntries === 'function') {
                    debouncedRenderEntries();
                }

                showAlert(`条目编号更新完成。本次共重新生成 ${regenerated} 个条目的 ID。`, 'success');
            } catch (error) {
                console.error('更新条目代码时发生错误：', error);
                setStatus('更新条目代码失败');
                setDetail(error.message || '未知错误');
                enableCloseButton();
                showAlert(`更新条目代码失败：${error.message}`, 'error');
            }
        }

        // 核心功能：根据“用户填写的日期”生成全局唯一 ID（格式：YYYYMMDD-序号）
        async function generateID(entry) {
            // 强制校验必填字段
            if (!entry.date) throw new Error('日期为必填项');

            // 日期格式化为 YYYYMMDD（直接基于用户输入的日期）
            const dateObj = new Date(entry.date);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const datePart = `${year}${month}${day}`;

            // 计数器以日期为基准：同一天内从 01 递增
            const counterRef = db.ref(getProjectPath(`counters/${datePart}`));
            let seq = 1;

            await counterRef.transaction(currentValue => {
                if (currentValue === null) return 1; // 初始化计数器
                return currentValue + 1;             // 递增序号
            }).then(({ committed, snapshot }) => {
                if (committed) seq = snapshot.val();
            });

            // 新 ID 格式示例：20250315-01
            return `${datePart}-${seq.toString().padStart(2, '0')}`;
        }

        // 记录上一次渲染使用的页码（用于判断是否需要自动滚动到顶部）
        let previousPage = 1;

        // 渲染条目列表
        function renderEntries() {
            // 仅在页码发生变化时，平滑滚动到页面顶部
            if (currentPage !== previousPage) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                previousPage = currentPage;
            }

            // 筛选条目
            const filteredEntries = getFilteredEntries();
            
            // 更新统计面板
            updateStatisticsPanel();
            
            // 计算分页
            const totalPages = Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE);
            currentPage = Math.min(currentPage, totalPages || 1);
            const start = (currentPage - 1) * ENTRIES_PER_PAGE;
            const end = start + ENTRIES_PER_PAGE;
            const currentPageEntries = filteredEntries.slice(start, end);

            // V2.3：Word 视图（分页）
            if (currentViewMode === 'word' && window.V2Word && typeof V2Word.render === 'function') {
                V2Word.render(currentPageEntries, totalPages);
                updatePagination(totalPages);
                if (typeof window._v2AfterRender === 'function') window._v2AfterRender();
                return;
            }

            // V2：时间线视图（全量事件，按日期比例排列）
            if (currentViewMode === 'timeline' && window.V2Events && typeof V2Events.render === 'function') {
                V2Events.render();
                if (typeof window._v2AfterRender === 'function') window._v2AfterRender();
                return;
            }

            // V2.1：卡片视图由 V2Views 渲染
            if (currentViewMode === 'card' && window.V2Views && typeof V2Views.renderPage === 'function') {
                V2Views.renderPage(currentPageEntries, totalPages);
                if (typeof window._v2AfterRender === 'function') window._v2AfterRender();
                return;
            }

            document.body.classList.remove('word-mode-active');
            document.body.classList.remove('timeline-mode-active');
            // 渲染列表 - 根据视图模式选择渲染函数
            const container = document.getElementById('entries-container');
            const isList = currentViewMode === 'list';

            // 创建新视图的容器
            const newViewContainer = document.createElement('div');
            newViewContainer.className = isList ? 'list-view' : 'detail-view'; // 添加基础类
            newViewContainer.innerHTML = isList ?
                renderListView(currentPageEntries) :
                renderDetailView(currentPageEntries);
            // 设置初始不可见状态，准备动画
            newViewContainer.style.opacity = 0;
            newViewContainer.style.transform = `translateX(${isList ? '20px' : '-20px'})`; // 列表从右进，详情从左进

            // 获取当前的视图容器 (如果存在)
            const currentView = container.querySelector('.list-view, .detail-view');

            // 如果已有视图，且视图类型发生了变化，则执行切换动画
            if (currentView && currentView.classList.contains(isList ? 'list-view' : 'detail-view') === false) {
                // 1. 给当前视图添加 'leaving' 动画类
                currentView.classList.add('leaving');
                currentView.classList.remove('entering'); // 确保移除 entering
                // 设置离开动画的目标状态
                currentView.style.opacity = 0;
                currentView.style.transform = `translateX(${currentView.classList.contains('list-view') ? '-20px' : '20px'})`; // 列表向左出，详情向右出

                // 2. 添加新视图到容器（初始状态已在上面设置）
                container.appendChild(newViewContainer);

                // 3. 使用微小的延迟确保浏览器渲染离开状态，然后触发进入动画
                requestAnimationFrame(() => {
                     requestAnimationFrame(() => { // Double requestAnimationFrame for robustness
                        // 应用进入状态
                        newViewContainer.classList.add('entering'); // 添加 entering 类（如果需要）
                        newViewContainer.style.opacity = 1;
                        newViewContainer.style.transform = 'translateX(0)';
                     });
                });

                // 4. 在旧视图动画结束后彻底移除它
                setTimeout(() => {
                    if (currentView && container.contains(currentView)) { // 再次检查以防万一
                       currentView.remove();
                    }
                }, 400); // 动画时长 0.4s

            } else if (!currentView) {
                // 如果没有旧视图（首次加载），直接添加并设置动画进入状态
                container.innerHTML = ''; // 清空容器
                container.appendChild(newViewContainer);
                // 使用微小延迟触发首次加载动画
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                       newViewContainer.classList.add('entering'); // 添加 entering 类
                       newViewContainer.style.opacity = 1;
                       newViewContainer.style.transform = 'translateX(0)';
                    });
                });
            } else {
                 // 如果视图类型未改变（例如，只是分页或筛选），则直接替换内容，不加动画
                 container.innerHTML = '';
                 container.appendChild(newViewContainer);
                 //确保新视图可见
                 newViewContainer.style.opacity = 1;
                 newViewContainer.style.transform = 'translateX(0)';
                 // newViewContainer.classList.add('entering'); // 保持 entering 状态可能不需要，因为没有动画
            }

            // 更新分页
            updatePagination(totalPages);

            // 在批量模式下更新选择计数
            if (bulkModeActive) {
                updateSelectedCount();
            }

            // 让新渲染的元素也能参与入场动画（如果增强模块已初始化）
            if (typeof window.refreshEnhancedAnimations === 'function') {
                try { window.refreshEnhancedAnimations(); } catch (_) {}
            }
            if (typeof window._v2AfterRender === 'function') {
                try { window._v2AfterRender(); } catch (_) {}
            }
        }

        // 渲染目录视图 (使用div结构以兼容批量操作)
        function renderListView(entries) {
             // --- 恢复到之前的逻辑：直接返回 div 元素 --- 
             return entries.map(entry => {
                 const elementClass = `entry-item ${bulkModeActive ? 'bulk-mode' : ''} ${selectedAll || selectedEntryIds.has(entry.id) ? 'selected' : ''}`;
                 let entryContent = '';

                // 目录视图：不显示内容预览，只显示标题、元数据和关键词
                const typeLabel = (window.V2SourceTypes && V2SourceTypes.typeName(entry.typeId)) || '';
                const citeText = entry.citation || (window.V2Citations && V2Citations.generateCitation(entry)) || '';
               entryContent += `
                    <div class="entry-header">
                        <h3 class="entry-title">${entry.title || ''}${(window.V2Events ? V2Events.eventBadgeHtml(entry) : '')}</h3>
                        <div class="entry-meta">
                            <span class="entry-id">${entry.id}</span>
                            <span class="entry-date">${entry.date}</span>
                            ${typeLabel ? `<span class="v2-type-badge">${typeLabel}</span>` : ''}
                        </div>
                        <div class="entry-actions">
                            ${bulkModeActive ? `
                                <input
                                    type="checkbox"
                                    class="select-entry"
                                    ${selectedAll || selectedEntryIds.has(entry.id) ? 'checked' : ''}
                                    onchange="handleEntrySelection('${entry.id}', this.checked)"
                                    style="display:none;"
                                >
                            ` : ''}
                            <button class="primary-btn btn-icon-only" onclick="editEntry('${entry.id}')" title="编辑" aria-label="编辑">
                                <span class="material-icons">edit</span>
                            </button>
                            <button class="danger-btn btn-icon-only" onclick="deleteEntry('${entry.id}')" title="删除" aria-label="删除">
                                <span class="material-icons">delete</span>
                            </button>
                        </div>
                    </div>
                    ${citeText ? `<div class="v2-entry-citation">${citeText.replace(/</g, '&lt;')}</div>` : ''}
                    <div class="entry-footer">
                        <div class="entry-keywords">
                            ${(entry.keywords || []).map(kw => `<span class="keyword-tag" onclick="filterByKeyword('${kw}')">${kw}</span>`).join('')}
                        </div>
                    </div>
                `;

                const clickAttr = bulkModeActive ? ` onclick="handleEntryItemClick(event, '${entry.id}')"` : '';
                return `<div class="${elementClass}" data-id="${entry.id}"${clickAttr}>${entryContent}</div>`;
             }).join('');
             // --- 恢复结束 ---
        }

        // 渲染详细视图
        function renderDetailView(entries) {
            return `<div class="detail-view-container">` + 
                   entries.map(entry => {
                       const elementClass = `detail-entry glass-container ${bulkModeActive ? 'bulk-mode' : ''} ${selectedAll || selectedEntryIds.has(entry.id) ? 'selected' : ''}`;
                       let entryContent = '';

                       // 批量模式：保留隐藏复选框用于逻辑控制，不再展示可见圈圈
                       if (bulkModeActive) {
                           entryContent += `
                               <input
                                   type="checkbox"
                                   class="select-entry"
                                   ${selectedAll || selectedEntryIds.has(entry.id) ? 'checked' : ''}
                                   onchange="handleEntrySelection('${entry.id}', this.checked)"
                                   style="display:none;"
                               >`;
                       }

                       // 全文检索高亮处理
                       let title = entry.title || '';
                       let content = entry.content || '';
                       let analysis = entry.analysis || '';
                       
                       if (fulltextSearch.highlights && fulltextSearch.highlights[entry.id]) {
                           const highlights = fulltextSearch.highlights[entry.id];
                           const titleLen = title.length;
                           const contentLen = content.length;
                           
                           // 根据检索范围分离高亮
                           if (fulltextSearch.scope === 'all') {
                               // 全部内容：需要按位置分离标题、内容、分析的高亮
                               const titleHighlights = highlights.filter(hl => hl.start < titleLen);
                               const contentHighlights = highlights.filter(hl => hl.start >= titleLen && hl.start < titleLen + 1 + contentLen).map(hl => ({
                                   ...hl,
                                   start: hl.start - titleLen - 1,
                                   end: hl.end - titleLen - 1
                               }));
                               const analysisHighlights = highlights.filter(hl => hl.start >= titleLen + 1 + contentLen).map(hl => ({
                                   ...hl,
                                   start: hl.start - titleLen - 1 - contentLen - 1,
                                   end: hl.end - titleLen - 1 - contentLen - 1
                               }));
                               
                               if (titleHighlights.length > 0) title = highlightText(title, titleHighlights);
                               if (contentHighlights.length > 0) content = highlightText(content, contentHighlights);
                               if (analysisHighlights.length > 0) analysis = highlightText(analysis, analysisHighlights);
                           } else if (fulltextSearch.scope === 'title') {
                               const titleHighlights = highlights;
                               if (titleHighlights.length > 0) title = highlightText(title, titleHighlights);
                           } else if (fulltextSearch.scope === 'content') {
                               const contentHighlights = highlights;
                               if (contentHighlights.length > 0) content = highlightText(content, contentHighlights);
                           } else if (fulltextSearch.scope === 'analysis') {
                               const analysisHighlights = highlights;
                               if (analysisHighlights.length > 0) analysis = highlightText(analysis, analysisHighlights);
                           }
                       }

                       // 详细条目内容
                       const typeLabel = (window.V2SourceTypes && V2SourceTypes.typeName(entry.typeId)) || '';
                       const citeText = entry.citation || (window.V2Citations && V2Citations.generateCitation(entry)) || '';
                       entryContent += `
                           <div class="entry-header">
                               <div class="entry-meta">
                                   <span class="entry-id">${entry.id}</span>
                                   <span class="entry-date">${entry.date}</span>
                                   ${typeLabel ? `<span class="v2-type-badge">${typeLabel}</span>` : ''}
                               </div>
                               <div class="entry-actions">
                                  <button class="primary-btn btn-icon-only" onclick="editEntry('${entry.id}')" title="编辑" aria-label="编辑">
                                      <span class="material-icons">edit</span>
                                  </button>
                                  <button class="danger-btn btn-icon-only" onclick="deleteEntry('${entry.id}')" title="删除" aria-label="删除">
                                      <span class="material-icons">delete</span>
                                  </button>
                               </div>
                           </div>
                           <div class="entry-body">
                               <h3 class="entry-title">${title}${window.V2Events ? V2Events.eventBadgeHtml(entry) : ''}</h3>
                               ${citeText ? `<div class="v2-entry-citation" style="-webkit-line-clamp:3;line-clamp:3">${citeText.replace(/</g, '&lt;')}</div>` : ''}
                               <div class="content-section">
                                   <h4>原文内容 <span class="word-count-badge">${countWords(entry.content)} 字</span></h4>
                                   <div class="entry-content">${content || '无内容'}</div>
                               </div>
                               ${entry.analysis ? `
                                   <div class="analysis-section">
                                       <h4>分析解读</h4>
                                       <div class="entry-analysis">${analysis}</div>
                                   </div>
                               ` : ''}
                               <div class="entry-footer">
                                   <div class="entry-keywords">
                                       ${(entry.keywords || []).map(k => `<span class="keyword-tag" onclick="filterByKeyword('${k}')">${k}</span>`).join('')}
                                   </div>
                                   <div class="entry-links">
                                       ${(entry.links || []).map(l => `<a href="${l}" target="_blank">相关链接</a>`).join('')}
                                   </div>
                               </div>
                           </div>
                       `;

                       const clickAttr = bulkModeActive ? ` onclick="handleEntryItemClick(event, '${entry.id}')"` : '';
                       return `<div class="${elementClass}" data-id="${entry.id}"${clickAttr}>${entryContent}</div>`;
                   }).join('') + 
                   `</div>`;
        }

        function exportEntries(format) {
            const entriesToExport = getFilteredEntries();
            exportExcel(entriesToExport, format); // 调用通用导出函数
        }

        async function exportExcel(entriesToExport, format) { // 改为 async，支持动态加载 XLSX
            showLoading('正在准备导出数据...');
            try {
                // 动态加载 XLSX 库（如果尚未加载）
                if (!window.XLSX) {
                    showLoading('正在加载导出工具...');
                    await window.loadXLSX();
                }
                
                // 数据格式预验证
                if (!Array.isArray(entriesToExport)) {
                    showAlert('导出数据格式错误', 'error');
                    hideLoading();
                    return;
                }
                
                const wb = XLSX.utils.book_new();

                // 仅当有条目选择时，才创建史料数据表
                if (entriesToExport.length > 0) {
                    // 数据安全处理
                    const validatedEntries = entriesToExport.map(entry => ({
                        ...entry,
                        links: Array.isArray(entry.links) ? entry.links : [],
                        keywords: Array.isArray(entry.keywords) ? entry.keywords : []
                    }));

                    const data = validatedEntries.map(entry => ({
                        ID: entry.id || '',
                        日期: entry.date || '',
                        标题: entry.title || '',
                        文献类型: (window.V2SourceTypes && V2SourceTypes.typeName(entry.typeId)) || entry.typeId || '',
                        引用: entry.citation || '',
                        作者: (entry.metadata && entry.metadata.author) || '',
                        原文内容: entry.content || '',
                        分析: entry.analysis || '',
                        相关链接: (entry.links || []).join('; '),
                        关键词: (entry.keywords || []).join('; '),
                        关联事件: (window.V2Events
                            ? V2Events.normalizeEvents(entry.events)
                            : (Array.isArray(entry.events) ? entry.events : [])
                          ).map(ev => `${ev.date || ''} ${ev.description || ''}`.trim()).filter(Boolean).join('；'),
                        关联文献: (entry.relatedSources || []).join('; ')
                    }));
                    const ws = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, ws, "史料数据");
                }

                // 只有当至少有一个工作表时才生成文件
                if (wb.SheetNames.length > 0) {
                showLoading('正在生成 Excel 文件...'); // 更新提示
                XLSX.writeFile(wb, `史料导出_${new Date().toISOString().slice(0,10)}.xlsx`);
                   showAlert(`成功导出 ${entriesToExport.length} 条记录`, 'success');
                } else {
                   showAlert('没有数据可导出', 'warning');
                }
                
            } catch (error) {
                console.error('导出失败:', error);
                showAlert(`导出失败：${error.message}`, 'error');
            } finally {
                hideLoading(); // 隐藏加载提示
            }
        }

        // 分类选择更新函数已废弃，保留空实现以兼容旧代码调用
        function updateCategorySelectors() {}

        function updateSubCats() {}

        function updatePagination(totalPages) {
            document.getElementById('currentPage').textContent = currentPage;
            document.getElementById('totalPages').textContent = totalPages || 1;
            document.getElementById('entriesPerPage').textContent = ENTRIES_PER_PAGE;

            // 保存总页数到全局变量
            window.totalPages = totalPages || 1;

            const container = document.getElementById('pagination-buttons');
            const current = currentPage;
            const pages = [];
            const MAX_VISIBLE = 5;

            // 生成页码数组（与原有逻辑一致）
            pages.push(1);
            if (totalPages <= 7) {
                for (let i = 2; i < totalPages; i++) pages.push(i);
            } else {
                if (current - MAX_VISIBLE > 2) pages.push('...');
                const start = Math.max(2, current - 2);
                const end = Math.min(totalPages - 1, current + 2);
                for (let i = start; i <= end; i++) pages.push(i);
                if (current + 2 < totalPages - 1) pages.push('...');
            }
            if (totalPages > 1) pages.push(totalPages);

            // 检测是否为移动端
            const isMobile = window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

            // 生成上一页 / 下一页按钮（移动端为图标，桌面端为文字+图标）
            const prevBtn = current > 1
                ? `<button class="page-btn nav" onclick="currentPage=${current - 1};renderEntries()">${
                    isMobile
                        ? '<span class="material-icons">chevron_left</span>'
                        : '<span class="material-icons" style="font-size:16px;vertical-align:middle;margin-right:4px;">chevron_left</span>上一页'
                  }</button>`
                : '';

            const nextBtn = current < totalPages
                ? `<button class="page-btn nav" onclick="currentPage=${current + 1};renderEntries()">${
                    isMobile
                        ? '<span class="material-icons">chevron_right</span>'
                        : '下一页<span class="material-icons" style="font-size:16px;vertical-align:middle;margin-left:4px;">chevron_right</span>'
                  }</button>`
                : '';

            // 生成页码按钮
            const pageButtons = pages.map(page => {
                if (page === '...') {
                    return `<button class="page-btn more">⋯</button>`;
                }
                return `<button class="page-btn ${page === current ? 'active' : ''}" onclick="currentPage=${page};renderEntries()">${page}</button>`;
            }).join('');

            // 同步更新顶部行内跳转输入框的最大页和当前值
            const inlineJump = document.getElementById('page-jump-inline');
            if (inlineJump) {
                inlineJump.max = totalPages || 1;
                inlineJump.value = current;
            }

            // 组合HTML（分页按钮区域只保留页码和上一页/下一页）
            container.innerHTML = `
                ${prevBtn}
                ${pageButtons}
                ${nextBtn}
            `;
        }
        
        // 显示更多页码
        function showMorePages() {
            const current = currentPage;
            const totalPages = parseInt(document.getElementById('totalPages').textContent);
            const visibleRange = 5; // 每次点击显示5页
            const start = Math.max(1, current - visibleRange);
            const end = Math.min(totalPages, current + visibleRange);
            
            const pages = [];
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            document.getElementById('pagination-buttons').innerHTML = pages.map(page => `
                <button class="page-btn ${page === current ? 'active' : ''}" 
                        onclick="currentPage=${page};renderEntries()">${page}</button>
            `).join('') + `
                <div class="page-jump">
                    跳至 <input type="number" min="1" max="${totalPages}" 
                          onchange="jumpToPage(this.value)" style="width:60px"> 页
                </div>
            `;
        }

        // 跳转页面
        function jumpToPage(page) {
            const totalPages = parseInt(document.getElementById('totalPages').textContent);
            page = Math.max(1, Math.min(Number(page), totalPages));
            if (page && page !== currentPage) {
                currentPage = page;
                renderEntries();
                // 添加轻微滚动效果
                const paginationElement = document.querySelector('.pagination');
                if (paginationElement) {
                    paginationElement.style.transform = 'translateY(-5px)';
                    setTimeout(() => {
                        paginationElement.style.transform = 'translateY(0)';
                    }, 300);
                }
            }
        }

        /**
         * 平滑滚动到工作区顶部（V2 布局使用 .v2-main-scroll 而非 window）
         */
        function scrollToTop() {
            const targets = [
                document.querySelector('.v2-main-scroll'),
                document.getElementById('entries-container-wrapper'),
                document.querySelector('.word-doc-paper'),
                document.querySelector('.word-toc-list'),
                document.querySelector('.word-notes-list'),
                document.querySelector('.detail-view-container'),
                document.querySelector('.card-view')
            ];
            targets.forEach(el => {
                if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function countKeyword(keyword) {
            return entries.filter(e => e.keywords.includes(keyword)).length;
        }

        async function saveEntry(e) {
            e.preventDefault();
            try {
                const formData = getFormData();
                
                // 验证必填字段
                if (!formData.date) throw new Error('请选择日期');
                if (!formData.title.trim()) throw new Error('请输入标题');
                if (!formData.content.trim()) throw new Error('请输入原文内容');

                // V2.2：文献类型与引用
                if (!formData.typeId) formData.typeId = 'general';
                if (!formData.metadata) formData.metadata = {};
                if (window.V2Citations) {
                    formData.citation = V2Citations.generateCitation(formData) || formData.citation || '';
                }
                
                // 构建新条目
                const newEntry = {
                    ...formData,
                    updatedAt: Date.now()
                };
                
                const entryRef = db.ref(getProjectPath('entries'));
                const originalEntry = editingId ? (await entryRef.child(editingId).once('value')).val() : null;

                let finalEntryId;
                
                if (editingId) {
                    // 保持原ID
                    newEntry.id = editingId;
                    // 保持原创建时间
                    newEntry.createdAt = originalEntry.createdAt;
                    
                    // 使用update方法更新部分字段
                    const updates = {};
                    Object.keys(newEntry).forEach(key => {
                        if (key !== 'id' && key !== 'createdAt') {
                            updates[key] = newEntry[key];
                        }
                    });
                    await entryRef.child(newEntry.id).update(updates);
                    finalEntryId = newEntry.id;
                } else {
                    // 新条目，生成ID
                    newEntry.id = await generateID(newEntry);
                    newEntry.createdAt = firebase.database.ServerValue.TIMESTAMP;
                    // 保存到数据库
                    await entryRef.child(newEntry.id).set(newEntry);
                    finalEntryId = newEntry.id;
                }

                // 修复：成功保存后清理草稿（使用已定义的 currentDraftId）
                if (currentDraftId) {
                    await db.ref(getProjectPath(`drafts/${currentDraftId}`)).remove();
                    localStorage.removeItem('currentDraftId');
                    currentDraftId = null;
                }
                
                // 如果是从草稿箱恢复的，也清理草稿箱中的记录
                if (entryDraft) {
                    await db.ref(getProjectPath(`drafts/${entryDraft}`)).remove();
                    entryDraft = null;
                }
                
                // 重置编辑状态
                editingId = null;
                
                hideForm();
                showAlert('保存成功！', 'success');
            } catch (error) {
                showAlert('保存失败: ' + error.message, 'error');
            }
        }

        function editEntry(id) {
            const entry = entries.find(e => e.id === id);
            if (!entry) {
                showAlert('找不到指定条目', 'error');
                return;
            }
            
            editingId = id; // 保留原始ID用于后续判断
            
            // 填充表单数据（主类/子类已从编辑表单中移除）
            document.querySelector('[name="date"]').value = entry.date || '';
            document.querySelector('[name="title"]').value = entry.title || '';
            // 添加检查确保 quill 实例存在
             if (quill && quill.root) {
                 quill.root.innerHTML = entry.content || ''; // 恢复
             } else {
                 console.error("Quill (原文) 实例未准备好，无法设置内容。");
             }
             // 添加检查确保 analysisQuill 实例存在
             if (window.analysisQuill && window.analysisQuill.root) {
                 window.analysisQuill.root.innerHTML = entry.analysis || ''; // 恢复
             } else {
                 console.error("Quill (分析) 实例未准备好，无法设置内容。");
             }
            // if (entryContentEditor) entryContentEditor.setData(entry.content || ''); // 移除
            // if (entryAnalysisEditor) entryAnalysisEditor.setData(entry.analysis || ''); // 移除
            document.querySelector('[name="links"]').value = (entry.links || []).join(', ');
            document.querySelector('[name="keywords"]').value = (entry.keywords || []).join(', ');
            showForm();
        }

        async function deleteEntry(id) {
            if (confirm('确定要删除该条目吗？删除的条目将移至回收站。')) {
                try {
                    const entry = entries.find(e => e.id === id);
                    if (entry) {
                        // 添加删除时间戳
                        entry.deletedAt = Date.now();
                        // 移动到回收站
                        await db.ref(getProjectPath(`trash/${id}`)).set(entry);
                        // 从当前列表中删除
                    await db.ref(getProjectPath(`entries/${id}`)).remove();
                        showAlert('条目已移至回收站', 'info');
                    }
                } catch (error) {
                    showAlert('删除失败: ' + error.message, 'error');
                }
            }
        }

        /* 性能优化：防抖与节流 */
        function debounce(fn, wait) {
            let t;
            return function executed(...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), wait);
            };
        }
        function throttle(fn, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    fn.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => { inThrottle = false; }, limit);
                }
            };
        }

        // 事件监听
        (function initSearchInput() {
            const el = document.getElementById('search-input');
            if (!el) return;
            el.addEventListener('input', debounce(function() {
                searchQuery = this.value;
                currentPage = 1;
                renderEntries();
            }, 300));
        })();

        // 高级检索：标签选择变化时同步 UI 摘要（事件委托，避免重复绑定）
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (target.closest && target.closest('#tag-selector')) {
                if (typeof updateTagFilterSummary === 'function') {
                    updateTagFilterSummary();
                }
            }
        });

        function filterByKeyword(keyword) {
            currentFilterKeyword = keyword === currentFilterKeyword ? null : keyword;
            currentPage = 1;
            renderEntries();
        }

        function resetFilter() {
            currentFilterKeyword = null;
            currentPage = 1;
            renderEntries();
        }

        // 全选功能逻辑
        function toggleSelectAll(isPageOnly) {
            const checkboxes = document.querySelectorAll('.select-entry');
            const pageCheckbox = document.getElementById('select-page');
            const allCheckbox = document.getElementById('select-all');
            const currentVisibleEntryIds = Array.from(checkboxes).map(cb => cb.closest('[data-id]')?.dataset.id).filter(Boolean);

            if (isPageOnly) {
                // --- 修改：选择当前页逻辑 ---
                selectedAll = false; // 选择页面时，取消全局全选状态
                allCheckbox.checked = false;

                // 检查当前页是否已全部选中
                const allCurrentlySelectedOnPage = currentVisibleEntryIds.every(id => selectedEntryIds.has(id));
                const shouldSelect = !allCurrentlySelectedOnPage;

                checkboxes.forEach(cb => {
                    const entryId = cb.closest('[data-id]')?.dataset.id;
                    if (entryId) {
                        cb.checked = shouldSelect;
                        if (shouldSelect) {
                            selectedEntryIds.add(entryId);
                             // 添加选中样式
                            cb.closest('.entry-item, .detail-entry, .card-entry')?.classList.add('selected');
                        } else {
                            selectedEntryIds.delete(entryId);
                             // 移除选中样式
                            cb.closest('.entry-item, .detail-entry, .card-entry')?.classList.remove('selected');
                        }
                    }
                });
                 pageCheckbox.checked = shouldSelect;
                // -------------------------
            } else {
                // --- 修改：选择全部逻辑 ---
                selectedAll = !selectedAll;
                pageCheckbox.checked = selectedAll; // 页面选择框也同步状态
                allCheckbox.checked = selectedAll;

                if (selectedAll) {
                    selectedEntryIds.clear(); // 全选模式下，清空手动选择的ID
                     checkboxes.forEach(cb => {
                         cb.checked = true;
                         cb.closest('.entry-item, .detail-entry, .card-entry')?.classList.add('selected');
                     });
                    showAlert('已选择全部条目，包括其他页面的条目', 'info');
                } else {
                    // 取消全选时，不清空已手动选择的，而是根据当前页的勾选状态决定
                     checkboxes.forEach(cb => {
                         const entryId = cb.closest('[data-id]')?.dataset.id;
                         cb.checked = false; // 先全部取消勾选
                         cb.closest('.entry-item, .detail-entry, .card-entry')?.classList.remove('selected');
                         if (entryId && selectedEntryIds.has(entryId)) {
                             selectedEntryIds.delete(entryId); // 如果之前是全选，现在取消则清空set
                         }
                     });
                }
                // -----------------------
            }
             updateSelectedCount(); // 更新计数显示
        }

        // 新增方法：获取过滤后的条目
        function getFilteredEntries() {
            let filtered = entries.filter(entry => {
                // 关键字过滤
                const keywordTagMatch = !currentFilterKeyword || 
                    (entry.keywords && entry.keywords.includes(currentFilterKeyword)); // 确保 keywords 存在
                
                // 搜索过滤（含引用与著录字段）
                const metaText = entry.metadata ? Object.values(entry.metadata).join(' ') : '';
                const searchMatch = !searchQuery || 
                    [entry.title, entry.content, entry.analysis, (entry.keywords || []).join(' '),
                     entry.citation || '', entry.typeId || '', metaText]
                        .join(' ')
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase());
                
                // 高级筛选
                const dateMatch = (!advancedFilter.startDate || entry.date >= advancedFilter.startDate) &&
                                (!advancedFilter.endDate || entry.date <= advancedFilter.endDate);
                
                // 标签交叉检索：对 entry.keywords 使用 AND / OR 逻辑
                const entryTags = entry.keywords || [];
                let tagMatch = true;
                if (advancedFilter.tags.length > 0) {
                    if (advancedFilter.tagLogic === 'AND') {
                        // 必须包含所有选中标签
                        tagMatch = advancedFilter.tags.every(tag => entryTags.includes(tag));
                    } else {
                        // 只要包含任意一个选中标签即可
                        tagMatch = advancedFilter.tags.some(tag => entryTags.includes(tag));
                    }
                }
                
                // 全文搜索：在标题、原文内容、分析解读三个字段中搜索关键词（仅用于全文检索模块）
                const titleText = (entry.title || '').toLowerCase();
                const contentText = (entry.content || '').toLowerCase();
                const analysisText = (entry.analysis || '').toLowerCase();
                const fullText = `${titleText} ${contentText} ${analysisText}`;
                
                // 全文检索过滤（有结果时在所有视图中生效）
                const fulltextMatch = fulltextSearch.results.length === 0 ||
                                    fulltextSearch.results.includes(entry.id);
                
                return keywordTagMatch && searchMatch && dateMatch && tagMatch && fulltextMatch;
            });
            
            // 添加排序逻辑：按日期升序 (从早到晚)
            filtered.sort((a, b) => {
                // 确保 date 字段存在且为有效字符串进行比较
                const dateA = a.date || '0000-00-00';
                const dateB = b.date || '0000-00-00';
                return dateA.localeCompare(dateB); // 升序排序 (从早到晚)
            });

            return filtered;
        }

        // --- 新增：导出选中条目的函数 ---
        function exportSelectedEntries(format) {
            let entriesToExport = [];
            
            if (selectedAll) {
                entriesToExport = getFilteredEntries(); // 全选模式导出所有筛选后的
            } else {
                 // 只导出 selectedEntryIds 中的条目
                entriesToExport = entries.filter(entry => selectedEntryIds.has(entry.id));
            }

            if (entriesToExport.length === 0) {
                showAlert('没有选中的条目可导出。', 'warning');
                return;
            }
            
            exportExcel(entriesToExport, format); // 调用通用导出函数
        }

        // 切换高级搜索面板（紧凑工具条，避免挤占条目列表）
        function toggleAdvancedSearch() {
            const wrap = document.querySelector('.v2-advanced-search') ||
                document.querySelector('.advanced-search');
            const panel = document.querySelector('.v2-advanced-search .advanced-panel') ||
                document.querySelector('.advanced-panel');
            const button = document.getElementById('toggle-advanced-search-btn');
            const iconEl = button?.querySelector('.material-icons');

            if (!panel) {
                console.warn('高级检索面板未找到');
                return;
            }

            const isOpen = wrap?.classList.contains('is-open');

            if (isOpen) {
                wrap?.classList.remove('is-open');
                panel.style.maxHeight = '0px';
                panel.style.opacity = '0';
                panel.style.marginTop = '0';
                panel.style.marginBottom = '0';
                if (button) {
                    button.title = '高级检索';
                    button.setAttribute('aria-label', '高级检索');
                    button.setAttribute('aria-expanded', 'false');
                    button.classList.remove('active');
                    if (iconEl) iconEl.textContent = 'filter_list';
                }
            } else {
                wrap?.classList.add('is-open');
                // 约 26vh / 上限 220px，保证下方条目仍有足够可视高度
                const cap = Math.min(Math.round(window.innerHeight * 0.26), 220);
                panel.style.maxHeight = cap + 'px';
                panel.style.opacity = '1';
                panel.style.marginTop = '6px';
                panel.style.marginBottom = '4px';
                if (button) {
                    button.title = '收起高级检索';
                    button.setAttribute('aria-label', '收起高级检索');
                    button.setAttribute('aria-expanded', 'true');
                    button.classList.add('active');
                    if (iconEl) iconEl.textContent = 'expand_less';
                }

                const tagSelector = document.getElementById('tag-selector');
                if (tagSelector && !tagSelector.children.length) {
                    const allTags = [...new Set(entries.flatMap(e => e.keywords || []))];

                    if (allTags.length === 0) {
                        tagSelector.textContent = '暂无标签数据';
                        tagSelector.classList.add('empty');
                    } else {
                        tagSelector.classList.remove('empty');
                        tagSelector.innerHTML = `
                            <div class="tag-cloud">
                                ${allTags.map((tag, index) => `
                                    <label class="tag-item" data-tag="${tag}" style="--index:${index}">
                                        <input type="checkbox" value="${tag}">
                                        <span class="tag-text">${tag}</span>
                                        <span class="tag-count">${countTagOccurrences(tag)}</span>
                                        <span class="checkmark" aria-hidden="true"></span>
                                    </label>
                                `).join('')}
                            </div>
                        `;
                    }
                }
                updateTagFilterSummary();
            }
        }

        // 标签出现次数
        function countTagOccurrences(tag) {
            return entries.filter(e => (e.keywords || []).includes(tag)).length;
        }

        // 同步标签选中状态 + 摘要
        function updateTagFilterSummary() {
            const container = document.getElementById('tag-selector');
            const summaryEl = document.getElementById('tag-filter-summary');
            const countEl = document.getElementById('selected-tags-count');
            if (!container || !summaryEl || !countEl) return;

            const items = container.querySelectorAll('.tag-item');
            let selectedCount = 0;
            items.forEach((item) => {
                const input = item.querySelector('input[type="checkbox"]');
                const selected = !!(input && input.checked);
                item.classList.toggle('selected', selected);
                if (selected) selectedCount++;
            });

            countEl.textContent = String(selectedCount);
            summaryEl.style.display = selectedCount > 0 ? 'flex' : 'none';
        }

        function clearAllTags() {
            document.querySelectorAll('#tag-selector input[type="checkbox"]').forEach(cb => { cb.checked = false; });
            updateTagFilterSummary();
        }

        // 日期预设
        function setDatePreset(preset, btn) {
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');
            if (!startDateInput || !endDateInput) return;

            document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');

            const today = new Date();
            const toISODate = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            let startDate = '';
            let endDate = '';

            switch (preset) {
                case 'today': {
                    startDate = toISODate(today);
                    endDate = startDate;
                    break;
                }
                case 'week': {
                    const weekStart = new Date(today);
                    // 以周日为一周开始（与原方案一致）
                    weekStart.setDate(today.getDate() - today.getDay());
                    startDate = toISODate(weekStart);
                    endDate = toISODate(today);
                    break;
                }
                case 'month': {
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    startDate = toISODate(monthStart);
                    endDate = toISODate(today);
                    break;
                }
                case 'year': {
                    const yearStart = new Date(today.getFullYear(), 0, 1);
                    startDate = toISODate(yearStart);
                    endDate = toISODate(today);
                    break;
                }
                default:
                    break;
            }

            startDateInput.value = startDate;
            endDateInput.value = endDate;
        }

        function clearDates() {
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');
            if (startDateInput) startDateInput.value = '';
            if (endDateInput) endDateInput.value = '';
            document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
        }

        // 应用高级筛选
        function applyAdvancedSearch() {
            advancedFilter = {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
                tags: Array.from(document.querySelectorAll('#tag-selector input:checked')).map(cb => cb.value),
                tagLogic: document.getElementById('keywordLogic').value || 'AND'
            };
            
            currentPage = 1;
            renderEntries();
        }

        // 重置筛选
        function resetAdvancedSearch() {
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            document.querySelectorAll('#tag-selector input').forEach(cb => cb.checked = false);
            document.getElementById('keywordLogic').value = 'AND';
            clearDates();
            updateTagFilterSummary();
            
            advancedFilter = {
                startDate: null,
                endDate: null,
                tags: [],
                tagLogic: 'AND'
            };
            
            currentPage = 1;
            renderEntries();
        }

        // ========== 全文检索功能 ==========
        // 执行全文检索
        function applyFulltextSearch() {
            const input = document.getElementById('fulltext-search').value.trim();
            const logic = document.getElementById('fulltext-logic').value;
            const scope = document.getElementById('fulltext-scope').value;
            
            if (!input) {
                showAlert('请输入检索词', 'warning');
                return;
            }
            
            fulltextSearch.query = input;
            fulltextSearch.logic = logic;
            fulltextSearch.scope = scope;
            
            // 解析检索词
            if (logic === 'PHRASE') {
                fulltextSearch.terms = [input]; // 精确短语作为一个整体
            } else {
                // 处理引号内的精确匹配
                const phraseMatches = input.match(/"([^"]+)"/g);
                let remaining = input;
                let terms = [];
                
                if (phraseMatches) {
                    phraseMatches.forEach(match => {
                        const phrase = match.slice(1, -1); // 去除引号
                        terms.push(phrase);
                        remaining = remaining.replace(match, '');
                    });
                }
                
                // 添加剩余的词
                const remainingTerms = remaining.trim().split(/\s+/).filter(t => t);
                terms.push(...remainingTerms);
                fulltextSearch.terms = terms;
            }
            
            // 执行检索
            performFulltextSearch();
            
            // 显示结果摘要
            showFulltextResultsSummary();
            currentPage = 1;
            renderEntries();
        }

        // 执行检索逻辑
        function performFulltextSearch() {
            fulltextSearch.results = [];
            fulltextSearch.highlights = {};
            
            entries.forEach(entry => {
                let searchText = '';
                
                // 根据范围构建搜索文本
                switch (fulltextSearch.scope) {
                    case 'content':
                        searchText = entry.content || '';
                        break;
                    case 'analysis':
                        searchText = entry.analysis || '';
                        break;
                    case 'title':
                        searchText = entry.title || '';
                        break;
                    case 'all':
                    default:
                        searchText = `${entry.title || ''} ${entry.content || ''} ${entry.analysis || ''}`;
                        break;
                }
                
                // 转换为小写进行不区分大小写的搜索
                const textLower = searchText.toLowerCase();
                
                // 根据逻辑检查匹配
                let isMatch = false;
                let highlights = [];
                
                if (fulltextSearch.logic === 'PHRASE') {
                    // 精确短语匹配
                    const phrase = fulltextSearch.terms[0].toLowerCase();
                    if (textLower.includes(phrase)) {
                        isMatch = true;
                        highlights = findPhraseHighlights(searchText, phrase);
                    }
                } else if (fulltextSearch.logic === 'AND') {
                    // 必须包含所有词
                    const allMatch = fulltextSearch.terms.every(term => 
                        textLower.includes(term.toLowerCase())
                    );
                    if (allMatch) {
                        isMatch = true;
                        highlights = fulltextSearch.terms.flatMap(term => 
                            findTermHighlights(searchText, term)
                        );
                    }
                } else { // OR逻辑
                    // 包含任意一个词
                    const anyMatch = fulltextSearch.terms.some(term => 
                        textLower.includes(term.toLowerCase())
                    );
                    if (anyMatch) {
                        isMatch = true;
                        highlights = fulltextSearch.terms.flatMap(term => 
                            findTermHighlights(searchText, term)
                        );
                    }
                }
                
                if (isMatch) {
                    fulltextSearch.results.push(entry.id);
                    fulltextSearch.highlights[entry.id] = highlights;
                }
            });
            
            // 重新渲染条目列表
            currentPage = 1;
            renderEntries();
        }

        // 查找术语高亮位置
        function findTermHighlights(text, term) {
            const highlights = [];
            const termLower = term.toLowerCase();
            const textLower = text.toLowerCase();
            let startIndex = 0;
            
            while (startIndex < textLower.length) {
                const index = textLower.indexOf(termLower, startIndex);
                if (index === -1) break;
                
                highlights.push({
                    start: index,
                    end: index + term.length,
                    term: term
                });
                
                startIndex = index + 1;
            }
            
            return highlights;
        }

        // 查找短语高亮位置
        function findPhraseHighlights(text, phrase) {
            const highlights = [];
            const phraseLower = phrase.toLowerCase();
            const textLower = text.toLowerCase();
            let startIndex = 0;
            
            while (startIndex < textLower.length) {
                const index = textLower.indexOf(phraseLower, startIndex);
                if (index === -1) break;
                
                highlights.push({
                    start: index,
                    end: index + phrase.length,
                    term: phrase
                });
                
                startIndex = index + 1;
            }
            
            return highlights;
        }

        // 在文本中添加高亮标记
        function highlightText(text, highlights) {
            if (!highlights || highlights.length === 0) return text;
            
            // 按起始位置排序
            highlights.sort((a, b) => a.start - b.start);
            
            let result = '';
            let lastIndex = 0;
            
            highlights.forEach(hl => {
                // 添加高亮前的文本
                result += text.substring(lastIndex, hl.start);
                
                // 添加高亮标记
                result += `<span class="fulltext-highlight" title="匹配词: ${hl.term}">`;
                result += text.substring(hl.start, hl.end);
                result += '</span>';
                
                lastIndex = hl.end;
            });
            
            // 添加剩余文本
            result += text.substring(lastIndex);
            
            return result;
        }

        // 显示全文检索结果摘要
        function showFulltextResultsSummary() {
            const searchRow = document.querySelector('.fulltext-search-group')?.parentNode;
            if (!searchRow) return;
            
            let container = document.getElementById('fulltext-results-summary');
            if (!container) {
                // 创建结果摘要容器
                const summaryHTML = `
                    <div id="fulltext-results-summary" class="fulltext-results-summary">
                        <h4>检索结果</h4>
                        <div class="results-stats">
                            <div class="results-stat-item">
                                <span class="stat-value">${fulltextSearch.results.length}</span>
                                <span class="stat-label">个匹配条目</span>
                            </div>
                            <div class="results-stat-item">
                                <span class="stat-value">${fulltextSearch.terms.length}</span>
                                <span class="stat-label">个检索词</span>
                            </div>
                            <div class="results-stat-item">
                                <span class="stat-value">${fulltextSearch.logic}</span>
                                <span class="stat-label">逻辑关系</span>
                            </div>
                            <div class="results-stat-item">
                                <span class="stat-value">${fulltextSearch.scope === 'all' ? '全部内容' : fulltextSearch.scope === 'content' ? '仅原文' : fulltextSearch.scope === 'analysis' ? '仅分析' : '仅标题'}</span>
                                <span class="stat-label">检索范围</span>
                            </div>
                        </div>
                    </div>
                `;
                searchRow.insertAdjacentHTML('beforeend', summaryHTML);
                container = document.getElementById('fulltext-results-summary');
            } else {
                // 更新现有摘要
                const statItems = container.querySelectorAll('.results-stat-item');
                if (statItems.length >= 4) {
                    statItems[0].querySelector('.stat-value').textContent = fulltextSearch.results.length;
                    statItems[1].querySelector('.stat-value').textContent = fulltextSearch.terms.length;
                    statItems[2].querySelector('.stat-value').textContent = fulltextSearch.logic;
                    statItems[3].querySelector('.stat-value').textContent = fulltextSearch.scope === 'all' ? '全部内容' : fulltextSearch.scope === 'content' ? '仅原文' : fulltextSearch.scope === 'analysis' ? '仅分析' : '仅标题';
                }
                container.classList.add('active');
            }
            
            // 如果有结果，显示成功提示
            if (fulltextSearch.results.length > 0) {
                const termList = fulltextSearch.terms.map(t => `"${t}"`).join('、');
                showAlert(`找到 ${fulltextSearch.results.length} 个包含 ${termList} 的条目`, 'success');
            } else {
                showAlert('未找到匹配的条目', 'warning');
            }
        }

        // 清空全文检索
        function clearFulltextSearch() {
            const fulltextInput = document.getElementById('fulltext-search');
            const fulltextLogic = document.getElementById('fulltext-logic');
            const fulltextScope = document.getElementById('fulltext-scope');
            
            if (fulltextInput) fulltextInput.value = '';
            if (fulltextLogic) fulltextLogic.value = 'AND';
            if (fulltextScope) fulltextScope.value = 'all';
            
            fulltextSearch = {
                query: '',
                terms: [],
                logic: 'AND',
                scope: 'all',
                results: [],
                highlights: {}
            };
            
            // 移除结果摘要
            const summary = document.getElementById('fulltext-results-summary');
            if (summary) {
                summary.classList.remove('active');
                setTimeout(() => summary.remove(), 300);
            }
            
            // 重新渲染条目列表
            currentPage = 1;
            renderEntries();
            
            showAlert('全文检索已清除', 'info');
        }

        // 初始化
        updateCategorySelectors();
        renderEntries();

        // 全文检索：按Enter执行检索（事件委托，支持动态创建的元素）
        document.addEventListener('keypress', function(e) {
            if (e.target && e.target.id === 'fulltext-search' && e.key === 'Enter') {
                applyFulltextSearch();
            }
        });

        // 自动检查数据完整性
        setTimeout(() => {
            // 延迟执行，确保页面其他内容已加载完成
            checkDataIntegrity();
        }, 2000);

        // 检查数据完整性，如果有问题建议用户修复
        function checkDataIntegrity() {
            const entriesRef = db.ref(getProjectPath('entries'));
            entriesRef.once('value').then(snapshot => {
                let hasIssues = false;
                let checkedCount = 0;
                
                snapshot.forEach(child => {
                    const entry = child.val();
                    checkedCount++;
                    
                    if (!entry.hasOwnProperty('links') || entry.links === null || entry.links === undefined ||
                        !entry.hasOwnProperty('keywords') || entry.keywords === null || entry.keywords === undefined ||
                        !entry.hasOwnProperty('analysis') || entry.analysis === null || entry.analysis === undefined) {
                        hasIssues = true;
                    }
                });
                
                if (hasIssues && checkedCount > 0) {
                    showAlert('检测到部分数据缺少必要字段，建议点击"修复数据"按钮进行修复', 'warning');
                }
            }).catch(error => {
                console.error('数据检查失败:', error);
            });
        }

        // 页面卸载时清理监听器与定时器（减少内存占用）
        window.addEventListener('beforeunload', () => {
            if (unsubscribeEntries) unsubscribeEntries();
            if (unsubscribeCategories) unsubscribeCategories();
            if (typeof autoSaveTimer !== 'undefined' && autoSaveTimer) {
                clearInterval(autoSaveTimer);
                autoSaveTimer = null;
            }
            hideLoading();
        });

        // 新增在页面显示状态提示的方法
        function showAlert(message, type = 'info') {
            const alertBox = document.createElement('div');
            alertBox.className = `export-alert ${type}`;
            alertBox.innerHTML = `
                <span>${message}</span>
                <button onclick="this.parentElement.remove()">&times;</button>
            `;
            
            document.body.prepend(alertBox);
            setTimeout(() => alertBox.remove(), 5000);
        }

        // ========== 新增功能 ==========
        
        // 更新统计面板数据
        function updateStatisticsPanel() {
            // 检查DOM元素是否存在
            const statTotal = document.getElementById('stat-total');
            const statWordcount = document.getElementById('stat-wordcount');
            const statKeywords = document.getElementById('stat-keywords');
            
            if (!statTotal || !statKeywords) return;
            if (!entries) return;
            
            // 总条目数
            statTotal.textContent = entries.length;
            
            // 总字数（原文摘抄部分，按“万字”为单位显示）
            if (statWordcount) {
                const totalWordCount = entries.reduce((sum, e) => sum + countWords(e.content), 0);
                const inWan = totalWordCount / 10000;
                // 保留两位小数，但去掉多余的 0
                statWordcount.textContent = Number(inWan.toFixed(2)).toString();
            }
            
            // 关键词数量
            const keywordsCount = new Set(entries.flatMap(e => e.keywords || [])).size;
            statKeywords.textContent = keywordsCount;
        }
        
        // 计算字数（不含空格，包括中英文和标点）
        function countWords(htmlContent) {
            if (!htmlContent) return 0;
            // 去除HTML标签
            const text = stripHtml(htmlContent);
            // 移除所有空格（包括中文空格、制表符、换行等）
            const noSpaces = text.replace(/[\s\u00A0\u3000]/g, '');
            // 返回字符数
            return noSpaces.length;
        }
        
        // 格式化数字（添加千分位）
        function formatNumber(num) {
            if (num >= 10000) {
                return (num / 10000).toFixed(1) + '万';
            }
            return num.toLocaleString();
        }
        
        // 显示详细统计面板
        function showStatisticsPanel() {
            const stats = getDetailedStatistics();
            
            const dialog = document.createElement('div');
            dialog.className = 'form-popup';
            dialog.style.display = 'block';
            dialog.style.width = '90%';
            dialog.style.maxWidth = '900px';
            
            dialog.innerHTML = `
                <h2>数据统计详情</h2>
                <div class="form-content" style="max-height: 60vh; overflow-y: auto;">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-value">${stats.totalEntries}</span>
                            <span class="stat-label">总条目数</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${formatNumber(stats.totalWordCount)}</span>
                            <span class="stat-label">原文总字数</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${stats.avgWordCount}</span>
                            <span class="stat-label">平均字数/条</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${stats.keywordsCount}</span>
                            <span class="stat-label">关键词数</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${stats.thisWeek}</span>
                            <span class="stat-label">本周新增</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${stats.thisMonth}</span>
                            <span class="stat-label">本月新增</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${stats.withAnalysis}</span>
                            <span class="stat-label">已分析</span>
                        </div>
                    </div>
                    
                    <h3 style="margin-top: 24px;">热门关键词 (前10)</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${stats.topKeywords.map(([kw, count]) => `
                            <span class="keyword-tag">${kw} (${count})</span>
                        `).join('')}
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="primary-btn btn-icon-only" onclick="this.closest('.form-popup').remove()" title="关闭" aria-label="关闭">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            `;
            
            document.body.appendChild(dialog);
        }
        
        // 获取详细统计数据（已不再统计分类）
        function getDetailedStatistics() {
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            // 字数统计
            const totalWordCount = entries.reduce((sum, e) => sum + countWords(e.content), 0);
            const avgWordCount = entries.length > 0 ? Math.round(totalWordCount / entries.length) : 0;
            
            // 关键词频率统计
            const keywordFreq = {};
            entries.forEach(entry => {
                (entry.keywords || []).forEach(kw => {
                    keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
                });
            });
            
            // 排序获取前10热门关键词
            const topKeywords = Object.entries(keywordFreq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            return {
                totalEntries: entries.length,
                totalWordCount,
                avgWordCount,
                keywordsCount: new Set(entries.flatMap(e => e.keywords || [])).size,
                thisWeek: entries.filter(e => e.createdAt && new Date(e.createdAt) >= oneWeekAgo).length,
                thisMonth: entries.filter(e => e.createdAt && new Date(e.createdAt) >= oneMonthAgo).length,
                withAnalysis: entries.filter(e => e.analysis && e.analysis.trim().length > 0).length,
                topKeywords
            };
        }
        
        function showTimelineView() {
            // Prefer V2 event-centric timeline when available
            if (window.V2Events && typeof V2Events.showTimelineView === 'function') {
                V2Events.showTimelineView();
                return;
            }
            const sortedEntries = [...entries].sort((a, b) => {
                const dateA = a.date || '0000-00-00';
                const dateB = b.date || '0000-00-00';
                return dateA.localeCompare(dateB);
            });
            
            const dialog = document.createElement('div');
            dialog.className = 'form-popup';
            dialog.style.display = 'block';
            dialog.style.width = '90%';
            dialog.style.maxWidth = '1000px';
            
            dialog.innerHTML = `
                <h2>时间线视图</h2>
                <div class="form-content" style="max-height: 70vh; overflow-y: auto;">
                    <div class="timeline-container">
                        ${sortedEntries.slice(0, 50).map((entry, index) => `
                            <div class="timeline-item ${index % 2 === 0 ? 'left' : 'right'}">
                                <div class="timeline-date">${entry.date || '未知日期'}</div>
                                <div class="timeline-content">
                                    <h4>${entry.title || '无标题'}</h4>
                                    <p>${stripHtml(entry.content || '').substring(0, 100)}...</p>
                                    <div class="timeline-tags">
                                        ${(entry.keywords || []).slice(0, 3).map(k => `<span>${k}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${sortedEntries.length > 50 ? '<p style="text-align: center; color: var(--text-secondary);">显示前50条记录</p>' : ''}
                </div>
                <div class="action-buttons">
                    <button class="primary-btn btn-icon-only" onclick="this.closest('.form-popup').remove()" title="关闭" aria-label="关闭">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            `;
            
            document.body.appendChild(dialog);
        }
        
        // 去除HTML标签
        function stripHtml(html) {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || '';
        }
        
        // 快速筛选行已移除：applyQuickFilter / applyQuickFilterToEntries 已删除
        
        // 批量编辑弹窗
        function showBulkEditForm() {
            if (selectedEntryIds.size === 0 && !selectedAll) {
                showAlert('请先选择要编辑的条目（使用批量操作模式）', 'warning');
                return;
            }
            
            const count = selectedAll ? getFilteredEntries().length : selectedEntryIds.size;
            
            const dialog = document.createElement('div');
            dialog.className = 'form-popup';
            dialog.id = 'bulk-edit-dialog';
            dialog.style.display = 'block';
            
            dialog.innerHTML = `
                <div class="bulk-edit-form">
                    <h3>批量编辑 (${count}个条目)</h3>
                    <div class="form-group">
                        <label>批量添加关键词（逗号分隔）：</label>
                        <input type="text" id="bulk-add-keywords" placeholder="例如: 重要, 待复核">
                    </div>
                    <div class="form-group">
                        <label>批量移除关键词（逗号分隔）：</label>
                        <input type="text" id="bulk-remove-keywords" placeholder="例如: 临时, 草稿">
                    </div>
                    <div class="action-buttons">
                        <button class="primary-btn" onclick="applyBulkEdit()">应用更改</button>
                        <button class="cancel-btn btn-icon-only" onclick="closeBulkEditForm()" title="取消" aria-label="取消">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
        }
        
        function closeBulkEditForm() {
            const dialog = document.getElementById('bulk-edit-dialog');
            if (dialog) dialog.remove();
        }
        
        async function applyBulkEdit() {
            const addKeywords = document.getElementById('bulk-add-keywords').value
                .split(',').map(k => k.trim()).filter(Boolean);
            const removeKeywords = document.getElementById('bulk-remove-keywords').value
                .split(',').map(k => k.trim()).filter(Boolean);
            
            if (addKeywords.length === 0 && removeKeywords.length === 0) {
                showAlert('请至少填写一项更改', 'warning');
                return;
            }
            
            const entriesToEdit = selectedAll ? getFilteredEntries() : 
                entries.filter(e => selectedEntryIds.has(e.id));
            
            if (entriesToEdit.length === 0) {
                showAlert('没有选中的条目', 'warning');
                return;
            }
            
            try {
                showLoading(`正在更新 ${entriesToEdit.length} 个条目...`);
                
                const updates = {};
                entriesToEdit.forEach(entry => {
                    const path = getProjectPath(`entries/${entry.id}`);
                    let entryKeywords = [...(entry.keywords || [])];
                    
                    // 添加新关键词
                    addKeywords.forEach(kw => {
                        if (!entryKeywords.includes(kw)) {
                            entryKeywords.push(kw);
                        }
                    });
                    
                    // 移除关键词
                    entryKeywords = entryKeywords.filter(kw => !removeKeywords.includes(kw));
                    
                    updates[`${path}/keywords`] = entryKeywords;
                    updates[`${path}/updatedAt`] = Date.now();
                });
                
                await db.ref().update(updates);
                
                closeBulkEditForm();
                showAlert(`成功更新 ${entriesToEdit.length} 个条目`, 'success');
            } catch (error) {
                console.error('批量编辑失败:', error);
                showAlert(`批量编辑失败: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
        }
        
        // 导出数据（多格式支持）
        function exportData(format) {
            switch(format) {
                case 'json':
                    exportJSON();
                    break;
                case 'markdown':
                    exportMarkdown();
                    break;
                default:
                    exportEntries('excel');
            }
        }
        
        // 导出JSON
        function exportJSON() {
            const jsonData = {
                exportDate: new Date().toISOString(),
                projectName: document.getElementById('projectTitle').textContent,
                totalEntries: entries.length,
                entries: entries.map(e => ({
                    id: e.id,
                    date: e.date,
                    title: e.title,
                    content: stripHtml(e.content || ''),
                    analysis: stripHtml(e.analysis || ''),
                    keywords: e.keywords,
                    links: e.links,
                    createdAt: e.createdAt,
                    updatedAt: e.updatedAt
                }))
            };
            
            const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `史料数据_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            showAlert('JSON导出成功', 'success');
        }
        
        // 导出Markdown
        function exportMarkdown() {
            let markdown = `# ${document.getElementById('projectTitle').textContent}\n\n`;
            markdown += `> 导出时间: ${new Date().toLocaleString()}\n`;
            markdown += `> 共 ${entries.length} 条记录\n\n`;
            markdown += `---\n\n`;
            
            // 不再按分类分组，直接按时间或原始顺序输出全部条目
            const sorted = [...entries].sort((a, b) => (a.date || '0000-00-00').localeCompare(b.date || '0000-00-00'));
            
            markdown += `## 全部条目\n\n`;
            sorted.forEach(e => {
                markdown += `### ${e.title || '无标题'}\n\n`;
                markdown += `- **日期**: ${e.date || '未知'}\n`;
                markdown += `- **关键词**: ${(e.keywords || []).join(', ') || '无'}\n\n`;
                markdown += `**原文摘抄**:\n\n${stripHtml(e.content || '无内容')}\n\n`;
                if (e.analysis) {
                    markdown += `**分析**:\n\n${stripHtml(e.analysis)}\n\n`;
                }
                markdown += `---\n\n`;
            });
            
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `史料数据_${new Date().toISOString().split('T')[0]}.md`;
            a.click();
            URL.revokeObjectURL(url);
            
            showAlert('Markdown导出成功', 'success');
        }
        
        // ========== 结束新增功能 ==========

        /*********************
         * 3D交互效果
         *********************/
        document.addEventListener('DOMContentLoaded', function() {
            // 尊重“减少动态效果”偏好：避免 JS 强行施加 3D/涟漪/入场动画
            try {
                if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            } catch (_) {}

            // 性能模式 / 触摸设备：禁用 3D 悬停、涟漪与视差等高耗电效果
            const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            const isPerformanceMode = document.body.classList.contains('performance-mode');
            const enableHighPerfEffects = !isPerformanceMode && !isTouchDevice;

            // 为所有卡片添加3D悬停效果（不含 .stat-card，避免数据统计框跳动）
            const add3DHoverEffect = () => {
                const cards = document.querySelectorAll('.entry-item, .detail-entry, .log-item, .draft-item');
                
                cards.forEach(card => {
                    card.addEventListener('mousemove', (e) => {
                        const rect = card.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        
                        const centerX = rect.width / 2;
                        const centerY = rect.height / 2;
                        
                        const rotateY = (x - centerX) / 25;
                        const rotateX = (centerY - y) / 25;

                        // 同步写入 CSS 变量，便于 CSS 侧做更自然的复合动效
                        const relativeX = (x - centerX) / centerX;
                        const relativeY = (y - centerY) / centerY;
                        card.style.setProperty('--mouse-x', String(relativeX));
                        card.style.setProperty('--mouse-y', String(relativeY));
                        
                        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
                    });
                    
                    card.addEventListener('mouseleave', () => {
                        card.style.transform = '';
                        card.style.removeProperty('--mouse-x');
                        card.style.removeProperty('--mouse-y');
                    });
                });
            };
            
            // 为按钮添加点击涟漪效果
            const addRippleEffect = () => {
                const buttons = document.querySelectorAll('.primary-btn, .danger-btn, .cancel-btn, .page-btn, .keyword-tag');
                
                buttons.forEach(button => {
                    button.style.position = 'relative';
                    button.style.overflow = 'hidden';
                    
                    button.addEventListener('click', function(e) {
                        const rect = this.getBoundingClientRect();
                        const size = Math.max(rect.width, rect.height);
                        const x = e.clientX - rect.left - size / 2;
                        const y = e.clientY - rect.top - size / 2;
                        
                        const ripple = document.createElement('span');
                        ripple.style.cssText = `
                            position: absolute;
                            border-radius: 50%;
                            background: rgba(255, 255, 255, 0.5);
                            width: ${size}px;
                            height: ${size}px;
                            top: ${y}px;
                            left: ${x}px;
                            transform: scale(0);
                            animation: rippleExpand 0.6s var(--ease-blob);
                            pointer-events: none;
                            z-index: 1;
                        `;
                        
                        this.appendChild(ripple);
                        setTimeout(() => ripple.remove(), 600);
                    });
                });
            };
            
            // 添加CSS动画
            const style = document.createElement('style');
            style.textContent = `
                @keyframes ripple {
                    to {
                        transform: scale(4);
                        opacity: 0;
                    }
                }
                @keyframes rippleExpand {
                    0% { transform: scale(0); opacity: 1; }
                    100% { transform: scale(2); opacity: 0; }
                }
            `;
            document.head.appendChild(style);

            // 入场观察器：仅用于“非条目内容”的轻量入场（避免条目出现时模糊/跳动）
            const initEnhancedAnimations = () => {
                if (!('IntersectionObserver' in window)) return;
                const observerOptions = { threshold: 0.12, rootMargin: '0px 0px -60px 0px' };

                const appearObserver = new IntersectionObserver((entriesList) => {
                    entriesList.forEach((entry) => {
                        if (!entry.isIntersecting) return;
                        const el = entry.target;

                        if (el.classList.contains('stat-card')) {
                            el.classList.add('animate-elastic-in');
                        } else {
                            el.classList.add('animate-soft-appear');
                        }

                        appearObserver.unobserve(el);
                    });
                }, observerOptions);

                const observeAll = () => {
                    // 不观察 .entry-item/.detail-entry 等条目，避免“入场模糊/缩放”
                    document.querySelectorAll('.stat-card, .sidebar > *')
                        .forEach((el) => {
                            if (el.dataset.enhancedObserved === '1') return;
                            el.dataset.enhancedObserved = '1';
                            appearObserver.observe(el);
                        });
                };

                observeAll();
                window.refreshEnhancedAnimations = observeAll;
            };

            // 搜索框动效已移除：保持完全静态
            
            // 初始化效果（已移除统计卡片浮动动画，避免数据统计框跳来跳去）
            if (enableHighPerfEffects) {
                // 仅在桌面非触摸设备且非性能模式下启用 3D 悬停与涟漪、视差效果
                setTimeout(() => {
                    add3DHoverEffect();
                    addRippleEffect();
                    initEnhancedAnimations();
                }, 500);

                // 添加视差滚动效果
                window.addEventListener('scroll', () => {
                    const scrolled = window.pageYOffset;
                    const parallaxElements = document.querySelectorAll('.parallax');
                    
                    parallaxElements.forEach(el => {
                        const speed = el.dataset.speed || 0.5;
                        el.style.transform = `translateY(${scrolled * speed}px)`;
                    });
                });
            } else {
                // 性能模式下仅保留轻量级入场动画，不启用 3D/涟漪/视差
                setTimeout(() => {
                    initEnhancedAnimations();
                }, 500);
            }
        });

        // 数据迁移函数 - 修复现有数据中的字段
        function migrateLegacyData() {
            showLoading('正在修复历史数据...');
            const entriesRef = db.ref(getProjectPath('entries'));
            
            entriesRef.once('value').then(snapshot => {
                let updates = {};
                let fixedCount = 0;
                
                snapshot.forEach(child => {
                    const entry = child.val();
                    let needsUpdate = false;
                    
                    // 检查并修复links字段
                    if (!entry.hasOwnProperty('links') || entry.links === null || entry.links === undefined) {
                        updates[`${child.key}/links`] = [];
                        needsUpdate = true;
                    }
                    
                    // 检查并修复keywords字段
                    if (!entry.hasOwnProperty('keywords') || entry.keywords === null || entry.keywords === undefined) {
                        updates[`${child.key}/keywords`] = [];
                        needsUpdate = true;
                    }
                    
                    // 检查并修复analysis字段
                    if (!entry.hasOwnProperty('analysis') || entry.analysis === null || entry.analysis === undefined) {
                        updates[`${child.key}/analysis`] = '';
                        needsUpdate = true;
                    }
                    
                    if (needsUpdate) {
                        fixedCount++;
                    }
                });
                
                if (fixedCount > 0) {
                    return entriesRef.update(updates).then(() => {
                        showAlert(`数据修复完成，已修复${fixedCount}条记录`, 'success');
                    });
                } else {
                    showAlert('所有数据格式正常，无需修复', 'info');
                    return Promise.resolve();
                }
            }).catch(error => {
                console.error('数据修复失败:', error);
                showAlert(`数据修复失败: ${error.message}`, 'error');
            }).finally(() => {
                 hideLoading(); // 隐藏加载提示
            });
        }

        // 日志相关功能
        // 初始化日志编辑器
        function initLogQuill() {
            if (logQuill) return logQuill;

            const container = document.getElementById('log-editor-container');
            if (!container) {
                throw new Error('日志编辑器容器未找到');
            }
            if (typeof Quill === 'undefined') {
                throw new Error('Quill 尚未加载');
            }

            const Font = Quill.import('formats/font');
            Font.whitelist = Font.whitelist || ['SimSun', 'STFangsong', 'KaiTi', 'STZhongsong', 'Times New Roman', 'Arial'];
            Quill.register(Font, true);

            const Size = Quill.import('attributors/style/size');
            Size.whitelist = Size.whitelist || [
                '10px', '12px', '14px', '16px', '18px', '20px',
                '24px', '28px', '32px', '36px', '48px', '72px'
            ];
            Quill.register(Size, true);

            logQuill = new Quill('#log-editor-container', {
                modules: {
                    toolbar: [
                        [{ 'font': Font.whitelist }],
                        [{ 'size': Size.whitelist }],
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'script': 'sub'}, { 'script': 'super' }],
                        [{ 'color': [] }, { 'background': [] }],
                        ['blockquote', 'code-block'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'indent': '-1'}, { 'indent': '+1' }],
                        [{ 'align': [] }],
                        ['link', 'image'],
                        ['clean']
                    ]
                },
                theme: 'snow'
            });

            logQuill.container.style.height = '300px';
            logQuill.container.style.overflowY = 'auto';
            const editorEl = logQuill.container.querySelector('.ql-editor');
            if (editorEl) editorEl.style.minHeight = '200px';

            return logQuill;
        }

        function ensureLogEditorInitialized() {
            return loadQuillScript().then(() => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 15;
                    function tryInit() {
                        try {
                            if (!logQuill) initLogQuill();
                            if (logQuill) {
                                resolve(logQuill);
                                return;
                            }
                        } catch (err) {
                            console.warn('日志编辑器初始化尝试失败:', err);
                        }
                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error('日志编辑器初始化超时'));
                            return;
                        }
                        setTimeout(tryInit, 100);
                    }
                    tryInit();
                });
            });
        }

        // 显示日志表单
        function showLogForm() {
            const form = document.getElementById('log-form');
            const viewer = document.getElementById('log-viewer');
            form.style.display = 'block';
            form.classList.remove('closing');
            if (viewer.style.display === 'block') {
               viewer.classList.add('closing');
               setTimeout(() => { viewer.style.display = 'none'; }, 200);
            } else {
               viewer.style.display = 'none';
            }

            ensureLogEditorInitialized().then(() => {
                const today = new Date().toISOString().split('T')[0];
                document.querySelector('#log-form [name="log-date"]').value = today;
                document.querySelector('#log-form [name="log-title"]').value = '';
                if (logQuill) logQuill.root.innerHTML = '';
                editingLogId = null;
            }).catch(error => {
                console.error('日志编辑器初始化失败:', error);
                showAlert('日志编辑器加载失败: ' + error.message, 'error');
            });
        }

        // 隐藏日志表单
        function hideLogForm() { // 移除 async
            const form = document.getElementById('log-form');
            form.classList.add('closing');
            // --- 移除 CKEditor 销毁 ---
            //  if (logContentEditor) { ... }
            setTimeout(() => {
                form.style.display = 'none';
                // document.querySelector('#log-form form').reset();
                 if (logQuill) logQuill.root.innerHTML = ''; // 恢复
                 editingLogId = null;
                form.classList.remove('closing');
            }, 200);
        }

        // 显示日志查看器
        function showLogViewer() {
            const viewer = document.getElementById('log-viewer');
            const form = document.getElementById('log-form');
            viewer.style.display = 'block';
            viewer.classList.remove('closing');
            if(form.style.display === 'block') { // 如果表单可见，添加关闭动画
               form.classList.add('closing');
               setTimeout(() => form.style.display = 'none', 200);
            } else {
               form.style.display = 'none';
            }
            loadLogs();
        }

        // 隐藏日志查看器
        function hideLogViewer() {
            const viewer = document.getElementById('log-viewer');
            viewer.classList.add('closing');
            setTimeout(() => {
                viewer.style.display = 'none';
                viewer.classList.remove('closing');
            }, 200);
        }

        // 加载日志数据
        function loadLogs() {
            const logsRef = db.ref(getProjectPath('logs'));
            logsRef.once('value').then(snapshot => {
                logs = snapshot.val() ? Object.values(snapshot.val()) : [];
                
                // 按日期降序排序（最新的在前）
                logs.sort((a, b) => b.date.localeCompare(a.date));
                
                // 应用当前筛选条件
                if (currentLogFilterDate) {
                    filteredLogs = logs.filter(log => log.date === currentLogFilterDate);
                } else {
                    filteredLogs = [...logs];
                }
                
                renderLogs();
            }).catch(error => {
                console.error('加载日志失败:', error);
                showAlert(`加载日志失败: ${error.message}`, 'error');
            });
        }

        // 渲染日志列表
        function renderLogs() {
            const container = document.getElementById('logs-container');
            
            if (filteredLogs.length === 0) {
                container.innerHTML = `
                    <div class="log-empty">
                        <p>暂无日志记录</p>
                        <button class="primary-btn btn-icon-only" onclick="showLogForm()" title="新增日志" aria-label="新增日志">
                            <span class="material-icons">post_add</span>
                        </button>
                    </div>
                `;
                document.getElementById('log-pagination').style.display = 'none';
                return;
            }
            
            // 计算日志统计信息
            const totalLogs = logs.length;
            const todayLogs = logs.filter(log => log.date === new Date().toISOString().split('T')[0]).length;
            const thisMonthLogs = logs.filter(log => {
                const logDate = new Date(log.date);
                const now = new Date();
                return logDate.getMonth() === now.getMonth() && 
                       logDate.getFullYear() === now.getFullYear();
            }).length;
            
            // 计算分页
            const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
            const start = (currentLogPage - 1) * LOGS_PER_PAGE;
            const end = start + LOGS_PER_PAGE;
            const currentPageLogs = filteredLogs.slice(start, end);
            
            // 渲染统计信息
            const statsHtml = `
                <div class="log-stats">
                    <div class="stat-item">
                        <span class="stat-value">${totalLogs}</span>
                        <span class="stat-label">总日志数</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${todayLogs}</span>
                        <span class="stat-label">今日日志</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${thisMonthLogs}</span>
                        <span class="stat-label">本月日志</span>
                    </div>
                </div>
            `;
            
            // 渲染当前页的日志列表
            const logsHtml = currentPageLogs.map(log => `
                <div class="log-item">
                    <div class="log-header">
                        <h3 class="log-title">${log.title}</h3>
                        <div class="log-actions">
                            <span class="log-date">${log.date}</span>
                            <button class="primary-btn btn-icon-only" onclick="editLog('${log.id}')" title="编辑" aria-label="编辑">
                                <span class="material-icons">edit</span>
                            </button>
                            <button class="danger-btn btn-icon-only" onclick="deleteLog('${log.id}')" title="删除" aria-label="删除">
                                <span class="material-icons">delete</span>
                            </button>
                        </div>
                    </div>
                    <div class="log-content">${log.content}</div>
                </div>
            `).join('');
            
            container.innerHTML = statsHtml + logsHtml;
            
            // 更新分页信息
            updateLogPagination(totalPages);
            document.getElementById('log-pagination').style.display = 'block';
        }

        // 保存日志
        async function saveLog(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            // 校验必填项
            if (!formData.get('log-date')) {
                showAlert('日期为必填项！', 'warning');
                return;
            }
            if (!formData.get('log-title')) {
                showAlert('标题为必填项！', 'warning');
                return;
            }
            if (!logQuill || !logQuill.root) {
                showAlert('日志编辑器尚未就绪，请稍后再试', 'warning');
                return;
            }

            try {
                const logsRef = db.ref(getProjectPath('logs'));
                
                // 获取原始数据（如果是编辑状态）
                let originalLog = null;
                if (editingLogId) {
                    const snapshot = await logsRef.child(editingLogId).once('value');
                    originalLog = snapshot.val();
                }

                // 生成新日志数据
                const newLog = {
                    date: formData.get('log-date'),
                    title: formData.get('log-title'),
                    content: logQuill.root.innerHTML, // 恢复
                    // content: logContentEditor ? logContentEditor.getData() : '', // 移除
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };

                if (editingLogId) {
                    // 保持原ID
                    newLog.id = editingLogId;
                    // 保持原创建时间
                    newLog.createdAt = originalLog.createdAt;
                    
                    // 更新日志
                    await logsRef.child(newLog.id).update(newLog);
                } else {
                    // 新日志，生成ID
                    newLog.id = `LOG-${Date.now()}`;
                    newLog.createdAt = firebase.database.ServerValue.TIMESTAMP;
                    // 保存到数据库
                    await logsRef.child(newLog.id).set(newLog);
                }

                hideLogForm();
                showLogViewer(); // 保存后显示日志查看器
                showAlert('日志保存成功！', 'success');
            } catch (error) {
                showAlert(`保存失败: ${error.message}`, 'error');
            }
        }

        // 编辑日志
        function editLog(id) {
            const log = logs.find(l => l.id === id);
            if (!log) {
                showAlert('找不到指定日志', 'error');
                return;
            }

            editingLogId = id;
            document.getElementById('log-form').style.display = 'block';
            document.getElementById('log-form').classList.remove('closing');
            document.getElementById('log-viewer').style.display = 'none';

            ensureLogEditorInitialized().then(() => {
                document.querySelector('[name="log-date"]').value = log.date || '';
                document.querySelector('[name="log-title"]').value = log.title || '';
                if (logQuill) logQuill.root.innerHTML = log.content || '';
            }).catch(error => {
                console.error('日志编辑器初始化失败:', error);
                showAlert('日志编辑器加载失败: ' + error.message, 'error');
            });
        }

        // 删除日志
        async function deleteLog(id) {
            if (confirm('确定要删除该日志吗？')) {
                try {
                    await db.ref(getProjectPath(`logs/${id}`)).remove();
                    loadLogs(); // 重新加载日志列表
                    showAlert('日志已删除', 'success');
                } catch (error) {
                    showAlert(`删除失败: ${error.message}`, 'error');
                }
            }
        }

        // 按日期筛选日志
        function filterLogsByDate(date) {
            currentLogFilterDate = date;
            currentLogPage = 1; // 重置页码
            if (date) {
                filteredLogs = logs.filter(log => log.date === date);
            } else {
                filteredLogs = [...logs];
            }
            renderLogs();
        }
        
        // 重置日志筛选
        function resetLogFilter() {
            document.getElementById('log-filter-date').value = '';
            currentLogFilterDate = null;
            filteredLogs = [...logs];
            renderLogs();
        }

        // 添加日志分页相关函数
        // 变量已在全局作用域声明，这里不再重复声明

        function updateLogPagination(totalPages) {
            document.getElementById('currentLogPage').textContent = currentLogPage;
            document.getElementById('totalLogPages').textContent = totalPages;
            document.getElementById('logsPerPage').textContent = LOGS_PER_PAGE;
            
            const container = document.getElementById('log-pagination-buttons');
            const current = currentLogPage;
            const pages = [];
            const MAX_VISIBLE = 5;
            
            pages.push(1);
            
            if (totalPages <= 7) {
                for (let i = 2; i < totalPages; i++) {
                    pages.push(i);
                }
            } else {
                if (current - MAX_VISIBLE > 2) pages.push('...');
                
                const start = Math.max(2, current - 2);
                const end = Math.min(totalPages - 1, current + 2);
                
                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }
                
                if (current + 2 < totalPages - 1) pages.push('...');
            }
            
            if (totalPages > 1) pages.push(totalPages);
            
            container.innerHTML = `
                ${current > 1 ? `
                    <button class="page-btn nav" onclick="jumpToLogPage(${current-1})">
                        <span class="material-icons">chevron_left</span>
                    </button>
                ` : ''}
                
                ${pages.map(page => {
                    if (page === '...') {
                        return `<button class="page-btn more">⋯</button>`;
                    }
                    return `<button class="page-btn ${page === current ? 'active' : ''}" 
                                  onclick="jumpToLogPage(${page})">${page}</button>`;
                }).join('')}
                
                ${current < totalPages ? `
                    <button class="page-btn nav" onclick="jumpToLogPage(${current+1})">
                        <span class="material-icons">chevron_right</span>
                    </button>
                ` : ''}
                
                <div class="page-jump">
                    <input type="number" min="1" max="${totalPages}" 
                           value="${current}"
                           onchange="jumpToLogPage(this.value)"
                           onkeypress="if(event.key === 'Enter') jumpToLogPage(this.value)">
                    <span>页</span>
                </div>
            `;
        }

        function changeLogPageSize(size) {
            LOGS_PER_PAGE = parseInt(size);
            currentLogPage = 1;
            renderLogs();
        }

        function jumpToLogPage(page) {
            const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
            page = Math.max(1, Math.min(Number(page), totalPages));
            currentLogPage = page;
            renderLogs();
        }

        function showMoreLogPages() {
            const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
            const visibleRange = 5;
            const start = Math.max(1, currentLogPage - visibleRange);
            const end = Math.min(totalPages, currentLogPage + visibleRange);
            
            const pages = [];
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            document.getElementById('log-pagination-buttons').innerHTML = pages.map(page => `
                <button class="page-btn ${page === currentLogPage ? 'active' : ''}" 
                        onclick="jumpToLogPage(${page})">${page}</button>
            `).join('') + `
                <div class="page-jump">
                    跳至 <input type="number" min="1" max="${totalPages}" 
                          onchange="jumpToLogPage(this.value)" style="width:60px"> 页
                </div>
            `;
        }

        // 添加到初始化部分
        function enableFirebaseDebug() {
            if (location.hostname === "localhost") {
                db.enableLogging(true);
                console.log("Firebase调试日志已启用");
            }
        }

        // 回收站功能
        let deletedEntries = [];
        let recycleCurrentPage = 1;
        const RECYCLE_ENTRIES_PER_PAGE = 10;

        async function showRecycleBin() {
            try {
                // 加载回收站数据
                const snapshot = await db.ref(getProjectPath('trash')).once('value');
                const trashData = snapshot.val() || {};
                
                // 过滤保留50天内的条目
                deletedEntries = Object.values(trashData).filter(entry => {
                    const days = (Date.now() - entry.deletedAt) / (1000 * 3600 * 24);
                    return days <= 50;
                });
                
                renderDeletedEntries();
                
                // 显示回收站弹窗
                const recycleBin = document.getElementById('recycle-bin');
                if (recycleBin) {
                    recycleBin.style.display = 'block';
                    recycleBin.classList.remove('closing');
                    console.log('回收站弹窗显示成功');
                } else {
                    console.error('找不到回收站元素');
                }
            } catch (error) {
                showAlert('加载回收站失败: ' + error.message, 'error');
            }
        }

        // hideRecycleBin函数 - 关闭回收站
        function hideRecycleBin() {
            console.log('正在执行关闭回收站 - 增强版');
            const recycleBin = document.getElementById('recycle-bin');
            if (recycleBin) {
                recycleBin.style.display = 'none';
                console.log('回收站成功隐藏');
            } else {
                console.error('找不到回收站元素!');
                // 尝试使用querySelector
                const recycleBinByQuery = document.querySelector('.form-popup#recycle-bin');
                if (recycleBinByQuery) {
                    recycleBinByQuery.style.display = 'none';
                    console.log('通过querySelector找到并隐藏回收站');
                }
            }
            
            // 确保全局函数也被调用
            window.closeRecycleBin && window.closeRecycleBin();
        }

        function renderDeletedEntries() {
            const container = document.getElementById('deleted-entries-container');
            const totalEntries = deletedEntries.length;
            
            if (totalEntries === 0) {
                container.innerHTML = '<p class="empty-message">回收站为空</p>';
                document.getElementById('recycle-pagination').style.display = 'none';
                return;
            }
            
            // 分页处理
            const totalPages = Math.ceil(totalEntries / RECYCLE_ENTRIES_PER_PAGE);
            recycleCurrentPage = Math.min(recycleCurrentPage, totalPages);
            
            const start = (recycleCurrentPage - 1) * RECYCLE_ENTRIES_PER_PAGE;
            const end = Math.min(start + RECYCLE_ENTRIES_PER_PAGE, totalEntries);
            const pageEntries = deletedEntries.slice(start, end);
            
            // 渲染表格
            const tableHtml = `
                <table class="entry-table">
                    <thead>
                        <tr>
                            <th>编号</th>
                            <th>标题</th>
                            <th>删除日期</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageEntries.map(entry => `
                            <tr class="deleted-entry">
                                <td>${entry.id || ''}</td>
                                <td>${entry.title || ''}</td>
                                <td>${new Date(entry.deletedAt).toLocaleDateString()}</td>
                                <td>
                                    <button class="restore-btn" onclick="restoreEntry('${entry.id}')">恢复</button>
                                    <button class="danger-btn" onclick="deletePermanently('${entry.id}')">彻底删除</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
             // 将包裹后的表格 HTML 放入容器
             container.innerHTML = `<div class="entry-table-container">${tableHtml}</div>`;
           
            // 更新分页
            updateRecyclePagination(totalPages);
        }

        function updateRecyclePagination(totalPages) {
            const container = document.getElementById('recycle-pagination-buttons');
            if (!container) return;
            
            container.style.display = 'flex';
            
            const current = recycleCurrentPage;
            const pages = [];
            const MAX_VISIBLE = 5;
            
            pages.push(1);
            
            if (totalPages <= 7) {
                for (let i = 2; i < totalPages; i++) {
                    pages.push(i);
                }
            } else {
                if (current - MAX_VISIBLE > 2) pages.push('...');
                
                const start = Math.max(2, current - 2);
                const end = Math.min(totalPages - 1, current + 2);
                
                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }
                
                if (current + 2 < totalPages - 1) pages.push('...');
            }
            
            if (totalPages > 1) pages.push(totalPages);
            
            container.innerHTML = `
                ${current > 1 ? `
                    <button class="page-btn nav" onclick="recycleCurrentPage=${current-1};renderDeletedEntries()">
                        <span class="material-icons">chevron_left</span>
                    </button>
                ` : ''}
                
                ${pages.map(page => {
                    if (page === '...') {
                        return `<button class="page-btn more">⋯</button>`;
                    }
                    return `<button class="page-btn ${page === current ? 'active' : ''}" 
                                  onclick="recycleCurrentPage=${page};renderDeletedEntries()">${page}</button>`;
                }).join('')}
                
                ${current < totalPages ? `
                    <button class="page-btn nav" onclick="recycleCurrentPage=${current+1};renderDeletedEntries()">
                        <span class="material-icons">chevron_right</span>
                    </button>
                ` : ''}
            `;
        }

        async function restoreEntry(id) {
            try {
                // 获取被删除的条目
                const deletedEntry = deletedEntries.find(e => e.id === id);
                if (!deletedEntry) {
                    showAlert('找不到指定条目', 'error');
                    return;
                }
                
                // 移除删除时间戳
                delete deletedEntry.deletedAt;
                
                // 恢复到正常条目列表
                await db.ref(getProjectPath(`entries/${id}`)).set(deletedEntry);
                
                // 从回收站删除
                await db.ref(getProjectPath(`trash/${id}`)).remove();
                
                // 从本地列表中移除
                deletedEntries = deletedEntries.filter(e => e.id !== id);
                
                // 重新渲染
                renderDeletedEntries();
                showAlert('条目已恢复', 'success');
            } catch (error) {
                showAlert('恢复失败: ' + error.message, 'error');
            }
        }

        async function deletePermanently(id) {
            if (confirm('确定要永久删除该条目吗？此操作无法撤销！')) {
                try {
                    await db.ref(getProjectPath(`trash/${id}`)).remove();
                    deletedEntries = deletedEntries.filter(e => e.id !== id);
                    renderDeletedEntries();
                    showAlert('条目已永久删除', 'info');
                } catch (error) {
                    showAlert('删除失败: ' + error.message, 'error');
                }
            }
        }

        async function emptyRecycleBin() {
            if (confirm('确定要清空回收站吗？此操作无法撤销！')) {
                try {
                    await db.ref(getProjectPath('trash')).remove();
                    deletedEntries = [];
                    renderDeletedEntries();
                    showAlert('回收站已清空', 'info');
                } catch (error) {
                    showAlert('清空回收站失败: ' + error.message, 'error');
                }
            }
        }
        
        // 样式联动处理
        function updateThemeStyles() {
            document.querySelectorAll('.glass-container').forEach(el => {
                el.style.setProperty('background', 'var(--glass-bg)');
                el.style.setProperty('border-color', 'var(--glass-border)');
            });
            
            document.querySelectorAll('.primary-btn').forEach(btn => {
                btn.style.setProperty('background', 'var(--primary-bg)');
            });
        }

        // 初始化时监听主题变化
        document.documentElement.addEventListener('theme-change', updateThemeStyles);

        // 回收站和工作时间记录功能

        // hideRecycleBin函数 - 关闭回收站
        function hideRecycleBin() {
            console.log('正在执行关闭回收站');
            document.getElementById('recycle-bin').style.display = 'none';
        }

       

     

       
        
        // 添加全局函数，确保回收站能够关闭
        window.closeRecycleBin = function() {
            console.log('关闭回收站 - 全局函数被调用');
            const recycleBin = document.getElementById('recycle-bin');
            if (recycleBin) {
                recycleBin.classList.add('closing');
                setTimeout(() => {
                   recycleBin.style.display = 'none'; 
                   recycleBin.classList.remove('closing');
                }, 200);
            } else {
                 console.error('找不到回收站元素!');
            }
        }

        function formatDuration(seconds) {
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hrs}h ${mins}m ${secs}s`;
        }

        function migrateTimeFormat() {
            const worklogsRef = db.ref(getProjectPath('worklogs'));
            worklogsRef.once('value').then(snapshot => {
                const updates = {};
                snapshot.forEach(child => {
                    const entry = child.val();
                    if (typeof entry.start === 'string') {
                        const [h, m, s] = entry.start.split(':');
                        updates[`${child.key}/start`] = {
                            hours: parseInt(h),
                            minutes: parseInt(m),
                            seconds: parseInt(s || 0)
                        };
                        updates[`${child.key}/duration_seconds`] = 
                            (parseInt(entry.duration.split('h')[0]) * 3600) +
                            (parseInt(entry.duration.split('m')[0].split('h')[1]) * 60) +
                            (parseInt(entry.duration.split('m')[1]) || 0);
                    }
                });
                worklogsRef.update(updates);
            });
        }

        // 添加定时清理任务（每天凌晨执行）
        function setupAutoPurge() {
            setInterval(() => {
                const cutoff = Date.now() - 50 * 24 * 60 * 60 * 1000;
                db.ref('recycle_bin').orderByChild('deleted_time').endAt(cutoff)
                  .once('value').then(snapshot => {
                      const updates = {};
                      snapshot.forEach(child => {
                          updates[child.key] = null; // 标记删除
                      });
                      db.ref('recycle_bin').update(updates);
                  });
            }, 24 * 60 * 60 * 1000); // 每日执行
        }

        // 在恢复/删除操作前添加验证
        function validateRecycleAction(user) {
            return user.roles.includes('admin') || 
                   user.permissions.includes('manage_recycle');
        }

        // 记录回收站操作日志
        function logRecycleAction(action, items) {
            db.ref('audit_logs').push({
                user: currentUser.uid,
                action: action,
                items: items.map(i => i.id),
                timestamp: Date.now()
            });
        }

        function confirmDestructiveAction() {
            return new Promise(resolve => {
                showDialog({
                    title: "危险操作确认",
                    content: "请输入安全密码：",
                    inputType: "password",
                    onConfirm: (pw) => validatePassword(pw).then(resolve)
                });
            });
        }

        // 实现虚拟滚动（仅在 VirtualScroll 已定义时启用，避免报错影响其他功能）
        if (typeof VirtualScroll === 'function') {
            const virtualScroll = new VirtualScroll({
                container: '#recycle-list',
                itemHeight: 48,
                render: (index) => createRecycleItem(data[index])
            });
        }

        let activeTimer = null;
        let startTimestamp = null;

        // 页面可见性监听（防止后台标签页计时不准确；页面隐藏时立即写入 entries 缓存）
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                clearInterval(trackingInterval);
                if (typeof window._flushEntriesCache === 'function') window._flushEntriesCache();
            } else {
                startTracking();
            }
        });

      

       

        // 新增全局变量
        let trackingInterval;
        let sessionStartTime;
        let lastUpdateTime = 0;
        const HEARTBEAT_INTERVAL = 30000; // 30秒同步一次

       

        // 用户活动处理
        function handleUserActivity() {
          if (!sessionStartTime) {
            startNewSession();
          } else {
            resetInactivityTimer();
          }
        }

        // 开始新会话
        function startNewSession() {
          sessionStartTime = Date.now();
          localStorage.setItem('currentSession', JSON.stringify({
            start: sessionStartTime,
            lastDuration: 0
          }));
          startTracking();
        }

      

      

        // 更新界面显示
        function updateTimerDisplay(milliseconds) {
          const totalSeconds = Math.floor(milliseconds / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          document.getElementById('current-duration').textContent = 
            `${hours}小时${minutes}分${seconds}秒`;
        }

        // 保存会话记录
        async function saveSessionToFirebase(duration) {
          const user = auth.currentUser;
          if (!user) return;

          const sessionData = {
            start: sessionStartTime,
            end: Date.now(),
            duration: duration,
            autoRecord: true,
            deviceId: getDeviceFingerprint() // 需要实现设备指纹
          };

          try {
            await db.ref(`worklogs/${user.uid}/${sessionStartTime}`).update(sessionData);
            localStorage.setItem('currentSession', JSON.stringify({
              start: sessionStartTime,
              lastDuration: duration
            }));
          } catch (error) {
            console.error('保存失败:', error);
            cacheSessionLocally(sessionData); // 本地缓存
          }
        }

        // 设备指纹生成
        function getDeviceFingerprint() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = "14px 'Arial'";
          ctx.fillText('ID', 2, 15);
          return canvas.toDataURL().slice(-20);
        }

        // 本地缓存
        function cacheSessionLocally(data) {
          const cached = JSON.parse(localStorage.getItem('cachedSessions') || '[]');
          cached.push(data);
          localStorage.setItem('cachedSessions', JSON.stringify(cached.slice(-10))); // 保留最后10条
        }

        // 恢复离线数据
        async function restoreCachedSessions() {
          const cached = JSON.parse(localStorage.getItem('cachedSessions') || '[]');
          if (cached.length > 0) {
            const user = auth.currentUser;
            await Promise.all(cached.map(session => 
              db.ref(`worklogs/${user.uid}/${session.start}`).set(session)
            ));
            localStorage.removeItem('cachedSessions');
          }
        }

        // Excel导入功能
        async function importExcel() {
            // 动态加载 XLSX 库（如果尚未加载）
            if (!window.XLSX) {
                showLoading('正在加载导入工具...');
                try {
                    await window.loadXLSX();
                } catch (error) {
                    showAlert('加载导入工具失败，请刷新页面重试', 'error');
                    return;
                }
            }
            
            // 创建一个隐藏的文件输入框
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.xlsx,.xls';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            // 监听文件选择事件
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                showLoading('正在读取 Excel 文件...'); // 显示加载提示
                try {
                    // 读取Excel文件内容
                    const reader = new FileReader();
                    reader.onload = async (event) => { // Renamed parameter to avoid conflict
                        try {
                            const fileData = event.target.result; // Use renamed parameter
                            const workbook = XLSX.read(fileData, { type: 'array' });
                            
                            // 获取史料数据
                            const firstSheetName = workbook.SheetNames.find(name => name !== "分类结构") || workbook.SheetNames[0];
                            if (!firstSheetName) {
                               showAlert('未找到有效的史料数据工作表', 'error');
                                return;
                            }
                            const firstSheet = workbook.Sheets[firstSheetName];
                            const rowData = XLSX.utils.sheet_to_json(firstSheet);

                            // 处理数据导入
                            await processImportData(rowData);
                            
                        } catch (error) {
                            console.error('解析Excel失败:', error);
                            showAlert(`解析Excel失败: ${error.message}`, 'error');
                        }
                    };
                    
                    reader.readAsArrayBuffer(file);
                } catch (error) {
                    console.error('导入失败:', error);
                    showAlert(`导入失败: ${error.message}`, 'error');
                } finally {
                    // 清理
                     hideLoading(); // 隐藏加载提示
                    document.body.removeChild(fileInput);
                }
            });

            // 触发文件选择对话框
            fileInput.click();
        }

        // 处理Excel导入数据
        async function processImportData(rowData) {
            showLoading('正在处理导入的数据...'); // 更新提示
            try {
                const entriesRef = db.ref(getProjectPath('entries'));
                const batch = {};
                let newCount = 0;
                let updateCount = 0;
                let errorCount = 0;
                let identifiedCount = 0;
                
                // 用于记录处理详情的数组
                const importResults = {
                    new: [],
                    updated: [],
                    identified: [],
                    error: []
                };

                // 新增：检查和修正Excel字段名
                if (rowData.length > 0) {
                    // 获取第一行数据的所有键
                    const firstRowKeys = Object.keys(rowData[0]);
                    console.log("Excel文件字段:", firstRowKeys);
                    
                    // 定义字段映射规则 - 更宽松的匹配
                    const fieldMappings = {
                        "日期": ["日期", "date", "日期：", "时间", "时间："],
                        "标题": ["标题", "title", "标题：", "名称", "名称："],
                        "原文内容": ["原文内容", "content", "原文内容：", "内容", "内容：", "正文", "正文：", "原文", "原文："],
                        "分析": ["分析", "analysis", "分析：", "解读", "解读：", "评论", "评论："],
                        "相关链接": ["相关链接", "links", "相关链接：", "链接", "链接：", "网址", "网址：", "url", "urls"],
                        "关键词": ["关键词", "keywords", "关键词：", "关键字", "关键字：", "标签", "标签：", "tags"],
                        "ID": ["ID", "id", "编号", "编号：", "条目ID"]
                    };
                    
                    // 创建字段映射
                    const actualFieldMapping = {};
                    
                    // 为每个预期字段，查找匹配的实际字段名
                    Object.keys(fieldMappings).forEach(expectedField => {
                        const possibleMatches = fieldMappings[expectedField];
                        // 查找第一个匹配的字段名
                        const matchedField = firstRowKeys.find(key => 
                            possibleMatches.some(match => 
                                key.toLowerCase().trim() === match.toLowerCase().trim()
                            )
                        );
                        
                        if (matchedField) {
                            actualFieldMapping[expectedField] = matchedField;
                            console.log(`映射字段 '${expectedField}' 到 '${matchedField}'`);
                        } else {
                            console.log(`未找到字段 '${expectedField}' 的匹配项`);
                        }
                    });
                    
                    console.log("最终字段映射:", actualFieldMapping);
                    
                    // 自动修正数据：为每一行创建规范的字段名
                    rowData = rowData.map(row => {
                        const standardizedRow = {};
                        
                        // 使用映射将原始字段名转换为标准字段名
                        Object.keys(actualFieldMapping).forEach(standardField => {
                            const actualField = actualFieldMapping[standardField];
                            if (row.hasOwnProperty(actualField)) {
                                standardizedRow[standardField] = row[actualField];
                            }
                        });
                        
                        // 保留未映射的字段
                        Object.keys(row).forEach(originalField => {
                            if (!Object.values(actualFieldMapping).includes(originalField)) {
                                standardizedRow[originalField] = row[originalField];
                            }
                        });
                        
                        return standardizedRow;
                    });
                    
                    console.log("标准化后的数据样例:", rowData[0]);
                }

                // 获取当前所有条目，用于检查重复
                const snapshot = await entriesRef.once('value');
                const existingEntries = snapshot.val() || {};
                
                // 建立ID到Key的映射，用于快速查找
                const idToKeyMap = {};
                // 建立内容指纹到Key的映射，用于查找相似项
                const contentFingerprintMap = {};
                // 建立标题到Key的映射
                const titleMap = {};
                
                Object.entries(existingEntries).forEach(([key, entry]) => {
                    // ID映射
                    idToKeyMap[entry.id] = key;
                    
                    // 标题映射
                    if (entry.title) {
                        const titleKey = entry.title.trim().toLowerCase();
                        if (!titleMap[titleKey]) {
                            titleMap[titleKey] = [];
                        }
                        titleMap[titleKey].push({key, entry});
                    }
                    
                    // 内容指纹映射
                    if (entry.title && entry.content) {
                        const fingerprint = (entry.title + entry.content.substring(0, 100)).replace(/\s+/g, '').toLowerCase();
                        contentFingerprintMap[fingerprint] = key;
                    }
                });
                
                // 检查Excel文件是否包含ID列
                const hasIdColumn = rowData.length > 0 && rowData[0].hasOwnProperty('ID');
                console.log("Excel文件是否包含ID列:", hasIdColumn);
                
                // 处理每一行数据
                for (const row of rowData) {
                    try {
                        console.log("正在处理行:", row);
                        
                        // 验证和转换行数据（不再依赖主类/子类）
                        const entry = {
                            date: row['日期'] || '',
                            title: row['标题'] || '',
                            content: row['原文内容'] || '',
                            analysis: row['分析'] || '',
                            links: row['相关链接'] ? row['相关链接'].split(';').map(l => l.trim()).filter(Boolean) : [],
                            keywords: row['关键词'] ? row['关键词'].split(';').map(k => k.trim()).filter(Boolean) : [],
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        };

                        // 1. 如果有ID字段，尝试按ID匹配
                        if (row['ID'] && idToKeyMap[row['ID']]) {
                            console.log("通过ID匹配到条目:", row['ID']);
                            const existingKey = idToKeyMap[row['ID']];
                            entry.id = row['ID'];
                            // 修复：确保createdAt不为undefined
                            entry.createdAt = existingEntries[existingKey].createdAt || firebase.database.ServerValue.TIMESTAMP; // 保留原创建时间，若不存在则使用当前时间
                            batch[`${existingKey}`] = entry;
                            updateCount++;
                            importResults.updated.push({
                                title: entry.title,
                                id: entry.id,
                                matchType: 'ID匹配'
                            });
                            continue; // 找到匹配项，跳过后续检查
                        }
                        
                        // 2. 尝试通过标题精确匹配
                        let identified = false;
                        if (entry.title) {
                            const titleKey = entry.title.trim().toLowerCase();
                            if (titleMap[titleKey] && titleMap[titleKey].length === 1) {
                                // 只有一个标题完全匹配的条目
                                console.log("通过标题匹配到条目:", entry.title);
                                const {key, entry: existingEntry} = titleMap[titleKey][0];
                                entry.id = existingEntry.id;
                                // 修复：确保createdAt不为undefined
                                entry.createdAt = existingEntry.createdAt || firebase.database.ServerValue.TIMESTAMP;
                                batch[key] = entry;
                                identifiedCount++;
                                identified = true;
                                importResults.identified.push({
                                    title: entry.title,
                                    id: entry.id,
                                    matchType: '标题匹配'
                                });
                            }
                        }
                        
                        // 3. 尝试通过内容指纹识别
                        if (!identified && entry.title && entry.content) {
                            const fingerprint = (entry.title + entry.content.substring(0, 100)).replace(/\s+/g, '').toLowerCase();
                            
                            if (contentFingerprintMap[fingerprint]) {
                                console.log("通过内容指纹匹配到条目");
                                const existingKey = contentFingerprintMap[fingerprint];
                                entry.id = existingEntries[existingKey].id;
                                // 修复：确保createdAt不为undefined
                                entry.createdAt = existingEntries[existingKey].createdAt || firebase.database.ServerValue.TIMESTAMP; // 保留原创建时间
                                batch[`${existingKey}`] = entry;
                                identifiedCount++;
                                identified = true;
                                importResults.identified.push({
                                    title: entry.title,
                                    id: entry.id,
                                    matchType: '内容匹配'
                                });
                            }
                        }
                        
                        // 4. 如果未识别到匹配项，则创建新条目
                        if (!identified) {
                            // 检查必填字段（仅日期）
                            if (!entry.date) {
                                console.warn('跳过缺少必要字段的行:', row);
                                errorCount++;
                                importResults.error.push({
                                    title: entry.title || '无标题',
                                    reason: '缺少必要字段 (日期)'
                                });
                                continue;
                            }
                            
                            try {
                            // 生成新ID
                                console.log("生成新条目ID");
                            const newId = await generateID(entry);
                            entry.id = newId;
                            entry.createdAt = firebase.database.ServerValue.TIMESTAMP;
                            batch[newId] = entry;
                            newCount++;
                                importResults.new.push({
                                    title: entry.title,
                                    id: newId
                                });
                            } catch (error) {
                                console.error('生成ID失败:', error, row);
                                errorCount++;
                                importResults.error.push({
                                    title: entry.title || '无标题',
                                    reason: `生成ID失败: ${error.message}`
                                });
                            }
                        }
                    } catch (err) {
                        console.error('处理行数据失败:', err, row);
                        errorCount++;
                        importResults.error.push({
                            title: row.标题 || '无标题',
                            reason: `处理数据失败: ${err.message}`
                        });
                    }
                }

                // 批量更新数据库
                if (Object.keys(batch).length > 0) {
                    showLoading('正在保存数据到数据库...'); // 更新提示
                    // 数据清理：确保批量数据中没有undefined值，这会导致Firebase更新失败
                    Object.keys(batch).forEach(key => {
                        const entryData = batch[key];
                        
                        // 确保所有预期字段都有默认值
                        entryData.date = entryData.date || '';
                        entryData.title = entryData.title || '';
                        entryData.content = entryData.content || '';
                        entryData.analysis = entryData.analysis || '';
                        entryData.links = entryData.links || [];
                        entryData.keywords = entryData.keywords || [];
                        entryData.id = entryData.id || '';
                        
                        // 确保时间戳字段正确
                        if (!entryData.createdAt) {
                            entryData.createdAt = firebase.database.ServerValue.TIMESTAMP;
                        }
                        entryData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                        
                        // 针对数组字段进行特殊处理
                        if (typeof entryData.links === 'string') {
                            entryData.links = entryData.links.split(';').map(l => l.trim()).filter(Boolean);
                        }
                        if (typeof entryData.keywords === 'string') {
                            entryData.keywords = entryData.keywords.split(';').map(k => k.trim()).filter(Boolean);
                        }
                        
                        // 更新批量数据
                        batch[key] = entryData;
                        
                        // 打印调试信息
                        console.log(`处理条目 ${key} 的数据:`, JSON.stringify(entryData));
                    });
                    
                    try {
                    await entriesRef.update(batch);
                        showAlert(`导入完成: 新增${newCount}条, 更新${updateCount}条, 识别恢复${identifiedCount}条, 失败${errorCount}条`, 'success');
                        // 显示导入结果详情
                        showImportResults(importResults, newCount, updateCount, identifiedCount, errorCount);
                    } catch (error) {
                        console.error('批量更新失败:', error, '批量数据:', JSON.stringify(batch));
                        showAlert(`批量更新失败: ${error.message}`, 'error');
                    }
                } else {
                    showAlert('没有有效数据可导入', 'warning');
                 hideLoading(); // 如果没有数据导入，也需要隐藏
                }
            } catch (error) {
                console.error('批量导入失败:', error);
                showAlert(`批量导入失败: ${error.message}`, 'error');
                 hideLoading(); // 出错时也要隐藏
            }
            // 注意：成功保存后的 hideLoading() 在 importExcel 的 finally 中处理
        }
        
        // 显示导入结果详情
        function showImportResults(results, newCount, updateCount, identifiedCount, errorCount) {
            // 创建对话框元素
            const dialog = document.createElement('div');
            dialog.className = 'form-popup';
            dialog.style.display = 'block';
            dialog.style.width = '90%';
            dialog.style.maxWidth = '1200px';
            
            // 构建对话框HTML
            dialog.innerHTML = `
                <h2>Excel导入结果详情</h2>
                <div style="margin-bottom: 20px;">
                    总结: 新增${newCount}条, 更新${updateCount}条, 识别恢复${identifiedCount}条, 失败${errorCount}条
                </div>
                <div class="form-content" style="max-height: 60vh; overflow-y: auto;">
                    <!-- 新增条目 -->
                    ${results.new.length > 0 ? `
                        <div class="result-section" style="margin-bottom: 30px;">
                            <h3>新增条目 (${results.new.length})</h3>
                            <table class="entry-table" style="width: 100%;">
                                <tr>
                                    <th>标题</th>
                                    <th>ID</th>
                                </tr>
                                ${results.new.map(item => `
                                    <tr>
                                        <td>${item.title || '无标题'}</td>
                                        <td>${item.id}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </div>
                    ` : ''}
                    
                    <!-- 更新条目 -->
                    ${results.updated.length > 0 ? `
                        <div class="result-section" style="margin-bottom: 30px;">
                            <h3>更新条目 (${results.updated.length})</h3>
                            <table class="entry-table" style="width: 100%;">
                                <tr>
                                    <th>标题</th>
                                    <th>ID</th>
                                    <th>匹配方式</th>
                                </tr>
                                ${results.updated.map(item => `
                                    <tr>
                                        <td>${item.title || '无标题'}</td>
                                        <td>${item.id}</td>
                                        <td>${item.matchType}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </div>
                    ` : ''}
                    
                    <!-- 识别恢复条目 -->
                    ${results.identified.length > 0 ? `
                        <div class="result-section" style="margin-bottom: 30px;">
                            <h3>识别恢复条目 (${results.identified.length})</h3>
                            <table class="entry-table" style="width: 100%;">
                                <tr>
                                    <th>标题</th>
                                    <th>ID</th>
                                    <th>匹配方式</th>
                                </tr>
                                ${results.identified.map(item => `
                                    <tr>
                                        <td>${item.title || '无标题'}</td>
                                        <td>${item.id}</td>
                                        <td>${item.matchType}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </div>
                    ` : ''}
                    
                    <!-- 失败条目 -->
                    ${results.error.length > 0 ? `
                        <div class="result-section" style="margin-bottom: 30px;">
                            <h3>失败条目 (${results.error.length})</h3>
                            <table class="entry-table" style="width: 100%;">
                                <tr>
                                    <th>标题</th>
                                    <th>失败原因</th>
                                </tr>
                                ${results.error.map(item => `
                                    <tr>
                                        <td>${item.title || '无标题'}</td>
                                        <td>${item.reason}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </div>
                    ` : ''}
                </div>
                <div class="action-buttons">
                    <button class="primary-btn btn-icon-only" onclick="this.parentElement.parentElement.remove()" title="关闭" aria-label="关闭">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            `;
            
            // 添加到页面
            document.body.appendChild(dialog);
        }
        
        // 扫描重复条目功能
        function scanDuplicates() {
            showLoading('正在扫描重复条目...');
            setTimeout(() => {
                try {
                    // 确保已加载所有条目
                    if (!entries || entries.length === 0) {
                        showAlert('没有找到任何条目，请先加载数据', 'error');
                        return;
                    }
                    
                    // 查找重复条目
                    const duplicateGroups = findDuplicateEntries(entries);
                    const groupCount = Object.keys(duplicateGroups).length;
                    
                    if (groupCount === 0) {
                        showAlert('未发现重复条目', 'success');
                    } else {
                        // 显示重复条目对话框
                        showDuplicatesDialog(duplicateGroups);
                    }
                } catch (error) {
                    console.error('扫描重复条目失败:', error);
                    showAlert(`扫描重复条目失败: ${error.message}`, 'error');
                } finally {
                     hideLoading(); // 隐藏加载提示
                }
            }, 100);
        }
        
        // 查找重复条目
        function findDuplicateEntries(entriesParam) {
            // 使用传入的entries参数或全局的entries变量
            const entriesToCheck = entriesParam || entries;
            
            // 用于存储找到的重复组
            const duplicateGroups = {};
            // 用于快速检索的映射
            const contentMap = {};
            const titleMap = {};
            
            // 遍历所有条目
            entriesToCheck.forEach(entry => {
                // 创建内容指纹 (标题+内容)
                if (entry.content) {
                    // 1. 精确内容匹配 (标题 + 内容)
                const contentFingerprint = (entry.title + entry.content).replace(/\s+/g, '');
                
                // 如果指纹非空
                if (contentFingerprint.length > 0) {
                    if (!contentMap[contentFingerprint]) {
                        contentMap[contentFingerprint] = [entry.id];
                    } else {
                        contentMap[contentFingerprint].push(entry.id);
                        }
                    }
                }
                
                // 2. 标题匹配（可能是不同版本的相同条目）
                if (entry.title && entry.title.trim().length > 0) {
                    const titleFingerprint = entry.title.replace(/\s+/g, '').toLowerCase();
                    
                    if (!titleMap[titleFingerprint]) {
                        titleMap[titleFingerprint] = [entry.id];
                    } else {
                        titleMap[titleFingerprint].push(entry.id);
                    }
                }
            });
            
            // 找出有多个条目的指纹（内容完全相同）
            Object.keys(contentMap).forEach(fingerprint => {
                if (contentMap[fingerprint].length > 1) {
                    const group = contentMap[fingerprint].map(id => entriesToCheck.find(e => e.id === id)).filter(Boolean);
                    if (group.length > 1) { // 确保至少有两个有效条目
                        duplicateGroups['c_' + fingerprint.substring(0, 20)] = {
                            items: group,
                            type: '完全重复'
                        };
                    }
                }
            });
            
            // 找出标题相同但内容不同的条目
            Object.keys(titleMap).forEach(titleKey => {
                if (titleMap[titleKey].length > 1) {
                    // 检查这些条目是否已经在完全重复组中
                    const ids = titleMap[titleKey];
                    const alreadyIncluded = ids.every(id => 
                        Object.values(duplicateGroups).some(group => 
                            group.items.some(item => item.id === id)
                        )
                    );
                    
                    // 如果不是已包含的重复条目，添加为标题重复组
                    if (!alreadyIncluded) {
                        const group = ids.map(id => entriesToCheck.find(e => e.id === id)).filter(Boolean);
                        if (group.length > 1) { // 确保至少有两个有效条目
                            duplicateGroups['t_' + titleKey.substring(0, 20)] = {
                                items: group,
                                type: '标题重复'
                            };
                        }
                    }
                }
            });
            
            return duplicateGroups;
        }
        
        // 显示重复条目对话框
        function showDuplicatesDialog(duplicates) {
            // 创建对话框元素
            const dialog = document.createElement('div');
            dialog.className = 'form-popup';
            dialog.style.display = 'block';
            dialog.style.width = '90%';
            dialog.style.maxWidth = '1200px';
            
            // 计算重复组数量和条目数量
            const groupCount = Object.keys(duplicates).length;
            const totalDuplicates = Object.values(duplicates).reduce((sum, group) => sum + group.items.length, 0);
            
            // 构建对话框HTML
            dialog.innerHTML = `
                <h2>扫描重复条目结果</h2>
                <div style="margin-bottom: 20px;">
                    找到 ${groupCount} 组重复条目，共涉及 ${totalDuplicates} 条记录。
                </div>
                <div class="form-content" style="max-height: 60vh; overflow-y: auto;">
                    ${Object.entries(duplicates).map(([fingerprint, group], groupIndex) => `
                        <div class="duplicate-group" style="margin-bottom: 30px; border: 1px solid var(--glass-border); padding: 15px; border-radius: 8px;">
                            <h3>重复组 #${groupIndex + 1} - ${group.type} (${group.items.length}条)</h3>
                            <table class="entry-table" style="width: 100%;">
                                <tr>
                                    <th>选择</th>
                                    <th>ID</th>
                                    <th>日期</th>
                                    <th>标题</th>
                                    <th>关键词</th>
                                </tr>
                                ${group.items.map((entry, entryIndex) => `
                                    <tr>
                                        <td>
                                            <input type="radio" name="keep_${groupIndex}" value="${entry.id}" 
                                                   ${entryIndex === 0 ? 'checked' : ''}>
                                        </td>
                                        <td>${entry.id}</td>
                                        <td>${entry.date || ''}</td>
                                        <td>${entry.title || ''}</td>
                                        <td>${(entry.keywords || []).join(', ')}</td>
                                    </tr>
                                `).join('')}
                            </table>
                            <div style="margin-top: 10px;">
                                <button class="primary-btn" onclick="viewEntry('${group.items[0].id}', this)">查看内容</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="action-buttons">
                    <button class="primary-btn" onclick="processDuplicates(this)">删除选中项以外的重复条目</button>
                    <button class="danger-btn btn-icon-only" onclick="this.parentElement.parentElement.remove()" title="关闭" aria-label="关闭">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            `;
            
            // 添加到页面
            document.body.appendChild(dialog);
        }
        
        // 查看条目内容
        function viewEntry(entryId, button) {
            const entry = entries.find(e => e.id === entryId);
            if (!entry) return;
            
            // 检查是否已经显示内容
            const container = button.parentElement.parentElement;
            const existingContent = container.querySelector('.entry-content');
            
            if (existingContent) {
                // 已显示，则切换显示状态
                existingContent.style.display = existingContent.style.display === 'none' ? 'block' : 'none';
                button.textContent = existingContent.style.display === 'none' ? '查看内容' : '隐藏内容';
            } else {
                // 未显示，创建内容区域
                const contentDiv = document.createElement('div');
                contentDiv.className = 'entry-content';
                contentDiv.style.marginTop = '15px';
                contentDiv.style.padding = '15px';
                contentDiv.style.border = '1px solid var(--glass-border)';
                contentDiv.style.borderRadius = '8px';
                contentDiv.style.backgroundColor = 'var(--glass-bg)';
                
                contentDiv.innerHTML = `
                    <h4>标题: ${entry.title}</h4>
                    <div style="margin-top: 10px;"><strong>原文内容:</strong></div>
                    <div style="max-height: 300px; overflow-y: auto; margin: 10px 0; padding: 10px; border: 1px solid var(--glass-border); border-radius: 4px;">
                        ${entry.content || '<em>无内容</em>'}
                    </div>
                    <div style="margin-top: 10px;"><strong>分析:</strong></div>
                    <div style="max-height: 300px; overflow-y: auto; margin: 10px 0; padding: 10px; border: 1px solid var(--glass-border); border-radius: 4px;">
                        ${entry.analysis || '<em>无分析</em>'}
                    </div>
                `;
                
                container.appendChild(contentDiv);
                button.textContent = '隐藏内容';
            }
        }
        
        // 处理重复条目选择
        async function processDuplicates(button) {
            if (!confirm('确定要删除未选中的重复条目吗？此操作不可撤销。')) {
                return;
            }
            
            const dialog = button.parentElement.parentElement;
            const duplicateGroups = dialog.querySelectorAll('.duplicate-group');
            const entriesRef = db.ref(getProjectPath('entries'));
            let deleteCount = 0;
            
            try {
                button.disabled = true;
                button.textContent = '处理中...';
                
                for (const group of duplicateGroups) {
                    const selectedRadio = group.querySelector('input[type="radio"]:checked');
                    if (!selectedRadio) continue;
                    
                    const keepId = selectedRadio.value;
                    const allRadios = group.querySelectorAll('input[type="radio"]');
                    
                    for (const radio of allRadios) {
                        if (radio.value !== keepId) {
                            const deleteId = radio.value;
                            await entriesRef.child(deleteId).remove();
                            deleteCount++;
                        }
                    }
                }
                
                showAlert(`成功删除 ${deleteCount} 条重复项`, 'success');
                dialog.remove();
                
            } catch (error) {
                console.error('处理重复条目失败:', error);
                showAlert(`处理重复条目失败: ${error.message}`, 'error');
                button.disabled = false;
                button.textContent = '删除选中项以外的重复条目';
            }
        }
        
        // 切换视图模式
        function changeViewMode(mode) {
            const allowed = ['list', 'detail', 'card', 'word', 'timeline'];
            currentViewMode = allowed.includes(mode) ? mode : 'list';
            try { localStorage.setItem('v2_view_mode', currentViewMode); } catch (e) {}
            if ((currentViewMode === 'word' || currentViewMode === 'timeline') && bulkModeActive) {
                bulkModeActive = false;
                const bulkBar = document.getElementById('bulk-actions-bar');
                if (bulkBar) bulkBar.style.display = 'none';
                selectedEntryIds.clear();
                selectedAll = false;
            }
            if (currentViewMode !== 'word') {
                document.body.classList.remove('word-mode-active');
            }
            if (currentViewMode !== 'timeline') {
                document.body.classList.remove('timeline-mode-active');
            }
            updateViewToggleButton();
            if (window.V2Views && typeof V2Views.syncViewMenu === 'function') {
                V2Views.syncViewMenu(currentViewMode);
            }
            renderEntries();
        }
        
        // 切换视图（在两种视图间切换）
        function toggleViewMode() {
            const cycle = ['list', 'card', 'detail', 'word'];
            const idx = cycle.indexOf(currentViewMode);
            const newMode = cycle[(idx + 1) % cycle.length];
            changeViewMode(newMode);
        }
        
        // 更新视图切换按钮文本
        function updateViewToggleButton() {
            const btn = document.getElementById('toggle-view-btn');
            if (btn) {
                const icon = btn.querySelector('.material-icons');
                const icons = { list: 'table_rows', detail: 'view_list', card: 'grid_view', word: 'menu_book', timeline: 'timeline' };
                const labels = { list: '数据库视图', detail: '详细视图', card: '卡片视图', word: 'Word 阅读视图', timeline: '时间线视图' };
                if (icon) icon.textContent = icons[currentViewMode] || 'view_module';
                btn.title = labels[currentViewMode] || '切换视图';
                btn.setAttribute('aria-label', btn.title);
            }
        }
        
        // 页面加载时初始化视图切换按钮文本
        document.addEventListener('DOMContentLoaded', function() {
            updateViewToggleButton();
        });

        // 新增 checkDraft 函数
        async function checkDraft() {
            try {
                let draftId = null;
                
                // 优先使用编辑ID或当前草稿ID
                if (editingId) {
                    draftId = editingId;
                } else if (currentDraftId) {
                    draftId = currentDraftId;
                } else {
                    // 尝试从localStorage获取
                    draftId = localStorage.getItem('currentDraftId');
                }
                
                if (draftId) {
                    const draftRef = db.ref(getProjectPath(`drafts/${draftId}`));
                    const snapshot = await draftRef.once('value');
                    
                    if (snapshot.exists()) {
                        const draft = snapshot.val();
                        const saveTime = new Date(draft.updatedAt).toLocaleString();
                        
                        // 询问用户是否恢复草稿
                        const message = editingId ? 
                            `检测到未保存的修改（最后保存：${saveTime}），是否恢复？` :
                            `检测到未完成的草稿（最后保存：${saveTime}），是否恢复？`;
                            
                        if (confirm(message)) {
                            await populateForm(draft);
                            entryDraft = draftId;
                            currentDraftId = draftId;
                            
                            // 更新保存时间显示
                            const lastSaveEl = document.getElementById('last-save-time');
                            if (lastSaveEl) {
                                lastSaveEl.innerHTML = `
                                    <span class="material-icons">history</span>
                                    已恢复草稿：${saveTime}
                                `;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('检查草稿失败:', error);
            }
        }

        // 将用户手动输入的 8 位数字日期（如 19380307）规范化为 YYYY-MM-DD
        function normalizeDateInput(raw) {
            const value = (raw || '').trim();
            // 只处理纯 8 位数字
            if (!/^\d{8}$/.test(value)) return null;
            const year = value.slice(0, 4);
            const month = value.slice(4, 6);
            const day = value.slice(6, 8);
            // 简单校验月份和日期范围
            const m = Number(month);
            const d = Number(day);
            if (m < 1 || m > 12 || d < 1 || d > 31) return null;
            return `${year}-${month}-${day}`;
        }

        // 新增 getFormData 和 populateForm 函数
        function getFormData() {
            const dateInput = document.querySelector('#entry-form [name="date"]');
            let dateValue = dateInput?.value || '';

            // 支持手动输入 8 位数字后自动识别为日期
            const normalized = normalizeDateInput(dateValue);
            if (normalized) {
                dateValue = normalized;
                if (dateInput) dateInput.value = normalized;
            }

            return {
                date: dateValue,
                title: document.querySelector('#entry-form [name="title"]')?.value || '',
                content: quill ? quill.root.innerHTML : '',
                analysis: window.analysisQuill ? window.analysisQuill.root.innerHTML : '',
                links: (document.querySelector('#entry-form [name="links"]')?.value || '')
                    .split(',')
                    .map(link => link.trim())
                    .filter(link => link.length > 0),
                keywords: (document.querySelector('#entry-form [name="keywords"]')?.value || '')
                    .split(',')
                    .map(keyword => keyword.trim())
                    .filter(keyword => keyword.length > 0)
            };
        }

        // 填充表单数据
        async function populateForm(data) {
            try {
                // 等待编辑器初始化
                await ensureEditorsInitialized();
                
                // 填充基本字段
                document.querySelector('[name="date"]').value = data.date || '';
                document.querySelector('[name="title"]').value = data.title || '';
                document.querySelector('[name="links"]').value = (data.links || []).join(',');
                document.querySelector('[name="keywords"]').value = (data.keywords || []).join(',');
                
                // 填充富文本编辑器内容
                if (quill && data.content) {
                    quill.root.innerHTML = data.content;
                }
                if (window.analysisQuill && data.analysis) {
                    window.analysisQuill.root.innerHTML = data.analysis;
                }
            } catch (error) {
                console.error('填充表单失败:', error);
                showAlert('恢复草稿失败: ' + error.message, 'error');
            }
        }

        // 确保编辑器已初始化（懒加载 Quill 脚本 + 初始化实例）
        function ensureEditorsInitialized() {
            return loadQuillScript().then(() => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 10;
                    const checkInterval = 100;
                    function checkEditors() {
                        if (quill && window.analysisQuill) {
                            resolve();
                            return;
                        }
                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error('编辑器初始化超时'));
                            return;
                        }
                        if (!quill || !window.analysisQuill) {
                            try { initQuill(); } catch (e) { console.warn('编辑器初始化尝试失败:', e); }
                        }
                        setTimeout(checkEditors, checkInterval);
                    }
                    checkEditors();
                });
            });
        }

        // 清理过期草稿
        async function clearExpiredDrafts() {
            if (!confirm('确定要清理30天前的所有草稿吗？')) return;
            
            try {
                const draftsRef = db.ref(getProjectPath('drafts'));
                const snapshot = await draftsRef.once('value');
                const drafts = snapshot.val() || {};
                const now = Date.now();
                
                const updates = {};
                Object.entries(drafts).forEach(([id, draft]) => {
                    if (now - draft.updatedAt > 30 * 86400000) {
                        updates[id] = null;
                    }
                });
                
                await draftsRef.update(updates);
                loadDrafts();
                showAlert(`已清理${Object.keys(updates).length}个过期草稿`, 'success');
            } catch (error) {
                showAlert('清理失败: ' + error.message, 'error');
            }
        }

        // 草稿箱功能
        let draftCheckInterval;

        // 显示草稿箱
        async function showDraftBox() {
            const draftBox = document.getElementById('draft-box');
            draftBox.style.display = 'block';
            draftBox.classList.remove('closing');
            loadDrafts();
            
            // 启动定期检查
            draftCheckInterval = setInterval(() => {
                const now = new Date();
                document.querySelectorAll('.draft-item').forEach(item => {
                    const timestamp = parseInt(item.dataset.timestamp);
                    const diffHours = Math.floor((now - timestamp) / 3600000);
                    item.style.opacity = Math.max(0.4, 1 - diffHours/240); // 10天内逐渐变淡
                });
            }, 60000);
        }

        // 隐藏草稿箱
        function hideDraftBox() {
            const draftBox = document.getElementById('draft-box');
            draftBox.classList.add('closing');
            setTimeout(() => {
                draftBox.style.display = 'none';
                draftBox.classList.remove('closing');
                clearInterval(draftCheckInterval);
            }, 200);
        }

        // 加载草稿列表
        async function loadDrafts() {
            try {
                const draftsRef = db.ref(getProjectPath('drafts'));
                const snapshot = await draftsRef.once('value');
                const drafts = snapshot.val() || {};
                
                // 转换为数组并过滤30天内的草稿
                const now = Date.now();
                const validDrafts = Object.entries(drafts)
                    .map(([id, draft]) => {
                        // 添加草稿类型标记
                        if (draft.originalId) {
                            draft.type = '编辑草稿';
                            draft.displayId = draft.originalId;
                        } else {
                            draft.type = '新建草稿';
                            draft.displayId = id;
                        }
                        return { id, ...draft };
                    })
                    .filter(d => now - d.updatedAt < 30 * 86400000)
                    .sort((a, b) => b.updatedAt - a.updatedAt);

                renderDrafts(validDrafts);
            } catch (error) {
                showAlert('加载草稿失败: ' + error.message, 'error');
            }
        }

        // 渲染草稿列表
        function renderDrafts(drafts) {
            const container = document.getElementById('drafts-container');
            const countSpan = document.getElementById('draft-count');
            
            if (drafts.length === 0) {
                container.innerHTML = '<div class="empty-draft">暂无保存中的草稿</div>';
                countSpan.textContent = '0';
                document.getElementById('last-draft-time').textContent = '无';
                return;
            }

            countSpan.textContent = drafts.length;
            document.getElementById('last-draft-time').textContent = 
                new Date(drafts[0].updatedAt).toLocaleString();

            container.innerHTML = drafts.map(draft => `
                <div class="draft-item glass-container" data-id="${draft.id}" data-timestamp="${draft.updatedAt}">
                    <div class="draft-header">
                        <h3 class="draft-title">
                            <span class="draft-type">[${draft.type}]</span>
                            <span class="draft-id">${draft.id}</span>
                            ${draft.title || '未命名草稿'}
                        </h3>
                        <div class="draft-meta">
                            <span class="draft-base-id">${draft.entryBaseId || '临时草稿'}</span>
                            <span class="draft-date">${new Date(draft.updatedAt).toLocaleString()}</span>
                            <span class="draft-size">${Math.ceil(JSON.stringify(draft).length/1024)}KB</span>
                        </div>
                    </div>
                    <div class="draft-content-preview">
                        ${draft.content ? `<div class="preview-text">${draft.content.substring(0, 100)}...</div>` : ''}
                    </div>
                    <div class="draft-actions">
                        <button class="primary-btn" onclick="continueDraft('${draft.id}')">继续编辑</button>
                        <button class="danger-btn btn-icon-only" onclick="deleteDraft('${draft.id}')" title="删除" aria-label="删除">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // 继续编辑草稿
        async function continueDraft(draftId) {
            try {
                const draftRef = db.ref(getProjectPath(`drafts/${draftId}`));
                const snapshot = await draftRef.once('value');
                
                if (snapshot.exists()) {
                    const draft = snapshot.val();
                    
                    // 检查是否是新建草稿或条目是否存在
                    const isNewDraft = draftId.startsWith('NEW_');
                    let originalExists = false;
                    
                    if (!isNewDraft) {
                        const entryRef = db.ref(getProjectPath(`entries/${draftId}`));
                        const entrySnapshot = await entryRef.once('value');
                        originalExists = entrySnapshot.exists();
                    }

                    // 如果原条目不存在且不是新建草稿，转为新建状态
                    if (!originalExists && !isNewDraft) {
                        if (confirm("原条目已不存在，是否转为新建条目？")) {
                            editingId = null; // 重置为新建状态
                            draft.id = null; // 清除原ID
                        } else {
                            return;
                        }
                    } else {
                        editingId = isNewDraft ? null : draftId;
                    }

                    // 先清空编辑器内容
                    quill.root.innerHTML = '';
                    window.analysisQuill.root.innerHTML = '';
                    
                    // 延迟填充确保编辑器初始化完成
                    setTimeout(() => {
                        populateForm(draft);
                        entryDraft = draftId;
                        showForm();
                        hideDraftBox();
                        
                        // 更新状态提示
                        const statusEl = document.getElementById('draft-status');
                        if (!originalExists && !isNewDraft) {
                            statusEl.innerHTML += `<div class="draft-warning">
                                <span class="material-icons">warning</span>
                                原条目已不存在，将保存为新条目
                            </div>`;
                        }
                        
                        // 自动聚焦到标题字段
                        document.querySelector('[name="title"]').focus();
                    }, 100);
                }
            } catch (error) {
                showAlert('加载草稿失败: ' + error.message, 'error');
            }
        }

        // 删除单个草稿
        async function deleteDraft(draftId) {
            if (confirm('确定要删除这个草稿吗？')) {
                try {
                    await db.ref(getProjectPath(`drafts/${draftId}`)).remove();
                    loadDrafts();
                } catch (error) {
                    showAlert('删除草稿失败: ' + error.message, 'error');
                }
            }
        }

        // 清理过期草稿
        async function clearExpiredDrafts() {
            if (!confirm('确定要清理30天前的所有草稿吗？')) return;
            
            try {
                const draftsRef = db.ref(getProjectPath('drafts'));
                const snapshot = await draftsRef.once('value');
                const drafts = snapshot.val() || {};
                const now = Date.now();
                
                const updates = {};
                Object.entries(drafts).forEach(([id, draft]) => {
                    if (now - draft.updatedAt > 30 * 86400000) {
                        updates[id] = null;
                    }
                });
                
                await draftsRef.update(updates);
                loadDrafts();
                showAlert(`已清理${Object.keys(updates).length}个过期草稿`, 'success');
            } catch (error) {
                showAlert('清理失败: ' + error.message, 'error');
            }
        }

        // 增强saveDraft函数
        async function saveDraft() {
            // 使用triggerAutoSave替代旧的保存逻辑
            await triggerAutoSave();
            // 重置时间戳以防定时器重复触发
            lastSaveTimestamp = Date.now();
        }

        // 页面离开保护
        window.addEventListener('beforeunload', (e) => {
            if (checkUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
                saveDraft(); // 尝试最后保存一次
            }
        });

        // 使用新的自动保存系统替代原先的定时器

        // ========== 分页动画初始化 ==========
        // 页面加载时为分页添加动画
        document.addEventListener('DOMContentLoaded', function() {
            // 分页按钮进入动画
            function animatePaginationButtons() {
                const pageButtons = document.querySelectorAll('.page-btn');
                pageButtons.forEach((btn, index) => {
                    btn.style.opacity = '0';
                    btn.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
                        btn.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                        btn.style.opacity = '1';
                        btn.style.transform = 'translateY(0)';
                    }, index * 50);
                });
            }
            
            // 延迟执行动画，确保分页已渲染
            setTimeout(() => {
                animatePaginationButtons();
            }, 500);
            
            // 监听分页更新事件，重新应用动画
            const originalUpdatePagination = window.updatePagination;
            if (originalUpdatePagination) {
                window.updatePagination = function(totalPages) {
                    originalUpdatePagination.call(this, totalPages);
                    setTimeout(animatePaginationButtons, 100);
                };
            }
        });

        window.changePageSize = changePageSize;
        window.scrollToTop = scrollToTop;
        window.toggleAdvancedSearch = toggleAdvancedSearch;
        window.applyFulltextSearch = applyFulltextSearch;
        window.applyAdvancedSearch = applyAdvancedSearch;
        window.resetAdvancedSearch = resetAdvancedSearch;
        window.clearFulltextSearch = clearFulltextSearch;