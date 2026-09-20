const {chromium}=require('playwright');
const fs=require('fs');
fs.mkdirSync('tests/results',{recursive:true});
const assert=require('node:assert/strict');
(async()=>{
const server=require('../scripts/serve.cjs').createServer();await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.fulfill({status:200,body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'application/javascript'}));
await context.addInitScript(()=>{
 const sample={id:'19370707-01',title:'卢沟桥事变：报刊记载与地方档案',date:'1937-07-07',content:'<h2>史料摘录</h2><p>历史研究始于对材料的细读。报刊记录呈现了事件发生时的社会视角，也留下了值得追问的空白。</p><blockquote><p>比较不同来源，才能理解同一事件的多重面貌。</p></blockquote><p><strong>材料说明：</strong>这里是用于界面验证的示例内容，并非真实史料。</p>',analysis:'<p>比较报刊与档案的叙述差异，关注时间、地域与作者立场。</p>',keywords:['近代史','报刊','社会记忆'],typeId:'general',metadata:{author:'研究示例'},createdAt:1700000000000,updatedAt:1700000000000,events:[{id:'ev1',date:'1937-07-07',description:'示例事件：史料记载的时间节点'}],comments:{}};
 const second={...sample,id:'19380000-02',title:'城市空间与日常生活的变迁',date:'1938',keywords:['城市史','日常生活'],events:[{id:'ev2',date:'1938-01-01',description:'研究线索：城市社会的变化'}]};
 const third={...sample,id:'19390000-03',title:'地方文献中的社会网络',date:'约1939',keywords:['地方志','社会网络'],events:[]};
 const store={users:{test:{profile:{displayName:'研究者'},projects:{demo:{id:'demo',name:'近代中国的社会与记忆',description:'从报刊、档案与地方文献出发，探索历史的多重叙述。',createdAt:1700000000000,updatedAt:Date.now(),entries:{[sample.id]:sample,[second.id]:second,[third.id]:third}}}}}};
 const callbacks=[];const clone=x=>x===undefined?null:JSON.parse(JSON.stringify(x));
 const parts=p=>p.split('/').filter(Boolean);const get=p=>parts(p).reduce((o,k)=>o?.[k],store)??null;
 function set(p,v){const path=parts(p);let o=store;path.slice(0,-1).forEach(k=>{if(!o[k])o[k]={};o=o[k];});if(v===null)delete o[path.at(-1)];else o[path.at(-1)]=clone(v);callbacks.forEach(c=>{if(p.startsWith(c.p)||c.p.startsWith(p))setTimeout(()=>c.fn(snap(get(c.p))),0);});}
 const snap=v=>({val:()=>clone(v),exists:()=>v!==null,numChildren:()=>Object.keys(v||{}).length,forEach:fn=>Object.entries(v||{}).forEach(([key,value])=>fn({...snap(value),key}))});
 function ref(p=''){return {key:parts(p).at(-1),child:k=>ref(p+'/'+k),once:async()=>snap(get(p)),get:async()=>snap(get(p)),on:(ev,fn)=>{callbacks.push({p,fn});setTimeout(()=>fn(snap(get(p))),25);return fn;},off:()=>{},set:async v=>set(p,v),update:async patch=>Object.entries(patch).forEach(([k,v])=>set(p+'/'+k,v)),remove:async()=>set(p,null),transaction:async fn=>{const v=fn(clone(get(p)));if(v===undefined)return{committed:false,snapshot:snap(get(p))};set(p,v);return{committed:true,snapshot:snap(v)};},orderByKey(){return this},orderByChild(){return this},startAt(){return this},endAt(){return this},limitToLast(){return this},push:()=>ref(p+'/'+Math.random().toString(36).slice(2))};}
 const user={uid:'test',displayName:'研究者',email:'research@example.test',emailVerified:true};const auth={currentUser:user,onAuthStateChanged:fn=>{setTimeout(()=>fn(user),20);return()=>{};},signOut:async()=>{}};const db={ref};function database(){return db}database.ServerValue={TIMESTAMP:Date.now()};window.firebase={apps:[],initializeApp(){this.apps.push({});return{};},app:()=>({}),auth:()=>auth,database};window.__test={store,ref};
 localStorage.setItem('currentProject','demo');window.confirm=()=>false;
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
await page.goto('http://127.0.0.1:8765/database.html?project=demo');await page.waitForTimeout(1700);

try {
await page.locator('.ed-view-tabs button[data-view="word"]').click();
await page.evaluate(()=>V2Word.setActiveEntry('19370707-01'));await page.waitForTimeout(250);
// Add a comment using the reading view selection toolbar.
await page.evaluate(()=>{const body=document.querySelector('#word-body'),text=body.querySelector('p').firstChild;const r=document.createRange();r.setStart(text,0);r.setEnd(text,4);const s=getSelection();s.removeAllRanges();s.addRange(r);body.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:500,clientY:300}));});
await page.locator('#word-add-comment-btn').click();await page.locator('#word-new-text').fill('阅读视图创建的批注');await page.locator('#word-new-save').click();await page.waitForTimeout(200);
assert.equal(await page.locator('#word-body [data-comment-marker]').count(),1);
await page.evaluate(()=>editEntry('19370707-01'));await page.waitForTimeout(300);
assert.equal(await page.locator('#editor-container .ed-comment-marker').count(),1);
await page.locator('#editor-container .ed-comment-marker').click();
assert.equal(await page.locator('dialog textarea[name="text"]').inputValue(),'阅读视图创建的批注');
await page.locator('dialog textarea[name="reply"]').fill('编辑区回复阅读批注');await page.locator('dialog button[type="submit"]').click();
// Add an analysis comment and retain it in an offline draft.
await page.evaluate(()=>analysisQuill.editor.commands.setTextSelection({from:1,to:5}));
await page.locator('#analysis-editor-container .ed-editor-toolbar').getByRole('button',{name:'添加批注',exact:true}).click();await page.locator('dialog textarea[name="text"]').fill('分析部分专属批注');await page.locator('dialog button[type="submit"]').click();
assert.equal(await page.locator('#analysis-editor-container .ed-comment-marker').count(),1);
await page.locator('#editor-container').getByRole('button',{name:'字体颜色',exact:true}).click();
assert.equal(await page.locator('.ed-color-swatch').first().innerText(),'');assert.equal(await page.locator('.ed-color-swatch').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(32, 32, 32)');
await page.screenshot({path:'tests/results/color-swatches.png',fullPage:true});assert.equal(await page.locator('dialog[open]').count(),0);
const geometry=await page.evaluate(()=>{const a=document.querySelector('#editor-container button[aria-label="字体颜色"]').getBoundingClientRect(),b=document.querySelector('.ed-color-popover').getBoundingClientRect();return {bottom:a.bottom,top:b.top,left:b.left,right:b.right};});assert.ok(Math.abs(geometry.top-geometry.bottom-8)<2);assert.ok(geometry.right<=1440);
await page.keyboard.press('Escape');assert.equal(await page.locator('.ed-color-popover').count(),0);assert.equal(await page.locator('#entry-form').isVisible(),true);
await page.evaluate(()=>quill.editor.commands.setTextSelection({from:1,to:5}));
await page.locator('#editor-container').getByRole('button',{name:'字体颜色',exact:true}).click();await page.locator('.ed-color-popover').getByRole('button',{name:'深红',exact:true}).click();
assert.equal(await page.locator('.ed-color-popover').count(),0);assert.equal(await page.evaluate(()=>quill.editor.getAttributes('textStyle').color),'#9b3434');
await page.locator('#editor-container').getByRole('button',{name:'高亮设置',exact:true}).click();await page.locator('.ed-color-popover').getByRole('button',{name:'浅绿',exact:true}).click();assert.equal(await page.evaluate(()=>quill.editor.getAttributes('highlight').color),'#ccebd6');
await page.locator('#editor-container').getByRole('button',{name:'高亮设置',exact:true}).click();await page.locator('.ed-color-popover input[type=color]').fill('#123456');assert.equal(await page.evaluate(()=>quill.editor.getAttributes('highlight').color),'#123456');
await page.locator('#editor-container').getByRole('button',{name:'高亮设置',exact:true}).click();await page.locator('.ed-color-popover').getByRole('button',{name:'清除高亮',exact:true}).click();assert.equal(await page.evaluate(()=>quill.editor.isActive('highlight')),false);
await page.locator('#editor-container').getByRole('button',{name:'字体颜色',exact:true}).click();await page.locator('#entry-form [name=title]').click();assert.equal(await page.locator('.ed-color-popover').count(),0);

assert.equal(await page.locator('#editor-container .ed-editor-toolbar button[aria-label="字体颜色"] svg').count(),1);
assert.equal(await page.locator('#editor-container .ed-editor-toolbar button[aria-label="高亮设置"] svg').count(),1);
assert.equal(await page.locator('#editor-container .ed-editor-toolbar button[aria-label="添加批注"] svg').count(),1);
await context.setOffline(true);await page.evaluate(()=>ResearchWorkspace.persistLocal());await page.evaluate(()=>hideForm());await context.setOffline(false);await page.waitForTimeout(250);
await page.getByRole('button',{name:'本机恢复草稿',exact:true}).click();await page.locator('.ed-version').getByRole('button',{name:'恢复',exact:true}).click();await page.waitForTimeout(350);
assert.equal(await page.locator('#analysis-editor-container .ed-comment-marker').count(),1);
await page.locator('#entry-form button[type="submit"]').click();await page.waitForTimeout(350);
await page.evaluate(()=>V2Word.setActiveEntry('19370707-01'));await page.waitForTimeout(200);
assert.ok(await page.locator('#word-notes-list').innerText().then(t=>t.includes('分析部分专属批注')&&t.includes('编辑区回复阅读批注')));
assert.equal(await page.locator('.word-analysis [data-comment-marker]').count(),1);
await page.locator('.word-analysis [data-comment-marker]').click();
assert.equal(await page.locator('.word-note.active .word-note-text').innerText(),'分析部分专属批注');
const cid=await page.locator('.word-note.active').getAttribute('data-cid');
await page.evaluate(id=>V2Word.toggleResolve(id),cid);await page.waitForTimeout(150);
await page.evaluate(()=>editEntry('19370707-01'));await page.waitForTimeout(250);
await page.locator('#analysis-editor-container .ed-comment-marker').click();assert.ok(await page.locator('.ed-comment-context').innerText().then(t=>t.includes('已解决')));
await page.getByRole('button',{name:'重新打开',exact:true}).click();
await page.locator('#analysis-editor-container .ed-comment-marker').click();await page.getByRole('button',{name:'删除批注',exact:true}).click();
assert.equal(await page.locator('#analysis-editor-container .ed-comment-marker').count(),0);
await page.locator('#entry-form button[type="submit"]').click();await page.waitForTimeout(300);
assert.equal(await page.evaluate(id=>V2Comments.commentsOf(entries.find(e=>e.id==='19370707-01')).some(c=>c.id===id),cid),false);
// Legacy inline annotations migrate to the shared thread store without losing their text.
await page.evaluate(async()=>{await db.ref(getProjectPath('entries/19380000-02/content')).set('<p>旧材料<span data-note="旧注释说明" data-note-kind="研究者注">旧注释说明</span></p>');});await page.waitForTimeout(100);
await page.evaluate(()=>editEntry('19380000-02'));await page.waitForTimeout(250);
await page.locator('#editor-container [data-note]').click();assert.equal(await page.locator('dialog textarea[name="text"]').inputValue(),'旧注释说明');
await page.locator('dialog textarea[name="reply"]').fill('旧批注也可以回复');await page.locator('dialog button[type="submit"]').click();
await page.locator('#entry-form button[type="submit"]').click();await page.waitForTimeout(250);
await page.evaluate(()=>V2Word.setActiveEntry('19380000-02'));await page.waitForTimeout(200);
assert.ok(await page.locator('#word-notes-list').innerText().then(t=>t.includes('旧注释说明')&&t.includes('旧批注也可以回复')));
await page.evaluate(()=>editEntry('19380000-02'));await page.waitForTimeout(250);await page.locator('#editor-container [data-note]').click();await page.getByRole('button',{name:'删除批注',exact:true}).click();assert.equal(await page.locator('#editor-container [data-note]').count(),0);
await page.evaluate(()=>hideForm());
assert.deepEqual(errors,[]);console.log('PASS: reader-created thread, analysis anchors, reply sync, offline draft recovery, resolve/delete sync, SVG icons and color swatches.');
} finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});

