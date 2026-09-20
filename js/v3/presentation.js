/* Presentation only: keep data, editing, and navigation behavior in their existing modules. */
(function () {
  'use strict';
  const paths = {
    save:'M4 3h13l4 4v14H3V3h1Zm3 0v6h10V3M7 21v-8h10v8',
    saveClose:'M3 3h13v18H3V3Zm3 0v6h7V3M6 21v-7h7v7M18 7l4 5-4 5',
    network:'M12 4 4 18h16L12 4ZM12 4v10M4 18l8-4 8 4',
    compact:'M4 5h16M4 10h16M4 15h16M4 20h16',
    restore:'M3 10a9 9 0 1 1 2 9M3 4v6h6M12 7v5l3 2',
    table:'M3 4h18v16H3zM3 10h18M10 4v16',
    image:'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M16 7h.01',
    expand:'M4 9l8-6 8 6M4 15l8 6 8-6',
    collapse:'M4 3l8 6 8-6M4 21l8-6 8 6',
    color:'m7 17 5-13 5 13M9 12h6M4 21h16',
    highlight:'m9 14 7-10 5 4-7 10-5-4ZM9 14l-3 5h5M3 22h18',
    comment:'M3 4h18v13H9l-6 4V4Zm5 5h8M8 13h5',
    menu:'M4 6h16M4 12h16M4 18h16',
    plus:'M12 5v14M5 12h14',
    close:'m6 6 12 12M18 6 6 18',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow:'M19 12H5m6-6-6 6 6 6',
    up:'M12 19V5m-6 6 6-6 6 6',
    down:'M12 5v14m-6-6 6 6 6-6',
    chevron:'m9 5 7 7-7 7',
    book:'M12 5v15M12 5C8 2 4 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-2-10 1Z',
    file:'M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h6',
    folder:'M3 5h6l2 3h10v12H3V5Z',
    grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    list:'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
    clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
    tag:'M20 13 11 4H3v8l9 9 8-8ZM7 8h.01',
    settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
    upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    download:'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    edit:'m15 4 5 5M3 21l5-1L21 7l-5-5L3 15v6Z',
    refresh:'M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6M4 17a9 9 0 0 0 15 2l3-3m0 6v-6h-6',
    logout:'M9 4H3v16h6M9 12h12m-5-5 5 5-5 5',
    archive:'M3 3h18v5H3zM5 8v13h14V8M10 12h4',
    check:'m4 12 5 5L20 6',
    copy:'M9 9h12v12H9zM15 5V3H3v12h2',
    quote:'M3 5h7v7H6c0 4-1 5-3 6M14 5h7v7h-4c0 4-1 5-3 6',
    calendar:'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
    timeline:'M5 3v18M9 5h12v5H9zM9 14h8v5H9z',
    filter:'M3 5h18M6 12h12M10 19h4',
    sort:'M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4',
    fullscreen:'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
    columns:'M3 4h18v16H3zM12 4v16',
    undo:'M3 10h11a6 6 0 0 1 0 12M3 10l6-6M3 10l6 6',
    redo:'M21 10H10a6 6 0 0 0 0 12M21 10l-6-6M21 10l-6 6',
    bold:'M6 3h7a5 5 0 0 1 0 10H6V3Zm0 10h8a4 4 0 0 1 0 8H6v-8Z',
    italic:'M10 3h10M4 21h10M15 3 9 21',
    underline:'M5 3v7a7 7 0 0 0 14 0V3M4 21h16',
    link:'m10 14 4-4M9 15l-3 3a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0M15 9l3-3a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0',
    user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',
    key:'M14 5a5 5 0 1 1-7 7l-5 5v5h5v-3h3v-3l2-2M17 7h.01',
    type:'M3 5h18M12 5v16M8 21h8M3 8V5M21 8V5',
    more:'M5 12h.01M12 12h.01M19 12h.01',
    clear:'m4 14 9-11 8 7-9 11H9l-5-4v-3ZM8 10l9 7M12 21h9',
    info:'M12 10v7M12 6h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'
  };
  function icon(name) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('ui-icon');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.file);svg.append(path);return svg;
  }
  const aliases={menu:'menu',arrow_back:'arrow',arrow_upward:'up',note_add:'plus',upload:'upload',file_upload:'upload',download:'download',file_download:'download',style:'file',library_books:'book',star:'star',star_border:'star',schedule:'clock',history:'clock',sell:'tag',label:'tag',table_rows:'list',grid_view:'grid',view_list:'list',menu_book:'book',timeline:'timeline',settings:'settings',tune:'settings',filter_list:'filter',search:'search',manage_search:'search',edit:'edit',delete:'trash',delete_sweep:'trash',close:'close',done:'check',done_all:'check',check:'check',check_circle:'check',content_copy:'copy',format_quote:'quote',calendar_today:'calendar',event:'calendar',restart_alt:'refresh',refresh:'refresh',sort:'sort',arrow_downward:'down',chevron_right:'chevron',more_vert:'more',more_horiz:'more',info:'info',archive:'archive'};
  const fa={'plus':'plus','trash':'trash','trash-alt':'trash','sync-alt':'refresh','sign-out-alt':'logout','list-check':'list','search':'search','sort':'sort','download':'download','upload':'upload','archive':'archive','times':'close','edit':'edit','folder':'folder','folder-open':'folder','chevron-right':'chevron','arrow-left':'arrow','check':'check','save':'archive'};
  const labels={'字体颜色':['color'],'高亮设置':['highlight'],'添加批注':['comment'],'☰':['menu','切换导航'], '全屏编辑':['fullscreen'], '左右对照':['columns'], '历史版本':['clock'], '立即同步草稿':['refresh'], '导出草稿备份':['download'], '本机恢复草稿':['archive'], '新增史料':['plus'], '撤销':['undo'], '重做':['redo'], '加粗':['bold'], '斜体':['italic'], '下划线':['underline'], '引用':['quote'], '列表':['list'], '编号':['list'], '链接':['link'], '插入':['plus'], '查找':['search'], '更多格式':['more'], '清除格式':['clear']};
  Object.assign(aliases,{list:'list',add:'plus',add_comment:'file',add_link:'link',analytics:'grid',auto_awesome:'settings',backspace:'clear',build:'settings',category:'grid',drafts:'archive',edit_note:'edit',fact_check:'check',file_copy:'copy',hub:'columns',person:'user',post_add:'plus',remove_circle:'close',reply:'undo',save:'archive',select_all:'grid',tag:'tag',view_module:'grid',article:'file',inventory_2:'archive'});
  Object.assign(fa,{'sign-in-alt':'logout','user-plus':'user',key:'key'});
  Object.assign(labels,{
    '数据库视图':['table'],'详细视图':['file'],'全部课题':['folder'],'最近使用':['clock'],'已归档':['archive'],'研究工具与管理':['settings'],'高级维护':['key'],'保存史料':['save'],'保存批注':['save'],'保存':['save'],'保存草稿并关闭':['saveClose'],
    '取消':['close'],'关闭':['close'],'关闭对照':['close'],'关闭回收站':['close'],
    '全部批注':['comment'],'批注':['comment'],'目录':['list'],'阅读':['book'],'阅读视图':['book'],'列表视图':['list'],'时间线':['timeline'],'时间线视图':['timeline'],
    '新增课题':['plus'],'新建课题':['plus'],'创建课题':['plus'],'新建':['plus'],'添加':['plus'],'添加事件':['calendar'],
    '筛选':['filter'],'搜索':['search'],'重置':['refresh'],'刷新':['refresh'],'清空':['clear'],'紧凑':['compact'],
    '编辑':['edit'],'修改':['edit'],'进入编辑界面':['edit'],'打开':['book'],'预览':['book'],
    '删除':['trash'],'删除批注':['trash'],'删除回复':['trash'],'永久删除':['trash'],'批量删除':['trash'],
    '清空回收站':['trash'],'清理30天前草稿':['trash'],'恢复':['restore'],'恢复草稿':['restore'],'撤销删除':['restore'],
    '回复':['undo'],'标为已解决':['check'],'重新打开':['restore'],'解决':['check'],'重开':['restore'],
    '收藏':['star'],'取消收藏':['star'],'归档':['archive'],'批量归档':['archive'],'导出':['download'],'导入':['upload'],'同步':['refresh'],
    '导出草稿备份':['download'],'导出选中项':['download'],'导出课题':['download'],'取消选择':['close'],'清除选择':['close'],
    '打开知识网络':['network'],'知识网络':['network'],'设置':['settings'],'返回':['arrow'],'返回顶部':['up'],
    '退出登录':['logout'],'退出':['logout'],'继续编辑':['edit'],'复制':['copy'],'复制引文':['copy'],
    '表格':['table'],'图片与图注':['image'],'分隔线':['compact'],'史料关联':['link'],'引用到分析':['quote'],
    '更多':['more'],'展开':['expand'],'收起':['collapse']
  });
  Object.assign(aliases,{folder_special:'archive',hub:'network',add_comment:'comment',edit_note:'comment',save:'save',unfold_more:'expand',unfold_less:'collapse'});
  const contentControls='.word-toc-item,.v2-nav-tag,.v2-rel-open,.v2-rel-link,.ed-thread-list button,.date-preset-btn,.ed-calendar-days button,.ed-color-swatches button,.word-color-dot,[data-type-id],[data-type],.v2-type-option';
  const readableWorkspaceControls=[
    '.v2-nav-item',
    '.ed-nav-group>summary',
    '.ed-top-actions button',
    '.ed-view-tabs button',
    '.entry-actions button',
    '.v2-info-actions button',
    '.word-doc-actions button',
    '.bulk-operations button',
    '.v2-adv-toolbar-actions button:not(:last-child)',
    '.v2-events-editor-actions button',
    '.v2-events-add-btn',
    '.v2-citation-style-bar button',
    '.form-popup .action-buttons button',
    '.category-manager .action-buttons button',
    '#entry-form>.action-buttons button',
    '#entry-form form>.action-buttons button'
  ].join(',');
  function usesVisibleLabel(button){
    return !!document.querySelector('.v2-main')&&button.matches(readableWorkspaceControls);
  }
  function iconActions(root){
    root.querySelectorAll('button,a.btn,a.icon-btn,.ed-nav-group>summary').forEach(b=>{
      if(b.matches(contentControls)||b.querySelector('input,select,textarea')||b.closest('.v2-type-selector,.v2-type-grid'))return;
      const copy=b.cloneNode(true);copy.querySelectorAll('svg,.material-icons,.fas,.far,.v2-nav-badge').forEach(el=>el.remove());
      const text=copy.textContent.trim().replace(/\s+/g,' ');
      const label=text||b.getAttribute('aria-label')||b.title;
      if(!label)return;
      const match=labels[label];let existing=b.querySelector('svg');
      if(!match&&!existing)return;
      // Preserve existing children and their event handlers, including navigation counters.
      if(!existing){existing=icon(match[0]);b.prepend(existing);}
      if(b.classList.contains('ui-icon-only')&&b.dataset.iconLabel===label&&b.querySelector('.ui-button-label'))return;
      b.setAttribute('aria-label',label);b.title=label;b.dataset.iconLabel=label;
      [...b.childNodes].forEach(n=>{
        if(n.nodeType===3&&n.textContent.trim()){const span=document.createElement('span');span.className='ui-button-label';n.replaceWith(span);span.append(n);}
        else if(n.nodeType===1&&!n.matches('svg,.material-icons,.fas,.far,.ui-icon-wrap,.v2-nav-badge')&&!n.querySelector('svg'))n.classList.add('ui-button-label');
      });
      if(usesVisibleLabel(b)){
        if(!b.querySelector('.ui-button-label')){const span=document.createElement('span');span.className='ui-button-label';span.textContent=label;b.append(span);}
        b.classList.remove('ui-icon-only');
        b.classList.add('ui-labeled-action','ui-icon-button');
      }else{
        b.classList.remove('ui-labeled-action');
        b.classList.add('ui-icon-only','ui-icon-button');
      }
    });
  }
  function tooltips(){
    const tip=document.createElement('div');tip.id='ui-action-tooltip';tip.className='ui-action-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);let owner;
    const hide=()=>{tip.hidden=true;if(owner){const ids=(owner.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!==tip.id);if(ids.length)owner.setAttribute('aria-describedby',ids.join(' '));else owner.removeAttribute('aria-describedby');}owner=null;};
    const show=target=>{const b=target.closest?.('.ui-icon-only');if(!b||b.disabled)return;hide();owner=b;tip.textContent=b.getAttribute('aria-label');tip.hidden=false;b.setAttribute('aria-describedby',((b.getAttribute('aria-describedby')||'')+' '+tip.id).trim());const r=b.getBoundingClientRect();const width=tip.offsetWidth,height=tip.offsetHeight;tip.style.left=Math.max(8,Math.min(innerWidth-width-8,r.left+r.width/2-width/2))+'px';tip.style.top=(r.bottom+height+14<innerHeight?r.bottom+7:Math.max(8,r.top-height-7))+'px';};
    document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')show(e.target);});document.addEventListener('focusin',e=>show(e.target));
    document.addEventListener('pointerout',e=>{if(owner&&!owner.contains(e.relatedTarget))hide();});document.addEventListener('focusout',hide);document.addEventListener('click',hide);document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  }
  function polish(root=document) {
    root.querySelectorAll('.material-icons, i.fas, i.far').forEach(el=>{
      if(el.querySelector('svg'))return;
      const key=el.classList.contains('material-icons')?aliases[el.textContent.trim()]:fa[[...el.classList].find(c=>c.startsWith('fa-'))?.slice(3)];
      if(!key)return;
      el.replaceChildren(icon(key));el.classList.add('ui-icon-wrap');el.setAttribute('aria-hidden','true');
    });
    root.querySelectorAll('.ed-editor-toolbar button,.ed-editor-actions button,.ed-top-actions .ed-primary,.ed-desktop-toggle,.v2-nav-item').forEach(b=>{
      if(b.querySelector('svg,.material-icons'))return;
      const label=b.textContent.trim(),match=labels[label];if(!match)return;
      b.setAttribute('aria-label',match[1]||label);b.title=match[1]||label;
      const span=document.createElement('span');span.className='ui-button-label';span.textContent=match[1]||label;
      b.replaceChildren(icon(match[0]),span);if(b.matches('.ed-desktop-toggle,.ed-editor-toolbar button'))b.classList.add('ui-icon-button');
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.body.classList.add('ui-minimal-actions');tooltips();
    if(document.querySelector('.v2-main'))document.body.classList.add('ui-readable-actions');
    document.body.classList.add('refined-ui');
    const masthead=document.querySelector('.ed-masthead');
    if(masthead){
      const brand=document.createElement('div');brand.className='ui-home-brand';
      const link=masthead.querySelector('a');link.prepend(icon('book'));brand.append(link);
      const label=document.createElement('span');label.className='ui-brand-caption';label.textContent='RESEARCH ARCHIVE';brand.append(label);
      const user=document.querySelector('.user-info');masthead.replaceChildren(brand);if(user)masthead.append(user);
      const title=document.querySelector('.page-title'),wrap=document.createElement('div');wrap.className='ui-page-intro';title.before(wrap);wrap.append(title);
      const intro=document.createElement('p');intro.textContent='沉心阅读，让每一份材料成为新的发现。';wrap.append(intro);
      const tabs=document.querySelector('.ed-home-tabs');document.querySelector('.toolbar-left')?.append(tabs);
      const cardTitle=document.querySelector('.card-title');if(cardTitle)cardTitle.textContent='课题目录';
      const toggle=tabs?.querySelector('button:last-child');if(toggle){toggle.textContent='';toggle.append(icon('grid'));toggle.setAttribute('aria-label','切换目录或卡片');toggle.title='切换目录或卡片';toggle.classList.add('ui-layout-toggle');}
    }
    const reading=document.querySelector('.ed-reading-tools');
    if(reading){const details=document.createElement('details');details.className='ui-reading-menu';const summary=document.createElement('summary');summary.append(icon('type'));summary.setAttribute('aria-label','阅读外观');summary.title='阅读外观';reading.before(details);details.append(summary,reading);document.addEventListener('click',e=>{if(!details.contains(e.target))details.open=false;});}
    document.querySelectorAll('.feature-icon').forEach((el,i)=>el.replaceChildren(icon(['folder','book','clock'][i]||'file')));
    document.querySelectorAll('.ed-calendar-button').forEach(el=>{el.replaceChildren(icon('calendar'));el.title='选择日期';el.setAttribute('aria-label','选择日期');});
    polish();iconActions(document);
    let queued=false;new MutationObserver(records=>{if(!records.some(r=>r.addedNodes.length)||queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();iconActions(document);});}).observe(document.body,{childList:true,subtree:true});
  });
})();
