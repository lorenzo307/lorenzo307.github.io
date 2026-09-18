const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
const server=require('../scripts/serve.cjs').createServer({demo:true});await new Promise(r=>server.listen(8768,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('v2_view_mode','card'));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:8768/database.html?project=demo');await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>currentViewMode),'list','obsolete card preference falls back to list');
 assert.equal(await page.locator('[data-view="card"]').count(),0);
 await page.locator('.ed-view-tabs [data-view="word"]').click();await page.waitForSelector('.word-doc-panel');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
 const metrics=()=>page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();return {header:r('.v2-topbar').height,chrome:r('.v2-workspace-chrome').height,toc:r('.word-toc-panel').width,notes:r('.word-notes-panel').width,doc:r('.word-doc-panel').width,paper:r('.word-doc-paper').height,reader:r('.word-mode').height,footer:getComputedStyle(document.querySelector('.pagination')).display,scroll:document.documentElement.scrollWidth,viewport:innerWidth}});
 let m=await metrics();console.log('DESKTOP',m);await page.screenshot({path:'tests/results/reading-focus-desktop.png',fullPage:true});assert.ok(m.header<=48);assert.ok(m.chrome<100);assert.ok(m.doc>1440*.60);assert.ok(m.paper>650);assert.equal(m.footer,'none');
 await page.screenshot({path:'tests/results/reading-focus-desktop.png',fullPage:true});
 const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.word-toc-item-title'});const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});console.log('CHINESE FONT',fonts);assert.ok(fonts.some(f=>f.isCustomFont&&f.familyName.includes('Source Han')),'Chinese uses embedded Source Han');
 await page.evaluate(()=>{const probe=document.createElement('span');probe.id='font-probe';probe.textContent='Archive 1937 史料';document.querySelector('#word-body').append(probe)});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const latinNode=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#font-probe'});const latinFonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:latinNode.nodeId});console.log('LATIN FONT',latinFonts.fonts);assert.ok(latinFonts.fonts.some(f=>f.familyName==='Arial'&&!f.isCustomFont),'Latin uses neutral sans serif');await page.evaluate(()=>document.querySelector('#font-probe').remove());
 const before=m.doc;await page.locator('[data-reader-panel=toc]').click();await page.locator('[data-reader-panel=notes]').click();await page.waitForTimeout(320);m=await metrics();assert.ok(m.doc>before+250);assert.equal(await page.locator('.word-toc-panel').evaluate(e=>e.inert),true);await page.screenshot({path:'tests/results/reading-focus-wide.png',fullPage:true});
 await page.locator('[data-reader-panel=toc]').click();await page.locator('[data-reader-panel=notes]').click();await page.waitForTimeout(300);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);m=await metrics();console.log('MOBILE',m);assert.ok(m.doc>340);assert.ok(m.paper>450);assert.ok(m.scroll<=390);assert.equal(await page.locator('[data-reader-panel=toc]').getAttribute('aria-expanded'),'false');
 await page.screenshot({path:'tests/results/reading-focus-mobile.png',fullPage:true});
 await page.locator('[data-reader-panel=toc]').click();await page.waitForTimeout(280);assert.equal(await page.locator('.word-toc-panel').evaluate(e=>e.inert),false);await page.locator('.word-toc-item').last().click();await page.waitForTimeout(300);assert.equal(await page.locator('[data-reader-panel=toc]').getAttribute('aria-expanded'),'false');
 await page.locator('[data-reader-panel=notes]').click();await page.waitForTimeout(280);assert.equal(await page.locator('.word-notes-panel').evaluate(e=>e.inert),false);await page.locator('[data-reader-panel=notes]').click();
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.word-mode').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 await page.locator('.ed-view-tabs [data-view=list]').click();assert.equal(await page.locator('.v2-main-scroll>.pagination').isVisible(),true);assert.ok(await page.locator('.v2-main-scroll>.pagination').evaluate(e=>e.getBoundingClientRect().height<=80));
 assert.deepEqual(errors,[]);console.log('PASS: compact reader, collapsible panels, card preference migration, real Chinese font, mobile access and reduced motion.');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
