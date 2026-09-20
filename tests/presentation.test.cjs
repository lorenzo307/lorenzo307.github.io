const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const server=require('../scripts/serve.cjs').createServer({demo:true});await new Promise(resolve=>server.listen(8767,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('tests/results',{recursive:true});
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8767/');await page.waitForTimeout(350);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
  const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,table:document.querySelector('.data-table').getBoundingClientRect().right,brand:document.querySelector('.ui-home-brand').getBoundingClientRect().height}));
  assert.ok(layout.scroll<=width+1,`home overflow at ${width}`);assert.ok(layout.table<=width+1,`table clipped at ${width}`);assert.ok(layout.brand<40,`brand wrapped at ${width}`);
  if(width===1440||width===390)await page.screenshot({path:`tests/results/refined-home-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'切换目录或卡片'}).click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('ed-project-cards')),true);await page.getByRole('button',{name:'切换目录或卡片'}).click();
  await page.goto('http://127.0.0.1:8767/database.html?project=demo');await page.waitForTimeout(450);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`workspace overflow at ${width}`);
  if(width===1440){
   const readable=await page.evaluate(()=>({
    sidebar:document.querySelector('.v2-sidebar').getBoundingClientRect().width,
    navLabel:document.querySelector('.v2-nav-item .ui-button-label')?.getBoundingClientRect().width||0,
    viewLabel:document.querySelector('.ed-view-tabs .ui-button-label')?.getBoundingClientRect().width||0,
    entryLabel:document.querySelector('.entry-actions .ui-button-label')?.getBoundingClientRect().width||0
   }));
   assert.ok(readable.sidebar>=190,'workspace sidebar is too narrow for icon-and-text navigation');
   assert.ok(readable.navLabel>1,'workspace navigation label is not visible');
   assert.ok(readable.viewLabel>1,'workspace view label is not visible');
   assert.ok(readable.entryLabel>1,'entry action label is not visible');
   assert.equal(await page.getByRole('button',{name:'打开导航',exact:true}).count(),0,'duplicate open-navigation button is still present');
  }
  if(width===1440||width===390)await page.screenshot({path:`tests/results/refined-workspace-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('.ed-top-actions').getByRole('button',{name:'新增史料',exact:true}).click();await page.waitForSelector('.tiptap');await page.waitForTimeout(250);
 assert.equal(await page.locator('.ed-editor-toolbar button').first().locator('svg').count(),1);
 await page.getByRole('button',{name:'全屏编辑',exact:true}).click();
 const fullscreen=await page.locator('#entry-form').evaluate(e=>{const r=e.getBoundingClientRect(),form=e.querySelector('form').getBoundingClientRect(),main=e.querySelector('.ed-editor-main').getBoundingClientRect(),editor=e.querySelector('#editor-container').getBoundingClientRect(),relation=e.querySelector('.v2-rel-form-row');return {active:e.classList.contains('ed-fullscreen'),left:r.left,top:r.top,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],meta:getComputedStyle(e.querySelector('.ed-editor-meta')).display,mainWidth:main.width,formWidth:form.width,editorHeight:editor.height,relationDisplay:relation?getComputedStyle(relation).display:null,relationParent:relation?.parentElement.className};});
 assert.equal(fullscreen.active,true);assert.ok(fullscreen.left<1&&fullscreen.top<1);assert.ok(fullscreen.width>=fullscreen.viewport[0]-1&&fullscreen.height>=fullscreen.viewport[1]-1);assert.equal(fullscreen.meta,'none');assert.ok(fullscreen.mainWidth>=fullscreen.formWidth-2,'fullscreen editor does not fill the writing area');assert.ok(fullscreen.editorHeight>200,'fullscreen editor is not visible');assert.equal(fullscreen.relationDisplay,'none');assert.equal(fullscreen.relationParent,'ed-editor-meta');
 assert.equal(await page.getByRole('button',{name:'退出全屏',exact:true}).getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#entry-form').evaluate(e=>e.classList.contains('ed-fullscreen')),false);assert.equal(await page.locator('#entry-form').isVisible(),true);
 await page.screenshot({path:'tests/results/refined-editor-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tests/results/refined-editor-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.querySelector('#entry-form').getBoundingClientRect().right<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('PASS: 360, 390, 768, 1024, 1440 px; visible table bounds, brand, card toggle, workspace, editor icon controls and fullscreen.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
