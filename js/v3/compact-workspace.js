(function(){
 document.addEventListener('DOMContentLoaded',()=>{
  if(!document.querySelector('.v2-main'))return;
  document.body.classList.add('ui-density-layout');
  const form=document.getElementById('entry-form');
  if(form&&!form.querySelector('.ed-compact-header')){
   const header=document.createElement('header');header.className='ed-compact-header';
   const title=form.querySelector('h2'),actions=form.querySelector('.ed-editor-actions'),status=form.querySelector('#ed-save-state');
   form.prepend(header);[title,actions,status].forEach(el=>{if(el)header.append(el);});
  }
 });
})();
