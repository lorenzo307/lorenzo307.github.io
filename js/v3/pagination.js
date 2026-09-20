/* Shared, bounded pagination for project and entry lists. */
(function(){
 'use strict';
 function pageWindow(current,total,width){const start=Math.max(1,Math.min(current-Math.floor(width/2),total-width+1));return Array.from({length:Math.min(width,total)},(_,i)=>start+i);}
 function arrow(direction){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${direction==='prev'?'m14 6-6 6 6 6':'m10 6 6 6-6 6'}"/></svg>`;}
 function render(root,{count,current,pageSize,onChange,id='entry-pagination',unit='条'}){
  const total=Math.max(1,Math.ceil(count/pageSize));current=Math.max(1,Math.min(current,total));root.id=id;root.classList.add('line-pagination');
  root.querySelectorAll(':scope > :not(.pagination-info)').forEach(e=>e.remove());
  const summary=document.createElement('span');summary.className='line-pager-total';summary.setAttribute('role','status');summary.textContent=`共 ${count.toLocaleString('zh-CN')} ${unit}`;
  const nav=document.createElement('nav');nav.className='line-pager-controls';nav.setAttribute('aria-label',unit==='项'?'课题分页':'史料分页');
  const pages=document.createElement('div');pages.className='line-pager-pages';if(id==='entry-pagination')pages.id='pagination-buttons';
  function go(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>total||n===current)return;onChange(n);requestAnimationFrame(()=>document.getElementById(id)?.querySelector('[aria-current=page]')?.focus({preventScroll:true}));}
  function button(label,action,html){const b=document.createElement('button');b.type='button';b.className='page-btn';b.setAttribute('aria-label',label);b.title=label;if(html)b.innerHTML=html;b.onclick=action;return b;}
  const prev=button('上一页',()=>go(current-1),arrow('prev'));prev.classList.add('line-pager-arrow');prev.disabled=current===1;pages.append(prev);
  pageWindow(current,total,matchMedia('(max-width:560px)').matches?3:5).forEach(n=>{const b=button(`第 ${n} 页`,()=>go(n));b.textContent=n;b.dataset.page=n;if(n===current){b.classList.add('active');b.setAttribute('aria-current','page');}pages.append(b);});
  const next=button('下一页',()=>go(current+1),arrow('next'));next.classList.add('line-pager-arrow');next.disabled=current===total;pages.append(next);
  const jump=document.createElement('label');jump.className='line-pager-jump';jump.append('前往');const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='1';input.max=String(total);input.step='1';input.value=current;input.disabled=total===1;input.setAttribute('aria-label',`跳转页码，共 ${total} 页`);if(id==='entry-pagination')input.id='page-jump-inline';
  const submit=()=>{if(!input.value){input.value=current;return;}if(!input.checkValidity()){input.reportValidity();return;}go(input.value);};input.addEventListener('change',submit);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});jump.append(input,'页');nav.append(pages,jump);root.append(summary,nav);
 }
 window.ResearchPagination={render,pageWindow};
})();
