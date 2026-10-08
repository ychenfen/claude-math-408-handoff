// Run this function with Playwright against a local preview. Uses a fresh browser context.
// These tests mock network routes; service workers are blocked so the offline cache does not bypass the mocks (tests/browser_offline.js covers it).
async (browserPage) => {
  const context=await browserPage.context().browser().newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  const page=await context.newPage(),BASE='http://127.0.0.1:8878',errors=[],external=[];
  const assert=(v,m)=>{if(!v)throw Error(m);};
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('example.invalid'))external.push(r.url());});
  try {
    await page.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const snapshot=await (await page.request.get(BASE+'/assets/data.json')).json();
    const os=snapshot.subjects.find(s=>s.id==='os');
    const co=snapshot.subjects.find(s=>s.id==='co');co.summaries=[];co.examCards=[];// fixture: one subject with no cards at all
    os.examCards=[];// this test walks the five review cards; exam cards are covered in test_exams.py
    os.records[0].text+='\n\n## 图解测试夹具（不是学习记录）\n\n```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 180" onload="window.svgInjected=1"><script>window.svgInjected=1</script><foreignObject><div>unsafe</div></foreignObject><image href="https://example.invalid/pixel"/><rect x="10" y="10" width="680" height="160" fill="#edf2e2"/><text x="40" y="95" font-size="30" fill="#243e31">先回想 → 看参考 → 再验证</text></svg>\n```\n\n```jsx\n<script>window.jsxInjected=1</script>\n```\n';
    await page.route(BASE+'/assets/data.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)}));
    await page.goto(BASE+'/#os/2026-10-05/drill');await page.waitForLoadState('networkidle');
    await page.locator('.recall-answer').waitFor();
    assert(await page.locator('.drill-context').isVisible(),'Question context visible before reveal');
    const contextText=await page.locator('.drill-context').innerText();
    for(const part of ['thread1','thread2','thread3','y = add(y, w)','2017'])assert(contextText.includes(part),'Missing question detail: '+part);
    assert(!contextText.includes('参考要点'),'Answer must not leak into question context');
    assert((await page.locator('.drill-stage .eyebrow').textContent()).startsWith('1 / 5'),'Five OS cards');
    assert(await page.locator('.drill-answer').isHidden(),'Answer must start hidden');
    assert(await page.locator('.drill-rate').isHidden(),'No rating before recall');
    await page.locator('.recall-answer').fill('测试回想：两把锁分别保护两个读者类别。');
    await page.reload();await page.waitForLoadState('networkidle');
    assert((await page.locator('.recall-answer').inputValue()).includes('测试回想'),'Recall note survives reload');
    await page.getByRole('button',{name:'我已回想，查看参考要点'}).click();
    assert(await page.locator('.drill-answer').isVisible(),'Reveal answer');
    await page.locator('.drill-answer img').first().waitFor();
    assert(await page.evaluate(()=>{const i=document.querySelector('.drill-answer img');return i.complete&&i.naturalWidth>0&&/PV-22/.test(decodeURIComponent(i.src));}),'Diagram shown inside the revealed card');
    await page.getByRole('button',{name:/^会了/}).click();
    const state=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('study-drill-v1:os:')).map(([k,v])=>[k,JSON.parse(v)]));
    assert(state.length===1&&state[0][1].rating==='会了','Local rating stored');
    assert(state[0][1].due>Date.now()+0.9*86400000&&state[0][1].due<Date.now()+1.1*86400000,'First success deferred one day');
    assert(await page.evaluate(()=>!Object.keys(localStorage).some(k=>k.endsWith(':reviewed'))),'Rating must not mark evidence reviewed');
    await page.reload();await page.waitForLoadState('networkidle');
    assert((await page.locator('.drill-stage .eyebrow').textContent()).startsWith('1 / 4'),'Not due card excluded');
    await page.locator('.drill-settings > summary').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出本科自测记录'}).click();
    assert((await download).suggestedFilename()==='操作系统-闭卷自测记录.md','Export filename');
    await page.screenshot({path:'/tmp/study-recall-desktop.png',fullPage:false});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile drill overflow');
    await page.screenshot({path:'/tmp/study-recall-mobile.png',fullPage:true});
    await page.locator('[data-subject="ds"]').click();await page.getByRole('tab',{name:'闭卷自测',exact:true}).click();
    await page.locator('.recall-answer').waitFor();
    const dsTotal=Number((await page.locator('.drill-stage .eyebrow').textContent()).match(/^1 \/ (\d+)/)[1]);
    const dsExpected=snapshot.subjects.find(s=>s.id==='ds').summaries.reduce((n,d)=>n+(d.text.match(/^### 自测：/gm)||[]).length,0)+(snapshot.subjects.find(s=>s.id==='ds').examCards||[]).reduce((n,d)=>n+(d.text.match(/^### 自测：/gm)||[]).length,0);
    assert(dsTotal===dsExpected,`DS cards from all its reviews and exams only: ${dsTotal} vs ${dsExpected}`);
    assert(await page.locator('.recall-answer').inputValue()==='','No cross-subject notes');
    // Newest first: the first DS card is whichever source is newest; every card must stand alone.
    assert((await page.locator('.drill-context').innerText()).replace(/\s/g,'').length>40,'DS card shows a standalone question');
    await page.locator('#date').fill('2026-10-05');await page.locator('#date').dispatchEvent('change');
    await page.getByRole('tab',{name:'每日复盘',exact:true}).click();
    assert(await page.locator('.selftest-item .drill-context').count()===3,'Daily review also exposes question context');
    assert(await page.locator('.selftest-item .drill-context').first().isVisible(),'Daily question visible before reveal');
    assert(await page.locator('details.selftest[open]').count()===0,'Daily answers still start hidden');
    assert(await page.locator('details.selftest .answer').first().isHidden(),'Daily answer content hidden');
    await page.locator('[data-subject="linear"]').click();await page.getByRole('tab',{name:'闭卷自测',exact:true}).click();
    await page.locator('.recall-answer').waitFor();
    assert((await page.locator('.drill-stage .eyebrow').textContent()).startsWith('1 / 5'),'Linear algebra recall cards come from its review, not from Q&A redo');
    // Formulas: Markdown must not eat TeX backslashes (matrix rows, braces, spaces).
    await page.goto(BASE+'/#linear/2026-10-05/daily');await page.waitForLoadState('networkidle');
    const tex=await page.evaluate(()=>[...document.querySelectorAll('#content annotation')].map(a=>a.textContent));
    assert(tex.some(t=>t.includes('\\begin{pmatrix}A\\\\B\\end{pmatrix}')),'Matrix row break survives Markdown');
    assert(await page.locator('#content .katex-error').count()===0,'No KaTeX errors');
    await page.locator('[data-subject="co"]').click();await page.getByRole('tab',{name:'闭卷自测',exact:true}).click();
    assert((await page.locator('.drill-stage').textContent()).includes('还没有复习卡'),'Honest empty state');
    await page.goto(BASE+'/#all');await page.waitForLoadState('networkidle');await page.locator('.review-today').waitFor();
    assert(await page.locator('.rt-item').count()===6,'Today panel lists six subjects');
    assert((await page.locator('.rt-item[data-drill="os"]').textContent()).includes('新'),'Today panel counts recall cards');
    await page.locator('.rt-item[data-drill="os"]').click();await page.locator('.recall-answer').waitFor();
    assert((await page.locator('#subject-title').textContent())==='操作系统','Today panel opens that subject drill');
    await page.locator('[data-subject="os"]').click();await page.getByRole('tab',{name:'当天问答',exact:true}).click();
    await page.locator('.study-figure img').waitFor();
    await page.waitForFunction(()=>document.querySelector('.study-figure img').naturalWidth>0);
    const svg=await page.locator('.study-figure img').getAttribute('src');
    assert(!/script|foreignObject|onload|example.invalid/.test(decodeURIComponent(svg)),'SVG unsafe content retained');
    assert(await page.locator('.source-only').count()===1,'JSX source collapsed');
    assert(await page.evaluate(()=>!window.svgInjected&&!window.jsxInjected),'Source executed');
    await page.locator('.study-figure .figure-zoom').click();
    assert(await page.locator('dialog[open]').count()===1,'Lightbox opens');
    await page.screenshot({path:'/tmp/study-svg-mobile.png',fullPage:false});
    await page.keyboard.press('Escape');assert(await page.locator('dialog[open]').count()===0,'Esc closes lightbox');
    assert(external.length===0,'SVG requested external resource');
    assert(errors.length===0,'Page errors: '+errors.join(','));
    return {status:'PASS',checks:['today panel','recall before reveal','persistence','due date','subject isolation','empty state','export','mobile','SVG render and sanitize','no script execution','lightbox','no evidence promotion']};
  } finally {await context.close();}
}
