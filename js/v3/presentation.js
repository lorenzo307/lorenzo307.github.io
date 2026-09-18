/* Presentation only: keep data, editing, and navigation behavior in their existing modules. */
(function () {
  'use strict';
  const paths = {
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
  const labels={'☰':['menu','切换导航'], '全屏编辑':['fullscreen'], '左右对照':['columns'], '历史版本':['clock'], '立即同步草稿':['refresh'], '导出草稿备份':['download'], '本机恢复草稿':['archive'], '新增史料':['plus'], '撤销':['undo'], '重做':['redo'], '加粗':['bold'], '斜体':['italic'], '下划线':['underline'], '引用':['quote'], '列表':['list'], '编号':['list'], '链接':['link'], '插入':['plus'], '查找':['search'], '更多格式':['more'], '清除格式':['clear']};
  Object.assign(aliases,{list:'list',add:'plus',add_comment:'file',add_link:'link',analytics:'grid',auto_awesome:'settings',backspace:'clear',build:'settings',category:'grid',drafts:'archive',edit_note:'edit',fact_check:'check',file_copy:'copy',hub:'columns',person:'user',post_add:'plus',remove_circle:'close',reply:'undo',save:'archive',select_all:'grid',tag:'tag',view_module:'grid',article:'file',inventory_2:'archive'});
  Object.assign(fa,{'sign-in-alt':'logout','user-plus':'user',key:'key'});
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
    polish();
    let queued=false;new MutationObserver(records=>{if(!records.some(r=>r.addedNodes.length)||queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}).observe(document.body,{childList:true,subtree:true});
  });
})();
