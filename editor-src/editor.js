import { Editor, Extension, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Highlight from '@tiptap/extension-highlight';
import DOMPurify from 'dompurify';
import { EditorState } from '@tiptap/pm/state';

const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clean(html) {
  const source = new DOMParser().parseFromString(html || '', 'text/html');
  source.querySelectorAll('iframe').forEach(el=>{const a=source.createElement('a');a.href=el.getAttribute('src')||'';a.textContent='视频来源：'+a.href;el.replaceWith(a);});
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(source.body.innerHTML, { ADD_TAGS: ['figure','figcaption'], ADD_ATTR: ['data-note','data-note-kind','data-source','data-width'] }), 'text/html');
  doc.querySelectorAll('[class]').forEach(el => {
    const align = [...el.classList].find(c=>c.startsWith('ql-align-'));
    if (align) el.style.textAlign = align.slice(9);
    const font = [...el.classList].find(c=>c.startsWith('ql-font-'));
    if(font) el.style.fontFamily = font.slice(8).replace('TimesNewRoman','Times New Roman');
    const indent = [...el.classList].find(c=>c.startsWith('ql-indent-'));
    if(indent) el.style.marginLeft = `${Number(indent.slice(10)) * 2}em`;
  });
  return doc.body.innerHTML;
}
const Indent = Extension.create({ name:'legacyIndent', addGlobalAttributes(){ return [{types:['paragraph','heading','listItem'],attributes:{indent:{default:null,parseHTML:e=>e.style.marginLeft || null,renderHTML:a=>a.indent?{style:`margin-left:${a.indent}`}:{}}}}]; }});
const Figure = Image.extend({
  addAttributes(){ const img=el=>el.querySelector?.('img')||el;return {...this.parent?.(),src:{default:null,parseHTML:el=>img(el).getAttribute('src')},alt:{default:null,parseHTML:el=>img(el).getAttribute('alt')},title:{default:null,parseHTML:el=>img(el).getAttribute('title')},caption:{default:'',parseHTML:el=>img(el).getAttribute('data-source')||'',renderHTML:a=>({'data-source':a.caption})}, width:{default:'100%',parseHTML:el=>img(el).style.width||'100%',renderHTML:a=>({style:`width:${a.width};max-width:100%`})}}; },
  parseHTML(){return [{tag:'figure.research-figure'},{tag:'img[src]'}];},
  renderHTML({HTMLAttributes}) { return ['figure',{'class':'research-figure'},['img',mergeAttributes(this.options.HTMLAttributes,HTMLAttributes)],['figcaption',{}, HTMLAttributes['data-source'] || '']]; },
});
const Note = Node.create({
  name:'researchNote',group:'inline',inline:true,atom:true,
  addAttributes(){return {text:{default:'',parseHTML:e=>e.getAttribute('data-note')},kind:{default:'研究者注',parseHTML:e=>e.getAttribute('data-note-kind')||'研究者注'}};},
  parseHTML(){return [{tag:'span[data-note]'}];},
  renderHTML({node}){return ['span',{'data-note':node.attrs.text,'data-note-kind':node.attrs.kind,class:'research-footnote',title:node.attrs.kind+'：'+node.attrs.text},node.attrs.kind+'：'+node.attrs.text];},
});
function dialog(title, fields, action, onSubmit) {
  const d=document.createElement('dialog'); d.className='ed-dialog';
  d.innerHTML=`<form><header><h2>${esc(title)}</h2><button type="button" data-close aria-label="关闭">×</button></header>${fields}<p class="ed-dialog-error" role="alert"></p><footer><button type="button" data-close>取消</button><button class="ed-primary" type="submit">${esc(action)}</button></footer></form>`;
  document.body.append(d); const previous=document.activeElement;
  d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();try { const result=await onSubmit(new FormData(e.target),d); if(result!==false)d.close(); }catch(err){d.querySelector('[role="alert"]').textContent=err.message;}};
  d.onclose=()=>{d.remove();previous?.focus();};d.showModal();return d;
}
class ResearchEditor {
  constructor(selector) {
    this.container=document.querySelector(selector);this.listeners=[];this.container.classList.add('research-editor');
    this.toolbar=document.createElement('div');this.toolbar.className='ed-editor-toolbar';this.toolbar.setAttribute('role','toolbar');this.toolbar.setAttribute('aria-label','文字编辑工具');
    this.host=document.createElement('div');this.container.replaceChildren(this.toolbar,this.host);
    this.editor=new Editor({element:this.host,extensions:[StarterKit.configure({link:{openOnClick:false,defaultProtocol:'https'}}),TextStyleKit,TextAlign.configure({types:['heading','paragraph']}),Subscript,Superscript,Highlight.configure({multicolor:true}),TableKit.configure({table:{resizable:true}}),Figure.configure({allowBase64:true}),Note,Indent],
      content:'<p></p>',editorProps:{attributes:{class:'ql-editor research-prose',role:'textbox','aria-multiline':'true','aria-label':selector.includes('analysis')?'研究分析':selector.includes('log')?'工作日志':'原文摘抄'},transformPastedHTML:html=>clean(html),handlePaste:(_v,event)=>{const file=[...(event.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));if(file){this.imageFile(file).catch(error=>window.showAlert?.(error.message,'error'));return true;}return false;},handleDrop:(_v,event)=>{const file=[...(event.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/'));if(file){event.preventDefault();this.imageFile(file).catch(error=>window.showAlert?.(error.message,'error'));return true;}return false;}},
      onUpdate:()=>{this.updateUI();this.listeners.forEach(fn=>fn());document.dispatchEvent(new CustomEvent('research-editor-change',{detail:{id:this.container.id}}));},onSelectionUpdate:()=>this.updateUI(),onFocus:()=>{window.ResearchEditor.active=this;}});
    this.root=this.editor.view.dom;this.buildToolbar();
    this.status=document.createElement('div');this.status.className='ed-editor-status';this.container.append(this.status);
    this.bubble=document.createElement('div');this.bubble.className='ed-selection-tools';this.bubble.hidden=true;
    this.bubble.append(this.button('加粗',()=>this.editor.chain().focus().toggleBold().run()),this.button('引用到分析',()=>this.quote()),this.button('研究者注',()=>this.note()));this.container.append(this.bubble);
    this.root.addEventListener('keydown',e=>{if(e.key==='/' && !e.isComposing && this.editor.state.selection.$from.parent.textContent===''){e.preventDefault();this.insertMenu();}});
    this.updateUI();
  }
  on(event,fn){if(event==='text-change')this.listeners.push(fn);}
  setHTML(html){this.originalHTML=html||'';this.editor.commands.setContent(clean(html),{emitUpdate:false});this.editor.view.updateState(EditorState.create({schema:this.editor.schema,doc:this.editor.state.doc,plugins:this.editor.state.plugins}));this.updateUI();}
  getHTML(){return this.editor.isEmpty?'':this.editor.getHTML();}
  getJSON(){return this.editor.getJSON();}
  button(label,action,mark){const b=document.createElement('button');b.type='button';b.textContent=label;b.title=label;b.setAttribute('aria-label',label);if(mark)b.dataset.mark=mark;b.onmousedown=e=>e.preventDefault();b.onclick=action;return b;}
  buildToolbar(){
    const e=this.editor;
    const select=document.createElement('select');select.setAttribute('aria-label','段落样式');[['p','正文'],['1','标题一'],['2','标题二'],['3','标题三']].forEach(([v,t])=>select.add(new Option(t,v)));select.onchange=()=>select.value==='p'?e.chain().focus().setParagraph().run():e.chain().focus().toggleHeading({level:+select.value}).run();this.toolbar.append(select);
    [['撤销',()=>e.chain().focus().undo().run()],['重做',()=>e.chain().focus().redo().run()],['加粗',()=>e.chain().focus().toggleBold().run(),'bold'],['斜体',()=>e.chain().focus().toggleItalic().run(),'italic'],['下划线',()=>e.chain().focus().toggleUnderline().run(),'underline'],['引用',()=>e.chain().focus().toggleBlockquote().run(),'blockquote'],['列表',()=>e.chain().focus().toggleBulletList().run(),'bulletList'],['编号',()=>e.chain().focus().toggleOrderedList().run(),'orderedList'],['链接',()=>this.link(),'link'],['插入',()=>this.insertMenu()],['查找',()=>this.find()],['更多格式',()=>this.more()],['清除格式',()=>e.chain().focus().unsetAllMarks().clearNodes().run()]].forEach(a=>this.toolbar.append(this.button(...a)));
    this.tablebar=document.createElement('div');this.tablebar.className='ed-table-tools';this.tablebar.hidden=true;
    [['下方加行','addRowAfter'],['右侧加列','addColumnAfter'],['删除行','deleteRow'],['删除列','deleteColumn'],['表头','toggleHeaderRow'],['合并／拆分','mergeOrSplit'],['删除表格','deleteTable']].forEach(([label,cmd])=>this.tablebar.append(this.button(label,()=>e.chain().focus()[cmd]().run())));this.container.insertBefore(this.tablebar,this.host);
    this.imagebar=document.createElement('div');this.imagebar.className='ed-table-tools';this.imagebar.hidden=true;['25%','50%','75%','100%'].forEach(width=>this.imagebar.append(this.button('宽度 '+width,()=>e.chain().focus().updateAttributes('image',{width}).run())));this.imagebar.append(this.button('修改图注',()=>{const value=e.getAttributes('image').caption||'';dialog('修改图注',`<label>图注与来源<input name="caption" value="${esc(value)}"></label>`,'保存',data=>e.chain().focus().updateAttributes('image',{caption:data.get('caption'),alt:data.get('caption')}).run());}),this.button('移除图片',()=>e.chain().focus().deleteSelection().run()));this.container.insertBefore(this.imagebar,this.host);
  }
  updateUI(){if(!this.editor)return;this.toolbar.querySelectorAll('[data-mark]').forEach(b=>b.setAttribute('aria-pressed',String(this.editor.isActive(b.dataset.mark))));if(this.tablebar)this.tablebar.hidden=!this.editor.isActive('table');if(this.status)this.status.textContent=`${this.editor.getText().replace(/\s/g,'').length.toLocaleString()} 字 · 支持 Word 粘贴 · Ctrl/Cmd + Shift + V 纯文本粘贴`;
    if(this.bubble){const s=this.editor.state.selection;this.bubble.hidden=s.empty||!this.editor.isFocused;}
    if(this.imagebar)this.imagebar.hidden=!this.editor.isActive('image');
  }
  link(){const current=this.editor.getAttributes('link').href||'';dialog('插入链接',`<label>网址<input name="url" type="url" value="${esc(current)}" placeholder="https://"></label><small>留空可移除选中的链接。</small>`,'应用',data=>{const url=data.get('url').trim();if(url&&!/^https?:\/\//i.test(url))throw Error('请输入 http 或 https 网址');url?this.editor.chain().focus().extendMarkRange('link').setLink({href:url}).run():this.editor.chain().focus().unsetLink().run();});}
  note(){const selected=this.editor.isActive('researchNote'),attrs=this.editor.getAttributes('researchNote');dialog('脚注与研究注释',`<label>注释类型<select name="kind">${['研究者注','原文注','文献出处'].map(k=>`<option${attrs.kind===k?' selected':''}>${k}</option>`).join('')}</select></label><label>内容与页码<textarea name="text" required rows="4" placeholder="填写说明、文献来源或页码">${esc(attrs.text||'')}</textarea></label>`,selected?'更新':'插入',data=>{const value={text:data.get('text'),kind:data.get('kind')};return selected?this.editor.chain().focus().updateAttributes('researchNote',value).run():this.editor.chain().focus().insertContent({type:'researchNote',attrs:value}).run();});}
  quote(){const {from,to}=this.editor.state.selection;const text=this.editor.state.doc.textBetween(from,to,'\n');if(!text)return;const target=window.analysisQuill;if(!target?.editor)return;const source=document.querySelector('#entry-form [name="title"]')?.value||'未命名史料';const citation=window.V2DynamicForm?.getCitation?.()||source;target.editor.chain().focus('end').insertContent(`<blockquote><p>${esc(text)}</p><p>——${esc(citation)}</p></blockquote><p></p>`).run();}
  insertMenu(){const d=dialog('插入内容','<div class="ed-insert-grid"></div>','完成',()=>{});const grid=d.querySelector('.ed-insert-grid');[['表格',()=>this.table()],['图片与图注',()=>this.image()],['脚注／出处',()=>this.note()],['分隔线',()=>this.editor.chain().focus().setHorizontalRule().run()],['史料关联',()=>this.related()],['引用到分析',()=>this.quote()]].forEach(([t,fn])=>grid.append(this.button(t,()=>{d.close();fn();})));}
  table(){dialog('插入表格','<label>行数<input name="rows" type="number" min="1" max="30" value="3" required></label><label>列数<input name="cols" type="number" min="1" max="12" value="3" required></label>','插入',data=>this.editor.chain().focus().insertTable({rows:+data.get('rows'),cols:+data.get('cols'),withHeaderRow:true}).run());}
  image(){const d=dialog('图片与来源','<label>图片文件<input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><label>或图片网址<input name="url" type="url" placeholder="https://"></label><label>图注与来源<input name="caption" placeholder="照片说明、收藏机构与编号"></label><label>显示宽度<select name="width"><option>100%</option><option>75%</option><option>50%</option><option>25%</option></select></label><small>本地图片会压缩后随史料保存，单张限 5 MB；不会上传至第三方图床。</small>','插入',async data=>{const file=data.get('file'),caption=data.get('caption'),width=data.get('width');if(file?.size)await this.imageFile(file,caption,width);else{const src=data.get('url');if(!/^https?:\/\//i.test(src))throw Error('请选择图片或填写有效网址');this.editor.chain().focus().setImage({src,alt:caption,caption,width}).run();}});return d;}
  async imageFile(file,caption='',width='100%'){
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>5*1024*1024){window.showAlert?.('请使用不超过 5 MB 的 PNG、JPEG、WebP 或 GIF 图片','error');throw Error('图片格式或大小不符合要求');}
    this.status.textContent='正在处理图片…';
    try {const bitmap=await createImageBitmap(file);const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const src=canvas.toDataURL('image/webp',0.82);this.editor.chain().focus().setImage({src,alt:caption,caption,width}).run();}catch(error){this.status.textContent='图片处理失败，请重新选择';throw error;}
  }
  related(){const list=typeof entries!=='undefined'?entries:[];const options=list.slice(0,500).map(e=>`<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');dialog('关联史料',`<label>选择史料<select name="entry" required>${options}</select></label>`,'插入',data=>{const entry=list.find(e=>e.id===data.get('entry'));if(!entry)throw Error('暂无可关联史料');const u=new URL(location.href);u.searchParams.set('entry',entry.id);this.editor.chain().focus().insertContent(`<a href="${esc(u.href)}">${esc(entry.title)}</a>`).run();});}
  more(){dialog('文字格式','<label>字体<select name="font"><option value="">默认</option><option value="SimSun">宋体</option><option value="KaiTi">楷体</option><option value="Arial">Arial</option><option value="Times New Roman">Times New Roman</option></select></label><label>字号<select name="size"><option value="16px">16</option><option value="18px">18</option><option value="20px">20</option><option value="24px">24</option><option value="32px">32</option></select></label><label>文字颜色<input name="color" type="color" value="#202020"></label><label>对齐<select name="align"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option><option value="justify">两端对齐</option></select></label><label>附加格式<select name="extra"><option value="">无</option><option value="toggleSuperscript">上标</option><option value="toggleSubscript">下标</option><option value="toggleStrike">删除线</option><option value="toggleHighlight">高亮</option><option value="toggleCodeBlock">代码块</option></select></label>','应用',data=>{let chain=this.editor.chain().focus().setFontFamily(data.get('font')).setFontSize(data.get('size')).setColor(data.get('color')).setTextAlign(data.get('align'));if(data.get('extra'))chain=chain[data.get('extra')]();chain.run();});}
  find(){const d=dialog('查找与替换','<label>查找<input name="query" required></label><label>替换为<input name="replacement"></label><p class="ed-match-count" role="status">输入要查找的文字</p><div class="ed-find-actions"></div>','关闭',()=>{});let cursor=-1;const q=d.querySelector('[name="query"]');
    const matches=()=>{const term=q.value,found=[];if(term)this.editor.state.doc.descendants((n,pos)=>{if(n.isText){let start=0,i;while((i=n.text.indexOf(term,start))!==-1){found.push({from:pos+i,to:pos+i+term.length});start=i+term.length;}}});d.querySelector('.ed-match-count').textContent=`找到 ${found.length} 处匹配（逐文本片段匹配）`;return found;};q.oninput=()=>{cursor=-1;matches();};
    d.querySelector('.ed-find-actions').append(this.button('下一处',()=>{const all=matches();if(all.length){cursor=(cursor+1)%all.length;this.editor.commands.setTextSelection(all[cursor]);this.editor.commands.scrollIntoView();}}),this.button('替换当前',()=>{const all=matches();if(!all.length)return;const hit=all[Math.max(0,cursor)%all.length];const text=d.querySelector('[name="replacement"]').value;this.editor.commands.insertContentAt(hit,text?{type:'text',text}:[]);matches();}),this.button('全部替换',()=>{const all=matches();const text=d.querySelector('[name="replacement"]').value;const tr=this.editor.state.tr;all.reverse().forEach(hit=>tr.insertText(text,hit.from,hit.to));this.editor.view.dispatch(tr);cursor=-1;matches();}));
  }
}
window.ResearchEditor=ResearchEditor;
window.ResearchHTML={clean,dialog,escape:esc};
