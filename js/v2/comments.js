/** Shared comment threads. Editor changes are staged with drafts and merged on entry save. */
(function(global){
'use strict';
const COLORS=['yellow','green','blue','pink','orange'];
const clone=value=>JSON.parse(JSON.stringify(value??{}));
const uid=()=> 'c_'+crypto.randomUUID().replace(/-/g,'');
const getAuthorName=()=>{let saved='';try{saved=localStorage.getItem('v2_author_name')?.trim();}catch{}return saved||global.auth?.currentUser?.displayName||global.auth?.currentUser?.email?.split('@')[0]||'研究者';};
const setAuthorName=name=>localStorage.setItem('v2_author_name',(name||'').trim());
const getAuthorUid=()=>global.auth?.currentUser?.uid||'local';
function normalize(raw){return Object.entries(raw||{}).filter(([,c])=>c).map(([id,c])=>({...clone(c),id:c.id||id,replies:Object.entries(c.replies||{}).filter(([,r])=>r).map(([rid,r])=>({...r,id:r.id||rid})).sort((a,b)=>a.createdAt-b.createdAt)})).sort((a,b)=>a.createdAt-b.createdAt);}
function mapOf(raw){return Object.fromEntries(normalize(raw).map(c=>[c.id,{...c,replies:Object.fromEntries(c.replies.map(r=>[r.id,r]))}]));}
function commentsOf(entry){return normalize(entry?.comments);}
function applyChanges(raw,changes){const map=mapOf(raw);for(const op of changes||[]){if(op.type==='add'){if(!map[op.comment.id])map[op.comment.id]=clone(op.comment);continue;}const c=map[op.id];if(!c)continue;if(op.type==='delete')delete map[op.id];else if(op.type==='patch')Object.assign(c,op.patch);else if(op.type==='reply'){c.replies=c.replies||{};c.replies[op.reply.id]=clone(op.reply);}else if(op.type==='deleteReply')delete c.replies?.[op.replyId];}return map;}
function comment(payload){if(!payload.text?.trim())throw Error('请输入批注内容');return {id:uid(),authorName:getAuthorName(),authorUid:getAuthorUid(),text:payload.text.trim(),quote:payload.quote||'',section:payload.section==='analysis'?'analysis':'content',startOffset:payload.startOffset??null,endOffset:payload.endOffset??null,color:COLORS.includes(payload.color)?payload.color:'yellow',resolved:false,collapsed:false,createdAt:Date.now(),updatedAt:Date.now(),replies:{}};}
function reply(text){if(!text?.trim())throw Error('请输入回复');return {id:uid(),authorName:getAuthorName(),authorUid:getAuthorUid(),text:text.trim(),createdAt:Date.now()};}
async function commit(entryId,op){const ref=db.ref(getProjectPath('entries/'+entryId));const result=await ref.transaction(current=>{if(!current)return;return {...current,comments:applyChanges(current.comments,[op])};},undefined,false);if(!result.committed)throw Error('条目不存在，批注未保存');const entry=entries.find(e=>e.id===entryId);if(entry)entry.comments=result.snapshot.val().comments;document.dispatchEvent(new CustomEvent('research-comments-changed'));}
async function addComment(id,payload){const c=comment(payload);await commit(id,{type:'add',comment:c});return c;}
async function updateComment(id,cid,patch){if('text' in patch&&!patch.text.trim())throw Error('批注不能为空');await commit(id,{type:'patch',id:cid,patch:{...patch,updatedAt:Date.now()}});}
async function deleteComment(id,cid){await commit(id,{type:'delete',id:cid});}
async function addReply(id,cid,text){const r=reply(text);await commit(id,{type:'reply',id:cid,reply:r});return r;}
async function deleteReply(id,cid,rid){await commit(id,{type:'deleteReply',id:cid,replyId:rid});}
let session={id:null,base:{},changes:[]};
function begin(data={}){session={id:data.id||null,base:mapOf(data.comments),changes:clone(data.commentChanges||[])};notify(false);}
function editorComments(){const latest=session.id&&typeof entries!=='undefined'?entries.find(e=>e.id===session.id):null;return normalize(applyChanges(latest?latest.comments:session.base,session.changes));}
function notify(dirty=true){document.dispatchEvent(new CustomEvent('research-comments-changed'));if(dirty)global.ResearchWorkspace?.changed();}
function stage(op){session.changes.push(op);if(op.type==='delete'){for(const instance of [typeof quill!=='undefined'?quill:null,global.analysisQuill]){if(!instance?.editor)continue;const hits=[];instance.editor.state.doc.descendants((n,pos)=>{if(n.type.name==='researchNote'&&n.attrs.commentId===op.id)hits.push({pos,size:n.nodeSize});});if(hits.length){const tr=instance.editor.state.tr;hits.reverse().forEach(h=>tr.delete(h.pos,h.pos+h.size));instance.editor.view.dispatch(tr);}}}notify();}
function editorAdd(payload){const c=comment(payload);stage({type:'add',comment:c});return c;}
function editorPatch(id,patch){if('text' in patch&&!patch.text.trim())throw Error('请输入批注内容');stage({type:'patch',id,patch:{...patch,updatedAt:Date.now()}});}
function editorReply(id,text){stage({type:'reply',id,reply:reply(text)});}
function changes(){return clone(session.changes);}
function locate(c,plain){if(!c.quote)return null;let start=c.startOffset,end=c.endOffset;if(start==null||end==null||plain.slice(start,end)!==c.quote){start=plain.indexOf(c.quote);if(start<0||plain.indexOf(c.quote,start+1)!==-1)return null;end=start+c.quote.length;}return {start,end};}
function importHTML(html,section){const doc=new DOMParser().parseFromString(html||'','text/html');doc.querySelectorAll('[data-note]').forEach((el,i)=>{let id=el.dataset.commentId;if(id&&!editorComments().some(c=>c.id===id)){el.remove();return;}if(!id){let hash=2166136261;for(const ch of section+':'+i+':'+el.dataset.note)hash=Math.imul(hash^ch.charCodeAt(0),16777619);id='legacy_'+(hash>>>0).toString(36);el.dataset.commentId=id;if(!editorComments().some(c=>c.id===id)){const c=comment({text:el.dataset.note||'原有批注',section});c.id=id;session.changes.push({type:'add',comment:c});}}});return doc.body.innerHTML;}
function openThread(id){const c=editorComments().find(c=>c.id===id);if(!c)return;const {dialog,escape:esc}=ResearchHTML;
const d=dialog('批注',`<p class="ed-comment-context">${esc(c.section==='analysis'?'研究分析':'原文摘抄')} · ${esc(c.authorName)}${c.resolved?' · 已解决':''}</p>${c.quote?'<blockquote>'+esc(c.quote)+'</blockquote>':''}<label>批注内容<textarea name="text" required rows="3">${esc(c.text)}</textarea></label><div class="ed-comment-replies">${c.replies.map(r=>'<div><strong>'+esc(r.authorName)+'</strong><p>'+esc(r.text)+'</p><button type="button" data-remove-reply="'+esc(r.id)+'">删除回复</button></div>').join('')||'<p>暂无回复</p>'}</div><label>添加回复<textarea name="reply" rows="2" placeholder="写下回复…"></textarea></label><div class="ed-comment-actions"></div><small>批注和回复随史料保存，与阅读视图同步。</small>`,'保存批注',data=>{editorPatch(id,{text:data.get('text').trim()});if(data.get('reply').trim())editorReply(id,data.get('reply'));});
const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;};
d.querySelector('.ed-comment-actions').append(button(c.resolved?'重新打开':'标为已解决',()=>{editorPatch(id,{resolved:!c.resolved});d.close();}),button('删除批注',()=>{stage({type:'delete',id});d.close();}));
d.querySelectorAll('[data-remove-reply]').forEach(b=>b.onclick=()=>{stage({type:'deleteReply',id,replyId:b.dataset.removeReply});b.parentElement.remove();});
}
function showList(section){const {dialog,escape:esc}=ResearchHTML;const list=editorComments().filter(c=>(c.section||'content')===section);const d=dialog('全部批注','<div class="ed-thread-list"></div>','关闭',()=>{});const box=d.querySelector('.ed-thread-list');if(!list.length)box.textContent='暂无批注，选中文字后可添加。';list.forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=(c.resolved?'✓ ':'')+c.text+' · '+c.replies.length+' 条回复';b.onclick=()=>{d.close();openThread(c.id);};box.append(b);});}
global.V2Comments={COLORS,getAuthorName,setAuthorName,commentsOf,addComment,updateComment,deleteComment,addReply,deleteReply,applyChanges,begin,editorComments,editorAdd,editorPatch,editorReply,changes,locate,importHTML,openThread,showList};
})(window);
