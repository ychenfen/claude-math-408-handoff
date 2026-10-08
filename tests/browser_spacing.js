// Fresh context and simulated clock: no ten-minute/day-long waits and no personal storage mutations.
async (browserPage) => {
  const context=await browserPage.context().browser().newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  const page=await context.newPage(),BASE='http://127.0.0.1:8878',errors=[];
  const assert=(v,m)=>{if(!v)throw Error(m);};
  page.on('pageerror',e=>errors.push(e.message));
  try {
    const data=await (await page.request.get(BASE+'/assets/data.json')).json();
    const os=data.subjects.find(s=>s.id==='os');
    os.summaries=[{...os.summaries[0],text:'# 测试夹具，不是真实学习记录\n\n### 自测：示例条件改变后，还能直接套公式吗？\n\n**参考要点**：先核对适用条件。\n'}];
    await page.route(BASE+'/assets/data.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
    await page.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.clock.install({time:new Date('2026-10-07T02:00:00Z')});
    await page.goto(BASE+'/#os/2026-10-05/drill');await page.waitForLoadState('networkidle');
    const reveal=()=>page.getByRole('button',{name:'我已回想，查看参考要点'}).click();
    const record=()=>page.evaluate(()=>JSON.parse(Object.entries(localStorage).find(([k])=>k.startsWith('study-drill-v1:os:'))[1]));
    await page.locator('.recall-answer').fill('我的测试回想，刷新后不能丢');await reveal();
    await page.getByRole('button',{name:/^不会/}).click();
    assert(await page.locator('.recall-answer').count()===0,'Forgotten must not repeat immediately');
    assert((await record()).level===0,'Forgotten resets stage');
    await page.clock.fastForward(9*60000);assert(await page.locator('.recall-answer').count()===0,'Not due yet');
    await page.clock.fastForward(2*60000);await page.locator('.recall-answer').waitFor();
    assert((await page.locator('.recall-answer').inputValue()).includes('不能丢'),'Automatic reappearance preserves note');
    await reveal();await page.getByRole('button',{name:/^会了/}).click();
    const first=await record();assert(first.level===1,'First due success');
    await page.reload();await page.waitForLoadState('networkidle');
    assert(await page.locator('.recall-answer').count()===0,'Future schedule survives reload');
    await page.getByRole('button',{name:'不等到期，练全部'}).click();await reveal();
    assert((await page.getByRole('button',{name:/^会了/}).textContent()).includes('保留原到期'),'Early-practice explanation');
    await page.getByRole('button',{name:/^会了/}).click();
    const early=await record();assert(early.due===first.due&&early.level===1,'Early success cannot fast-forward memory');
    await page.clock.fastForward(86400000+30000);await page.locator('.recall-answer').waitFor();
    await reveal();assert((await page.getByRole('button',{name:/^会了/}).textContent()).includes('3天后'),'Next interval grows');
    await page.getByRole('button',{name:/^会了/}).click();assert((await record()).level===2,'Second due success progresses');
    await page.getByRole('button',{name:'不等到期，练全部'}).click();await reveal();
    await page.screenshot({path:'/tmp/study-spacing-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
    await page.screenshot({path:'/tmp/study-spacing-mobile.png',fullPage:true});
    await page.getByRole('button',{name:/^模糊/}).click();assert((await record()).level===1,'Uncertain steps back');
    assert(errors.length===0,'Errors: '+errors.join(','));
    return {status:'PASS',checks:['10-minute automatic return','reload persistence','due success grows','early practice protected','uncertain shortens','mobile','notes preserved']};
  } finally {await context.close();}
}
